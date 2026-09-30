import type {
  GameConfig
} from '@/components/pixel_war/interface/Interface';

const gameConfig:GameConfig = {
  // ---- 世界尺寸 ----
  worldSize: 20000,
  worldMinX: -10000,
  worldMaxX: 10000,
  worldMinY: -10000,
  worldMaxY: 10000,

  // ---- NPC 刷新 ----
  npcSpawnTotalProbability:0.4,//NPC 生成总概率(0,1]
  npcSpawnNoSpawnRadius:300,// 禁刷怪区,单位px
  npcSpawnHighRadius:900,// 高频刷怪区外边界,单位px
  npcSpawnMediumRadius:1800,// 中频刷怪区外边界,单位px
  npcSpawnLowRadius:3200,// 低频刷怪区外边界,单位px
  npcDespawnDistance:4800,// NPC 超出此距离后消失,单位px
  npcSpawnHighInterval:4,// 高频刷怪区生成间隔,单位秒
  npcSpawnMediumInterval:10,// 中频刷怪区生成间隔,单位秒
  npcSpawnLowInterval:22,// 低频刷怪区生成间隔,单位秒
  npcSpawnMaxCountSinglePlayer:140,// 地图中同时存在的 NPC 数量上限,单位个
  npcSpawnMaxAttempts:1,// 每个游戏刻tick最大尝试生成次数
  npcSpawnPadding:12,// 新 NPC 与已有动态实体之间额外保留的安全距离,单位px
  
  // ---- 物品刷新 ----
  itemSpawnTotalProbability:0.1,//item 生成总概率(0,1]
  itemSpawnNoSpawnRadius:300,// 禁生成物品区,单位px
  itemSpawnHighRadius:900,// 高频生成区外边界,单位px
  itemSpawnMediumRadius:1800,// 中频生成区外边界,单位px
  itemSpawnLowRadius:3200,// 低频生成区外边界,单位px
  itemSpawnHighInterval:6,// 高频生成间隔,单位秒
  itemSpawnMediumInterval:14,// 中频生成间隔,单位秒
  itemSpawnLowInterval:30,// 低频生成间隔,单位秒
  itemSpawnMaxCountSinglePlayer:20,// 地图中同时存在的 ITEM 数量上限,单位个
  itemSpawnMaxAttempts:1, // 每个游戏刻tick最大尝试生成次数
  itemSpawnPadding:50,// 生成物品的间距

  /** 是否单人模式 */
  singlePlayerMode: true,

  /** 每tick为 NPC 选取随机目标的尝试次数*/
  setRandomTargetMaxAttempts:1
}

export default gameConfig;