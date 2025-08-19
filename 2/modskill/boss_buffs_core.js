(function (global) {
  const MULT_KEYS = new Set([
    "atkMul", "defMul", "shieldMul", "speedMul", "critDmgMul"
  ]);
  const ADD_KEYS = new Set([
    "atkAdd", "defAdd", "critRate", "lifestealPct", "regenPct", "dmgReductionPct", "reflectPct", "accuracy", "evasion"
  ]);
  const FLAG_KEYS = new Set([
    "stanceFortify"
  ]);

  function ensureStores(mon) {
    mon.buffState = mon.buffState || {};
    mon.buffState.buffs = mon.buffState.buffs || {};
    mon.skillCooldowns = mon.skillCooldowns || {};
  }

  function aggregateBuffs(mon) {
    ensureStores(mon);
    const buffs = mon.buffState.buffs;
    const acc = {
      atkMul: 1, defMul: 1, shieldMul: 1,
      atkAdd: 0, defAdd: 0,
      critRate: 0, critDmgMul: 1,
      lifestealPct: 0, regenPct: 0,
      dmgReductionPct: 0, reflectPct: 0,
      speedMul: 1, accuracy: 0, evasion: 0,
      stanceFortify: false
    };

    for (const key in buffs) {
      const b = buffs[key];
      if (!b || b.turns <= 0) continue;
      const v = Number(b.value || 0);
      if (MULT_KEYS.has(key)) {
        acc[key] *= (v || 1);
      } else if (ADD_KEYS.has(key)) {
        acc[key] += (v || 0);
      } else if (FLAG_KEYS.has(key)) {
        acc[key] = !!v || true;
      } else {
        if (b.mode === "mul") acc[key] = (acc[key] ?? 1) * (v || 1);
        else if (b.mode === "add") acc[key] = (acc[key] ?? 0) + (v || 0);
        else if (b.mode === "flag") acc[key] = !!v || true;
      }
    }
    return acc;
  }

  const Core = {
    init(mon) {
      if (!mon) return;
      if (mon.baseAtk == null) mon.baseAtk = mon.atk;
      if (mon.naturalDef == null) mon.naturalDef = mon.def;
      ensureStores(mon);

      // 兼容：ATK buff 顯示
      mon._enragedTurns = mon._enragedTurns || 0;
      mon._enrageMul = mon._enrageMul || 1;
      // 兼容：護盾顯示
      mon._rootShieldTurns = mon._rootShieldTurns || 0;
      mon._shieldMul = mon._shieldMul || 1;
      // ✅ 新增：專屬 DEF buff 顯示
      mon._defBuffTurns = mon._defBuffTurns || 0;
      mon._defMulForUi = mon._defMulForUi || 1;

      Core._applyPanel(mon);
    },

    addBuff(mon, key, opt = {}) {
      if (!mon || !key) return;
      ensureStores(mon);
      const bmap = mon.buffState.buffs;
      const mode = opt.mode || (MULT_KEYS.has(key) ? "mul" : ADD_KEYS.has(key) ? "add" : (FLAG_KEYS.has(key) ? "flag" : "add"));
      const value = (mode === "flag") ? true : Number(opt.value ?? 0);
      const duration = Math.max(0, Math.floor(opt.duration || 0));
      const stacking = opt.stacking || "refresh";
      const maxStacks = Math.max(1, Math.floor(opt.maxStacks || 99));

      const cur = bmap[key];
      if (!cur) {
        bmap[key] = { mode, value, turns: duration, stacks: 1, stacking };
      } else {
        if (stacking === "stack") {
          cur.stacks = Math.min(maxStacks, (cur.stacks || 1) + 1);
          if (mode === "mul") cur.value = Number(cur.value || 1) * Number(value || 1);
          else if (mode === "add") cur.value = Number(cur.value || 0) + Number(value || 0);
          else if (mode === "flag") cur.value = true;
          cur.turns = Math.max(cur.turns || 0, duration);
        } else {
          cur.mode = mode;
          cur.value = value;
          cur.turns = duration;
          cur.stacks = 1;
          cur.stacking = "refresh";
        }
      }
      Core._applyPanel(mon); // ✅ 簡化：將所有 UI 更新移到這裡
    },

    removeBuff(mon, key) {
      if (!mon || !key) return;
      ensureStores(mon);
      delete mon.buffState.buffs[key];
      Core._applyPanel(mon); // ✅ 簡化：將所有 UI 更新移到這裡
    },

    getBuffTurns(mon, key) {
      if (!mon) return 0;
      ensureStores(mon);
      if (key === "atk") return mon.buffState?.buffs?.atkMul?.turns || 0;
      if (key === "def") return mon.buffState?.buffs?.defMul?.turns || 0;
      if (key === "shield") return mon.buffState?.buffs?.shieldMul?.turns || 0;
      return mon.buffState?.buffs?.[key]?.turns || 0;
    },

    getBuffValue(mon, key) {
      if (!mon) return 0;
      ensureStores(mon);
      return mon.buffState?.buffs?.[key]?.value ?? 0;
    },

    getStat(mon, key) {
      if (!mon) return 0;
      const acc = aggregateBuffs(mon);
      return acc[key] ?? 0;
    },

    applyFromSkill(mon, payload) {
      if (!mon || !payload) return { ok: false, reason: "no-data" };
      if (payload.atk) {
        const { mul, add, duration } = payload.atk;
        if (mul && duration > 0 && this.getBuffTurns(mon, "atk") <= 0) {
          this.addBuff(mon, "atkMul", { mode: "mul", value: Number(mul), duration: Math.floor(duration) });
        }
        if (add) this.addBuff(mon, "atkAdd", { mode: "add", value: Number(add), duration: Math.floor(duration || 0) });
      }
      if (payload.def) {
        const { mul, add, duration } = payload.def;
        if (mul && duration > 0 && this.getBuffTurns(mon, "def") <= 0) {
          this.addBuff(mon, "defMul", { mode: "mul", value: Number(mul), duration: Math.floor(duration) });
        }
        if (add) this.addBuff(mon, "defAdd", { mode: "add", value: Number(add), duration: Math.floor(duration || 0) });
      }

      const list = Array.isArray(payload.buffs) ? payload.buffs : (payload.buffs ? [payload.buffs] : []);
      for (const b of list) {
        if (!b || !b.key) continue;
        this.addBuff(mon, b.key, b);
      }

      this._applyPanel(mon);
      return { ok: true };
    },

    setSkillCooldown(mon, skillKey, turns) {
      if (!mon || !skillKey) return;
      ensureStores(mon);
      mon.skillCooldowns[skillKey] = Math.max(0, Math.floor(turns));
    },

    getSkillCooldown(mon, skillKey) {
      if (!mon) return 0;
      return mon.skillCooldowns ? (mon.skillCooldowns[skillKey] || 0) : 0;
    },

    endTurn(mon) {
      if (!mon) return;
      ensureStores(mon);
      for (const key in mon.buffState.buffs) {
        const b = mon.buffState.buffs[key];
        if (!b) continue;
        if ((b.turns || 0) > 0) {
          b.turns--;
        }
        if ((b.turns || 0) <= 0) {
          delete mon.buffState.buffs[key];
        }
      }

      for (const k in mon.skillCooldowns) {
        if (mon.skillCooldowns[k] > 0) mon.skillCooldowns[k]--;
      }

      Core._applyPanel(mon); // ✅ 簡化：將所有 UI 更新移到這裡
    },

    _applyPanel(mon) {
      const acc = aggregateBuffs(mon);

      const atkBase = mon.baseAtk ?? mon.atk;
      const defBase = mon.naturalDef ?? mon.def;

      // ✅ 修正：獨立取得攻擊、防禦、護盾的倍率
      const atkMul = acc.atkMul || 1;
      const defMul = acc.defMul || 1;
      const shieldMul = acc.shieldMul || 1;

      mon.atk = Math.round(atkBase * atkMul + (acc.atkAdd || 0));
      // ✅ 修正：最終防禦值 = 基礎防禦 * 防禦增益 * 護盾增益
      mon.def = Math.round(defBase * defMul * shieldMul + (acc.defAdd || 0));

      // ✅ 修正：明確更新 UI 顯示欄位
      mon._enrageMul = atkMul;
      mon._enragedTurns = this.getBuffTurns(mon, "atk");
      
      mon._defMulForUi = defMul;
      mon._defBuffTurns = this.getBuffTurns(mon, "def");
      
      mon._shieldMul = shieldMul;
      mon._rootShieldTurns = this.getBuffTurns(mon, "shield");
    }
  };

  global.BossCore = Core;
})(window);
