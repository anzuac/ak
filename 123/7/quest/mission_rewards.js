// 任務獎勵配置（共用）
var missionRewards = {
  daily: [
    { id: "kill_10_monsters", name: "擊敗 10 隻怪",
      rewards: [ { type:"gold", amount:500 }, { type:"stone", amount:10 } ] },
    { id: "get_3000_gold", name: "獲得楓幣 3000",
      rewards: [ { type:"diamond", amount:1 } ] },
    { id: "daily_login", name: "每日登入",
      rewards: [ { type:"stone", amount:20 } ] },
    { id: "get_100_stone", name: "獲得強化石 100",
      rewards: [ { type:"diamond", amount:1 } ] },
    { id: "finish_4_daily", name: "完成每日任務 4 次",
      rewards: [ { type:"diamond_box", min:5, max:20 }, { type:"medal", amount:5 } ] }
  ],

  weekly: [
    { target: 5,  rewards: [ {type:"diamond",amount:2},  {type:"stone",amount:30},  {type:"medal",amount:2}  ] },
    { target: 10, rewards: [ {type:"diamond",amount:3},  {type:"stone",amount:60},  {type:"medal",amount:5}  ] },
    { target: 20, rewards: [ {type:"diamond",amount:5},  {type:"stone",amount:120}, {type:"medal",amount:15} ] },
    { target: 30, rewards: [ {type:"diamond",amount:8},  {type:"stone",amount:200}, {type:"medal",amount:30}, {type:"diamond_box",min:20,max:50} ] }
  ]
};