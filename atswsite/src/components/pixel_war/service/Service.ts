import type { 
  DataPackage,
  InstructObject,
  MapData,
  Point,
  TickTimer,
  GameConfig
} from '@/components/pixel_war/interface/Interface';
import { Instruct } from '@/components/pixel_war/instruct/Instruct';
import {
  CurbStaticEntity,
  BulletDynamicEntity,
  DynamicEntity,
  NpcDynamicEntity,
  OrdinaryBulletDynamicEntity,
  PlayerDynamicEntity,
  WhitePixelEntity,
  RedPixelEntity,
  RedPixelBombEntity,
  HealingGemItemEntity,
  GrenadeDynamicEntity
} from '@/components/pixel_war/class';
import { RedIntegerFormat } from 'three';

////////////////////
// 常量区-->
////////////////////
// 当前 Worker 实例,用于接收客户端指令并回传地图快照
const SERVICE: Worker = self as any;

const GCFG:GameConfig = {
  npcSpawnNoSpawnRadius:200,// 玩家周围 0-200px 半径内为禁刷怪区,单位px
  npcSpawnHighRadius:400,// 玩家周围 200-400px 半径内为高频刷怪区外边界,单位px
  npcSpawnMediumRadius:800,// 玩家周围 400-800px 半径内为中频刷怪区外边界,单位px
  npcSpawnLowRadius:1600,// 玩家周围 800-1600px 半径内为低频刷怪区外边界,单位px
  npcSpawnHighInterval:4,// 高频刷怪区生成间隔,单位秒
  npcSpawnMediumInterval:8,// 中频刷怪区生成间隔,单位秒
  npcSpawnLowInterval:16,// 低频刷怪区生成间隔,单位秒
  npcSpawnMaxCountSinglePlayer:30,// 地图中同时存在的 NPC 数量上限,单位个
  npcSpawnMaxAttempts:30,// 每次刷怪在目标环形区域内寻找可用生成点的最大尝试次数,单位次
  npcSpawnPadding:12,// 新 NPC 与已有动态实体之间额外保留的安全距离,单位px
  
  itemSpawnNoSpawnRadius:200,// 玩家周围 0-200px 
  itemSpawnHighRadius:400,// 玩家周围 200-400px 
  itemSpawnMediumRadius:800,// 玩家周围 400-800px 
  itemSpawnLowRadius:1600,// 玩家周围 800-1600px 
  itemSpawnHighInterval:4,// 高频生成间隔,单位秒
  itemSpawnMediumInterval:8,// 中频生成间隔,单位秒
  itemSpawnLowInterval:16,// 低频生成间隔,单位秒
  itemSpawnMaxCountSinglePlayer:10,// 地图中同时存在的 ITEM 数量上限,单位个
  itemSpawnMaxAttempts:30, // 每Tk最大尝试生成次数
  itemSpawnPadding:50,// 生成物品的间距

  singleplayerMode: true
}

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
// 生成权重
const SPAWNABLE_NPC_CLASSES = [
  RedPixelEntity,
  WhitePixelEntity
  // more
] as const;

// 预先计算每个 NPC 的权重,并验证权重是否合法
const NPC_WEIGHTS = SPAWNABLE_NPC_CLASSES.map((ctor) => {
  const weight = (ctor as any).GENERATE_WEIGHT; // 读取静态属性
  if (typeof weight !== 'number' || weight <= 0 || weight > 1) {
    throw new Error(
      `NPC class ${ctor.name} must have a static GENERATE_WEIGHT property in (0,1]`
    );
  }
  return { ctor, weight };
});
////////////////////
//<--常量区
////////////////////

////////////////////
// 变量区-->
////////////////////
let lastTickTime = performance.now();
let npcSpawnHighTimer = GCFG.npcSpawnHighInterval;
let npcSpawnMediumTimer = GCFG.npcSpawnMediumInterval;
let npcSpawnLowTimer = GCFG.npcSpawnLowInterval;
let itemSpawnHighTimer = GCFG.npcSpawnHighInterval;
let itemSpawnMediumTimer = GCFG.npcSpawnMediumInterval;
let itemSpawnLowTimer = GCFG.npcSpawnLowInterval;
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
    const deltaTime = Math.min(0.05, Math.max(0, (now - lastTickTime) / 1000));//转换为秒
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
  if (playerEntity.personRule.fireCooldownNow > 0) return;

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
  playerEntity.personRule.fireCooldownNow=playerEntity.personRule.fireCooldownMax;
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

const spawnBulletDynamicEntity = (bullet: BulletDynamicEntity) => {
  MAP_DATA.dynamicEntitie.bulletDynamicEntitys.push(bullet);
};

const spawnGrenadeDynamicEntity = (grenade: GrenadeDynamicEntity) => {
  MAP_DATA.dynamicEntitie.grenadeDynamicEntitys.push(grenade);
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


const updateGrenadeEntities = (deltaTime: number): boolean => {
  if (MAP_DATA.dynamicEntitie.grenadeDynamicEntitys.length === 0) return false;

  let changed = false;
  for (const grenade of MAP_DATA.dynamicEntitie.grenadeDynamicEntitys) {
    grenade.update(deltaTime, MAP_DATA.staticEntities,MAP_DATA.dynamicEntitie,GCFG);
  }

  const oldLength = MAP_DATA.dynamicEntitie.grenadeDynamicEntitys.length;
  MAP_DATA.dynamicEntitie.grenadeDynamicEntitys = MAP_DATA.dynamicEntitie.grenadeDynamicEntitys.filter(grenade => !grenade.isDead);
  return changed || oldLength !== MAP_DATA.dynamicEntitie.grenadeDynamicEntitys.length;
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

/**
 * 动态实体的碰撞处理
 * 包含碰撞检测
 * @returns 
 */
const resolveDynamicEntityCollisions = () => {
  const dynamicEntityList = getNpcPlayerDynamicEntityList().filter(entity => !entity.isDead);
  if (dynamicEntityList.length < 2) return;

  for (let iter = 0; iter < 3; iter++) {// 动态实体碰撞分离的迭代次数,单位次
    for (let i = 0; i < dynamicEntityList.length - 1; i++) {
      const entityA = dynamicEntityList[i];
      if(entityA instanceof PlayerDynamicEntity){
        /**
         * 对于玩家实体,不需要推开npc
         * 玩家将碰到自己的npc吸附为servant
         * npc的运动方式将被动接受玩家的运动(移动)
         */
        for (let j = i + 1; j < dynamicEntityList.length; j++) {
          const entityB = dynamicEntityList[j];
          if(!(entityB instanceof NpcDynamicEntity))continue;
          if(entityA.selectServantByID(entityB.id)!==null)continue;//避免重复添加
          const boxA = entityA.collisionBox;
          const boxB = entityB.collisionBox;
          const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);// 叠合长度
          const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);

          if (overlapX <= 0 || overlapY <= 0){continue;}//没有产生碰撞
          else{//产生碰撞
            //1.根据npc的坐标判断添加到player的servant的哪个位置
            let RC = entityA.worldPositionToRowCol(entityB.position);
            if(RC === null){
              continue;// npc位置无法映射到玩家的servantGrid
            }
            //2.更新玩家的servantGrid
            let servant = entityA.selectServantByRC(RC.row,RC.col);
            if(servant===null){
              continue;// 玩家的servantGrid为空
            }
            if(servant.exist === true){
              continue;// 当期位置已经占用了
            }
            let setStatus = entityA.setServant(RC.row,RC.col,entityB.id);
            if(setStatus === false){
              continue;// 设置失败
            }
            else{//设置成功
              //3.修改npc部分属性
              let newPosition = entityA.rowColToWorldPosition(RC.row,RC.col);
              if(newPosition === null){
                continue;// RC异常
              }
              entityB.ownerId = entityA.id;
            } 
          }
        }
      }
      else{
        /**
         * npc和npc之间的推挤保持原状
         */
        for (let j = i + 1; j < dynamicEntityList.length; j++) {
          const entityB = dynamicEntityList[j];
          const boxA = entityA.collisionBox;
          const boxB = entityB.collisionBox;
          const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);// 叠合长度
          const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);

          if (overlapX <= 0 || overlapY <= 0){continue;}//没有产生碰撞
          else{//产生碰撞
            if (overlapX < overlapY) {
              const pushX = overlapX / 2 + 0.1;//0.1PX 动态实体碰撞分离时额外推出的距离
              const direction = entityA.position.x <= entityB.position.x ? -1 : 1;
              entityA.position.x += direction * pushX;
              entityB.position.x -= direction * pushX;
            }
            else {
              const pushY = overlapY / 2 + 0.1;//0.1PX 动态实体碰撞分离时额外推出的距离
              const direction = entityA.position.y <= entityB.position.y ? -1 : 1;
              entityA.position.y += direction * pushY;
              entityB.position.y -= direction * pushY;
            }

            entityA.updateCollisionBox();
            entityB.updateCollisionBox();
          }
        }
      }
    }
  }
};

const updateDynamicEntities = (deltaTime: number) => {
  const dynamicEntityList = getNpcPlayerDynamicEntityList();
  const actionLoopContext = {
    deltaTime,
    staticEntities: MAP_DATA.staticEntities,
    spawnBullet: spawnBulletDynamicEntity,
    spawnGrenade: spawnGrenadeDynamicEntity
  };

  for (const entity of dynamicEntityList) {
    entity.update(deltaTime, MAP_DATA.staticEntities, MAP_DATA.dynamicEntitie, GCFG);
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

const canSpawnNpcOrItemAt = (position: Point,spawnItem:boolean,spawnNpc:boolean): boolean => {
  if(!spawnItem && !spawnNpc)return false;
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
    const maxPadding = Math.max(GCFG.npcSpawnPadding,GCFG.itemSpawnPadding);
    const padding = (spawnItem && spawnNpc) ? maxPadding : (spawnItem ? GCFG.itemSpawnPadding : GCFG.npcSpawnPadding);
    const minDistance =
      Math.max(WhitePixelEntity.WIDTH, WhitePixelEntity.HEIGHT) / 2 +
      Math.max(entity.width, entity.height) / 2 +
      padding;
    if (Math.hypot(position.x - entity.position.x, position.y - entity.position.y) < minDistance) {
      return false;
    }
  }

  return true;
};

/**
 * 尝试在玩家周围生成ITEM
 * @param playerEntity 
 * @param minRadius 
 * @param maxRadius 
 * @returns 
 */
const spawnItemInRingAroundPlayer = (
  playerEntity: PlayerDynamicEntity,
  minRadius: number,
  maxRadius: number
): boolean => {
  for (let i = 0; i < GCFG.itemSpawnMaxAttempts; i++) {
    const position = getRandomPointInRing(playerEntity.position, minRadius, maxRadius);
    if (!canSpawnNpcOrItemAt(position,true,false)) continue;

    //暂时只有一个item类型
    const item = new HealingGemItemEntity(position);

    MAP_DATA.itemEntities.push(item);
    return true;
  }
  return false;
};

/**
 * 尝试在玩家周围生成NPC
 * @param playerEntity 
 * @param minRadius 
 * @param maxRadius 
 * @returns 
 */
const spawnNpcInRingAroundPlayer = (
  playerEntity: PlayerDynamicEntity,
  minRadius: number,
  maxRadius: number
): boolean => {
  for (let i = 0; i < GCFG.npcSpawnMaxAttempts; i++) {
    const position = getRandomPointInRing(playerEntity.position, minRadius, maxRadius);
    if (!canSpawnNpcOrItemAt(position, false, true)) continue;

    // 根据权重随机选择一个 NPC 类型
    const NpcCtor = selectRandomNpcCtor();
    const npc = new NpcCtor(position);
    npc.setTarget(position, MAP_DATA.staticEntities, { preferStraight: true });
    MAP_DATA.dynamicEntitie.npcDynamicEntitys.push(npc);
    return true;
  }
  return false;
};

/**
 * 根据静态权重随机选择一个 NPC 构造函数
 * 权重越高，被选中的概率越大
 */
const selectRandomNpcCtor = (): new (position: Point) => NpcDynamicEntity => {
  // 计算总权重（注意每个权重 <=1，总和可能小于 1，但无影响）
  const totalWeight = NPC_WEIGHTS.reduce((sum, { weight }) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  for (const { ctor, weight } of NPC_WEIGHTS) {
    if (random < weight) return ctor;
    random -= weight;
  }
  // fallback（理论上不会到达）
  return NPC_WEIGHTS[0].ctor;
};


const updateNpcSpawnTimer = (
  timer: number,
  deltaTime: number,
  interval: number,
  playerEntity: PlayerDynamicEntity,
  minRadius: number,
  maxRadius: number
) => {
  let nextTimer = timer - deltaTime;//global
  //deltaTime >= nextTimer
  while (nextTimer <= 0 && MAP_DATA.dynamicEntitie.npcDynamicEntitys.length < GCFG.npcSpawnMaxCountSinglePlayer) {
    spawnNpcInRingAroundPlayer(playerEntity, minRadius, maxRadius);
    nextTimer += interval;
  }
  return nextTimer;
};

const updateItemSpawnTimer = (
  timer: number,
  deltaTime: number,
  interval: number,
  playerEntity: PlayerDynamicEntity,
  minRadius: number,
  maxRadius: number
) => {
  let nextTimer = timer - deltaTime;//global
  //deltaTime >= nextTimer
  while (nextTimer <= 0 && MAP_DATA.dynamicEntitie.npcDynamicEntitys.length < GCFG.npcSpawnMaxCountSinglePlayer) {
    spawnItemInRingAroundPlayer(playerEntity, minRadius, maxRadius);
    nextTimer += interval;
  }
  return nextTimer;
};

/**
 * 玩家周围随机刷新 NPC
 * 0-200px 为禁刷区,200-400px 为高频区,400-800px 为中频区,800-1600px 为低频区
 */
const generateNpcAroundPlayerSingle = (deltaTime: number) => {
  const playerEntity = MAP_DATA.dynamicEntitie.playerDynamicEntitys[0];
  if (!playerEntity || playerEntity.isDead) return;
  if (MAP_DATA.dynamicEntitie.npcDynamicEntitys.length >= GCFG.npcSpawnMaxCountSinglePlayer) return;

  npcSpawnHighTimer = updateNpcSpawnTimer(
    npcSpawnHighTimer,
    deltaTime,
    GCFG.npcSpawnHighInterval,
    playerEntity,
    GCFG.npcSpawnNoSpawnRadius,
    GCFG.npcSpawnHighRadius
  );
  npcSpawnMediumTimer = updateNpcSpawnTimer(
    npcSpawnMediumTimer,
    deltaTime,
    GCFG.npcSpawnMediumInterval,
    playerEntity,
    GCFG.npcSpawnHighRadius,
    GCFG.npcSpawnMediumRadius
  );
  npcSpawnLowTimer = updateNpcSpawnTimer(
    npcSpawnLowTimer,
    deltaTime,
    GCFG.npcSpawnLowInterval,
    playerEntity,
    GCFG.npcSpawnMediumRadius,
    GCFG.npcSpawnLowRadius
  );
};



/**
 * 玩家周围随机刷新 物品
 * 0-200px 为禁刷区,200-400px 为高频区,400-800px 为中频区,800-1600px 为低频区
 */
const generateItemAroundPlayerSingle = (deltaTime: number) => {
  const playerEntity = MAP_DATA.dynamicEntitie.playerDynamicEntitys[0];
  if (!playerEntity || playerEntity.isDead) return;
  if (MAP_DATA.itemEntities.length >= GCFG.itemSpawnMaxCountSinglePlayer) return;

  itemSpawnHighTimer = updateItemSpawnTimer(
    itemSpawnHighTimer,
    deltaTime,
    GCFG.itemSpawnHighInterval,
    playerEntity,
    GCFG.itemSpawnNoSpawnRadius,
    GCFG.itemSpawnHighRadius
  );
  itemSpawnMediumTimer = updateItemSpawnTimer(
    itemSpawnMediumTimer,
    deltaTime,
    GCFG.itemSpawnMediumInterval,
    playerEntity,
    GCFG.itemSpawnHighRadius,
    GCFG.itemSpawnMediumRadius
  );
  itemSpawnLowTimer = updateItemSpawnTimer(
    itemSpawnLowTimer,
    deltaTime,
    GCFG.itemSpawnLowInterval,
    playerEntity,
    GCFG.itemSpawnMediumRadius,
    GCFG.itemSpawnLowRadius
  );
  
};



const updateGame = (deltaTime: number) => {
  updateItemEntityLifetimes(deltaTime);
  updateDynamicEntities(deltaTime);
  updateDynamicEntityItemPickups();
  updateBulletEntities(deltaTime);
  updateGrenadeEntities(deltaTime);
  generateNpcAroundPlayerSingle(deltaTime);
  generateItemAroundPlayerSingle(deltaTime);
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
