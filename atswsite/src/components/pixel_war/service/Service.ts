import type { DataPackage, InstructObject, MapData, Point, TickTimer } from '@/components/pixel_war/interface/Interface';
import { Instruct } from '@/components/pixel_war/instruct/Instruct';
import {
  CurbStaticEntity,
  BulletDynamicEntity,
  DynamicEntity,
  NpcDynamicEntity,
  OrdinaryBulletDynamicEntity,
  PlayerDynamicEntity,
  WhitePixelEntity,
} from '@/components/pixel_war/class';

////////////////////
// 常量区-->
////////////////////
// 当前 Worker 实例,用于接收客户端指令并回传地图快照
const SERVICE: Worker = self as any;
// 动态实体碰撞分离的迭代次数,单位次
const RDEC_ITERATIONS = 3;
// 动态实体碰撞分离时额外推出的距离,单位:px
const RDEC_SEPARATION_EPSILON = 0.1;
// 玩家普通射击冷却时间,单位秒
const PLAYER_FIRE_COOLDOWN = 0.12;
// 玩家周围 0-200px 半径内为禁刷怪区,单位px
const NPC_SPAWN_NO_SPAWN_RADIUS = 200;
// 玩家周围 200-400px 半径内为高频刷怪区外边界,单位px
const NPC_SPAWN_HIGH_RADIUS = 400;
// 玩家周围 400-800px 半径内为中频刷怪区外边界,单位px
const NPC_SPAWN_MEDIUM_RADIUS = 800;
// 玩家周围 800-1600px 半径内为低频刷怪区外边界,单位px
const NPC_SPAWN_LOW_RADIUS = 1600;
// 高频刷怪区生成间隔,单位秒
const NPC_SPAWN_HIGH_INTERVAL = 4;
// 中频刷怪区生成间隔,单位秒
const NPC_SPAWN_MEDIUM_INTERVAL = 8;
// 低频刷怪区生成间隔,单位秒
const NPC_SPAWN_LOW_INTERVAL = 16;
// 地图中同时存在的 NPC 数量上限,单位个
const NPC_SPAWN_MAX_COUNT = 80;
// 每次刷怪在目标环形区域内寻找可用生成点的最大尝试次数,单位次
const NPC_SPAWN_MAX_ATTEMPTS = 30;
// 新 NPC 与已有动态实体之间额外保留的安全距离,单位px
const NPC_SPAWN_DYNAMIC_PADDING = 12;
// 主循环计时器配置,interval 单位毫秒；tickTime 单位毫秒时间戳
const TICK_TIMER: TickTimer = {
  interval: 20,
  id: 0,
  status: 'initial',
  tick: {
    tickCount: 0,
    tickTime: performance.now()
  }
};
// 当前地图状态快照,包含动态实体、静态实体和物品实体列表
const MAP_DATA: MapData = {
  dynamicEntitie: {
    bulletDynamicEntitys: [],
    grenadeDynamicEntitys: [],
    npcDynamicEntitys: [],
    playerDynamicEntitys: []
  },
  staticEntities: [],
  itemEntities: []
};
////////////////////
//<--常量区
////////////////////

////////////////////
// 变量区-->
////////////////////
let lastTickTime = performance.now();
let cooldownNormalAttack = 0;
let npcSpawnHighTimer = NPC_SPAWN_HIGH_INTERVAL;
let npcSpawnMediumTimer = NPC_SPAWN_MEDIUM_INTERVAL;
let npcSpawnLowTimer = NPC_SPAWN_LOW_INTERVAL;
////////////////////
//<--变量区
////////////////////

const getNpcPlayerDynamicEntityList = (): DynamicEntity[] => [
  ...MAP_DATA.dynamicEntitie.playerDynamicEntitys,
  ...MAP_DATA.dynamicEntitie.npcDynamicEntitys
];

const refreshPlayerMoveState = (moveState: Partial<typeof PlayerDynamicEntity.playerMoveState>) => {
  PlayerDynamicEntity.playerMoveState.playerMoveW = moveState.playerMoveW === true;
  PlayerDynamicEntity.playerMoveState.playerMoveA = moveState.playerMoveA === true;
  PlayerDynamicEntity.playerMoveState.playerMoveS = moveState.playerMoveS === true;
  PlayerDynamicEntity.playerMoveState.playerMoveD = moveState.playerMoveD === true;
};

////////////////////
// 初始化函数区-->
////////////////////
const main = () => {
  startSetting();
  SERVICE.addEventListener('message', handleMessage);
  sendMapDataInitial(MAP_DATA);
};

const startSetting = () => {
  initMapData();
  runTickTimer();
};

const runTickTimer = () => {
  TICK_TIMER.status = 'running';
  lastTickTime = performance.now();
  TICK_TIMER.id = setInterval(() => {
    const now = performance.now();
    const deltaTime = Math.min(0.05, Math.max(0, (now - lastTickTime) / 1000));
    lastTickTime = now;
    TICK_TIMER.tick.tickCount++;
    TICK_TIMER.tick.tickTime = now;
    updateGame(deltaTime);
    sendMapDataUpdate(MAP_DATA);
  }, TICK_TIMER.interval) as unknown as number;
};

const initMapData = () => {
  const curbHalfside = 10000;// 边长的一半(px)
  const step      = 50;// 每个curb之间的间距(px)
  const offset = step/2;// 偏移量(px)

  for (let x = -curbHalfside + offset; x <= curbHalfside - offset; x += step) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity({ x, y: -curbHalfside - 25 }));
  }
  for (let x = -curbHalfside + offset; x <= curbHalfside - offset; x += step) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity({ x, y: curbHalfside + 25 }));
  }
  for (let y = -curbHalfside + offset; y <= curbHalfside - offset; y += step) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity({ x: -curbHalfside - 25, y }));
  }
  for (let y = -curbHalfside + offset; y <= curbHalfside - offset; y += step) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity({ x: curbHalfside + 25, y }));
  }
  MAP_DATA.staticEntities.push(new CurbStaticEntity({ x: curbHalfside + 25, y: curbHalfside + 25 }));
  MAP_DATA.staticEntities.push(new CurbStaticEntity({ x: curbHalfside + 25, y: -curbHalfside - 25 }));
  MAP_DATA.staticEntities.push(new CurbStaticEntity({ x: -curbHalfside - 25, y: curbHalfside + 25 }));
  MAP_DATA.staticEntities.push(new CurbStaticEntity({ x: -curbHalfside - 25, y: -curbHalfside - 25 }));

  MAP_DATA.dynamicEntitie.playerDynamicEntitys.push(new PlayerDynamicEntity({ x: 0, y: 0 }, 'Player', true));
};
////////////////////
//<--初始化函数区
////////////////////

////////////////////
// 游戏逻辑区-->
////////////////////

const spawnPlayerBullet = (targetCanvas: Point) => {
  const playerEntity = MAP_DATA.dynamicEntitie.playerDynamicEntitys[0];
  if (!playerEntity || playerEntity.isDead) return;
  if (cooldownNormalAttack > 0) return;

  const dx = targetCanvas.x - playerEntity.position.x;
  const dy = targetCanvas.y - playerEntity.position.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.0001) return;

  const direction = { x: dx / len, y: dy / len };
  const spawnDistance = playerEntity.width * 0.6;
  MAP_DATA.dynamicEntitie.bulletDynamicEntitys.push(
    new OrdinaryBulletDynamicEntity(
      {
        x: playerEntity.position.x + direction.x * spawnDistance,
        y: playerEntity.position.y + direction.y * spawnDistance,
      },
      direction,
      playerEntity.id
    )
  );
  cooldownNormalAttack = PLAYER_FIRE_COOLDOWN;
};

const updateItemEntityLifetimes = (deltaTime: number): boolean => {
  if (MAP_DATA.itemEntities.length === 0) return false;
  const oldLength = MAP_DATA.itemEntities.length;
  for (const item of MAP_DATA.itemEntities) {
    item.updateLifetime(deltaTime);
  }
  MAP_DATA.itemEntities = MAP_DATA.itemEntities.filter(item => !item.isReadyToRemove());
  return MAP_DATA.itemEntities.length !== oldLength;
};

const updateDynamicEntityItemPickups = (): boolean => {
  const dynamicEntityList = getNpcPlayerDynamicEntityList();
  if (MAP_DATA.itemEntities.length === 0 || dynamicEntityList.length === 0) return false;

  let pickedAny = false;
  for (const item of MAP_DATA.itemEntities) {
    if (item.isDisappearing) continue;
    for (const dynamicEntity of dynamicEntityList) {
      if (dynamicEntity.isDead) continue;
      if (dynamicEntity instanceof NpcDynamicEntity || dynamicEntity instanceof PlayerDynamicEntity) {
        if (dynamicEntity.tryPickupItem(item)) {
          dynamicEntity.pickupItem(item);
          item.beginDisappear();
          pickedAny = true;
          break;
        }
      }
    }
  }
  return pickedAny;
};

const spawnDynamicEntityBullet = (bullet: BulletDynamicEntity) => {
  MAP_DATA.dynamicEntitie.bulletDynamicEntitys.push(bullet);
};

const removeFinishedDeadDynamicEntities = (): boolean => {
  const oldNpcLength = MAP_DATA.dynamicEntitie.npcDynamicEntitys.length;
  const oldPlayerLength = MAP_DATA.dynamicEntitie.playerDynamicEntitys.length;
  MAP_DATA.dynamicEntitie.npcDynamicEntitys = MAP_DATA.dynamicEntitie.npcDynamicEntitys.filter(entity => !entity.isDeathEffectFinished());
  MAP_DATA.dynamicEntitie.playerDynamicEntitys = MAP_DATA.dynamicEntitie.playerDynamicEntitys.filter(entity => !entity.isDeathEffectFinished());
  return (
    oldNpcLength !== MAP_DATA.dynamicEntitie.npcDynamicEntitys.length ||
    oldPlayerLength !== MAP_DATA.dynamicEntitie.playerDynamicEntitys.length
  );
};

const updateBulletEntities = (deltaTime: number): boolean => {
  if (MAP_DATA.dynamicEntitie.bulletDynamicEntitys.length === 0) return false;

  let changed = false;
  const dynamicEntityList = getNpcPlayerDynamicEntityList();
  for (const bullet of MAP_DATA.dynamicEntitie.bulletDynamicEntitys) {
    bullet.update(deltaTime, MAP_DATA.staticEntities);
    if (bullet.shouldRemove) {
      changed = true;
      continue;
    }

    for (const entity of dynamicEntityList) {
      if (entity.isDead) continue;
      if (entity.id === bullet.ownerId) continue; // 避免自己击杀自己
      const hitDistance = Math.hypot(
        entity.position.x - bullet.position.x,
        entity.position.y - bullet.position.y
      );
      const hitRadius = entity.width * 0.45 + bullet.width * 0.5;

      if (hitDistance <= hitRadius) {
        entity.applyDamage(bullet.damage);
        bullet.shouldRemove = true;
        changed = true;
        break;
      }
    }
  }

  const oldLength = MAP_DATA.dynamicEntitie.bulletDynamicEntitys.length;
  MAP_DATA.dynamicEntitie.bulletDynamicEntitys = MAP_DATA.dynamicEntitie.bulletDynamicEntitys.filter(bullet => !bullet.shouldRemove);
  return changed || oldLength !== MAP_DATA.dynamicEntitie.bulletDynamicEntitys.length;
};

const setRandomTargetForDynamic = (entity: DynamicEntity): boolean => {

  const radius = Math.max(1, entity.wanderRange);
  const center = entity.position;
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * Math.sqrt(Math.random());
    const target: Point = {
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist,
    };

    let safe = true;
    for (const se of MAP_DATA.staticEntities) {
      const box = se.collisionBox;
      if (
        target.x >= box.x &&
        target.x <= box.x + box.width &&
        target.y >= box.y &&
        target.y <= box.y + box.height
      ) {
        safe = false;
        break;
      }
    }
    if (safe && entity.setTarget(target, MAP_DATA.staticEntities)) {
      return true;
    }
    attempts++;
  }

  return entity.tryFallbackTarget(MAP_DATA.staticEntities);
};

const resolveDynamicEntityCollisions = () => {
  const dynamicEntityList = getNpcPlayerDynamicEntityList().filter(entity => !entity.isDead);
  if (dynamicEntityList.length < 2) return;

  for (let iter = 0; iter < RDEC_ITERATIONS; iter++) {
    for (let i = 0; i < dynamicEntityList.length - 1; i++) {
      const entityA = dynamicEntityList[i];
      for (let j = i + 1; j < dynamicEntityList.length; j++) {
        const entityB = dynamicEntityList[j];
        const boxA = entityA.collisionBox;
        const boxB = entityB.collisionBox;
        const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
        const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);

        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const pushX = overlapX / 2 + RDEC_SEPARATION_EPSILON;
          const direction = entityA.position.x <= entityB.position.x ? -1 : 1;
          entityA.position.x += direction * pushX;
          entityB.position.x -= direction * pushX;
        } else {
          const pushY = overlapY / 2 + RDEC_SEPARATION_EPSILON;
          const direction = entityA.position.y <= entityB.position.y ? -1 : 1;
          entityA.position.y += direction * pushY;
          entityB.position.y -= direction * pushY;
        }

        entityA.updateCollisionBox();
        entityB.updateCollisionBox();
      }
    }
  }
};

const updateDynamicEntities = (deltaTime: number) => {
  const dynamicEntityList = getNpcPlayerDynamicEntityList();
  const actionLoopContext = {
    deltaTime,
    staticEntities: MAP_DATA.staticEntities,
    spawnBullet: spawnDynamicEntityBullet,
  };

  for (const entity of dynamicEntityList) {
    entity.update(deltaTime, MAP_DATA.staticEntities);
    entity.updateDamageEffect(deltaTime);
    entity.updateDeathEffect(deltaTime);
  }

  removeFinishedDeadDynamicEntities();
  resolveDynamicEntityCollisions();

  for (const entity of getNpcPlayerDynamicEntityList()) {
    entity.updateCrowdStuckState(deltaTime);
    entity.updateStayDuration(deltaTime);
    entity.updateStaticCompressionEffects(deltaTime, MAP_DATA.staticEntities);

    if (entity.updateNoMovementWatchdog(deltaTime)) {
      setRandomTargetForDynamic(entity);
      continue;
    }

    if (entity.canGetNewWanderTarget(deltaTime, MAP_DATA.staticEntities)) {
      setRandomTargetForDynamic(entity);
    }

    entity.actionLoop(actionLoopContext);
  }
};

/**
 * 在指定环形范围内随机生成一个点
 * 半径使用世界坐标 px,随机面积在环内均匀分布
 */
const getRandomPointInRing = (center: Point, minRadius: number, maxRadius: number): Point => {
  const angle = Math.random() * Math.PI * 2;
  const minSquare = minRadius * minRadius;
  const maxSquare = maxRadius * maxRadius;
  const radius = Math.sqrt(minSquare + Math.random() * (maxSquare - minSquare));
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
};

const canSpawnNpcAt = (position: Point): boolean => {
  const halfW = WhitePixelEntity.WIDTH / 2;
  const halfH = WhitePixelEntity.HEIGHT / 2;
  const spawnBox = {
    x: position.x - halfW,
    y: position.y - halfH,
    width: WhitePixelEntity.WIDTH,
    height: WhitePixelEntity.HEIGHT,
  };

  for (const staticEntity of MAP_DATA.staticEntities) {
    const box = staticEntity.collisionBox;
    const separated =
      spawnBox.x + spawnBox.width <= box.x ||
      spawnBox.x >= box.x + box.width ||
      spawnBox.y + spawnBox.height <= box.y ||
      spawnBox.y >= box.y + box.height;
    if (!separated) return false;
  }

  for (const entity of getNpcPlayerDynamicEntityList()) {
    if (entity.isDead) continue;
    const minDistance =
      Math.max(WhitePixelEntity.WIDTH, WhitePixelEntity.HEIGHT) / 2 +
      Math.max(entity.width, entity.height) / 2 +
      NPC_SPAWN_DYNAMIC_PADDING;
    if (Math.hypot(position.x - entity.position.x, position.y - entity.position.y) < minDistance) {
      return false;
    }
  }

  return true;
};

const spawnNpcInRingAroundPlayer = (
  playerEntity: PlayerDynamicEntity,
  minRadius: number,
  maxRadius: number
): boolean => {
  for (let i = 0; i < NPC_SPAWN_MAX_ATTEMPTS; i++) {
    const position = getRandomPointInRing(playerEntity.position, minRadius, maxRadius);
    if (!canSpawnNpcAt(position)) continue;

    const npc = new WhitePixelEntity(position);
    npc.setTarget(position, MAP_DATA.staticEntities, { preferStraight: true });
    MAP_DATA.dynamicEntitie.npcDynamicEntitys.push(npc);
    return true;
  }
  return false;
};

const updateNpcSpawnTimer = (
  timer: number,
  deltaTime: number,
  interval: number,
  playerEntity: PlayerDynamicEntity,
  minRadius: number,
  maxRadius: number
) => {
  let nextTimer = timer - deltaTime;
  while (nextTimer <= 0 && MAP_DATA.dynamicEntitie.npcDynamicEntitys.length < NPC_SPAWN_MAX_COUNT) {
    spawnNpcInRingAroundPlayer(playerEntity, minRadius, maxRadius);
    nextTimer += interval;
  }
  return nextTimer;
};

/**
 * 玩家周围随机刷新 NPC
 * 0-200px 为禁刷怪区,200-400px 为高频区,400-800px 为中频区,800-1600px 为低频区
 */
const generateNpcAroundPlayer = (deltaTime: number) => {
  const playerEntity = MAP_DATA.dynamicEntitie.playerDynamicEntitys[0];
  if (!playerEntity || playerEntity.isDead) return;
  if (MAP_DATA.dynamicEntitie.npcDynamicEntitys.length >= NPC_SPAWN_MAX_COUNT) return;

  npcSpawnHighTimer = updateNpcSpawnTimer(
    npcSpawnHighTimer,
    deltaTime,
    NPC_SPAWN_HIGH_INTERVAL,
    playerEntity,
    NPC_SPAWN_NO_SPAWN_RADIUS,
    NPC_SPAWN_HIGH_RADIUS
  );
  npcSpawnMediumTimer = updateNpcSpawnTimer(
    npcSpawnMediumTimer,
    deltaTime,
    NPC_SPAWN_MEDIUM_INTERVAL,
    playerEntity,
    NPC_SPAWN_HIGH_RADIUS,
    NPC_SPAWN_MEDIUM_RADIUS
  );
  npcSpawnLowTimer = updateNpcSpawnTimer(
    npcSpawnLowTimer,
    deltaTime,
    NPC_SPAWN_LOW_INTERVAL,
    playerEntity,
    NPC_SPAWN_MEDIUM_RADIUS,
    NPC_SPAWN_LOW_RADIUS
  );
};


const updateGame = (deltaTime: number) => {
  cooldownNormalAttack = Math.max(0, cooldownNormalAttack - deltaTime);
  updateItemEntityLifetimes(deltaTime);
  updateDynamicEntities(deltaTime);
  updateDynamicEntityItemPickups();
  updateBulletEntities(deltaTime);
  generateNpcAroundPlayer(deltaTime);
  removeFinishedDeadDynamicEntities();
};
////////////////////
//<--游戏逻辑区
////////////////////

////////////////////
// 事件处理区-->
////////////////////
const handleMessage = (message: MessageEvent) => {
  const dpkg = message.data as DataPackage;
  const instructs = dpkg?.data?.instructs || [];
  for (const instruct of instructs) {
    handleInstruct(instruct);
  }
};

const handleInstruct = (instruct: InstructObject) => {
  switch (instruct.type) {
    case 'player_move_input': {
      refreshPlayerMoveState(instruct.data);
      break;
    }
    case 'player_fire_input': {
      spawnPlayerBullet(instruct.data as Point);
      break;
    }
    default: {
      console.warn('Service received unknown instruct type:', instruct.type, instruct);
      break;
    }
  }
};
////////////////////
//<--事件处理区
////////////////////

////////////////////
// 通信处理区-->
////////////////////
const sendDataPackage = (dataPackage: DataPackage) => {
  SERVICE.postMessage(dataPackage);
};

const createDataPackage = (instructs: InstructObject[]): DataPackage => ({
  tick: { ...TICK_TIMER.tick },
  data: { instructs }
});

const sendMapDataInitial = (mapData: MapData) => {
  sendDataPackage(createDataPackage([Instruct.I_MapDataInitial(mapData)]));
};

const sendMapDataUpdate = (mapData: MapData) => {
  sendDataPackage(createDataPackage([Instruct.I_MapDataUpdate(mapData)]));
};
////////////////////
//<--通信处理区
////////////////////

main();
