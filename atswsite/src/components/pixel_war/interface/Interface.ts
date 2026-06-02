import type { TypeCursorName } from '@/components/pixel_war/type/Type';
import type { Entity } from '@/components/pixel_war/class/Entity/Entity';
import type { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { BulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BulletDynamicEntity';
import type { GrenadeDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/GrenadeDynamicEntity/GrenadeDynamicEntity';
import type { NpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NpcDynamicEntity';
import type { PlayerDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/PlayerDynamicEntity/PlayerDynamicEntity';

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
  //几何相关
  showHistoricalTrajectory: boolean;
  showCollisionBoxes: boolean;
  showFacingDirection: boolean;
  showMovementRange: boolean;
  showInterestRange: boolean;
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
}

export interface MapData {
  dynamicEntitie: DynamicEntitieList;
  staticEntities: Array<StaticEntity>;
  itemEntities: Array<ItemEntity>; 
}

export interface GameConfig {
  npcSpawnNoSpawnRadius:number;
  npcSpawnHighRadius:number;
  npcSpawnMediumRadius:number;
  npcSpawnLowRadius:number;
  npcSpawnHighInterval:number;
  npcSpawnMediumInterval:number;
  npcSpawnLowInterval:number;
  npcSpawnMaxCountSinglePlayer:number;
  npcSpawnMaxAttempts:number;
  npcSpawnPadding:number;
  
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

  singleplayerMode:boolean;

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
}

// 定义一行从者：必须恰好包含 9 个 Sit，且长度为 9
export interface ServantRow extends Array<Servant> {
    length: 9;// 固定长度
    0: Servant; 
    1: Servant;
    2: Servant;
    3: Servant;
    4: Servant;
    5: Servant;
    6: Servant;
    7: Servant;
    8: Servant;
    [index: number]: Servant;// 索引签名 确保所有元素均为 Servant
}

// 定义整个 9×9 从者网格：必须恰好包含 9 个 Row，且长度为 9
export interface ServantGrid extends Array<ServantRow> {
    length: 9;
    0: ServantRow;
    1: ServantRow;
    2: ServantRow;
    3: ServantRow;
    4: ServantRow;
    5: ServantRow;
    6: ServantRow;
    7: ServantRow;
    8: ServantRow;
    [index: number]: ServantRow;
}

export interface ActionLoopContext {
  deltaTime: number;
  staticEntities: StaticEntity[];
  spawnBullet: (bullet: BulletDynamicEntity) => void;
  spawnGrenade: (grenade: GrenadeDynamicEntity) => void;
};