// 📦 monster_utils.js（完整修正版）
// 目標：Boss 遭遇 + 難度倍率（屬性吃難度；EXP/GOLD 在 getDrop 時乘）+ 杜絕 NaN
// 另外支援：重新套用地圖設定、getDrop 讀取「當前最新地圖掉落表」

;(function () {
  // ---------- 小工具 ----------
  function getRandomInt(min, max) {
    min = Number(min); max = Number(max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  const toInt = (n) => {
    n = Number(n);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n + Number.EPSILON));
  };

  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

  // 將難度表正規化成數值，避免 NaN
  function normalizeDifficulty(raw) {
    const d = isObj(raw) ? raw : {};
    const num = (x, def = 1) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : def;
    };
    return {
      hp:          num(d.hp, 1),
      atk:         num(d.atk, 1),
      def:         num(d.def, 1),
      gold:        num(d.gold, 1),
      stone:       num(d.stone, 1),
      item:        num(d.item, 1),
      exp:         num(d.exp, 1),
      eliteChance: num(d.eliteChance, 0.05),
      // 保留其他鍵不處理
    };
  }

  // 若 hp/atk/def 未提供，就用通用 stats/stat 當後備倍率
  function resolveStatDifficulty(raw) {
    const d = normalizeDifficulty(raw);
    const generic = Number((raw && (raw.stats ?? raw.stat))) || 1;
    return {
      ...d,
      hp:  Number.isFinite(d.hp)  && d.hp  !== 1 ? d.hp  : generic,
      atk: Number.isFinite(d.atk) && d.atk !== 1 ? d.atk : generic,
      def: Number.isFinite(d.def) && d.def !== 1 ? d.def : generic,
    };
  }

  // 確保 dropRates 至少具有可用結構
  function normalizeDropRates(dr) {
    const out = isObj(dr) ? { ...dr } : {};

    // gold: 物件 {min,max}
    if (!isObj(out.gold)) out.gold = { min: 1, max: 1 };
    const gmin = Number(out.gold.min);
    const gmax = Number(out.gold.max);
    out.gold.min = Number.isFinite(gmin) ? gmin : 1;
    out.gold.max = Number.isFinite(gmax) ? gmax : out.gold.min;

    // stone: 物件 {chance,min,max}（可省略）
    if (out.stone !== undefined && !isObj(out.stone)) {
      delete out.stone;
    } else if (isObj(out.stone)) {
      const c = Number(out.stone.chance);
      const smin = Number(out.stone.min);
      const smax = Number(out.stone.max);
      out.stone.chance = Number.isFinite(c) ? c : 0;
      out.stone.min = Number.isFinite(smin) ? smin : 1;
      out.stone.max = Number.isFinite(smax) ? smax : out.stone.min;
    }

    return out;
  }

  // ---------- 將地圖設定展開為具數值範圍的怪物模板 ----------
  function applyMonsterStatRanges(monsterAreaPool) {
    if (!isObj(monsterAreaPool)) return;
    for (const area in monsterAreaPool) {
      const config = monsterAreaPool[area];
      if (!isObj(config)) continue;
      if (!Array.isArray(config.monsters) || config.monsters.length === 0) continue;
      if (!isObj(config.baseStats) || !isObj(config.hpRange) || !isObj(config.atkRange) || !isObj(config.defRange)) continue;

      const base = config.baseStats;

      config.monsters = config.monsters.map(mon => {
        const name = typeof mon === "string" ? mon : mon.name;
        const hp  = toInt((Number(base.hp)  || 0) + getRandomInt(Number(config.hpRange.min),  Number(config.hpRange.max)));
        const atk = toInt((Number(base.atk) || 0) + getRandomInt(Number(config.atkRange.min), Number(config.atkRange.max)));
        const def = toInt((Number(base.def) || 0) + getRandomInt(Number(config.defRange.min), Number(config.defRange.max)));

        const extra = {};
        if (typeof mon !== "string" && Array.isArray(mon.statusEffects)) {
          mon.statusEffects.forEach(e => {
            extra[e] = true;
            extra[`${e}Chance`] = 20;
          });
        }
        if (typeof mon !== "string" && Array.isArray(mon.buffs)) {
          if (!extra.buff) extra.buff = {};
          mon.buffs.forEach(b => extra.buff[b] = true);
        }

        return {
          name,
          baseStats: { hp, atk, def },
          exp: Number(config.exp) || 0,
          dropRates: normalizeDropRates(config.dropRates),
          extra
        };
      });
    }
  }

  // 若全域有 monsterAreaPool 就初始化（注意順序）
  if (typeof window !== 'undefined' && isObj(window.monsterAreaPool)) {
    try { applyMonsterStatRanges(window.monsterAreaPool); } catch (e) { console.error(e); }
  }

  // ---------- 產生怪物 ----------
  function getMonster(area, levelRange) {
    // ========== Boss 遭遇（地圖王）==========
    if (typeof window !== 'undefined' && typeof window.mapBossPool !== 'undefined') {
      const mapSpecificBosses = Array.isArray(window.mapBossPool[area]) ? window.mapBossPool[area] : [];
      for (const bossConfig of mapSpecificBosses) {
        const encounterChance = Number(bossConfig?.encounterRate) / 100;
        if (Number.isFinite(encounterChance) && Math.random() < encounterChance) {
          if (typeof window.showBossEncounterUI === 'function') { try { window.showBossEncounterUI(bossConfig.name); } catch(_){} }
          if (typeof window.logPrepend === 'function') { try { window.logPrepend(`❗❗ 一股強大的氣息出現了...`); } catch(_){} }
          console.log(`[系統] 觸發特殊怪物生成：${bossConfig.name}`);

          const lvl = Number(bossConfig.level) || 1;
          const dr  = normalizeDropRates(bossConfig.dropRates);

          // EXP：支援 baseExp / exp / dropRates.exp；此處保留基礎值（難度在 getDrop() 再乘）
          const rawExpFromCfg =
            Number.isFinite(Number(bossConfig.baseExp)) ? Number(bossConfig.baseExp)
          : Number.isFinite(Number(bossConfig.exp))     ? Number(bossConfig.exp)
          : Number.isFinite(Number(dr?.exp))            ? Number(dr.exp)
          : (10 + lvl * 2);
          const bossBaseExp  = toInt(rawExpFromCfg);

          // GOLD：支援 baseGold / dropRates.gold.max（或 min）；此處保留基礎值
          const rawGoldFromCfg =
            Number.isFinite(Number(bossConfig.baseGold)) ? Number(bossConfig.baseGold)
          : Number.isFinite(Number(dr?.gold?.max))       ? Number(dr.gold.max)
          : Number.isFinite(Number(dr?.gold?.min))       ? Number(dr.gold.min)
          : 0;
          const bossBaseGold = toInt(rawGoldFromCfg);

          // 三圍吃難度（提供 stats/stat 後備）
          const diff = resolveStatDifficulty(typeof window.getCurrentDifficulty === 'function' ? window.getCurrentDifficulty() : {});

          const bossMonster = {
            ...bossConfig,
            name: `👑 ${bossConfig.name}`,
            isBoss: true,
            area: area,                       // 標記所屬地圖（讓掉落取地圖現值）
            level: lvl,
            hp:  toInt((Number(bossConfig.hp)  || 1) * diff.hp),
            atk: toInt(((Number(bossConfig.atk) || 1) + lvl * 12) * diff.atk),
            def: toInt(((Number(bossConfig.def) || 1) + lvl *  8) * diff.def),
            maxHp: undefined,
            dropRates: dr,
            baseExp:  bossBaseExp,
            baseGold: bossBaseGold,
            isElite: false,
            extra: isObj(bossConfig.extra) ? { ...bossConfig.extra } : {}
          };
          bossMonster.maxHp = bossMonster.hp;

          if (typeof bossMonster.init === 'function') { try { bossMonster.init(bossMonster); } catch(_){ } }
          return bossMonster;
        }
      }
    }
    // ====== Boss 區塊結束 ======

    // 難度倍率（含預設）
    const difficulty = normalizeDifficulty(
      typeof window !== 'undefined' && typeof window.getCurrentDifficulty === "function"
        ? window.getCurrentDifficulty()
        : {}
    );

    // 解析等級區間
    const [minL, maxL] = String(levelRange).split("-").map(v => Number(v));
    let level = getRandomInt(Number.isFinite(minL) ? minL : 1, Number.isFinite(maxL) ? maxL : (minL || 1));

    const mapInfo = Array.isArray(window?.mapOptions) ? window.mapOptions.find(m => m.value === area) : null;
    const minLevel = Number(mapInfo?.minLevel) || 1;
    if (level < minLevel) level = minLevel;

    // 選池（必要時補跑初始化：避免 utils 先載、config 後載）
    if (!isObj(window?.monsterAreaPool)) {
      window.monsterAreaPool = window.monsterAreaPool || {};
    } else {
      // 如果還沒展開就補跑一次
      const anyArea = window.monsterAreaPool[area];
      if (anyArea && Array.isArray(anyArea.monsters) && typeof anyArea.monsters[0] === 'string') {
        try { applyMonsterStatRanges(window.monsterAreaPool); } catch (e) { console.error(e); }
      }
    }

    const areaData = isObj(window?.monsterAreaPool) ? window.monsterAreaPool[area] : null;
    const pool = areaData?.includeAll
      ? [...(Array.isArray(window?.monsterBasePool) ? window.monsterBasePool : []), ...(Array.isArray(areaData?.monsters) ? areaData.monsters : [])]
      : (Array.isArray(areaData?.monsters) && areaData.monsters.length ? areaData.monsters : (Array.isArray(window?.monsterBasePool) ? window.monsterBasePool : []));

    // 沒池就回傳安全預設
    if (!Array.isArray(pool) || pool.length === 0) {
      return {
        name: `未知生物 Lv.${level}`,
        area,
        level,
        hp: toInt(100 * difficulty.hp),
        atk: toInt(10 * difficulty.atk),
        def: toInt(5 * difficulty.def),
        dropRates: normalizeDropRates(),
        baseGold: toInt((1 + level * 2)), // 基礎值；難度在 getDrop() 再乘
        baseExp: toInt((10 + level * 2)), // 基礎值；難度在 getDrop() 再乘
        isElite: false,
        extra: {}
      };
    }

    const template = pool[Math.floor(Math.random() * pool.length)] || {};
    const dropRates = normalizeDropRates(template.dropRates);

    // 精英怪?
    const isElite = Math.random() < difficulty.eliteChance;

    // 基礎金幣：範圍 + 等級加成（基礎值；難度在 getDrop() 再乘）
    const baseGold = toInt(getRandomInt(dropRates.gold.min, dropRates.gold.max) + (level * 2));

    // 生成怪
    const newMonster = {
      ...template,
      name: `${template.name} Lv.${level}`,
      area,
      level,
      // 屬性 = (模板基礎 + 等級加成) * 難度（屬性可在這裡乘）
      hp:  toInt(((Number(template.baseStats?.hp)  || 0) + level * 40) * difficulty.hp),
      atk: toInt(((Number(template.baseStats?.atk) || 0) + level * 28) * difficulty.atk),
      def: toInt(((Number(template.baseStats?.def) || 0) + level * 20) * difficulty.def),
      dropRates,
      baseExp: toInt(Number(template.exp) || 0),  // 基礎值；難度於 getDrop() 再乘
      baseGold: toInt(baseGold),                  // 基礎值；難度於 getDrop() 再乘
      isElite,
      extra: isObj(template.extra) ? { ...template.extra } : {}
    };

    // 精英強化（屬性與金幣基礎值調整；難度加成仍在 getDrop）
    if (isElite) {
      newMonster.hp  = toInt(newMonster.hp  * 1.5);
      newMonster.atk = toInt(newMonster.atk * 1.5);
      newMonster.def = toInt(newMonster.def * 1.5);
      newMonster.baseGold = toInt(newMonster.baseGold * 2);
      newMonster.name = `⭐精英怪 ${newMonster.name}`;

      // 隨機 1~3 狀態 + 全部 buff
      const allStatusEffects = ["poison", "burn", "paralyze", "weaken", "freeze", "bleed", "curse", "blind"];
      const allBuffs = ["atkBuff", "defBuff", "healBuff", "shieldBuff"];

      const numberOfStatusEffects = getRandomInt(1, 3);
      const selected = new Set();
      while (selected.size < numberOfStatusEffects) {
        selected.add(allStatusEffects[Math.floor(Math.random() * allStatusEffects.length)]);
      }
      for (const eff of selected) {
        newMonster.extra[eff] = true;
        newMonster.extra[`${eff}Chance`] = 100;  //異常機率
      }
      if (!newMonster.extra.buff) newMonster.extra.buff = {};
      allBuffs.forEach(b => newMonster.extra.buff[b] = true);
    }

    return newMonster;
  }

  // ---------- 掉落 ----------
  function getDrop(monster) {
    // 難度倍率（含預設）
    const diffRaw = (typeof window !== 'undefined' && typeof window.getCurrentDifficulty === "function" ? window.getCurrentDifficulty() : {});
    const difficulty = normalizeDifficulty(diffRaw);

    // 玩家加成（容錯）
    const p = (typeof window !== "undefined" && isObj(window.player)) ? window.player : {};
    const dropRateBonus = Number(p.dropRateBonus) || 0;
    const goldRateBonus = Number(p.goldRateBonus) || 0;
    const expRateBonus  = Number(p.expRateBonus)  || 0;

    const isElite = !!monster?.isElite;
    const level = Number(monster?.level) || 1;

    // ❶ 優先讀「當前地圖的最新掉落表」
    let areaDropsNow = undefined;
    if (monster?.area && isObj(window?.monsterAreaPool?.[monster.area]?.dropRates)) {
      areaDropsNow = window.monsterAreaPool[monster.area].dropRates;
    }
    // ❷ 後備：怪物模板內建的 dropRates
    const dropRates = normalizeDropRates(areaDropsNow ?? monster?.dropRates);

    // 金幣（基礎值 × 玩家加成 × 難度）
    const baseGold = Number(monster?.baseGold);
    const gold = toInt((Number.isFinite(baseGold)
                        ? baseGold
                        : getRandomInt(dropRates.gold.min, dropRates.gold.max) + level * 2)
                       * (1 + goldRateBonus) * difficulty.gold);

    // 石頭
    let stone = 0;
    if (isObj(dropRates.stone)) {
      const stoneChance = Number(dropRates.stone.chance) * (1 + dropRateBonus);
      if (Number.isFinite(stoneChance) && Math.random() < stoneChance) {
        const base = getRandomInt(dropRates.stone.min, dropRates.stone.max);
        const bonus = Math.floor(level / 5);
        stone = toInt((base + bonus) * difficulty.stone);
      }
    }

    // 物品
    const items = [];
    const dropRateMultiplier = isElite ? 2 : 1;

    // 區域性掉落：只處理 value 是物件且具有 chance 的鍵；跳過 gold/stone/exp
    for (const itemName in dropRates) {
      if (itemName === "gold" || itemName === "stone" || itemName === "exp") continue;
      const cfg = dropRates[itemName];
      if (!isObj(cfg) || !Number.isFinite(Number(cfg.chance))) continue;
      const finalItemChance = Number(cfg.chance) * dropRateMultiplier * (1 + dropRateBonus) * difficulty.item;
      if (finalItemChance > 0 && Math.random() < finalItemChance) {
        try { addItem(itemName); } catch (_) {}
        items.push(itemName);
      }
    }

    // 全域掉落（若無定義則跳過）
    const globalDrops = (typeof window !== "undefined" && isObj(window.GLOBAL_DROP_RATES)) ? window.GLOBAL_DROP_RATES : {};
    for (const key in globalDrops) {
      const rec = globalDrops[key];
      if (!isObj(rec)) continue;
      const name = rec.name ?? key;
      const rate = Number(rec.rate);
      if (!Number.isFinite(rate)) continue;
      const finalGlobalChance = rate * dropRateMultiplier * (1 + dropRateBonus) * difficulty.item;
      if (finalGlobalChance > 0 && Math.random() < finalGlobalChance) {
        try { addItem(name); } catch (_) {}
        items.push(name);
      }
    }

    // 經驗（基礎值 × 等級係數 × 精英 × 玩家加成 × 難度）
    const baseExpRaw = Number(monster?.baseExp);
    const baseExpSafe = Number.isFinite(baseExpRaw) ? baseExpRaw : toInt(10 + level * 2);
    let exp = toInt(baseExpSafe * (1 + Math.max(0, level - 1) * 0.2));
    if (isElite) exp = toInt(exp * 1.5);
    const finalExp = toInt(exp * (1 + expRateBonus) * difficulty.exp);

    return { gold, stone, exp: finalExp, items };
  }

  // 可覆寫；此處保底避免報錯
  function addItem(name) {
    console.log(`📦 獲得物品：${name}`);
  }

  // 提供重新載入入口（例如上傳新地圖檔後想即時生效）
  function reloadMapConfig(newConfig) {
    if (isObj(newConfig)) {
      try {
        window.monsterAreaPool = newConfig;
        applyMonsterStatRanges(window.monsterAreaPool);
        console.log('[系統] 地圖設定已重新載入');
      } catch (e) {
        console.error('[系統] 地圖設定載入失敗：', e);
      }
    }
  }

  // 導出到全域（避免 ESM 作用域問題）
  if (typeof window !== 'undefined') {
    window.getMonster = getMonster;
    window.getDrop = getDrop;
    window.applyMonsterStatRanges = applyMonsterStatRanges;
    window.normalizeDifficulty = normalizeDifficulty;
    window.resolveStatDifficulty = resolveStatDifficulty;
    window.reloadMapConfig = reloadMapConfig;
    window.addItem = window.addItem || addItem;
  }
})();
