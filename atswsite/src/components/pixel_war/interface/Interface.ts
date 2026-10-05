import type { TypeCursorName } from '@/components/pixel_war/type/Type';
import type { Entity } from '@/components/pixel_war/class/Entity/Entity';
import type { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { GrenadeDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
import type { NpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
import type { PlayerDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/PlayerDynamicEntity/PlayerDynamicEntity';
import type { ExpOrbDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/ExpOrbDynamicEntity/ExpOrbDynamicEntity';
import type { SkillOrbDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/SkillOrbDynamicEntity/SkillOrbDynamicEntity';
import type { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';

export interface Resolution { width: number; height: number }
export interface PenPoint {x: number; y: number; g: number};//g是压力值，0-1通过鼠标移动速度模拟
export interface PenTrajectory {
  id: number;//轨迹ID
  color: RGB;//笔迹颜色
  thickness: number;//笔迹粗细
  resolution: Resolution;//分辨率
  startPoint: Point;//参照点
  endPoint: Point;//终结点
  list: Array<PenPoint>;//笔迹点以startPoint为起点的偏移坐标值和压力值
}
export interface RGB { r: number; g: number; b: number; }
export interface Point { x: number; y: number };
export interface EventArea {
  id: string;                    // 唯一标识
  rect: {                         // 矩形区域
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type: 'button' | 'element' | 'menu';  // 区域类型
  data?: any;                     // 附加数据
  cursor?: TypeCursorName;                 // 鼠标样式
  onClick?: (e: MouseEvent, area: EventArea) => void;
  onHover?: (e: MouseEvent, area: EventArea, isHovering: boolean) => void;
}

export interface InherentProp {
  name: string;
  color: RGB;
  opacity: 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1;
};
export interface Element {
  id: number;
  type: "point" | "line" | "segment";
  points: Array<Point>;
  inherentProp: InherentProp;
  customProp: Object;
};
export interface PointElement extends Element {
  type: "point"
};
export interface LineElement extends Element {
  type: "line"
};
export interface SegmentElement extends Element {
  type: "segment"
};
export interface CachedImage {
  img: HTMLImageElement;
  offsetX: number;
  offsetY: number;
}

//碰撞箱
// export interface CollisionBox {
//   x: number;
//   y: number;
//   width: number;
//   height: number;
// }
export interface CollisionBox {
  x: number;// 碰撞箱的参照点通常是实体的中心点
  y: number;
  width: number;
  height: number;
}

export interface Texture {
  img: HTMLImageElement;
  loaded: boolean;
  path: string;
}

// 特效播放事件
export interface CanvasEffectEventPayload {
  kind: string;
  position: Point;
  width: number;
  height: number;
  tag?: string;
  entityType: Entity['type'];
};
// 加载雪碧图特效图片
export interface LoadedEffectSprite  {
  img: HTMLImageElement;
  loaded: boolean;
  path: string;
};
// 当前播放的特效列表
export interface ActiveCanvasEffect {
  id: number;
  kind: string;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  tag?: string;
  spritePath: string;
  elapsed: number;
};

// 从者吸附特效(有方向的条状渐变拖尾 + 锚点处的吸附能量块/光晕)
export interface ServantAbsorbEffect {
  id: number;
  entityId: number;  // 被吸附的从者实体 id(锚点每帧跟随该实体移动)
  anchorX: number;   // 吸附落点(被吸附的从者格子)世界坐标 X
  anchorY: number;   // 吸附落点世界坐标 Y
  dirX: number;      // 拖尾方向(单位向量,8 方向之一,指向玩家吸附面向外)
  dirY: number;      // 拖尾方向(单位向量)
  length: number;    // 拖尾总长度(px)
  cellSize: number;  // 网格单元边长(px)
  color: string;     // 拖尾/格子基色(取自被吸附 NPC 的本体颜色)
  elapsed: number;   // 已播放时长(秒)
};

export interface UserData {
    id: number; // ID
    anonymous_user: boolean; // 用户是否是匿名的
    email: string; // 电子邮箱
    password: string | null; // 一般为空，仅保留字段
    name: string; // 用户名
    qq: number; // QQ 号码
    theme_color: string; // 主题颜色（暗黑和亮色）
    head_img: string; // 头像的URI
}

export interface PixelWarUserData extends UserData {
    /* 游戏账号相关数据 */
    player_score: number; // 玩家得分
}

export interface LogConfig {
    code: number;
    time: string;
    text: string;
    from: string;
    type: string;
    data: any;
}

export interface InstructObject {
    type: string;
    class: string;
    conveyor: string;
    time: string;
    data: any;
}

export interface ServerConfig {
    version: string;// 服务端运行版本
    anonymous_login: boolean;
    key: string;
    url: string;
    name: string;
    online_number: number;
    max_online: number;
}

export interface StarFieldStar {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  opacityDirection: 1 | -1;
  opacityIncrement: number;
}

export interface EntityDebugFlags {
  //属性相关
  showHealth: boolean;
  showHunger: boolean;
  showMovementSpeed: boolean;
  showMovementPassion: boolean;
  showTag: boolean;
  showLevel: boolean;
  //几何相关
  showHistoricalTrajectory: boolean;
  showCollisionBoxes: boolean;
  showFacingDirection: boolean;
  showMovementRange: boolean;
  showInterestRange: boolean;
  /** 显示镭射线的攻击范围(激光命中判定带 + 幽蓝孤光的攻击方向预览) */
  showLaserLine: boolean;
}

export interface Tick {
  tickCount: number;
  tickTime: number;
}

export interface TickTimer {
  interval: 20;
  id: number;
  status: 'running' | 'stopped' | 'initial';
  tick: Tick;
}

export interface DataPackage {
  tick: Tick;
  data: {
    instructs: Array<InstructObject>;
  };
}

export interface DynamicEntitieList {
  bulletDynamicEntitys: Array<BulletDynamicEntity>;
  grenadeDynamicEntitys: Array<GrenadeDynamicEntity>;
  npcDynamicEntitys: Array<NpcDynamicEntity>;
  playerDynamicEntitys: Array<PlayerDynamicEntity>;
  expOrbDynamicEntitys: Array<ExpOrbDynamicEntity>;
  skillOrbDynamicEntitys: Array<SkillOrbDynamicEntity>;
}

export interface MapData {
  dynamicEntitie: DynamicEntitieList;
  staticEntities: Array<StaticEntity>;
  itemEntities: Array<ItemEntity>; 
}

export interface GameConfig {
  npcSpawnTotalProbability:number;// (0,1]
  npcSpawnNoSpawnRadius:number;
  npcSpawnHighRadius:number;
  npcSpawnMediumRadius:number;
  npcDespawnDistance:number;
  npcSpawnLowRadius:number;
  npcSpawnHighInterval:number;
  npcSpawnMediumInterval:number;
  npcSpawnLowInterval:number;
  npcSpawnMaxCountSinglePlayer:number;
  npcSpawnMaxAttempts:number;
  npcSpawnPadding:number;
  
  itemSpawnTotalProbability:number;// (0,1]
  itemSpawnNoSpawnRadius:number;
  itemSpawnHighRadius:number;
  itemSpawnMediumRadius:number;
  itemSpawnLowRadius:number;
  itemSpawnHighInterval:number;
  itemSpawnMediumInterval:number;
  itemSpawnLowInterval:number;
  itemSpawnMaxCountSinglePlayer:number;
  itemSpawnMaxAttempts:number;
  itemSpawnPadding:number;

  singlePlayerMode:boolean;

  setRandomTargetMaxAttempts:number;

  worldSize: number;// px
  worldMinX: number;// px
  worldMaxX: number;// px
  worldMinY: number;// px
  worldMaxY: number;// px
}

// 定义单个从者的结构
export interface Servant {
    // 行索引（0-8）
    row: number;
    // 列索引（0-8）
    col: number;
    // 此格是否有从者,默认false
    exist: boolean;
    // npc的实体id,默认为-1
    npcId: number;
    // 邻居信息
    neighbor: NeighborGrid;
}

// 3 x 3 的网格(初中心点以外)表示从左到右从上到下的邻居实体id
export interface NeighborGrid extends Array<number> {
  length: 8;
  [index: number]: number;
}

// 定义一行从者
export interface ServantRow extends Array<Servant> {
    length: 15;
    0: Servant;
    1: Servant;
    2: Servant;
    3: Servant;
    4: Servant;
    5: Servant;
    6: Servant;
    7: Servant;
    8: Servant;
    9: Servant;
    10: Servant;
    11: Servant;
    12: Servant;
    13: Servant;
    14: Servant;
    [index: number]: Servant;
}

// 定义整个从者网格
export interface ServantGrid extends Array<ServantRow> {
    length: 15;
    0: ServantRow;
    1: ServantRow;
    2: ServantRow;
    3: ServantRow;
    4: ServantRow;
    5: ServantRow;
    6: ServantRow;
    7: ServantRow;
    8: ServantRow;
    9: ServantRow;
    10: ServantRow;
    11: ServantRow;
    12: ServantRow;
    13: ServantRow;
    14: ServantRow;
    [index: number]: ServantRow;
}

export interface ServantMap extends Map<number, Servant> {}

export interface ActionLoopContext {
  deltaTime: number;
  staticEntities: StaticEntity[];
  npcEntities: NpcDynamicEntity[];
  playerEntities: PlayerDynamicEntity[];
  spawnBullet: (bullet: BulletDynamicEntity) => void;
  spawnGrenade: (grenade: GrenadeDynamicEntity) => void;
};

export interface PlayerRule {
  bulletColor: string,
  fireCooldownNow: number,
  fireCooldownMax: number,
};

//////////////////////////////////////////////////
// 战利品与背包相关类型(背包 / 技能球 / 物品) -->
//////////////////////////////////////////////////

/** 战利品类型:目前仅支持技能球,预留后续扩展(如物品球、金币等) */
export type LootType = 'skillOrb';

/** NPC 战利品配置 */
export interface NpcLoot {
  /** 战利品类型 */
  type: LootType;
  /** 战利品标签(技能球对应技能 tag,如 va2_shoot_skill) */
  tag: string;
  /** 掉落概率,取值范围 (0, 1] */
  odds: number;
}

/** 背包条目种类:技能 / 物品 */
export type InventoryEntryKind = 'skill' | 'item';

/**
 * 背包中的一个条目
 * - 技能不可堆叠(count 恒为 1,maxStack 恒为 1)
 * - 物品可堆叠,单格上限为 INVENTORY_ITEM_MAX_STACK(50)
 */
export interface InventoryEntry {
  /** 条目唯一 id(拖拽/使用/销毁时作为定位依据) */
  uid: string;
  /** 条目种类 */
  kind: InventoryEntryKind;
  /** 标签:技能 tag 或物品 tag */
  tag: string;
  /** 显示名称 */
  name: string;
  /** 持有数量(技能恒为 1) */
  count: number;
  /** 堆叠上限(技能恒为 1,物品为 50) */
  maxStack: number;
  /** 主题色(用于背包与技能槽绘制) */
  color: string;
}

/** 玩家背包:上半部分为持有物网格,下半部分为技能装配区 */
export interface PlayerInventory {
  /**
   * 背包网格(固定长度,元素为 null 表示空格)
   * 下标与背包界面槽位一一对应,便于拖拽/点击精确落到指定格子。
   * 已装配的技能不在此网格中。
   */
  entries: (InventoryEntry | null)[];
  /** 技能装配区(10 个槽位,存放技能 tag,null 表示空槽) */
  equippedSkills: (string | null)[];
}

//////////////////////////////////////////////////
// 专研(Research)系统相关类型 -->
//////////////////////////////////////////////////

/** 研究项类别:普通(蓝) / 传说(金) */
export type ResearchCategory = 'normal' | 'legendary';

/**
 * 玩家持有的一个研究项记录。
 * - level:当前研究等级(1 起)
 * - value:附带的数值状态(目前仅"不动堡垒"用于记录剩余吸收值,其余恒为 0)
 */
export interface ResearchEntry {
  /** 研究项标签(见 class/Research/Research.ts 的 ResearchTagType) */
  tag: string;
  /** 当前等级 */
  level: number;
  /** 附带数值状态(不动堡垒的剩余吸收值) */
  value: number;
}

//////////////////////////////////////////////////
// <-- 专研(Research)系统相关类型
//////////////////////////////////////////////////

/** 物品定义(名称/说明/堆叠上限/使用效果) */
export interface ItemDefinition {
  /** 物品标签 */
  tag: string;
  /** 显示名称 */
  name: string;
  /** 功能说明 */
  description: string;
  /** 主题色 */
  color: string;
  /** 图标类型 */
  icon: 'gem' | 'square';
  /** 使用后恢复的生命值(0 表示无治疗效果) */
  heal: number;
  /** 单格堆叠上限 */
  maxStack: number;
}

/**
 * 掉落物堆叠:地面上的一堆物品
 * 同一个物品标签的掉落会合并为一条,count 表示这一堆的数量。
 */
export interface DroppedItemStack {
  /** 物品标签 */
  tag: string;
  /** 物品名称(用于背包与界面展示) */
  name: string;
  /** 堆叠数量 */
  count: number;
}

/**
 * 背包掉落内容:从背包(含技能装配区)中取出、需要落在地面上的东西
 */
export interface InventoryDeathDrop {
  /** 物品掉落(已按标签合并的堆叠) */
  items: DroppedItemStack[];
  /** 技能掉落(技能标签,掉落为技能球) */
  skillTags: string[];
}

/**
 * 专研降级记录:死亡惩罚会让所有专研项降低 1 级
 */
export interface ResearchDowngrade {
  /** 研究项标签 */
  tag: string;
  /** 死亡前的等级 */
  from: number;
  /** 死亡后的等级(0 表示该项已被移除) */
  to: number;
}

/**
 * 玩家死亡结算结果:玩家死亡后需要落在地面上的内容与自身损失
 */
export interface PlayerDeathDrop extends InventoryDeathDrop {
  /** 掉落为经验球的经验值 */
  droppedExp: number;
  /** 死亡惩罚导致降级/移除的专研项 */
  researchDowngrades: ResearchDowngrade[];
}

//////////////////////////////////////////////////
// <-- 战利品与背包相关类型
//////////////////////////////////////////////////