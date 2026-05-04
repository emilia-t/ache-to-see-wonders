import type { DataPackage, InstructObject, MapData, Point, TickTimer } from '@/components/pixel_war/interface/Interface';
import { Instruct } from '@/components/pixel_war/instruct/Instruct';
import {
  CurbStaticEntity,
  DynamicEntity,
  ItemEntity,
  NpcDynamicEntity,
  OrdinaryBulletDynamicEntity,
  PlayerDynamicEntity,
  WhitePixelEntity,
} from '@/components/pixel_war/class';

////////////////////
// 常量区-->
////////////////////
const SERVICE: Worker = self as any;
const RDEC_ITERATIONS = 3;
const RDEC_SEPARATION_EPSILON = 0.1;
const PLAYER_FIRE_COOLDOWN = 0.12;
const TICK_TIMER: TickTimer = {
  interval: 20,
  id: 0,
  status: 'initial',
  tick: {
    tickCount: 0,
    tickTime: performance.now()
  }
};
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
////////////////////
//<--变量区
////////////////////

const getDynamicEntityList = (): DynamicEntity[] => [
  ...MAP_DATA.dynamicEntitie.playerDynamicEntitys,
  ...MAP_DATA.dynamicEntitie.npcDynamicEntitys,
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

  MAP_DATA.dynamicEntitie.npcDynamicEntitys.push(new WhitePixelEntity({ x: 50, y: 50 }));
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
  const dynamicEntityList = getDynamicEntityList();
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

const updateProjectileEntities = (deltaTime: number): boolean => {
  if (MAP_DATA.dynamicEntitie.bulletDynamicEntitys.length === 0) return false;

  let changed = false;
  const dynamicEntityList = getDynamicEntityList();
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
  const dynamicEntityList = getDynamicEntityList().filter(entity => !entity.isDead);
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
  const dynamicEntityList = getDynamicEntityList();

  for (const entity of dynamicEntityList) {
    entity.update(deltaTime, MAP_DATA.staticEntities);
    entity.updateDamageEffect(deltaTime);
    entity.updateDeathEffect(deltaTime);
  }

  removeFinishedDeadDynamicEntities();
  resolveDynamicEntityCollisions();

  for (const entity of getDynamicEntityList()) {
    if (entity instanceof PlayerDynamicEntity) continue;
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
  }
};

const updateGame = (deltaTime: number) => {
  cooldownNormalAttack = Math.max(0, cooldownNormalAttack - deltaTime);
  updateItemEntityLifetimes(deltaTime);
  updateDynamicEntities(deltaTime);
  updateDynamicEntityItemPickups();
  updateProjectileEntities(deltaTime);
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
