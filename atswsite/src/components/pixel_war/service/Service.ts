/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;
import type { 
  DataPackage,
  InstructObject,
  MapData,
  Point,
  TickTimer,
  GameConfig
} from '@/components/pixel_war/interface/Interface';
import { 
  Instruct
} from '@/components/pixel_war/instruct/Instruct';
import {
  StaticEntity,
  CurbStaticEntity,
  CurbStaticEntity8Length,
  BulletDynamicEntity,
  DynamicEntity,
  NpcDynamicEntity,
  OrdinaryBulletDynamicEntity,
  PlayerDynamicEntity,
  WhitePixelEntity,
  RedPixelEntity,
  HealingGemItemEntity,
  GrenadeDynamicEntity
} from '@/components/pixel_war/class';

////////////////////
// 常量区-->
////////////////////
// 当前 Worker 实例,用于接收客户端指令并回传地图快照
const SERVICE: DedicatedWorkerGlobalScope = self;

const GCFG:GameConfig = {
  npcSpawnNoSpawnRadius:200,// 玩家周围 0-200px 半径内为禁刷怪区,单位px
  npcSpawnHighRadius:400,// 玩家周围 200-400px 半径内为高频刷怪区外边界,单位px
  npcSpawnMediumRadius:800,// 玩家周围 400-800px 半径内为中频刷怪区外边界,单位px
  npcSpawnLowRadius:1600,// 玩家周围 800-1600px 半径内为低频刷怪区外边界,单位px
  npcSpawnHighInterval:4,// 高频刷怪区生成间隔,单位秒
  npcSpawnMediumInterval:8,// 中频刷怪区生成间隔,单位秒
  npcSpawnLowInterval:16,// 低频刷怪区生成间隔,单位秒
  npcSpawnMaxCountSinglePlayer:240,// 地图中同时存在的 NPC 数量上限,单位个
  npcSpawnMaxAttempts:30,// 每次刷怪在目标环形区域内寻找可用生成点的最大尝试次数,单位次
  npcSpawnPadding:12,// 新 NPC 与已有动态实体之间额外保留的安全距离,单位px
  
  itemSpawnNoSpawnRadius:200,// 玩家周围 0-200px 
  itemSpawnHighRadius:400,// 玩家周围 200-400px 
  itemSpawnMediumRadius:800,// 玩家周围 400-800px 
  itemSpawnLowRadius:1600,// 玩家周围 800-1600px 
  itemSpawnHighInterval:4,// 高频生成间隔,单位秒
  itemSpawnMediumInterval:8,// 中频生成间隔,单位秒
  itemSpawnLowInterval:16,// 低频生成间隔,单位秒
  itemSpawnMaxCountSinglePlayer:20,// 地图中同时存在的 ITEM 数量上限,单位个
  itemSpawnMaxAttempts:30, // 每Tk最大尝试生成次数
  itemSpawnPadding:50,// 生成物品的间距

  singleplayerMode: true,

  setRandomTargetMaxAttempts:1,

  worldSize: 20000,
  worldMinX: -10000,
  worldMaxX: 10000,
  worldMinY: -10000,
  worldMaxY: 10000
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
// 空间索引区 -->
////////////////////
/**
 * 简单网格索引，用于快速判断点是否与任何静态实体碰撞
 */
class StaticEntitySpatialGrid {
  private cellSize: number;// px
  private grid: Map<string, StaticEntity[]>;

  constructor(staticEntities: StaticEntity[], cellSize: number = 400) {
    this.cellSize = cellSize;//
    this.grid = new Map();
    for (const entity of staticEntities) {
      const box = entity.collisionBox;
      // 获取实体覆盖的所有格子（考虑可能跨格子）
      const minCellX = Math.floor(box.x / this.cellSize);
      const maxCellX = Math.floor((box.x + box.width) / this.cellSize);
      const minCellY = Math.floor(box.y / this.cellSize);
      const maxCellY = Math.floor((box.y + box.height) / this.cellSize);
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        for (let cy = minCellY; cy <= maxCellY; cy++) {
          const key = `${cx},${cy}`;
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key)!.push(entity);
        }
      }
    }
  }

  //用于获取指定矩形区域内的所有静态实体
  public getEntitiesInRect(x: number, y: number, width: number, height: number): StaticEntity[] {
    const minCellX = Math.floor(x / this.cellSize);
    const maxCellX = Math.floor((x + width) / this.cellSize);
    const minCellY = Math.floor(y / this.cellSize);
    const maxCellY = Math.floor((y + height) / this.cellSize);
    const result: StaticEntity[] = [];
    const added = new Set<StaticEntity>();

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const key = `${cx},${cy}`;
        const entities = this.grid.get(key);
        if (entities) {
          for (const e of entities) {
            if (!added.has(e)) {
              added.add(e);
              result.push(e);
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * 检查点 (x, y) 是否与任何静态实体碰撞（点在碰撞盒内即碰撞）
   */
  isPointColliding(x: number, y: number): boolean {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    // 检查自身及周围 8 个邻居格子（防止边界遗漏）
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`;
        const entities = this.grid.get(key);
        if (entities) {
          for (const se of entities) {
            const box = se.collisionBox;
            if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
}

let staticEntitySpatialGrid: StaticEntitySpatialGrid | null = null;
////////////////////
//<-- 空间索引区
////////////////////

////////////////////
// 排序与碰撞检测区 -->
////////////////////

// 内省排序 (Introsort)
// 静态实体 id => 排名
const  staticEntitySortA = {
  index: {},
  sort: []
};

// 内省排序 (Introsort)
// 动态实体 id => 排名
const dynamicEntitySortB = {
  index: {},
  sort: []
};

// 合并两个有序数组：使用双指针归并，O(|A| + |B|)，不需要重新全量排序。
const entitySortC = {
  index: {},
  sort: []
}


////////////////////
//<-- 排序与碰撞检测区
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

const getNpcPlayerDynamicEntityList = (): (PlayerDynamicEntity | NpcDynamicEntity)[] => [
  ...MAP_DATA.dynamicEntitie.playerDynamicEntitys,
  ...MAP_DATA.dynamicEntitie.npcDynamicEntitys
];

const getNpcDynamicEntityList = (): NpcDynamicEntity[] => [
  ...MAP_DATA.dynamicEntitie.npcDynamicEntitys
];

const getPlayerDynamicEntityById = (entityId: number):PlayerDynamicEntity|null => {
  for(const player of MAP_DATA.dynamicEntitie.playerDynamicEntitys){
    if(player.id === entityId) return player;
  }
  return null;
};

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
  // 添加错误边界
  SERVICE.addEventListener('error', (error) => {
    console.error('Worker internal error:', error);
  });
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
  const curbHalfside = GCFG.worldSize/2;          // 边界半长 (px)
  const tile = CurbStaticEntity8Length.TILE;       // 50
  const length = CurbStaticEntity8Length.LENGTH;   // 8
  const unit = tile * length;                      // 400 (单个长条覆盖长度)

  // 计算主体长条覆盖的起止范围：从 -curbHalfside + unit/2 到 curbHalfside - unit/2
  // 这样长条不会延伸到角部，为角部留出长度为 unit/2 的空隙 (即 200px)
  const start = -curbHalfside + unit / 2;
  const end = curbHalfside - unit / 2;

  // 1. 上边界 (方向 'up')，仅主体部分
  const topY = -curbHalfside - 25;
  for (let x = start; x <= end; x += unit) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity8Length({ x, y: topY }, 'up'));
  }

  // 2. 下边界 (方向 'down')
  const bottomY = curbHalfside + 25;
  for (let x = start; x <= end; x += unit) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity8Length({ x, y: bottomY }, 'down'));
  }

  // 3. 左边界 (方向 'left')
  const leftX = -curbHalfside - 25;
  for (let y = start; y <= end; y += unit) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity8Length({ x: leftX, y }, 'left'));
  }

  // 4. 右边界 (方向 'right')
  const rightX = curbHalfside + 25;
  for (let y = start; y <= end; y += unit) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity8Length({ x: rightX, y }, 'right'));
  }

  // 5. 四个角：用原有的 CurbStaticEntity（50×50）填补，确保无空隙且不重叠
  const corners = [
    { x: -curbHalfside - 25, y: -curbHalfside - 25 }, // 左上
    { x:  curbHalfside + 25, y: -curbHalfside - 25 }, // 右上
    { x: -curbHalfside - 25, y:  curbHalfside + 25 }, // 左下
    { x:  curbHalfside + 25, y:  curbHalfside + 25 }  // 右下
  ];
  for (const corner of corners) {
    MAP_DATA.staticEntities.push(new CurbStaticEntity(corner));
  }

  // 创建玩家实体
  MAP_DATA.dynamicEntitie.playerDynamicEntitys.push(
    new PlayerDynamicEntity({ x: -9800, y: -9800 }, createTeamIdLength14(), 'Player', true)
  );

  // 构建静态实体空间索引
  staticEntitySpatialGrid = new StaticEntitySpatialGrid(MAP_DATA.staticEntities, 400);
  DynamicEntity.staticEntitySpatialGrid = staticEntitySpatialGrid;
};
////////////////////
//<--初始化函数区
////////////////////

////////////////////
// 游戏逻辑区-->
////////////////////

const createTeamIdLength14 = (): number => {
  let num = Math.floor(Math.random() * 9) + 1;
  for (let i = 0; i < 13; i++) {
    num = num * 10 + Math.floor(Math.random() * 10);
  }
  return num;
};

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
      playerEntity.id,
      playerEntity.teamId
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

  const dynamicEntityList = getNpcPlayerDynamicEntityList().filter(e => !e.isDead);

  // 构建空间哈希以降低子弹与实体的碰撞检测复杂度
  const CELL_SIZE = 64;
  const cellKey = (cx: number, cy: number) => `${cx},${cy}`;
  const spatial = new Map<string, (PlayerDynamicEntity | NpcDynamicEntity)[]>();
  for (const e of dynamicEntityList) {
    const cx = Math.floor(e.position.x / CELL_SIZE);
    const cy = Math.floor(e.position.y / CELL_SIZE);
    const key = cellKey(cx, cy);
    const arr = spatial.get(key);
    if (arr) arr.push(e as PlayerDynamicEntity | NpcDynamicEntity);
    else spatial.set(key, [e as PlayerDynamicEntity | NpcDynamicEntity]);
  }

  for (const bullet of MAP_DATA.dynamicEntitie.bulletDynamicEntitys) {
    bullet.update(deltaTime, MAP_DATA.staticEntities);
    if (bullet.shouldRemove) {
      changed = true;
      continue;
    }

    const bx = Math.floor(bullet.position.x / CELL_SIZE);
    const by = Math.floor(bullet.position.y / CELL_SIZE);
    const candidates: (PlayerDynamicEntity | NpcDynamicEntity)[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = spatial.get(cellKey(bx + dx, by + dy));
        if (list) candidates.push(...list);
      }
    }

    for (const entity of candidates) {
      if (entity.isDead) continue;
      if (bullet.ownerId === entity.id) continue; // 避免自残
      if(bullet.teamId!==null){if (bullet.teamId === entity.teamId) continue;} // 避免误伤队友

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


const setRandomTargetForNpc = (entity: NpcDynamicEntity): boolean => {

  if(entity.ownerId !== null){
    return false;
  }

  const radius = Math.max(1, entity.wanderRange);
  const center = entity.position;
  let attempts = 0;
  const maxAttempts = GCFG.setRandomTargetMaxAttempts;

  while (attempts < maxAttempts) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * Math.sqrt(Math.random());
    const target: Point = {
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist,
    };

    // 使用空间索引快速检测碰撞
    if (staticEntitySpatialGrid && !staticEntitySpatialGrid.isPointColliding(target.x, target.y)) {
      if (entity.setTarget(target, MAP_DATA.staticEntities)) {
        return true;
      }
    }
    attempts++;
  }

  return entity.tryFallbackTarget(MAP_DATA.staticEntities);
};

/**
 * 处理玩家的从者死亡的函数
 * @param npcEntity 
 */
const resolvePlayerServantDead = (npcEntity:NpcDynamicEntity):void => {
  if(npcEntity.isDead && npcEntity.ownerId!==null){
    for(const player of MAP_DATA.dynamicEntitie.playerDynamicEntitys){
      if(npcEntity.ownerId === player.id){
        player.removeServant(npcEntity.id);
        break;
      }
    }
  }
}

/**
 * 动态实体的碰撞处理
 * 包含碰撞检测
 * @returns 
 */
const resolveDynamicEntityCollisions = () => {
  const dynamicEntityList = getNpcPlayerDynamicEntityList().filter(entity => !entity.isDead);
  if (dynamicEntityList.length < 2) return;

  const CELL_SIZE = 64; // 空间哈希格子大小,可根据实体平均尺寸调整 CELL单元格
  const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

  for (let iter = 0; iter < 1; iter++) {// 动态实体碰撞分离的迭代次数,单位次
    // 构建空间哈希(基于实体位置),把实体放入其所在格子
    const spatial = new Map<string, DynamicEntity[]>();// 空间哈系地图
    for (const e of dynamicEntityList) {
      const cx = Math.floor(e.position.x / CELL_SIZE);
      const cy = Math.floor(e.position.y / CELL_SIZE);
      const key = cellKey(cx, cy);
      const arr = spatial.get(key);
      if (arr) arr.push(e);
      else spatial.set(key, [e]);
    }

    // 对每个实体,只与相邻格子的实体比较,避免全表 O(n^2)
    for (const entityA of dynamicEntityList) {
      const ax = Math.floor(entityA.position.x / CELL_SIZE);
      const ay = Math.floor(entityA.position.y / CELL_SIZE);

      // 收集周围 3x3 格子的候选实体
      const candidates: DynamicEntity[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const list = spatial.get(cellKey(ax + dx, ay + dy));
          if (list) candidates.push(...list);
        }
      }

      for (const entityB of candidates) {
        // 只处理一次(按 id 避免重复),并忽略自身与死亡实体
        if (entityB.id <= entityA.id) continue;
        if (entityB.isDead) continue;

        // player <-> npc 吸附逻辑(保持原有行为)
        if (
          (entityA instanceof PlayerDynamicEntity && entityB instanceof NpcDynamicEntity) ||
          (entityB instanceof PlayerDynamicEntity && entityA instanceof NpcDynamicEntity)
        ) {
          const player = entityA instanceof PlayerDynamicEntity ? entityA : (entityB as PlayerDynamicEntity);
          const npc = entityA instanceof NpcDynamicEntity ? (entityA as NpcDynamicEntity) : (entityB as NpcDynamicEntity);

          if (npc.ownerId !== null) continue; // 已有归属
          if (player.selectServantByID(npc.id) !== null) continue; // 重复

          const boxA = player.collisionBox;
          const boxB = npc.collisionBox;
          const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
          const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
          if (overlapX <= 0 || overlapY <= 0) continue;

          const RC = player.worldPositionToRowCol(npc.position);
          if (RC === null) continue;
          const servant = player.selectServantByRC(RC.row, RC.col);
          if (servant === null || servant.exist === true) continue;
          if (!player.setServant(RC.row, RC.col, npc.id)) continue;

          // 设置归属
          npc.ownerId = player.id;
          npc.teamId = player.teamId;

          continue;
        }

        // 如果某方是已归属的 npc,尝试由 owner 收纳另一个 npc(保持原逻辑)
        if (entityA instanceof NpcDynamicEntity && entityA.ownerId !== null && entityB instanceof NpcDynamicEntity) {
          const owner = getPlayerDynamicEntityById(entityA.ownerId);
          if (owner !== null) {
            if (owner.selectServantByID(entityB.id) !== null) continue;
            const boxA = entityA.collisionBox;
            const boxB = entityB.collisionBox;
            const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
            const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
            if (overlapX <= 0 || overlapY <= 0) continue;

            const RC = owner.worldPositionToRowCol(entityB.position);
            if (RC === null) continue;
            const servant = owner.selectServantByRC(RC.row, RC.col);
            if (servant === null || servant.exist === true) continue;
            if (!owner.setServant(RC.row, RC.col, entityB.id)) continue;

            entityB.ownerId = owner.id;
            entityB.teamId = owner.teamId;
          }
          continue;
        }

        if (entityB instanceof NpcDynamicEntity && entityB.ownerId !== null && entityA instanceof NpcDynamicEntity) {
          const owner = getPlayerDynamicEntityById(entityB.ownerId);
          if (owner !== null) {
            if (owner.selectServantByID(entityA.id) !== null) continue;
            const boxA = entityB.collisionBox;
            const boxB = entityA.collisionBox;
            const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
            const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
            if (overlapX <= 0 || overlapY <= 0) continue;

            const RC = owner.worldPositionToRowCol(entityA.position);
            if (RC === null) continue;
            const servant = owner.selectServantByRC(RC.row, RC.col);
            if (servant === null || servant.exist === true) continue;
            if (!owner.setServant(RC.row, RC.col, entityA.id)) continue;

            entityA.ownerId = owner.id;
            entityA.teamId = owner.teamId;
          }
          continue;
        }

        // 独立 npc <-> npc 碰撞分离(位移)
        // 只处理 NpcDynamicEntity 与 NpcDynamicEntity 之间的分离
        if (entityA instanceof NpcDynamicEntity && entityB instanceof NpcDynamicEntity) {
          const boxA = entityA.collisionBox;
          const boxB = entityB.collisionBox;
          const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
          const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
          if (overlapX <= 0 || overlapY <= 0) continue;

          if (overlapX < overlapY) {
            const pushX = overlapX / 2 + 0.1;
            const direction = entityA.position.x <= entityB.position.x ? -1 : 1;
            entityA.position.x += direction * pushX;
            entityB.position.x -= direction * pushX;
          } else {
            const pushY = overlapY / 2 + 0.1;
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
};

/**
 * 更新动态实体
 * @param deltaTime 
 */
const updateDynamicEntities = (deltaTime: number) => {
  for (const entity of getNpcPlayerDynamicEntityList()) {
    entity.update(deltaTime, MAP_DATA.staticEntities, MAP_DATA.dynamicEntitie, GCFG);
    entity.updateDamageEffect(deltaTime);
    entity.updateDeathEffect(deltaTime);
    if(entity instanceof NpcDynamicEntity){
      resolvePlayerServantDead(entity);
    }
  }

  removeFinishedDeadDynamicEntities();
  resolveDynamicEntityCollisions();

  const actionLoopContext = {
    deltaTime,
    staticEntities: MAP_DATA.staticEntities,
    spawnBullet: spawnBulletDynamicEntity,
    spawnGrenade: spawnGrenadeDynamicEntity
  };

  for (const entity of getNpcDynamicEntityList()) {
    entity.updateCrowdStuckState(deltaTime);
    entity.updateStayDuration(deltaTime);
    entity.updateStaticCompressionEffects(deltaTime, MAP_DATA.staticEntities);

    if (entity.updateNoMovementWatchdog(deltaTime)) {
      setRandomTargetForNpc(entity);
      continue;
    }

    if (entity.canGetNewWanderTarget(deltaTime, MAP_DATA.staticEntities)) {
      setRandomTargetForNpc(entity);
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

const canSpawnNpcOrItemAt = (position: Point, spawnItem: boolean, spawnNpc: boolean): boolean => {
  if (!spawnItem && !spawnNpc) return false;
  if (position.x <= GCFG.worldMinX || position.x >= GCFG.worldMaxX || position.y <= GCFG.worldMinY || position.y >= GCFG.worldMaxY)return false;
  const halfW = WhitePixelEntity.WIDTH / 2;
  const halfH = WhitePixelEntity.HEIGHT / 2;
  const spawnBox = {
    x: position.x - halfW,
    y: position.y - halfH,
    width: WhitePixelEntity.WIDTH,
    height: WhitePixelEntity.HEIGHT,
  };

  // 使用空间索引快速判断是否与静态实体重叠
  // 需要检查生成实体的整个矩形区域是否与任何静态实体碰撞
  // 简单实现：检查矩形四个角点是否在静态实体内（更精确可遍历格子）
  if (staticEntitySpatialGrid) {
    // 检查包围盒四个顶点以及中心（保守检测）
    const pointsToCheck = [
      { x: spawnBox.x, y: spawnBox.y },
      { x: spawnBox.x + spawnBox.width, y: spawnBox.y },
      { x: spawnBox.x, y: spawnBox.y + spawnBox.height },
      { x: spawnBox.x + spawnBox.width, y: spawnBox.y + spawnBox.height },
      { x: spawnBox.x + spawnBox.width / 2, y: spawnBox.y + spawnBox.height / 2 }
    ];
    for (const p of pointsToCheck) {
      if (staticEntitySpatialGrid.isPointColliding(p.x, p.y)) return false;
    }
    return true;
  } else {
    // fallback 遍历
    for (const staticEntity of MAP_DATA.staticEntities) {
      const box = staticEntity.collisionBox;
      const separated =
        spawnBox.x + spawnBox.width <= box.x ||
        spawnBox.x >= box.x + box.width ||
        spawnBox.y + spawnBox.height <= box.y ||
        spawnBox.y >= box.y + box.height;
      if (!separated) return false;
    }
  }

  // 动态实体碰撞检测
  for (const entity of getNpcPlayerDynamicEntityList()) {
    if (entity.isDead) continue;
    const maxPadding = Math.max(GCFG.npcSpawnPadding, GCFG.itemSpawnPadding);
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
    const npc = new NpcCtor(position,null,null);
    npc.setTarget(position, MAP_DATA.staticEntities, { preferStraight: true });
    MAP_DATA.dynamicEntitie.npcDynamicEntitys.push(npc);
    return true;
  }
  return false;
};

/**
 * 根据静态权重随机选择一个 NPC 构造函数
 * 权重越高,被选中的概率越大
 */
const selectRandomNpcCtor = (): new (position: Point, ownerId: number | null, teamId: number | null) => NpcDynamicEntity => {
  // 计算总权重(注意每个权重 <=1,总和可能小于 1,但无影响)
  const totalWeight = NPC_WEIGHTS.reduce((sum, { weight }) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  for (const { ctor, weight } of NPC_WEIGHTS) {
    if (random < weight) return ctor;
    random -= weight;
  }
  // fallback
  return NPC_WEIGHTS[0].ctor;
};

/**
 * npc刷怪计时器
 * @param timer 
 * @param deltaTime 
 * @param interval 
 * @param playerEntity 
 * @param minRadius 
 * @param maxRadius 
 * @returns 
 */
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
  try {
    const dataPackage = createDataPackage([Instruct.I_MapDataInitial(mapData)]);
    sendDataPackage(dataPackage);
    console.log('MapData initial sent successfully');
  } catch (error) {
    console.error('Failed to send map data:', error);
  }
};

const sendMapDataUpdate = (mapData: MapData) => {
  sendDataPackage(createDataPackage([Instruct.I_MapDataUpdate(mapData)]));
};
////////////////////
//<--通信处理区
////////////////////

main();
