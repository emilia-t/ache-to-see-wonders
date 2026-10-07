/**
 * Java 服务端协议类型定义(对应 java/src/main/java/com/atsw/pixelwar/protocol/Protocol.java)。
 *
 * 前端只在这里描述服务端消息结构,具体的渲染数据转换见 ProtocolMapper.ts。
 */

export interface JavaVec {
  x: number;
  y: number;
}

export interface JavaTick {
  tickCount: number;
  tickTime: number;
}

export interface JavaWorld {
  size: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface JavaStaticEntity {
  id: number;
  tag: string;
  name: string;
  position: JavaVec;
  width: number;
  height: number;
  direction?: string | null;
}

export interface JavaInventoryEntry {
  uid: string;
  kind: 'skill' | 'item';
  tag: string;
  name: string;
  count: number;
  maxStack: number;
  color: string;
}

export interface JavaInventory {
  entries: (JavaInventoryEntry | null)[];
  equippedSkills: (string | null)[];
}

export interface JavaPlayerPublic {
  id: number;
  name: string;
  teamId?: number | null;
  position: JavaVec;
  facingDirection: JavaVec;
  health: number;
  healthMax: number;
  dead: boolean;
  moving: boolean;
  sprinting: boolean;
  staminaRatio: number;
  servantCount: number;
  score: number;
  level: number;
}

export interface JavaResearchEntry {
  tag: string;
  level: number;
  /** 附带数值状态(不动堡垒剩余吸收值,其余恒为 0) */
  value: number;
}

/** 死亡掉落的物品堆叠 */
export interface JavaDeathItem {
  tag: string;
  name: string;
  count: number;
}

/** 专研降级记录(from > to;to = 0 表示该项被移除) */
export interface JavaResearchDowngrade {
  tag: string;
  from: number;
  to: number;
}

/** 玩家死亡明细(仅单播给本人,用于死亡界面展示) */
export interface JavaDeathReport {
  droppedExp: number;
  items: JavaDeathItem[];
  skillTags: string[];
  researchDowngrades: JavaResearchDowngrade[];
}

export interface JavaPlayerPrivate {
  playerId: number;
  score: number;
  level: number;
  exp: number;
  expToNextLevel: number;
  stamina: number;
  staminaMax: number;
  sprinting: boolean;
  fireCooldownNow: number;
  fireCooldownMax: number;
  /** 技能装配区各槽位的技能剩余CD(秒),下标与 equippedSkills 一致 */
  equippedSkillCooldowns: number[];
  /** 当前子弹数(开火消耗,子弹球补充) */
  bulletCount: number;
  /** 最大子弹数(基础 50 + 专研「弹量」加成) */
  bulletMaxCount: number;
  inventory: JavaInventory;
  servantIds: number[];
  /** 已研究的专研项 */
  research: JavaResearchEntry[];
  /** 待玩家选择的专研选项(空数组表示无待选界面) */
  researchPendingOptions: string[];
  /** 死亡后需等待的复活时间(秒):X = 3 + 等级 / 3,上限 30;未死亡为 0 */
  deathRespawnDelay?: number;
  /** 复活等待的剩余时间(秒),客户端据此展示复活倒计时;未死亡为 0 */
  deathRespawnRemaining?: number;
  /** 最近一次伤害来源显示名(死亡界面提示「你被 xxx 击倒了」);未受伤为空串 */
  lastDamagerName?: string;
  /** 最近一次死亡结算明细(缺省/null 表示尚未死亡或已重生) */
  lastDeathReport?: JavaDeathReport | null;
}

export interface JavaNpc {
  id: number;
  tag: string;
  /** 服务端仅在非空时下发 */
  name?: string | null;
  ownerId?: number | null;
  teamId?: number | null;
  attitude: string;
  position: JavaVec;
  facingDirection: JavaVec;
  health: number;
  healthMax: number;
  dead: boolean;
  moving: boolean;
  mapColor?: string | null;
  killScore?: number | null;
  /** 服务端仅在死亡特效期间下发 */
  deathEffectTimer?: number | null;
  /** NPC 等级(服务端仅在 > 0 时下发,缺省视为 0) */
  level?: number | null;
  /** 触手旋转相位(tick 计数):仅带旋转线段的 NPC(珊瑚红触手)有值,缺省视为 0 */
  tentacleTicks?: number | null;
}

/**
 * 子弹快照。
 *
 * 普通子弹只下发 id / position / velocity / ownerId / bulletColor:
 * 子弹尺寸恒为 8×8、伤害恒为 1 且由服务端裁决,对应的默认值在 ProtocolMapper 中补齐。
 * 线段型激光弹额外下发 tag 与激光参数(普通子弹这些字段缺省)。
 */
export interface JavaBullet {
  id: number;
  position: JavaVec;
  velocity: JavaVec;
  ownerId?: number | null;
  bulletColor?: string | null;
  /** 子弹类型标签:普通子弹缺省(视为 ordinary_bullet) */
  tag?: string | null;
  /** 激光最大长度(px,已按围墙截断) */
  laserMaxLength?: number | null;
  /** 激光前端展开速度(px/s) */
  laserExpandSpeed?: number | null;
  /** 激光持续发光时长(秒) */
  laserHoldSeconds?: number | null;
  /** 激光已存在时长(秒) */
  laserElapsed?: number | null;
  /** 激光辉光色 */
  laserGlowColor?: string | null;
}

export interface JavaGrenade {
  id: number;
  tag: string;
  position: JavaVec;
  ownerId?: number | null;
  fuseRatio: number;
}

export interface JavaExpOrb {
  id: number;
  position: JavaVec;
  value: number;
}

export interface JavaSkillOrb {
  id: number;
  position: JavaVec;
  skillTag: string;
}

/** 子弹球快照(碰撞体积恒为 14×14,不再下发) */
export interface JavaBulletOrb {
  id: number;
  position: JavaVec;
  value: number;
}

export interface JavaItem {
  id: number;
  tag: string;
  name: string;
  position: JavaVec;
  count: number;
  lifetimeRatio: number;
}

export interface JavaWelcome {
  playerId: number;
  roomId: string;
  playerName: string;
  tickIntervalMs: number;
  world: JavaWorld;
  staticEntities: JavaStaticEntity[];
  players: JavaPlayerPublic[];
}

export interface JavaSnapshot {
  tick: JavaTick;
  self: JavaPlayerPublic;
  selfPrivate: JavaPlayerPrivate;
  players: JavaPlayerPublic[];
  npcs: JavaNpc[];
  bullets: JavaBullet[];
  grenades: JavaGrenade[];
  expOrbs: JavaExpOrb[];
  skillOrbs: JavaSkillOrb[];
  bulletOrbs: JavaBulletOrb[];
  items: JavaItem[];
}

/** 服务端消息信封 */
export interface JavaServerEnvelope<T = unknown> {
  type: 'welcome' | 'snapshot' | 'player_joined' | 'player_left' | 'event' | 'pong' | 'error';
  data: T;
}

/** 客户端消息类型(与 Java 端 Protocol.ClientType 对应) */
export type JavaClientMessageType =
  | 'join'
  | 'move_input'
  | 'fire_input'
  | 'dodge_input'
  | 'respawn'
  | 'inventory_update'
  | 'inventory_use_item'
  | 'inventory_drop'
  | 'research_choose'
  | 'tick_pause'
  | 'ping';

/** 客户端消息信封 */
export interface JavaClientEnvelope<T = unknown> {
  type: JavaClientMessageType;
  data: T;
}
