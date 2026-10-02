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

export interface JavaPlayerPrivate {
  playerId: number;
  score: number;
  level: number;
  exp: number;
  expToNextLevel: number;
  stamina: number;
  staminaMax: number;
  sprinting: boolean;
  invincibleTimer: number;
  fireCooldownNow: number;
  fireCooldownMax: number;
  dodgeCooldownNow: number;
  dodgeCooldownMax: number;
  inventory: JavaInventory;
  servantIds: number[];
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
}

/**
 * 子弹快照。
 *
 * 服务端只下发 id / position / velocity / ownerId / bulletColor:
 * 子弹只有一种类型(tag 恒为 ordinary_bullet)、碰撞体积恒为 8×8、伤害恒为 1 且由服务端裁决,
 * 对应的默认值在 ProtocolMapper 中补齐。
 */
export interface JavaBullet {
  id: number;
  position: JavaVec;
  velocity: JavaVec;
  ownerId?: number | null;
  bulletColor?: string | null;
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
  | 'tick_pause'
  | 'ping';

/** 客户端消息信封 */
export interface JavaClientEnvelope<T = unknown> {
  type: JavaClientMessageType;
  data: T;
}
