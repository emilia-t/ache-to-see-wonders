<script setup lang="ts">
// The relative position of this file: src/components/pixel_war/ViewPixelWar.vue
// Warning! Please use an editor that supports UTF-8 to read the code!
import { ref, onMounted, onUnmounted } from 'vue';
import { Instruct } from '@/components/pixel_war/instruct/Instruct';
import type { EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

import type {
  BulletTag,
  DynamicEntityKind,
  PerspectiveMode
} from '@/components/pixel_war/type/Type';

import type {
  RGB,
  Point,
  EventArea, 
  DataPackage,
  MapData,
  InstructObject,
  StarFieldStar,
  Tick,
} from '@/components/pixel_war/interface/Interface';

import {
  CursorManager,
  EffectManager,
  Entity,
  EmptyEntity,
  StaticEntity,
  BoxStaticEntity,
  WallStaticEntity,
  CurbStaticEntity,
  ItemEntity,
  HealingGemItemEntity,
  RedPixelBombEntity,
  NpcDynamicEntity,
  PlayerDynamicEntity,
  WhitePixelEntity,
  RedPixelEntity,
  BulletDynamicEntity,
  BuckshotBulletDynamicEntity,
  SniperBulletDynamicEntity,
  LaserBulletDynamicEntity,
  OrdinaryBulletDynamicEntity,
  GrenadeDynamicEntity
} from '@/components/pixel_war/class';

import ServiceWorker from '@/components/pixel_war/service/Service?worker';

////////////////////
//服务器通信相关区-->
////////////////////

const serviceWorker = new ServiceWorker();

const handleWorkerMessage = (event: MessageEvent) => {
  let dpkg = event.data as DataPackage;
  let tick = dpkg.tick as Tick;
  let instructs = dpkg.data.instructs as Array<InstructObject>;
  for (let instruct of instructs) {
    let type = instruct.type;
    switch (type) {
      case 'test':{
        console.log('Received test instruct from worker:', instruct);
        break;
      }
      case 'map_data_initial':{
        console.log('Received map data initial instruct from worker:', instruct);
        applyMapDataSnapshot(instruct.data as MapData);
        drawEntities();
        drawUI();
        break;
      }
      case 'map_data_update':{
        applyMapDataSnapshot(instruct.data as MapData);
        break;
      }
      default:{
        console.warn('Received unknown instruct type from worker:', type, instruct);
      }
    }
  }
};

serviceWorker.addEventListener('message', (event: MessageEvent) => {
  handleWorkerMessage(event);
});

const applyMapDataSnapshot = (mapData: MapData) => {
  const aliveIds = new Set<number>();
  const hydrateList = <T extends Entity>(list: T[]): T[] => {
    return list.map((entity) => {
      aliveIds.add(entity.id);
      return H_getRenderableEntityFromSnapshot(entity);
    });
  };

  staticEntityList = hydrateList(mapData.staticEntities) as StaticEntity[];
  itemEntityList = hydrateList(mapData.itemEntities) as ItemEntity[];
  npcEntityList = hydrateList(mapData.dynamicEntitie.npcDynamicEntitys) as NpcDynamicEntity[];
  const playerEntityList = hydrateList(mapData.dynamicEntitie.playerDynamicEntitys) as PlayerDynamicEntity[];
  playerEntity = playerEntityList[0] || null;
  grenadeEntityList = hydrateList(mapData.dynamicEntitie.grenadeDynamicEntitys) as GrenadeDynamicEntity[];
  bulletEntityList = hydrateList(mapData.dynamicEntitie.bulletDynamicEntitys) as BulletDynamicEntity[];

  // 处理死亡实体的特效
  for (const entity of [...npcEntityList, ...playerEntityList]) {
    if (entity.isDead) {
      effectManager?.emitDynamicEntityDeath(entity);
    }
  }
  
  refreshRenderEntityList();

  for (const id of ENTITY_CACHE.keys()) {
    if (!aliveIds.has(id)) {
      ENTITY_CACHE.delete(id);
    }
  }
};

const sendClientInstruct = (instruct: InstructObject) => {
  serviceWorker.postMessage(H_getWorkerTickPackage([instruct]));
};

const sendPlayerMoveInput = () => {
  sendClientInstruct(Instruct.I_PlayerMoveInput({
    playerMoveW: PlayerDynamicEntity.playerMoveState.playerMoveW,
    playerMoveA: PlayerDynamicEntity.playerMoveState.playerMoveA,
    playerMoveS: PlayerDynamicEntity.playerMoveState.playerMoveS,
    playerMoveD: PlayerDynamicEntity.playerMoveState.playerMoveD,
  }));
};
////////////////////
//<--服务器通信相关区
////////////////////

////////////////////
//常量区-->
////////////////////
const GRAPHICS_CANVAS = ref<HTMLCanvasElement | null>(null);
const UI_CANVAS = ref<HTMLCanvasElement | null>(null);
const ENTITY_CANVAS = ref<HTMLCanvasElement | null>(null);
const EFFECTS_CANVAS = ref<HTMLCanvasElement | null>(null);
const DEBUG_TERMINAL_MAX_LOGS = 120;
const EFFECT_SPRITE_FRAME_WIDTH = 100;
const EFFECT_SPRITE_FRAME_HEIGHT = 100;
const EFFECT_SPRITE_FRAME_COUNT = 30;
const EFFECT_SPRITE_FPS = 30;
const EFFECT_PATH_DYNAMIC_ENTITY_DEATH = './effects/dynamic_entity_death_default.png';
const ENTITY_CACHE = new Map<number, Entity>();// 服务端实体快照对应的本地渲染实体缓存
const STAR_FIELD_STAR_COUNT = 40; // 星空背景星星数量,单位个
const STAR_FIELD_MIN_RADIUS = 0.5; // 星星最小半径,单位px
const STAR_FIELD_MAX_RADIUS = 1.5; // 星星最大半径,单位px
const STAR_FIELD_MAX_OPACITY_INCREMENT = 0.03; // 星星单帧基础透明度变化量,单位透明度比例
const STAR_FIELD_TWINKLE_SPEED = 0.125; // 星星闪烁速度倍率,越小闪烁越慢
////////////////////
//<--常量区
////////////////////

////////////////////
//变量区-->
////////////////////
let cursorManager: CursorManager | null = null;
let effectManager: EffectManager | null = null;
let starFieldStars: StarFieldStar[] = [];// 星空背景的星星列表
let ctxGraphics: CanvasRenderingContext2D | null = null;
let ctxUi: CanvasRenderingContext2D | null = null;
let ctxEntity: CanvasRenderingContext2D | null = null;

let offsetXX = 0;  // 原点在x轴上的偏移
let offsetYY = 0;  // 原点在y轴上的偏移
let scale = 1;     // 缩放比例

let eventArea: Array<EventArea> = []; // 事件触发区域列表
let mouseX = 0;
let mouseY = 0;
let hoveredArea: EventArea | null = null;

let isDragging   = false;  // 是否正在拖动画布
let isMoveCanvas = false;  // 是否是通过拖动来移动画布
let dragStartX = 0;        // 拖动起始X坐标
let dragStartY = 0;        // 拖动起始Y坐标
let dragTotalX = 0;        // 累计X方向拖动长度
let dragTotalY = 0;        // 累计Y方向拖动长度
let lastDragX  = 0;        // 上一次拖动的X位置
let lastDragY  = 0;        // 上一次拖动的Y位置

let cdtRafCursorId: number | null = null;
let cdtLastMouseX = 0;//光标绘制节流Cursor drawing throttling
let cdtLastMouseY = 0;

let animationFrameId: number | null = null;                 // 动画帧ID
let lastTimestamp: number = 0;                              // 上一帧时间戳
let renderEntityList: Array<Entity> = [];                   // 要渲染的实体列表
let staticEntityList: StaticEntity[] = [];                  // 静态实体列表
let npcEntityList: NpcDynamicEntity[] = [];                 // NPC实体列表
let bulletEntityList: BulletDynamicEntity[] = [];           // 子弹动态实体列表
let grenadeEntityList: GrenadeDynamicEntity[] = [];
let itemEntityList: ItemEntity[] = [];                      // 物品实体列表
let playerEntity: PlayerDynamicEntity | null = null;

let entityDebugFlags: EntityDebugFlags = {
  //属性相关
  showHealth: false,
  showHunger: false,
  showMovementSpeed: false,
  showMovementPassion: false,
  showTag: false,
  //几何相关
  showHistoricalTrajectory: false,
  showCollisionBoxes: false,
  showFacingDirection: false,
  showMovementRange: false,
  showInterestRange: false
};

let debugTerminalVisible = false;
let debugTerminalInput = '';
let debugTerminalLogs: string[] = [];
let debugTerminalScrollOffset = 0; // 终端日志向上滚动的行偏移(0=显示最新日志)
let debugTerminalHistory: string[] = [];
let debugTerminalHistoryIndex = -1; // 调试终端历史命令索引,-1表示当前输入行,0及以上表示历史命令
let debugTerminalInputDraft = '';
let debugBoardVisible = false;
let mouseWorldX = 0; // 鼠标世界坐标X
let mouseWorldY = 0; // 鼠标世界坐标Y
let perspectiveMode: PerspectiveMode = 'third_person';
let firstPersonMoveW = false;
let firstPersonMoveA = false;
let firstPersonMoveS = false;
let firstPersonMoveD = false;
let playerFireMode = false;



////////////////////
//<--变量区
////////////////////

////////////////////
//辅助函数区-->
////////////////////

const H_getCanvasCssSize = (canvas: HTMLCanvasElement) => {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  return { width, height };
};

const H_applyDprToCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  const { width, height } = H_getCanvasCssSize(canvas);
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const displayWidth = Math.round(width * dpr);
  const displayHeight = Math.round(height * dpr);
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const H_getHitEventArea = (x: number, y: number): EventArea | null => {
  for (let i = eventArea.length - 1; i >= 0; i--) {
    const area = eventArea[i];
    if (
      x >= area.rect.x &&
      x <= area.rect.x + area.rect.width &&
      y >= area.rect.y &&
      y <= area.rect.y + area.rect.height
    ) {
      return area;
    }
  }
  return null;
};

const H_getWorkerTickPackage = (instructs: InstructObject[]): DataPackage => {
  return {
    tick: {
      tickCount: 0,
      tickTime: performance.now(),
    },
    data: {
      instructs,
    },
  };
};

const H_hydrateEntitySnapshot = <T extends Entity>(entity: T, snapshot: T): T => {
  const texture = entity.texture;
  Object.assign(entity, snapshot);
  entity.texture = texture;
  entity.updateCollisionBox();
  return entity;
};

const H_getBulletDirectionFromSnapshot = (snapshot: any): Point => {
  const velocity = snapshot.velocity || { x: 1, y: 0 };
  const len = Math.hypot(velocity.x, velocity.y);
  if (len < 0.0001) return { x: 1, y: 0 };
  return {
    x: velocity.x / len,
    y: velocity.y / len,
  };
};

const H_createEntityFromSnapshot = (snapshot: any): Entity => {
  // 静态实体
  if (snapshot.type === 'static') {
    const tag = snapshot.tag;
    switch (tag) {
      case 'wall':
        return new WallStaticEntity(snapshot.position, snapshot.name, tag);
      case 'curb':
        return new CurbStaticEntity(snapshot.position, snapshot.name, tag);
      case 'box':
        return new BoxStaticEntity(snapshot.position, snapshot.name, tag);
    }
  }
  // 物体实体
  if (snapshot.type === 'item') {
    const tag = snapshot.tag;
    switch (tag) {
      case 'healing_gem':
        return new HealingGemItemEntity(snapshot.position, snapshot.name, tag);
    }
  }
  // 动态实体
  const kind = snapshot.kind as DynamicEntityKind;
  if (kind === 'npc') {
    const tag = snapshot.tag;
    switch (tag){
      case 'white_pixel':
        return new WhitePixelEntity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      case 'red_pixel':
        return new RedPixelEntity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
    }
  }
  else if(kind === 'player'){
    return new PlayerDynamicEntity(snapshot.position, snapshot.name, snapshot.isme);
  }
  else if(kind === 'bullet'){
    const bulletTag = snapshot.tag as BulletTag;
    switch(bulletTag){
      case 'ordinary_bullet':
        return new OrdinaryBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name
        );
      case 'laser_bullet':
        return new LaserBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name
        );
      case 'sniper_bullet':
        return new SniperBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name
        );
      case 'buckshot_bullet':
        return new BuckshotBulletDynamicEntity(
          snapshot.position,
          H_getBulletDirectionFromSnapshot(snapshot),
          snapshot.ownerId,
          snapshot.teamId,
          snapshot.name
        );
    }
  }
  else{//grenade
    const grenadeTag = snapshot.tag;
    switch (grenadeTag){
      case 'red_pixel_bomb':{
        return new RedPixelBombEntity(
          snapshot.position,
          snapshot.ownerId,
          snapshot.teamId
        );
      }
    }
  }
  return new EmptyEntity();
};

const H_getRenderableEntityFromSnapshot = <T extends Entity>(snapshot: T): T => {
  const cached = ENTITY_CACHE.get(snapshot.id) as T | undefined;
  if (cached) return H_hydrateEntitySnapshot(cached, snapshot);

  const entity = H_hydrateEntitySnapshot(H_createEntityFromSnapshot(snapshot) as T, snapshot);
  ENTITY_CACHE.set(entity.id, entity);
  entity.loadTexture().then(() => {
    drawEntities();
  });
  return entity;
};

const H_getWorldViewport = () => {
  if (!GRAPHICS_CANVAS.value) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  return {
    minX: -offsetXX,
    maxX: width - offsetXX,
    maxY: offsetYY,               // 世界坐标 Y 向上
    minY: offsetYY - height,
  };
};

const H_createStarFieldStar = (minX: number, maxX: number, minY: number, maxY: number): StarFieldStar => ({
  x: minX + Math.random() * (maxX - minX),
  y: minY + Math.random() * (maxY - minY),
  radius: STAR_FIELD_MIN_RADIUS + Math.random() * (STAR_FIELD_MAX_RADIUS - STAR_FIELD_MIN_RADIUS),
  opacity: Math.random(),
  opacityDirection: 1,
  opacityIncrement: Math.random() * STAR_FIELD_MAX_OPACITY_INCREMENT,
});

const H_ensureStarsInViewport = () => {
  if (!GRAPHICS_CANVAS.value) return;
  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  const view = H_getWorldViewport();
  // 在视口四周扩展 30% 的区域作为星星存活区，避免边缘闪烁
  const marginX = width * 0.3;
  const marginY = height * 0.3;
  const minX = view.minX - marginX;
  const maxX = view.maxX + marginX;
  const minY = view.minY - marginY;
  const maxY = view.maxY + marginY;

  for (const star of starFieldStars) {
    if (star.x < minX || star.x > maxX || star.y < minY || star.y > maxY) {
      // 超出范围则重新生成世界坐标，同时重置闪烁状态
      star.x = minX + Math.random() * (maxX - minX);
      star.y = minY + Math.random() * (maxY - minY);
      star.opacity = Math.random();
      star.opacityDirection = 1;
      star.opacityIncrement = Math.random() * STAR_FIELD_MAX_OPACITY_INCREMENT;
    }
  }
};

////////////////////
//<--辅助函数区
////////////////////

////////////////////
//初始化函数区-->
////////////////////
const startSetting = () => {
  onResizeCanvas();
  if (GRAPHICS_CANVAS.value) {
      const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
      offsetXX = width / 2;// 初始化原点偏移量为画布中心
      offsetYY = height / 2;
  }

  if (UI_CANVAS.value) {// 添加事件监听(全部绑定到UI Canvas)
    UI_CANVAS.value.addEventListener('mousedown', onMousedown);
    UI_CANVAS.value.addEventListener('mousemove', onMouseMove);
    UI_CANVAS.value.addEventListener('mouseup', onMouseUp);
    UI_CANVAS.value.addEventListener('mouseleave', onMouseUp); // 鼠标离开画布时取消拖动
    UI_CANVAS.value.addEventListener('click', onCanvasClick);
    UI_CANVAS.value.addEventListener('dblclick', onCanvasDoubleClick);
    UI_CANVAS.value.addEventListener('wheel', onCanvasWheel, { passive: false });
    UI_CANVAS.value.addEventListener('mouseleave', onWindowMouseLeave);
    UI_CANVAS.value.addEventListener('mouseenter', onWindowMouseEnter);
  }

  // 初始化实体层上下文
  if (ENTITY_CANVAS.value) {
    ctxEntity = ENTITY_CANVAS.value.getContext('2d');
    if (ctxEntity) {
      H_applyDprToCanvas(ENTITY_CANVAS.value, ctxEntity);
    }
  }

  // init effect manager
  if (!effectManager) {
    effectManager = new EffectManager({
      frameWidth: EFFECT_SPRITE_FRAME_WIDTH,
      frameHeight: EFFECT_SPRITE_FRAME_HEIGHT,
      frameCount: EFFECT_SPRITE_FRAME_COUNT,
      fps: EFFECT_SPRITE_FPS,
      effectPathByKind: {
        dynamic_entity_death: EFFECT_PATH_DYNAMIC_ENTITY_DEATH,
      },
      worldToScreen: TOcanvas2Screen,
      getCanvasCssSize: H_getCanvasCssSize,
    });
  }
  effectManager.bindCanvas(EFFECTS_CANVAS.value);
  effectManager.applyDprToCanvas();

  // initialize entities
  staticEntityList = [];
  npcEntityList = [];
  bulletEntityList = [];
  grenadeEntityList = [];
  itemEntityList = [];
  renderEntityList = [];
  playerFireMode = false;
  effectManager?.reset();

  // 加载纹理并开始动画
  // load textures and start animation
  Promise.all([loadEntityTextures(), effectManager.loadEffectTextures()]).then(() => {
    drawEntities();
    effectManager?.updateAndDraw(0);
    // start animation loop
    animationFrameId = requestAnimationFrame(animateEntities);
  });
  
  // UI层渲染循环
  cursorManager = new CursorManager("canvas-cursor");
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('resize', onResizeCanvas);
  window.visualViewport?.addEventListener('resize', onResizeCanvas);
  window.addEventListener('keydown', onGlobalKeyDown); // 添加快捷键监听
  window.addEventListener('keyup', onGlobalKeyUp);
  drawGraphics();
  drawUI();
};
////////////////////
//<--初始化函数区
////////////////////

////////////////////
//各种创建函数区-->
////////////////////

/**
 * 绘制圆角矩形辅助函数
 */
const createRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
};

/**
 * 创建坐标轴刻度标记(图形层)
 */
const createAxisMark = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  const gridSize = 50 * scale; // 网格大小
  const tickSize = 6; // 刻度线长度

  ctxGraphics.save();
  ctxGraphics.font = '12px Arial';
  ctxGraphics.fillStyle = '#333';
  ctxGraphics.textAlign = 'center';
  ctxGraphics.textBaseline = 'middle';

  // 计算画布可见区域对应的坐标范围
  const canvasLeftTop = TOscreen2Canvas(0, 0);
  const canvasRightBottom = TOscreen2Canvas(width, height);

  // X轴刻度(在X轴上绘制)
  if (offsetYY >= 0 && offsetYY <= height) {
    // 计算X轴可见区域的坐标范围
    const minX = Math.min(canvasLeftTop.x, canvasRightBottom.x);
    const maxX = Math.max(canvasLeftTop.x, canvasRightBottom.x);

    // 计算第一个刻度的坐标(按gridSize取整)
    let firstTickX = Math.ceil(minX / 50) * 50;

    // 绘制X轴刻度
    for (let x = firstTickX; x <= maxX; x += 50) {
      const screenPos = TOcanvas2Screen(x, 0);

      // 确保刻度在画布范围内
      if (screenPos.x >= 0 && screenPos.x <= width) {
        // 绘制刻度线
        ctxGraphics.beginPath();
        ctxGraphics.moveTo(screenPos.x, offsetYY - tickSize / 2);
        ctxGraphics.lineTo(screenPos.x, offsetYY + tickSize / 2);
        ctxGraphics.strokeStyle = '#666';
        ctxGraphics.lineWidth = 1;
        ctxGraphics.stroke();

        // 绘制刻度数值
        ctxGraphics.fillText(x.toString(), screenPos.x, offsetYY + 15);
      }
    }
  }

  // Y轴刻度(在Y轴上绘制)
  if (offsetXX >= 0 && offsetXX <= width) {
    // 计算Y轴可见区域的坐标范围
    const minY = Math.min(canvasLeftTop.y, canvasRightBottom.y);
    const maxY = Math.max(canvasLeftTop.y, canvasRightBottom.y);

    // 计算第一个刻度的坐标(按gridSize取整)
    let firstTickY = Math.ceil(minY / 50) * 50;

    // 绘制Y轴刻度
    for (let y = firstTickY; y <= maxY; y += 50) {
      const screenPos = TOcanvas2Screen(0, y);

      // 确保刻度在画布范围内
      if (screenPos.y >= 0 && screenPos.y <= height) {
        // 绘制刻度线
        ctxGraphics.beginPath();
        ctxGraphics.moveTo(offsetXX - tickSize / 2, screenPos.y);
        ctxGraphics.lineTo(offsetXX + tickSize / 2, screenPos.y);
        ctxGraphics.strokeStyle = '#666';
        ctxGraphics.lineWidth = 1;
        ctxGraphics.stroke();

        // 绘制刻度数值
        ctxGraphics.fillText(y.toString(), offsetXX - 20, screenPos.y);
      }
    }
  }

  ctxGraphics.restore();
};

/**
 * 创建坐标辅助轴(带刻度)(图形层)
 * @param xColor X轴颜色
 * @param yColor Y轴颜色
 */
const createAxis = (xColor: RGB, yColor: RGB) => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);

  // 保存当前上下文状态
  ctxGraphics.save();

  // 绘制X轴(红色)
  ctxGraphics.beginPath();
  ctxGraphics.strokeStyle = `rgb(${xColor.r}, ${xColor.g}, ${xColor.b})`;
  ctxGraphics.lineWidth = 2;
  ctxGraphics.moveTo(0, offsetYY);
  ctxGraphics.lineTo(width, offsetYY);
  ctxGraphics.stroke();

  // 绘制Y轴(绿色)
  ctxGraphics.beginPath();
  ctxGraphics.strokeStyle = `rgb(${yColor.r}, ${yColor.g}, ${yColor.b})`;
  ctxGraphics.lineWidth = 2;
  ctxGraphics.moveTo(offsetXX, 0);
  ctxGraphics.lineTo(offsetXX, height);
  ctxGraphics.stroke();

  // 绘制箭头(X轴箭头)
  ctxGraphics.beginPath();
  ctxGraphics.fillStyle = `rgb(${xColor.r}, ${xColor.g}, ${xColor.b})`;
  // 右箭头
  ctxGraphics.moveTo(width - 10, offsetYY - 5);
  ctxGraphics.lineTo(width, offsetYY);
  ctxGraphics.lineTo(width - 10, offsetYY + 5);
  ctxGraphics.fill();

  // 左箭头
  ctxGraphics.beginPath();
  ctxGraphics.moveTo(10, offsetYY - 5);
  ctxGraphics.lineTo(0, offsetYY);
  ctxGraphics.lineTo(10, offsetYY + 5);
  ctxGraphics.fill();

  // 绘制箭头(Y轴箭头)
  ctxGraphics.beginPath();
  ctxGraphics.fillStyle = `rgb(${yColor.r}, ${yColor.g}, ${yColor.b})`;
  // 上箭头
  ctxGraphics.moveTo(offsetXX - 5, 10);
  ctxGraphics.lineTo(offsetXX, 0);
  ctxGraphics.lineTo(offsetXX + 5, 10);
  ctxGraphics.fill();

  // 下箭头
  ctxGraphics.beginPath();
  ctxGraphics.moveTo(offsetXX - 5, height - 10);
  ctxGraphics.lineTo(offsetXX, height);
  ctxGraphics.lineTo(offsetXX + 5, height - 10);
  ctxGraphics.fill();

  // 标注坐标轴文字
  ctxGraphics.font = "14px Arial";
  ctxGraphics.fillStyle = "#000";
  ctxGraphics.fillText("X", width - 20, offsetYY - 10);
  ctxGraphics.fillText("Y", offsetXX + 10, 20);

  // 原点标注
  ctxGraphics.beginPath();
  ctxGraphics.arc(offsetXX, offsetYY, 4, 0, Math.PI * 2);
  ctxGraphics.fillStyle = '#333';
  ctxGraphics.fill();
  ctxGraphics.fillStyle = '#000';
  ctxGraphics.font = 'bold 12px Arial';
  ctxGraphics.fillText("O", offsetXX + 8, offsetYY - 8);

  // 恢复上下文状态
  ctxGraphics.restore();
};

/**
 * 绘制网格辅助线(图形层)
 */
const createGrid = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  const gridSize = 50 * scale; // 网格大小,随缩放比例变化

  ctxGraphics.save();
  ctxGraphics.strokeStyle = 'rgba(180, 215, 255, 0.22)';
  ctxGraphics.lineWidth = 0.5;

  // 绘制垂直网格线
  for (let x = offsetXX % gridSize; x < width; x += gridSize) {
    ctxGraphics.beginPath();
    ctxGraphics.moveTo(x, 0);
    ctxGraphics.lineTo(x, height);
    ctxGraphics.stroke();
  }

  // 绘制水平网格线
  for (let y = offsetYY % gridSize; y < height; y += gridSize) {
    ctxGraphics.beginPath();
    ctxGraphics.moveTo(0, y);
    ctxGraphics.lineTo(width, y);
    ctxGraphics.stroke();
  }

  ctxGraphics.restore();
};

/**
 * 绘制单颗圆形闪烁星星(图形层)
 */
const drawSingleStar = (star: StarFieldStar) => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;
  const screenPos = TOcanvas2Screen(star.x, star.y);
  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);

  // 完全在屏幕外的星星跳过绘制
  if (screenPos.x < -star.radius * 2 || screenPos.x > width + star.radius * 2 ||
      screenPos.y < -star.radius * 2 || screenPos.y > height + star.radius * 2) {
    return;
  }

  // 闪烁逻辑(透明度降到 0 时，在世界空间重新随机位置)
  if (star.opacity >= 1) {
    star.opacityDirection = -1;
  } else if (star.opacity <= 0) {
    star.opacityDirection = 1;
    const view = H_getWorldViewport();
    const { width: w, height: h } = H_getCanvasCssSize(GRAPHICS_CANVAS.value!);
    star.x = view.minX + Math.random() * (view.maxX - view.minX);
    star.y = view.minY + Math.random() * (view.maxY - view.minY);
    star.opacityIncrement = Math.random() * STAR_FIELD_MAX_OPACITY_INCREMENT;
  }
  star.opacity = Math.max(0, Math.min(1, star.opacity + star.opacityIncrement * STAR_FIELD_TWINKLE_SPEED * star.opacityDirection));

  ctxGraphics.save();
  ctxGraphics.beginPath();
  ctxGraphics.arc(screenPos.x, screenPos.y, star.radius, 0, Math.PI * 2);
  ctxGraphics.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
  ctxGraphics.shadowBlur = star.radius * 4;
  ctxGraphics.shadowColor = `rgba(255, 255, 180, ${star.opacity})`;
  ctxGraphics.fill();
  ctxGraphics.restore();
};

/**
 * 绘制星空背景(图形层)
 */
const drawStarField = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;
  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);

  // 首次初始化星星池(世界坐标)
  if (starFieldStars.length === 0) {
    const view = H_getWorldViewport();
    starFieldStars = Array.from({ length: STAR_FIELD_STAR_COUNT }, () =>
      H_createStarFieldStar(view.minX, view.maxX, view.minY, view.maxY)
    );
  } else {
    H_ensureStarsInViewport(); // 每帧维护星星位置
  }

  // 绘制渐变背景(这里保持屏幕固定，若需背景也移动可做偏移)
  const gradient = ctxGraphics.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#02030d');
  gradient.addColorStop(0.55, '#05091a');
  gradient.addColorStop(1, '#090d18');
  ctxGraphics.fillStyle = gradient;
  ctxGraphics.fillRect(0, 0, width, height);

  // 绘制星星(世界坐标 -> 屏幕坐标)
  for (const star of starFieldStars) {
    drawSingleStar(star);
  }
};

////////////////////
//<--各种创建函数区
////////////////////

////////////////////
//其他函数区-->
////////////////////

/**
 * 将屏幕坐标转换为画布坐标
 * @param screenX 屏幕X坐标
 * @param screenY 屏幕Y坐标
 * @returns 画布坐标对象
 */
const TOscreen2Canvas = (screenX: number, screenY: number) => {
  return {
    x: screenX - offsetXX,
    y: offsetYY - screenY  // 因为屏幕Y轴向下,画布Y轴向上
  };
};

/**
 * 将画布坐标转换为屏幕坐标
 * @param canvasX 画布X坐标
 * @param canvasY 画布Y坐标
 * @returns 屏幕坐标对象
 */
const TOcanvas2Screen = (canvasX: number, canvasY: number) => {
  return {
    x: canvasX + offsetXX,
    y: offsetYY - canvasY
  };
};

const drawInstructions = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  if (!CtxUi || !CANVAS) return;
  const { width } = H_getCanvasCssSize(CANVAS);
  const text = `F = Toggle fire | 3 = Toggle perspective`;
  CtxUi.save();
  CtxUi.font = '14px "Microsoft YaHei", Arial, sans-serif';
  CtxUi.fillStyle = 'rgba(78,78,78,0.9)';
  CtxUi.textAlign = 'center';
  CtxUi.textBaseline = 'top';
  const textWidth = CtxUi.measureText(text).width;
  const padding = 10;
  const boxWidth = textWidth + padding * 2;
  const boxHeight = 30;
  const x = (width - boxWidth) / 2;
  const y = 0;
  // 半透明背景
  CtxUi.fillStyle = 'rgba(208,208,208,0.7)';
  createRoundRect(CtxUi, x, y, boxWidth, boxHeight, 5);
  CtxUi.fill();
  CtxUi.fillStyle = 'rgb(78,78,78)';
  CtxUi.fillText(text, width / 2, y + 8);
  CtxUi.restore();
};

/**
 * 绘制调试面板(UI层)
 */
const drawDebugBoard = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  if (!debugBoardVisible) return;

  const panelWidth = 320;
  const panelHeight = 160;
  const x = 12;
  const y = 12;

  CtxUi.save();
  CtxUi.fillStyle = 'rgba(10, 10, 10, 0.8)';
  CtxUi.strokeStyle = 'rgba(100, 200, 255, 0.7)';
  CtxUi.lineWidth = 2;
  CtxUi.beginPath();
  createRoundRect(CtxUi, x, y, panelWidth, panelHeight, 8);
  CtxUi.fill();
  CtxUi.stroke();

  const title = 'Debug Board (/show_debug_board)';
  CtxUi.font = 'bold 13px Consolas, "Courier New", monospace';
  CtxUi.fillStyle = '#00E5FF';
  CtxUi.fillText(title, x + 12, y + 20);

  CtxUi.beginPath();
  CtxUi.strokeStyle = 'rgba(100, 200, 255, 0.5)';
  CtxUi.moveTo(x + 8, y + 28);
  CtxUi.lineTo(x + panelWidth - 8, y + 28);
  CtxUi.stroke();

  CtxUi.font = '11px Consolas, "Courier New", monospace';
  CtxUi.fillStyle = '#D9D9D9';
  const lineHeight = 18;
  let textY = y + 42;

  // 静态实体数量
  CtxUi.fillText(`Static entities: ${staticEntityList.length}`, x + 12, textY);
  textY += lineHeight;

  // NPC实体数量
  CtxUi.fillText(`NPC entities: ${npcEntityList.length}`, x + 12, textY);
  textY += lineHeight;

  // 子弹实体数量
  CtxUi.fillText(`Bullet entities: ${bulletEntityList.length}`, x + 12, textY);
  textY += lineHeight;

  // grenade实体数量
  CtxUi.fillText(`Grenade entities: ${grenadeEntityList.length}`, x + 12, textY);
  textY += lineHeight;

  // 物品实体数量
  CtxUi.fillText(`Item entities: ${itemEntityList.length}`, x + 12, textY);

  // 鼠标屏幕坐标
  CtxUi.fillText(`Mouse screen position: (${Math.round(mouseX)}, ${Math.round(mouseY)})`, x + 12, textY);
  textY += lineHeight;

  // 鼠标世界坐标
  const mouseScreenToWorld = TOscreen2Canvas(mouseX, mouseY);
  CtxUi.fillText(`Mouse world position: (${Math.round(mouseScreenToWorld.x)}, ${Math.round(mouseScreenToWorld.y)})`, x + 12, textY);
  textY += lineHeight;

  // 玩家世界坐标
  if (playerEntity && !playerEntity.isDead) {
    CtxUi.fillText(`Player world position: (${Math.round(playerEntity.position.x)}, ${Math.round(playerEntity.position.y)})`, x + 12, textY);
    textY += lineHeight;
  } else {
    CtxUi.fillStyle = '#FF6B6B';
    CtxUi.fillText('Player: Dead or Not Found', x + 12, textY);
  }

  CtxUi.restore();
};

/**
 * 绘制调试终端(UI层)
 */
const drawDebugTerminal = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {

  const { height, width } = H_getCanvasCssSize(CANVAS);
  const terminalWidth = Math.min(560, Math.max(320, width - 30));
  const terminalHeight = 220;
  const x = 12;
  const y = height - terminalHeight - 12;

  if (!debugTerminalVisible){
    CtxUi.clearRect(x, y, terminalWidth, terminalHeight);
    return;
  }

  CtxUi.save();
  CtxUi.fillStyle = 'rgba(10, 10, 10, 0.85)';
  CtxUi.strokeStyle = 'rgba(120, 120, 120, 0.9)';
  CtxUi.lineWidth = 1;
  CtxUi.beginPath();
  createRoundRect(CtxUi, x, y, terminalWidth, terminalHeight, 8);
  CtxUi.fill();
  CtxUi.stroke();

  const title = 'Debug Terminal (~ to close)';
  CtxUi.font = '13px Consolas, "Courier New", monospace';
  CtxUi.fillStyle = '#7CFC00';
  CtxUi.fillText(title, x + 10, y + 16);

  CtxUi.beginPath();
  CtxUi.strokeStyle = 'rgba(90, 90, 90, 0.8)';
  CtxUi.moveTo(x + 8, y + 28);
  CtxUi.lineTo(x + terminalWidth - 8, y + 28);
  CtxUi.stroke();

  CtxUi.beginPath();
  CtxUi.rect(x + 8, y + 34, terminalWidth - 16, terminalHeight - 68);
  CtxUi.clip();

  CtxUi.font = '12px Consolas, "Courier New", monospace';
  CtxUi.fillStyle = '#D9D9D9';
  const lineHeight = 16;
  const maxVisibleLines = Math.floor((terminalHeight - 72) / lineHeight);
  const maxScrollOffset = Math.max(0, debugTerminalLogs.length - maxVisibleLines);
  debugTerminalScrollOffset = Math.max(0, Math.min(debugTerminalScrollOffset, maxScrollOffset));
  const start = Math.max(0, debugTerminalLogs.length - maxVisibleLines - debugTerminalScrollOffset);
  const end = start + maxVisibleLines;
  const visibleLogs = debugTerminalLogs.slice(start, end);
  visibleLogs.forEach((line, index) => {
    CtxUi.fillText(line, x + 10, y + 48 + index * lineHeight);
  });
  CtxUi.restore();

  CtxUi.save();
  CtxUi.font = '12px Consolas, "Courier New", monospace';
  CtxUi.fillStyle = '#00E5FF';
  CtxUi.fillText(`$ ${debugTerminalInput}`, x + 10, y + terminalHeight - 16);
  CtxUi.restore();
};

const getDebugTerminalRect = (canvas: HTMLCanvasElement) => {
  const { height, width } = H_getCanvasCssSize(canvas);
  const terminalWidth = Math.min(560, Math.max(320, width - 30));
  const terminalHeight = 220;
  const x = 12;
  const y = height - terminalHeight - 12;
  return { x, y, width: terminalWidth, height: terminalHeight };
};

/**
 * 绘制比例尺(UI层)
 */
const drawUIRuler = (CtxUi: CanvasRenderingContext2D,CANVAS: HTMLCanvasElement) => {
  const padding = 20;
  const ruleWidth = 90;
  const ruleHeight = 40;

  const x = padding;
  const { height } = H_getCanvasCssSize(CANVAS);
  const y = height - padding - ruleHeight;

  CtxUi.save();

  // 半透明背景
  CtxUi.fillStyle = 'rgba(255, 255, 255, 0.8)';
  CtxUi.fillRect(x, y, ruleWidth, ruleHeight);

  // 边框
  CtxUi.strokeStyle = '#ccc';
  CtxUi.lineWidth = 1;
  CtxUi.strokeRect(x, y, ruleWidth, ruleHeight);

  // 每格实际代表的单位
  const gridUnit = 50; // 每格代表50单位

  // 比例尺显示
  CtxUi.font = '12px Arial';
  CtxUi.fillStyle = '#333';
  CtxUi.textAlign = 'center';

  // 绘制比例尺条
  CtxUi.beginPath();
  CtxUi.strokeStyle = '#333';
  CtxUi.lineWidth = 2;
  CtxUi.moveTo(x + 20, y + 25);
  CtxUi.lineTo(x + ruleWidth - 20, y + 25);
  CtxUi.stroke();

  // 刻度
  CtxUi.beginPath();
  CtxUi.moveTo(x + 20, y + 20);
  CtxUi.lineTo(x + 20, y + 30);
  CtxUi.stroke();

  CtxUi.beginPath();
  CtxUi.moveTo(x + ruleWidth - 20, y + 20);
  CtxUi.lineTo(x + ruleWidth - 20, y + 30);
  CtxUi.stroke();

  // 数值
  CtxUi.fillText('0', x + 20, y + 15);
  CtxUi.fillText(`${gridUnit}`, x + ruleWidth - 20, y + 15);

  CtxUi.restore();
};

/**
 * 绘制图形层(网格、轴、元素、临时预览)
 */
const drawGraphics = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);

  // 清空画布
  ctxGraphics.clearRect(0, 0, width, height);

  // 绘制星空背景
  drawStarField();

  // 绘制网格
  createGrid();

  // 绘制坐标轴
  // createAxis({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 });

  // 绘制刻度与刻度数值
  // createAxisMark();

};

/**
 * 绘制所有实体到 canvas-entity
 */
const drawEntities = () => {
  if (!ctxEntity || !ENTITY_CANVAS.value) return;
  const { width, height } = H_getCanvasCssSize(ENTITY_CANVAS.value);
  ctxEntity.clearRect(0, 0, width, height);

  const worldToScreen = (cx: number, cy: number) => TOcanvas2Screen(cx, cy);
  const canvasSize = { width, height };
  const margin = 500;// 额外扩展的绘制边距,避免部分实体被裁剪

  // 绘制静态实体
  for (const entity of staticEntityList) {
    if (entity.isInViewport(worldToScreen, canvasSize, margin)) {
      entity.draw(ctxEntity, worldToScreen, canvasSize, entityDebugFlags);
    }
  }
  // 绘制物品
  for (const entity of itemEntityList) {
    if (entity.isInViewport(worldToScreen, canvasSize, margin)) {
      entity.draw(ctxEntity, worldToScreen, canvasSize, entityDebugFlags);
    }
  }
  // 绘制NPC实体
  for (const entity of npcEntityList) {
    if (entity.isInViewport(worldToScreen, canvasSize, margin)) {
      entity.draw(ctxEntity, worldToScreen, canvasSize, entityDebugFlags);
    }
  }
  // 绘制子弹实体
  for (const entity of bulletEntityList) {
    if (entity.isInViewport(worldToScreen, canvasSize, margin)) {
      entity.draw(ctxEntity, worldToScreen, canvasSize, entityDebugFlags);
    }
  }
  // 绘制炸弹之类
  for(const entity of grenadeEntityList){
    if (entity.isInViewport(worldToScreen, canvasSize, margin)) {
      entity.draw(ctxEntity, worldToScreen, canvasSize, entityDebugFlags);
    }
  }
  // 绘制玩家实体
  if (playerEntity) {
    if (playerEntity.isInViewport(worldToScreen, canvasSize, margin)) {
      playerEntity.draw(ctxEntity, worldToScreen, canvasSize, entityDebugFlags);
    }
  }
};

/**
 * 绘制UI层
 */
const drawUI = () => {
  if (!ctxUi || !UI_CANVAS.value) return;
  const { width, height } = H_getCanvasCssSize(UI_CANVAS.value);
  ctxUi.clearRect(0, 0, width, height);
  //drawUIRuler(ctxUi, UI_CANVAS.value);
  drawInstructions(ctxUi, UI_CANVAS.value);
  drawDebugBoard(ctxUi, UI_CANVAS.value);
  drawDebugTerminal(ctxUi, UI_CANVAS.value);
};

/**
 * 加载所有实体的纹理
 */
const loadEntityTextures = async () => {
  const allEntities = [...staticEntityList, ...itemEntityList, ...npcEntityList, ...bulletEntityList, ...grenadeEntityList];
  await Promise.all(allEntities.map(e => e.loadTexture()));
  drawEntities(); // 加载完成后重绘
};

const refreshRenderEntityList = () => {
  renderEntityList = [...staticEntityList, ...itemEntityList, ...npcEntityList, ...bulletEntityList, ...grenadeEntityList];
};


const applyFirstPersonCameraMovement = (_deltaTime: number) => {
  if (perspectiveMode !== 'first_person') return;
  if (!playerEntity || !GRAPHICS_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  offsetXX = width / 2 - playerEntity.position.x;
  offsetYY = height / 2 + playerEntity.position.y;
};

/**
 * 动画循环
 * 更新动态实体位置并重绘实体层
 * @param timestamp 当前时间戳
 */
const animateEntities = (timestamp: number) => {
  if (!lastTimestamp) {// 初始帧
    lastTimestamp = timestamp;
    animationFrameId = requestAnimationFrame(animateEntities);
    return;
  }

  const deltaTime = Math.min(0.033, (timestamp - lastTimestamp) / 1000); // 当前时间减去上一帧的时间等于此帧的时间-并且限制最大33ms
  if (deltaTime > 0) {
    applyFirstPersonCameraMovement(deltaTime);  // 移动第一人称视角(背景)
    drawGraphics();                             // 重绘星空和网格层
    drawEntities();                             // 重绘实体层
    effectManager?.updateAndDraw(deltaTime);    // 渲染特效层
    
    if(debugBoardVisible){
      if (!ctxUi || !UI_CANVAS.value) return;
      drawDebugBoard(ctxUi, UI_CANVAS.value);
    }// 渲染调试面板

    // 不再频繁渲染UI层,只在状态变化时渲染,以提升性能
    // if(ctxUi && UI_CANVAS.value){
    //   drawUI();
    // }

  }
  lastTimestamp = timestamp;
  animationFrameId = requestAnimationFrame(animateEntities);
};

////////////////////
//<--其他函数区
////////////////////

////////////////////
//事件处理函数区-->
////////////////////

const pushDebugTerminalLog = (text: string) => {
  debugTerminalLogs.push(text);
  if (debugTerminalLogs.length > DEBUG_TERMINAL_MAX_LOGS) {
    debugTerminalLogs = debugTerminalLogs.slice(debugTerminalLogs.length - DEBUG_TERMINAL_MAX_LOGS);
  }
};

const pushDebugTerminalHistory = (text: string) => {
  const commandText = text.trim();
  if (!commandText) return;

  debugTerminalHistory = debugTerminalHistory.filter(cmd => cmd !== commandText);
  debugTerminalHistory.push(commandText);
  if (debugTerminalHistory.length > 10) {// 最大记忆10条历史命令
    debugTerminalHistory = debugTerminalHistory.slice(debugTerminalHistory.length - 10);
  }
};

const parseDebugSwitchCommand = (args: string[], currentValue: boolean): boolean | null => {
  if (args.length === 0) return !currentValue;
  const option = args[0].toLowerCase();
  if (option === 'on' || option === '1' || option === 'true') return true;
  if (option === 'off' || option === '0' || option === 'false') return false;
  if (option === 'toggle') return !currentValue;
  return null;
};

const parsePerspectiveMode = (raw?: string): PerspectiveMode | null => {
  if (!raw) return null;
  const option = raw.toLowerCase();
  if (option === 'first' || option === 'first_person' || option === 'fp' || option === '1p') return 'first_person';
  if (option === 'third' || option === 'third_person' || option === 'tp' || option === '3p') return 'third_person';
  return null;
};

const setPerspectiveMode = (nextMode: PerspectiveMode) => {
  perspectiveMode = nextMode;
  if (nextMode === 'first_person') {
    isDragging = false;
    isMoveCanvas = false;
    applyFirstPersonCameraMovement(0);
  } else {
    firstPersonMoveW = false;
    firstPersonMoveA = false;
    firstPersonMoveS = false;
    firstPersonMoveD = false;
  }
};

const applyDebugFlagCommand = (
  featureName: string,
  currentValue: boolean,
  args: string[],
  setter: (value: boolean) => void
) => {
  const nextValue = parseDebugSwitchCommand(args, currentValue);
  if (nextValue === null) {
    pushDebugTerminalLog(`[ERR] Invalid option for ${featureName}. Use: on | off | toggle`);
    return;
  }
  setter(nextValue);
  pushDebugTerminalLog(`[OK] ${featureName}: ${nextValue ? 'ON' : 'OFF'}`);
  drawEntities();
};

// 自动补全命令输入
const DEBUG_COMMAND_SPECS = [
  { name: '/help', args: [] as string[] },
  { name: '/status', args: [] as string[] },
  { name: '/set_perspective', args: ['first', 'third'] },
  { name: '/trajectory', args: ['on', 'off', 'toggle'] },
  { name: '/collision', args: ['on', 'off', 'toggle'] },
  { name: '/facing', args: ['on', 'off', 'toggle'] },
  { name: '/show_tag', args: ['on', 'off', 'toggle'] },
  { name: '/show_hunger', args: ['on', 'off', 'toggle'] },
  { name: '/show_health', args: ['on', 'off', 'toggle'] },
  { name: '/show_debug_board', args: ['on', 'off', 'toggle'] },
  { name: '/perception_range', args: ['on', 'off', 'toggle'] },
  { name: '/movement_range', args: ['on', 'off', 'toggle'] },
  { name: '/movement_speed', args: ['on', 'off', 'toggle'] },
  { name: '/movement_passion', args: ['on', 'off', 'toggle'] },
  { name: '/all', args: ['on', 'off'] },
  { name: '/clear', args: [] as string[] },
];

const autoCompleteDebugCommand = () => {
  const raw = debugTerminalInput;
  const trimmed = raw.trim();
  if (!trimmed) {
    debugTerminalInput = '/';
    return;
  }

  const tokens = trimmed.split(/\s+/);
  const firstToken = tokens[0].startsWith('/') ? tokens[0] : `/${tokens[0]}`;
  const commandSpecs = DEBUG_COMMAND_SPECS;

  // 只补全命令
  if (tokens.length <= 1 && !raw.endsWith(' ')) {
    const candidates = commandSpecs
      .map(s => s.name)
      .filter(name => name.startsWith(firstToken.toLowerCase()));
    if (candidates.length === 1) {
      debugTerminalInput = `${candidates[0]} `;
      return;
    }
    if (candidates.length > 1) {
      const match = candidates.sort()[0];
      debugTerminalInput = match;
      return;
    }
    return;
  }

  // 补全参数
  const spec = commandSpecs.find(s => s.name === firstToken.toLowerCase());
  if (!spec || spec.args.length === 0) return;

  const currentArg = raw.endsWith(' ') ? '' : tokens[tokens.length - 1].toLowerCase();
  const argCandidates = spec.args.filter(arg => arg.startsWith(currentArg));
  if (argCandidates.length === 1) {
    debugTerminalInput = `${firstToken} ${argCandidates[0]}`;
  } else if (argCandidates.length > 1) {
    debugTerminalInput = `${firstToken} ${argCandidates.sort()[0]}`;
  }
};

const isIntegerToken = (value: string) => /^-?\d+$/.test(value);

const executeDebugTerminalCommand = (rawCommand: string) => {
  const commandText = rawCommand.trim();
  if (!commandText) return;

  pushDebugTerminalLog(`> ${commandText}`);

  const [rawCmd, ...args] = commandText.split(/\s+/);
  const cmd = rawCmd.replace(/^\//, '').toLowerCase();

  switch (cmd) {
    case 'help':{
      pushDebugTerminalLog('Commands:');
      pushDebugTerminalLog('/help');
      pushDebugTerminalLog('/status');
      pushDebugTerminalLog('/show_debug_board');
      pushDebugTerminalLog('/set_perspective <first|third>');

      pushDebugTerminalLog('/trajectory [on|off|toggle]');
      pushDebugTerminalLog('/collision [on|off|toggle]');
      pushDebugTerminalLog('/facing [on|off|toggle]');
      pushDebugTerminalLog('/show_tag [on|off|toggle]');
      pushDebugTerminalLog('/show_hunger [on|off|toggle]');
      pushDebugTerminalLog('/show_health [on|off|toggle]');
      pushDebugTerminalLog('/perception_range [on|off|toggle]');
      pushDebugTerminalLog('/movement_range [on|off|toggle]');
      pushDebugTerminalLog('/movement_speed [on|off|toggle]');
      pushDebugTerminalLog('/movement_passion [on|off|toggle]');

      pushDebugTerminalLog('/all [on|off]');
      pushDebugTerminalLog('/clear');
      break;
    }
    case 'status':{
      pushDebugTerminalLog(`Perspective: ${perspectiveMode === 'first_person' ? 'FIRST_PERSON' : 'THIRD_PERSON'}`);

      pushDebugTerminalLog(`Trajectory: ${entityDebugFlags.showHistoricalTrajectory ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`CollisionBoxes: ${entityDebugFlags.showCollisionBoxes ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`FacingArrow: ${entityDebugFlags.showFacingDirection ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`TagText: ${entityDebugFlags.showTag ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`HungerText: ${entityDebugFlags.showHunger ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`HealthText: ${entityDebugFlags.showHealth ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`InterestRange: ${entityDebugFlags.showInterestRange ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`MovementRange: ${entityDebugFlags.showMovementRange ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`MovementSpeedText: ${entityDebugFlags.showMovementSpeed ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`MovementPassionText: ${entityDebugFlags.showMovementPassion ? 'ON' : 'OFF'}`);
      break;
    }
    case 'set_perspective': {
      const nextMode = parsePerspectiveMode(args[0]);
      if (!nextMode) {
        pushDebugTerminalLog('[ERR] Invalid perspective. Use: /set_perspective <first|third>');
        break;
      }
      setPerspectiveMode(nextMode);
      pushDebugTerminalLog(`[OK] Perspective: ${nextMode === 'first_person' ? 'FIRST_PERSON' : 'THIRD_PERSON'}`);
      break;
    }
    case 'trajectory':{
      applyDebugFlagCommand('Trajectory', entityDebugFlags.showHistoricalTrajectory, args, (v) => { entityDebugFlags.showHistoricalTrajectory = v; });
      break;
    }
    case 'collision':{
      applyDebugFlagCommand('CollisionBoxes', entityDebugFlags.showCollisionBoxes, args, (v) => { entityDebugFlags.showCollisionBoxes = v; });
      break;
    }
    case 'facing':{
      applyDebugFlagCommand('FacingArrow', entityDebugFlags.showFacingDirection, args, (v) => { entityDebugFlags.showFacingDirection = v; });
      break;
    }
    case 'show_tag':{
      applyDebugFlagCommand('TagText', entityDebugFlags.showTag, args, (v) => { entityDebugFlags.showTag = v; });
      break;
    }
    case 'show_hunger':{
      applyDebugFlagCommand('HungerText', entityDebugFlags.showHunger, args, (v) => { entityDebugFlags.showHunger = v; });
      break;
    }
    case 'show_health':{
      applyDebugFlagCommand('HealthText', entityDebugFlags.showHealth, args, (v) => { entityDebugFlags.showHealth = v; });
      break;
    }
    case 'perception_range':{
      applyDebugFlagCommand('InterestRange', entityDebugFlags.showInterestRange, args, (v) => { entityDebugFlags.showInterestRange = v; });
      break;
    }
    case 'movement_range':{
      applyDebugFlagCommand('MovementRange', entityDebugFlags.showMovementRange, args, (v) => { entityDebugFlags.showMovementRange = v; });
      break;
    }
    case 'movement_speed':{
      applyDebugFlagCommand('MovementSpeedText', entityDebugFlags.showMovementSpeed, args, (v) => { entityDebugFlags.showMovementSpeed = v; });
      break;
    }
    case 'movement_passion':{
      applyDebugFlagCommand('MovementPassionText', entityDebugFlags.showMovementPassion, args, (v) => { entityDebugFlags.showMovementPassion = v; });
      break;
    }
    case 'all': {
      if (args.length === 0) {
        pushDebugTerminalLog('[ERR] Missing option for all. Use: on | off');
        break;
      }
      const option = args[0].toLowerCase();
      let nextValue: boolean | null = null;
      if (option === 'on' || option === '1' || option === 'true') nextValue = true;
      if (option === 'off' || option === '0' || option === 'false') nextValue = false;
      if (nextValue === null) {
        pushDebugTerminalLog('[ERR] Invalid option for all. Use: on | off');
        break;
      }
      entityDebugFlags.showHistoricalTrajectory = nextValue;
      entityDebugFlags.showCollisionBoxes = nextValue;
      entityDebugFlags.showFacingDirection = nextValue;
      entityDebugFlags.showTag = nextValue;
      entityDebugFlags.showHunger = nextValue;
      entityDebugFlags.showHealth = nextValue;
      entityDebugFlags.showInterestRange = nextValue;
      entityDebugFlags.showMovementRange = nextValue;
      entityDebugFlags.showMovementSpeed = nextValue;
      entityDebugFlags.showMovementPassion = nextValue;
      pushDebugTerminalLog(`[OK] All debug features: ${nextValue ? 'ON' : 'OFF'}`);
      drawEntities();
      break;
    }
    case 'show_debug_board': {
      const nextValue = parseDebugSwitchCommand(args, debugBoardVisible);
      if (nextValue === null) {
        pushDebugTerminalLog('[ERR] Invalid option for show_debug_board. Use: on | off | toggle');
        break;
      }
      debugBoardVisible = nextValue;
      pushDebugTerminalLog(`[OK] DebugBoard: ${nextValue ? 'ON' : 'OFF'}`);
      drawUI();
      break;
    }
    case 'clear':{
      debugTerminalLogs = [];
      debugTerminalScrollOffset = 0;
      break;
    }
    default:{
      pushDebugTerminalLog(`[ERR] Unknown command: ${rawCmd}`);
      pushDebugTerminalLog("Type /help to list commands.");
      break;
    }
  }
};

/**
 * 全局键盘快捷键处理
 */
const onGlobalKeyDown = (e: KeyboardEvent) => {
  // ~ 统一用于打开/关闭调试终端
  if (e.key === '`' || e.key === '~') {
    e.preventDefault();
    debugTerminalVisible = !debugTerminalVisible;
    if (debugTerminalVisible) {
      debugTerminalScrollOffset = 0;
      debugTerminalHistoryIndex = -1;
      debugTerminalInputDraft = '';
      pushDebugTerminalLog('[SYS] Debug terminal opened. Type /help');
    }
    else {
      pushDebugTerminalLog('[SYS] Debug terminal closed.');
    }
    drawUI();
    return;
  }

  // 终端打开时,接管输入
  if (debugTerminalVisible) {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeDebugTerminalCommand(debugTerminalInput);
      pushDebugTerminalHistory(debugTerminalInput);
      debugTerminalInput = '';
      debugTerminalHistoryIndex = -1;
      debugTerminalInputDraft = '';
      drawUI();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      debugTerminalInput = debugTerminalInput.slice(0, -1);
      debugTerminalHistoryIndex = -1;
      drawUI();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (debugTerminalHistory.length === 0) return;
      if (debugTerminalHistoryIndex === -1) {
        debugTerminalInputDraft = debugTerminalInput;
        debugTerminalHistoryIndex = debugTerminalHistory.length - 1;
      } else if (debugTerminalHistoryIndex > 0) {
        debugTerminalHistoryIndex -= 1;
      }
      debugTerminalInput = debugTerminalHistory[debugTerminalHistoryIndex];
      drawUI();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (debugTerminalHistoryIndex === -1) return;
      if (debugTerminalHistoryIndex < debugTerminalHistory.length - 1) {
        debugTerminalHistoryIndex += 1;
        debugTerminalInput = debugTerminalHistory[debugTerminalHistoryIndex];
      } else {
        debugTerminalHistoryIndex = -1;
        debugTerminalInput = debugTerminalInputDraft;
      }
      drawUI();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      debugTerminalVisible = false;
      debugTerminalHistoryIndex = -1;
      debugTerminalInputDraft = '';
      drawUI();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      autoCompleteDebugCommand();
      debugTerminalHistoryIndex = -1;
      drawUI();
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      debugTerminalInput += e.key;
      debugTerminalHistoryIndex = -1;
      drawUI();
    }
    return;
  }

  // 单个按键
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'f' && !e.repeat) {// 切换开火模式
      e.preventDefault();
      playerFireMode = !playerFireMode;
      drawUI();
      return;
    }
    if (key === '3' && !e.repeat) {// 切换视角模式
      if(perspectiveMode === 'first_person'){
        setPerspectiveMode('third_person');
      }
      else{
        setPerspectiveMode('first_person');
      }
      return;
    }
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
      e.preventDefault();
      if (key === 'w') PlayerDynamicEntity.playerMoveState.playerMoveW = true;
      if (key === 'a') PlayerDynamicEntity.playerMoveState.playerMoveA = true;
      if (key === 's') PlayerDynamicEntity.playerMoveState.playerMoveS = true;
      if (key === 'd') PlayerDynamicEntity.playerMoveState.playerMoveD = true;
      if (perspectiveMode === 'first_person') {
        if (key === 'w') firstPersonMoveW = true;
        if (key === 'a') firstPersonMoveA = true;
        if (key === 's') firstPersonMoveS = true;
        if (key === 'd') firstPersonMoveD = true;
      }
      sendPlayerMoveInput();
      return;
    }
  }

  // 多个按键
  // if (e.ctrlKey || e.metaKey) {
  //   switch (e.key.toLowerCase()) {
      
  //   }
  // }
};

const onGlobalKeyUp = (e: KeyboardEvent) => {
  const key = e.key.toLowerCase();
  if (key === 'w') firstPersonMoveW = false;
  if (key === 'a') firstPersonMoveA = false;
  if (key === 's') firstPersonMoveS = false;
  if (key === 'd') firstPersonMoveD = false;
  if (key === 'w') PlayerDynamicEntity.playerMoveState.playerMoveW = false;
  if (key === 'a') PlayerDynamicEntity.playerMoveState.playerMoveA = false;
  if (key === 's') PlayerDynamicEntity.playerMoveState.playerMoveS = false;
  if (key === 'd') PlayerDynamicEntity.playerMoveState.playerMoveD = false;
  if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
    sendPlayerMoveInput();
  }
};

/**
 * 画布点击事件处理(绑定到UI Canvas)
 */
const onCanvasClick = (e: MouseEvent) => {
  if (!UI_CANVAS.value || !ctxGraphics) return;

  const screenX = e.offsetX;
  const screenY = e.offsetY;
  const hitArea = H_getHitEventArea(screenX, screenY);
  if (hitArea) {
    if (hitArea.onClick) {
      hitArea.onClick(e, hitArea);
      drawUI();
    }
    e.stopPropagation();
    return;
  }

  dragTotalX = 0;
  dragTotalY = 0;
};

const onCanvasDoubleClick = (_e: MouseEvent) => {
  // drawing-board polyline feature removed
};

const onCanvasWheel = (e: WheelEvent) => {
  if (!UI_CANVAS.value || !debugTerminalVisible) return;
  const rect = getDebugTerminalRect(UI_CANVAS.value);
  const x = e.offsetX;
  const y = e.offsetY;
  const isInTerminal =
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height;
  if (!isInTerminal) return;

  const lineHeight = 16;
  const maxVisibleLines = Math.floor((220 - 72) / lineHeight);
  const maxScrollOffset = Math.max(0, debugTerminalLogs.length - maxVisibleLines);
  const step = Math.max(1, Math.round(Math.abs(e.deltaY) / 40));

  if (e.deltaY < 0) {
    // 向上滚动:查看更早的日志
    debugTerminalScrollOffset = Math.min(maxScrollOffset, debugTerminalScrollOffset + step);
  } else if (e.deltaY > 0) {
    // 向下滚动:回到更新的日志
    debugTerminalScrollOffset = Math.max(0, debugTerminalScrollOffset - step);
  }

  e.preventDefault();
  drawUI();
};

/**
 * 调整画布大小以适应窗口
 */
const onResizeCanvas = () => {
  if (!GRAPHICS_CANVAS.value || !UI_CANVAS.value) return;
  const cursorCanvas = document.getElementById('canvas-cursor') as HTMLCanvasElement | null;

  ctxGraphics = GRAPHICS_CANVAS.value.getContext('2d');
  ctxUi = UI_CANVAS.value.getContext('2d');
  if (!ctxGraphics || !ctxUi) return;

  // 应用 DPI 适配
  H_applyDprToCanvas(GRAPHICS_CANVAS.value, ctxGraphics);
  H_applyDprToCanvas(UI_CANVAS.value, ctxUi);
  if (cursorCanvas) {
    const cursorCtx = cursorCanvas.getContext('2d');
    if (cursorCtx) {
      H_applyDprToCanvas(cursorCanvas, cursorCtx);
    }
  }

  // 调整实体层 DPR
  if (ENTITY_CANVAS.value && ctxEntity) {
    H_applyDprToCanvas(ENTITY_CANVAS.value, ctxEntity);
    drawEntities(); // 重绘实体层
  }

  // adjust effect layer DPR and redraw
  effectManager?.bindCanvas(EFFECTS_CANVAS.value);
  effectManager?.applyDprToCanvas();
  effectManager?.updateAndDraw(0);

  // 如果还没有设置偏移量,初始化为画布中心
  if (offsetXX === 0 && offsetYY === 0) {
    const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
    offsetXX = width / 2;
    offsetYY = height / 2;
  }

  // 重新绘制所有内容
  drawGraphics();
  drawUI();
};

/**
 * 鼠标按下事件(绑定到UI Canvas)
 */
const onMousedown = (e: MouseEvent) => {
  const screenX = e.offsetX;
  const screenY = e.offsetY;

  if (H_getHitEventArea(screenX, screenY)) return;

  if (e.button === 0 && playerFireMode) {
    e.preventDefault();
    sendClientInstruct(Instruct.I_PlayerFireInput(TOscreen2Canvas(screenX, screenY)));
    drawUI();
    return;
  }

  const canvasPos = TOscreen2Canvas(screenX, screenY);
  dragStartX = canvasPos.x;
  dragStartY = canvasPos.y;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  isDragging = true;
  isMoveCanvas = true;
};

/**
 * 鼠标移动事件(绑定到UI Canvas)
 */
const onMouseMove = (e: MouseEvent) => {
  mouseX = e.offsetX;
  mouseY = e.offsetY;
  // 更新鼠标世界坐标,用于调试面板
  const worldCoord = TOscreen2Canvas(mouseX, mouseY);
  mouseWorldX = worldCoord.x;
  mouseWorldY = worldCoord.y;

  if (!UI_CANVAS.value) return;

  const hitArea = H_getHitEventArea(mouseX, mouseY);
  hoveredArea = hitArea;

  if (hitArea) {
    cursorManager?.setNowCursorType(hitArea.cursor || 'pointer');
  } else {
    if (isMoveCanvas) {
      cursorManager?.setNowCursorType('move');
    } else if (playerFireMode) {
      cursorManager?.setNowCursorType('crosshair');
    } else {
      cursorManager?.setNowCursorType('default');
    }
  }

  if (!isDragging) return;

  const deltaX = e.clientX - lastDragX;
  const deltaY = e.clientY - lastDragY;
  dragTotalX += Math.abs(deltaX);
  dragTotalY += Math.abs(deltaY);
  offsetXX += deltaX;
  offsetYY += deltaY;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  drawGraphics();
};

/**
 * 鼠标释放事件(绑定到UI Canvas)
 */
const onMouseUp = () => {
  isDragging = false;
  isMoveCanvas = false;
  cursorManager?.setNowCursorType(playerFireMode ? 'crosshair' : 'default');
};

/**
 * 窗口鼠标移动(用于自定义光标)
 */
const onWindowMouseMove = (e: MouseEvent) => {
  cdtLastMouseX = e.clientX;
  cdtLastMouseY = e.clientY;
  if (cdtRafCursorId) cancelAnimationFrame(cdtRafCursorId);
  cdtRafCursorId = requestAnimationFrame(() => {
    cursorManager?.drawCursor('auto', cdtLastMouseX, cdtLastMouseY, 0.2);
    cdtRafCursorId = null;
  });
};

/**
 * 窗口鼠标离开(隐藏光标)
 */
const onWindowMouseLeave = () => {
  cursorManager?.setFocused(false);
};

/**
 * 窗口鼠标进入(显示光标)
 */
const onWindowMouseEnter = () => {
  cursorManager?.setFocused(true);
};

////////////////////
//<--事件处理函数区
////////////////////

////////////////////
//vue事件处理区-->
////////////////////

onMounted(() => {
  startSetting();
});

onUnmounted(() => {
  // 关闭服务端
  serviceWorker.terminate();

  if (UI_CANVAS.value) {
    UI_CANVAS.value.removeEventListener('mousedown', onMousedown);
    UI_CANVAS.value.removeEventListener('mousemove', onMouseMove);
    UI_CANVAS.value.removeEventListener('mouseup', onMouseUp);
    UI_CANVAS.value.removeEventListener('mouseleave', onMouseUp);
    UI_CANVAS.value.removeEventListener('click', onCanvasClick);
    UI_CANVAS.value.removeEventListener('dblclick', onCanvasDoubleClick);
    UI_CANVAS.value.removeEventListener('wheel', onCanvasWheel);
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  window.removeEventListener('resize', onResizeCanvas);
  window.visualViewport?.removeEventListener('resize', onResizeCanvas);
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseleave', onWindowMouseLeave);
  window.removeEventListener('mouseenter', onWindowMouseEnter);
  window.removeEventListener('keydown', onGlobalKeyDown);
  window.removeEventListener('keyup', onGlobalKeyUp);
  effectManager = null;
});
////////////////////
//<--vue事件处理区
////////////////////
</script>
<template>
  <div class="view-pixel-war-container">
    <!-- 图形层可以渲染背景 -->
    <canvas id="canvas-graphics" ref="GRAPHICS_CANVAS"></canvas>
    <!-- 实体渲染 -->
    <canvas id="canvas-entity" ref="ENTITY_CANVAS"></canvas>
    <!-- 特效层 -->
    <canvas id="canvas-effects" ref="EFFECTS_CANVAS"></canvas>
    <!-- UI用户界面层 -->
    <canvas id="canvas-ui" ref="UI_CANVAS"></canvas>
    <!-- 鼠标指针 -->
    <canvas id="canvas-cursor"></canvas>
  </div>
</template>
<style scoped>
.view-pixel-war-container{position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;cursor:none;}
#canvas-graphics{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-entity{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-effects{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-ui{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:auto;cursor:none;}
#canvas-cursor{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
</style>
