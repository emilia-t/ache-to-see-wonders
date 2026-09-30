import type {
  DataPackage,
  InstructObject,
  MapData,
  Point
} from '@/components/pixel_war/interface/Interface';
import type {
  JavaBullet,
  JavaClientEnvelope,
  JavaExpOrb,
  JavaGrenade,
  JavaItem,
  JavaNpc,
  JavaPlayerPrivate,
  JavaPlayerPublic,
  JavaSkillOrb,
  JavaSnapshot,
  JavaStaticEntity,
  JavaWelcome
} from '@/components/pixel_war/service/transport/JavaProtocol';

/**
 * 协议映射:Java 服务端协议 <-> 前端渲染数据。
 *
 * Java 服务端的快照为"按实体类别分组 + 视野裁剪"的结构,这里把它还原成前端渲染管线
 * 使用的 MapData 结构(与本地 Worker 单人模式的快照一致),从而复用同一套渲染逻辑。
 */

/** 地面物品在客户端淡出用的基准寿命(秒),与服务端 GroundItemEntity.DEFAULT_LIFETIME 对应 */
const H_ITEM_LIFETIME_SECONDS = 60;

/**
 * 各类实体的固定碰撞体积(px)。
 *
 * 这些值在服务端都是按类型固定的常量(PlayerEntity/NpcEntity 25、BulletEntity 8、
 * BombEntity 10、ExpOrbEntity 12、SkillOrbEntity 14、ItemEntity 25),快照里不再下发,
 * 在此补齐——修改服务端常量时必须同步这里。
 */
const H_FIXED_SIZE = {
  player: 25,
  npc: 25,
  bullet: 8,
  grenade: 10,
  expOrb: 12,
  skillOrb: 14,
  item: 25
} as const;

/** 服务端只有一种子弹(BulletEntity 为 final、tag 恒为 ordinary_bullet、伤害恒为 1),不再随快照下发 */
const H_BULLET_TAG = 'ordinary_bullet';
const H_BULLET_DAMAGE = 1;

/**
 * 玩家默认战斗规则。
 *
 * 注意:客户端用 Object.assign 把快照字段合并到实体实例上,若这里显式赋 undefined,
 * 会把实体构造器里的默认值覆盖掉(例如 PlayerDynamicEntity.playerRule),
 * 导致渲染时读取属性报错。因此凡是客户端会用到的字段都必须给出具体值。
 */
const H_defaultPlayerRule = (): Record<string, number | string> => ({
  bulletColor: 'rgba(255, 255, 255, 0.9)',
  invincibleTimer: 0,
  fireCooldownNow: 0,
  fireCooldownMax: 0.5,
  dodgeCooldownNow: 0,
  dodgeCooldownMax: 5
});

/** 空背包(结构、长度与前端 Inventory 保持一致) */
const H_emptyInventory = (): Record<string, unknown> => ({
  entries: new Array(20).fill(null),
  equippedSkills: new Array(10).fill(null)
});

/**
 * Java 静态实体 -> 前端静态实体快照
 *
 * 注意:这里**不能**下发 texturePath。贴图路径是客户端资源(由实体类的静态常量给出)
 */
export const H_toStaticEntities = (welcome: JavaWelcome): unknown[] =>
  welcome.staticEntities.map((entity: JavaStaticEntity) => ({
    id: entity.id,
    type: 'static',
    tag: entity.tag,
    name: entity.name,
    position: { x: entity.position.x, y: entity.position.y },
    width: entity.width,
    height: entity.height,
    direction: entity.direction ?? null,
    collisionBox: {
      x: entity.position.x - entity.width / 2,
      y: entity.position.y - entity.height / 2,
      width: entity.width,
      height: entity.height
    }
  }));

const H_toPosition = (point: Point): Point => ({ x: point.x, y: point.y });

/** Java 玩家(公开 + 私有) -> 前端玩家快照 */
export const H_toPlayerEntity = (
  player: JavaPlayerPublic,
  privateState: JavaPlayerPrivate | null,
  isme: boolean
): Record<string, unknown> => ({
  id: player.id,
  type: 'dynamic',
  kind: 'player',
  tag: 'player',
  name: player.name,
  teamId: player.teamId ?? null,
  position: H_toPosition(player.position),
  facingDirection: H_toPosition(player.facingDirection),
  width: H_FIXED_SIZE.player,
  height: H_FIXED_SIZE.player,
  health: player.health,
  healthMax: player.healthMax,
  isDead: player.dead,
  isMoving: player.moving,
  isSprinting: player.sprinting,
  stamina: privateState ? privateState.stamina : player.staminaRatio * 100,
  staminaMax: privateState ? privateState.staminaMax : 100,
  player_score: player.score,
  game_level: player.level,
  game_exp: privateState ? privateState.exp : 0,
  isme,
  inventory: privateState
    ? {
        entries: privateState.inventory.entries,
        equippedSkills: privateState.inventory.equippedSkills
      }
    : H_emptyInventory(),
  playerRule: privateState
    ? {
        bulletColor: 'rgba(255, 255, 255, 0.9)',
        invincibleTimer: privateState.invincibleTimer,
        fireCooldownNow: privateState.fireCooldownNow,
        fireCooldownMax: privateState.fireCooldownMax,
        dodgeCooldownNow: privateState.dodgeCooldownNow,
        dodgeCooldownMax: privateState.dodgeCooldownMax
      }
    : H_defaultPlayerRule()
});

/** Java NPC -> 前端 NPC 快照 */
export const H_toNpcEntity = (npc: JavaNpc): Record<string, unknown> => ({
  id: npc.id,
  type: 'dynamic',
  kind: 'npc',
  tag: npc.tag,
  name: npc.name ?? '',
  ownerId: npc.ownerId ?? null,
  teamId: npc.teamId ?? null,
  attitude: npc.attitude,
  position: H_toPosition(npc.position),
  facingDirection: H_toPosition(npc.facingDirection),
  width: H_FIXED_SIZE.npc,
  height: H_FIXED_SIZE.npc,
  health: npc.health,
  healthMax: npc.healthMax,
  isDead: npc.dead,
  isMoving: npc.moving,
  mapColor: npc.mapColor ?? '',
  kill_score: npc.killScore ?? 1,
  deathEffectTimer: npc.deathEffectTimer ?? 0
});

/** Java 子弹 -> 前端子弹快照 */
export const H_toBulletEntity = (bullet: JavaBullet): Record<string, unknown> => ({
  id: bullet.id,
  type: 'dynamic',
  kind: 'bullet',
  tag: H_BULLET_TAG,
  name: '',
  position: H_toPosition(bullet.position),
  velocity: H_toPosition(bullet.velocity),
  velocityX: bullet.velocity.x,
  velocityY: bullet.velocity.y,
  ownerId: bullet.ownerId ?? null,
  teamId: null,
  width: H_FIXED_SIZE.bullet,
  height: H_FIXED_SIZE.bullet,
  damage: H_BULLET_DAMAGE,
  bulletColor: bullet.bulletColor ?? '',
  shouldRemove: false
});

/** Java 炸弹 -> 前端手雷快照 */
export const H_toGrenadeEntity = (grenade: JavaGrenade): Record<string, unknown> => ({
  id: grenade.id,
  type: 'dynamic',
  kind: 'grenade',
  tag: grenade.tag,
  name: '',
  position: H_toPosition(grenade.position),
  ownerId: grenade.ownerId ?? null,
  teamId: null,
  width: H_FIXED_SIZE.grenade,
  height: H_FIXED_SIZE.grenade,
  isDead: false,
  fuseRatio: grenade.fuseRatio
});

/** Java 经验球 -> 前端经验球快照 */
export const H_toExpOrbEntity = (orb: JavaExpOrb): Record<string, unknown> => ({
  id: orb.id,
  type: 'dynamic',
  kind: 'exp_orb',
  tag: 'exp_orb',
  name: '经验球',
  position: H_toPosition(orb.position),
  width: H_FIXED_SIZE.expOrb,
  height: H_FIXED_SIZE.expOrb,
  value: orb.value,
  isPickedUp: false
});

/** Java 技能球 -> 前端技能球快照 */
export const H_toSkillOrbEntity = (orb: JavaSkillOrb): Record<string, unknown> => ({
  id: orb.id,
  type: 'dynamic',
  kind: 'skill_orb',
  tag: 'skill_orb',
  name: '技能球',
  position: H_toPosition(orb.position),
  width: H_FIXED_SIZE.skillOrb,
  height: H_FIXED_SIZE.skillOrb,
  skillTag: orb.skillTag,
  isPickedUp: false
});

/** Java 地面物品 -> 前端物品快照 */
export const H_toItemEntity = (item: JavaItem): Record<string, unknown> => ({
  id: item.id,
  type: 'item',
  tag: item.tag,
  name: item.name,
  position: H_toPosition(item.position),
  width: H_FIXED_SIZE.item,
  height: H_FIXED_SIZE.item,
  count: item.count,
  lifetimeTotal: H_ITEM_LIFETIME_SECONDS,
  lifetimeRemaining: item.lifetimeRatio * H_ITEM_LIFETIME_SECONDS,
  isDisappearing: false,
  disappearTimer: 0,
  collisionBox: { x: item.position.x, y: item.position.y, width: 0, height: 0 }
});

/**
 * 把 Java 快照映射为前端 MapData。
 *
 * 注意:自己的玩家实体固定放在玩家列表首位,前端以 `playerEntityList[0]` 作为本地玩家。
 */
export const H_toClientMapData = (snapshot: JavaSnapshot): MapData => {
  const selfEntity = H_toPlayerEntity(snapshot.self, snapshot.selfPrivate, true);
  const otherPlayers = snapshot.players
    .filter((player: JavaPlayerPublic) => player.id !== snapshot.self.id)
    .map((player: JavaPlayerPublic) => H_toPlayerEntity(player, null, false));

  const mapData = {
    staticEntities: [],
    dynamicEntitie: {
      playerDynamicEntitys: [selfEntity, ...otherPlayers],
      npcDynamicEntitys: snapshot.npcs.map(H_toNpcEntity),
      bulletDynamicEntitys: snapshot.bullets.map(H_toBulletEntity),
      grenadeDynamicEntitys: snapshot.grenades.map(H_toGrenadeEntity),
      expOrbDynamicEntitys: snapshot.expOrbs.map(H_toExpOrbEntity),
      skillOrbDynamicEntitys: snapshot.skillOrbs.map(H_toSkillOrbEntity)
    },
    itemEntities: snapshot.items.map(H_toItemEntity)
  };
  return mapData as unknown as MapData;
};

/** 构建"初始地图数据"指令(含静态实体,仅在 welcome 时下发一次) */
export const H_toMapDataInitialInstruct = (welcome: JavaWelcome): InstructObject => ({
  type: 'map_data_initial',
  class: '',
  conveyor: 'server',
  time: '',
  data: {
    staticEntities: H_toStaticEntities(welcome),
    dynamicEntitie: {
      playerDynamicEntitys: welcome.players.map((player: JavaPlayerPublic) =>
        H_toPlayerEntity(player, null, player.id === welcome.playerId)),
      npcDynamicEntitys: [],
      bulletDynamicEntitys: [],
      grenadeDynamicEntitys: [],
      expOrbDynamicEntitys: [],
      skillOrbDynamicEntitys: []
    },
    itemEntities: []
  }
});

/** 构建"动态地图数据"指令(每帧快照) */
export const H_toSnapshotInstruct = (snapshot: JavaSnapshot): InstructObject => ({
  type: 'map_data_dynamic_item_update',
  class: '',
  conveyor: 'server',
  time: '',
  data: H_toClientMapData(snapshot)
});

/** 把前端数据包中的指令转成 Java 客户端消息(null 表示该指令不需要下发) */
export const H_toJavaClientMessages = (dataPackage: DataPackage): JavaClientEnvelope[] => {
  const messages: JavaClientEnvelope[] = [];
  const instructs = dataPackage?.data?.instructs ?? [];
  for (const instruct of instructs) {
    const message = H_toJavaClientMessage(instruct);
    if (message !== null) {
      messages.push(message);
    }
  }
  return messages;
};

/** 单条前端指令 -> Java 客户端消息 */
export const H_toJavaClientMessage = (instruct: InstructObject): JavaClientEnvelope | null => {
  const data = (instruct.data ?? {}) as Record<string, unknown>;
  switch (instruct.type) {
    case 'player_move_input':
      return { type: 'move_input', data: { moveState: data.moveState } };
    case 'player_fire_input':
      return { type: 'fire_input', data: { target: data.target } };
    case 'player_dodge_input':
      return { type: 'dodge_input', data: { direction: data.direction } };
    case 'player_respawn':
      return { type: 'respawn', data: {} };
    case 'inventory_update':
      return { type: 'inventory_update', data: { inventory: data.inventory } };
    case 'inventory_use_item':
      return { type: 'inventory_use_item', data: { uid: data.uid } };
    case 'servant_editor_delete':
      return { type: 'servant_editor_delete', data: { npcId: data.npcId } };
    case 'servant_editor_rotate':
      return { type: 'servant_editor_rotate', data: { npcId: data.npcId } };
    case 'tick_pause':
      return { type: 'tick_pause', data: { paused: data.paused } };
    default:
      return null;
  }
};
