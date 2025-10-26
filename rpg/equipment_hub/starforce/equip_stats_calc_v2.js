/*!
 * equip_stats_calc_v2.js — 裝備能力彙總（對應 StarforceTableV1）
 * - 純計算，完全不碰存檔/背包
 */
(function(root){
  'use strict';
  function nz(n){ return (typeof n==='number' && isFinite(n)) ? n : 0; }
  function clone(o){ try{return JSON.parse(JSON.stringify(o||{}));}catch(_){return {}; } }

  // node: { type, locked, base:{...}, enhance:{...}, star }
  function calcEquipFinal(node){
    if (!node || node.locked) {
      return { str:0,dex:0,int:0,luk:0,atk:0,def:0,hp:0, starAtkPctSum:0, atkFromStar:0, atkFlat:0, detail:{} };
    }
    var b = clone(node.base||{}), e=clone(node.enhance||{});
    var type = node.type||'', star = node.star|0;

    var basePlusScrollAtk = nz(b.atk)+nz(e.atk);
    var sf = (root.StarforceTableV1 && root.StarforceTableV1.calcStarBonus)
      ? root.StarforceTableV1.calcStarBonus(type, star, basePlusScrollAtk)
      : { allStat:0, atkPctSum:0, atkFromStar:0, atkFlat:0 };

    var out = {
      str: nz(b.str)+nz(e.str)+sf.allStat,
      dex: nz(b.dex)+nz(e.dex)+sf.allStat,
      int: nz(b.int)+nz(e.int)+sf.allStat,
      luk: nz(b.luk)+nz(e.luk)+sf.allStat,
      atk: nz(b.atk)+nz(e.atk) + nz(sf.atkFromStar) + nz(sf.atkFlat),
      def: nz(b.def)+nz(e.def),
      hp:  nz(b.hp) +nz(e.hp),
      starAtkPctSum: sf.atkPctSum,
      atkFromStar: sf.atkFromStar,
      atkFlat: sf.atkFlat,
      detail: { base:b, enhance:e, starAll:sf.allStat }
    };
    return out;
  }

  function sumStats(list){
    var sum={str:0,dex:0,int:0,luk:0,atk:0,def:0,hp:0};
    var i; for(i=0;i<list.length;i++){
      var s=list[i]||{};
      sum.str+=nz(s.str); sum.dex+=nz(s.dex); sum.int+=nz(s.int); sum.luk+=nz(s.luk);
      sum.atk+=nz(s.atk); sum.def+=nz(s.def); sum.hp+=nz(s.hp);
    }
    return sum;
  }

  root.EquipStatsV2 = { calcEquipFinal:calcEquipFinal, sumStats:sumStats };
})(this);