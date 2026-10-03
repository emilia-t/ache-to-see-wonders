<script setup lang="ts">
// The relative position of this file: src/components/pixel_war/ViewPixelWar.vue
// Warning! Please use an editor that supports UTF-8 to read the code!
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
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
  PlayerInventory,
  InventoryEntry
} from '@/components/pixel_war/interface/Interface';

import {
  CursorManager,
  EffectManager,
  NumericalManager,
  Entity,
  StaticEntity,
  ItemEntity,
  NpcDynamicEntity,
  PlayerDynamicEntity,
  DodgeSkill,
  BulletDynamicEntity,
  GrenadeDynamicEntity,
  ExpOrbDynamicEntity,
  SkillOrbDynamicEntity,
  INVENTORY_SKILL_SLOT_COUNT,
  INVENTORY_INNATE_SKILL_SLOT_COUNT,
  INVENTORY_EXTENDED_SKILL_SLOT_COUNT,
  H_inventoryIsInnateSkillSlot,
  INVENTORY_ITEM_MAX_STACK,
  INVENTORY_BAG_CAPACITY,
  H_inventoryGetEntryAtSlot,
  H_inventoryUsedSlotCount,
  H_inventoryEquipSkill,
  H_inventoryAutoEquipSkill,
  H_inventoryUnequipSkill,
  H_inventoryUnequipSkillToSlot,
  H_inventoryMoveSkillSlot,
  H_inventoryMoveEntry,
  H_inventoryDestroyEntry,
  H_inventoryDestroyEquipped,
  H_ensurePlayerInventory,
  H_drawSkillIconTexture,
  H_preloadSkillIconTextures,
  H_getResearchDefinition,
  H_getResearchEffectText,
  H_getResearchLevel,
  RESEARCH_NORMAL_COLOR,
  RESEARCH_LEGENDARY_COLOR,
  RESEARCH_FORTRESS_ABSORB_PER_LEVEL
} from '@/components/pixel_war/class';
// 注册表层(技能表 / 物品表 / 实体工厂)统一从 registry/ 导入
import { H_getSkillByTag, H_getAllSkills } from '@/components/pixel_war/registry/SkillRegistry';
import { H_getItemDefinition } from '@/components/pixel_war/registry/ItemRegistry';
import { H_createEntityFromSnapshot } from '@/components/pixel_war/registry/EntityFactory';

// 底部状态栏技能信息类型
type BottomStatusSkill = {
  key: string;
  title: string;
  subtitle: string;
  color: string;
  cooldownNow: number;
  cooldownMax: number;
  active?: boolean;
  // 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG,取自 Skill.icon);
  // 固定功能键无贴图,按 key 绘制矢量图标
  icon?: string;
  // 是否为已装配技能(来自技能装配区)
  equipped?: boolean;
};

// 实体插值状态Map，key为实体ID，value为插值状态
type EntityInterpolationState = {
  from: Point;
  to: Point;
  startTime: number;
  duration: number;
};

import { createServiceTransport } from '@/components/pixel_war/service/transport/ServiceTransport';
// 特效贴图资源已由 public/effects 迁移至 pixel_war/resource/effects
import dynamicEntityDeathEffectUrl from '@/components/pixel_war/resource/effects/dynamic_entity_death_default.png?url';

const router = useRouter();

////////////////////
// 数值管理器相关函数 -->
////////////////////

// 对比新旧实体列表，生成伤害/恢复数字
const generateFloatingNumbersFromHealthChange = (
  newEntities: (NpcDynamicEntity | PlayerDynamicEntity)[],
  oldHealthMap: Map<number, number>
) => {
  for (const entity of newEntities) {
    const oldHealth = oldHealthMap.get(entity.id);
    if (oldHealth !== undefined && oldHealth !== entity.health) {
      const delta = entity.health - oldHealth;
      if (delta < 0) {
        // 受到伤害
        numericalManager.addNumber(
          `${Math.floor(Math.abs(delta))}`,
          entity.position.x,
          entity.position.y,
          '#ff6666'  // 红色
        );
      } else if (delta > 0) {
        // 恢复血量
        numericalManager.addNumber(
          `+${Math.floor(delta)}`,
          entity.position.x,
          entity.position.y,
          '#66ff66'  // 绿色
        );
      }
    }
  }
}

////////////////////
// <-- 数值管理器相关函数
////////////////////


////////////////////
//服务器通信相关区-->
////////////////////

// 服务端通道:默认使用浏览器内 Worker(单人模式);配置指向 websocket 时连接 Java 多人服务端
const serviceTransport = createServiceTransport();

serviceTransport.addEventListener('message', (event: MessageEvent) => {
  handleWorkerMessage(event);
});

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
        if (!isPageVisible) {
          break;
        }
        //console.log(instruct.data);
        applyMapDataSnapshot(instruct.data as MapData);
        break;
      }
      case 'map_data_dynamic_item_update': {
        if (!isPageVisible) {
          break;
        }
        applyDynamicMapDataSnapshot(instruct.data as MapData);
        break;
      }
      default:{
        console.warn('Received unknown instruct type from worker:', type, instruct);
      }
    }
  }

  // 检测从者吸附(ownerId 由无主变为本玩家)并播放吸附特效
  H_detectServantAbsorb();
};

const handleVisibilityChange = () => {
  isPageVisible = !document.hidden;
  if (isPageVisible) {
    // 页面恢复可见时立即重绘一次，确保画面与最新数据同步
    drawGraphics();
    drawEntities();
    effectManager?.updateAndDraw(0);
  }
};

/**
 * 将相机中心重置到玩家当前位置(玩家居中)
 * 若画布或玩家尚未就绪，则置为待处理状态，由动画循环在就绪后执行。
 */
const resetCameraToPlayer = () => {
  if (!playerEntity || !GRAPHICS_CANVAS.value) {
    pendingCameraResetToPlayer = true;
    return;
  }
  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  // 画布尚未完成布局(CSS 尺寸为 0)时无法计算相机偏移,
  // 必须保持"待处理"状态等下一帧重试,否则会把相机算到错误位置导致视角不跟随玩家。
  if (!(width > 0) || !(height > 0)) {
    pendingCameraResetToPlayer = true;
    return;
  }
  offsetXX = width / 2 - playerEntity.position.x;
  offsetYY = height / 2 + playerEntity.position.y;
  pendingCameraResetToPlayer = false;
};

/**
 * 在快照更新后根据玩家状态变化同步相机：
 * - 首次看到玩家(首次进入游戏)时重置相机到玩家
 * - 玩家从死亡变为存活(死亡后重生)时重置相机到玩家
 */
const syncCameraToPlayerIfNeeded = () => {
  if (!playerEntity) {
    prevPlayerIsDead = null;
    return;
  }
  const isDead = playerEntity.isDead;
  if (prevPlayerIsDead === null) {
    // 首次进入游戏：相机重置到玩家
    resetCameraToPlayer();
  } else if (prevPlayerIsDead && !isDead) {
    // 玩家死亡后重生：相机重置到玩家
    resetCameraToPlayer();
  }
  prevPlayerIsDead = isDead;
};

/**
 * 检测"从者吸附成功"并播放吸附特效
 * - 判定依据:某 NPC 的 ownerId 由"无主"变为"本玩家"
 * - 拖尾方向由"玩家位置 → 被吸附从者所在格子位置"决定(由 EffectManager 吸附到 8 个方向之一),
 *   即朝玩家被吸附的那一面向外拖出,而不是朝 NPC 的来向
 * - 特效锚点每帧跟随被吸附的从者实体,无需等待位置落到网格
 */
const H_detectServantAbsorb = () => {
  const player = playerEntity;
  const aliveIds = new Set<number>();

  for (const npc of npcEntityList) {
    aliveIds.add(npc.id);
    const prevOwner = prevNpcAbsorbStates.get(npc.id);
    // 归属由"无主"变为"本玩家"即视为吸附成功(首次见到该 NPC 时 prevOwner 为 undefined,不触发)
    if (prevOwner === null && npc.ownerId !== null && player && npc.ownerId === player.id) {
      effectManager?.emitServantAbsorb(
        npc.id,
        player.position,
        npc.position,
        npc.fillColor ?? ''
      );
    }
    prevNpcAbsorbStates.set(npc.id, npc.ownerId);
  }

  // 清理已消失 NPC 的记录(视野外/已被击杀)
  for (const id of Array.from(prevNpcAbsorbStates.keys())) {
    if (!aliveIds.has(id)) prevNpcAbsorbStates.delete(id);
  }
};

const applyMapDataSnapshot = (mapData: MapData) => {
  // 1. 保存旧的健康值快照
  const oldHealthMap = new Map<number, number>();
  for (const npc of npcEntityList) oldHealthMap.set(npc.id, npc.health);
  if (playerEntity) oldHealthMap.set(playerEntity.id, playerEntity.health);

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
  // 服务端保证本地玩家在列表首位,其余的都是其他玩家(多人模式需要一并渲染)
  otherPlayerEntityList = playerEntity
    ? playerEntityList.filter((player) => player.id !== playerEntity!.id)
    : playerEntityList;
  grenadeEntityList = hydrateList(mapData.dynamicEntitie.grenadeDynamicEntitys) as GrenadeDynamicEntity[];
  bulletEntityList = hydrateList(mapData.dynamicEntitie.bulletDynamicEntitys) as BulletDynamicEntity[];
  expOrbEntityList = hydrateList(mapData.dynamicEntitie.expOrbDynamicEntitys) as ExpOrbDynamicEntity[];
  skillOrbEntityList = hydrateList(mapData.dynamicEntitie.skillOrbDynamicEntitys ?? []) as SkillOrbDynamicEntity[];

  // 2. 生成数值浮层 (NPC + 玩家)
  generateFloatingNumbersFromHealthChange(npcEntityList, oldHealthMap);
  if (playerEntity) {
    generateFloatingNumbersFromHealthChange([playerEntity], oldHealthMap);
    H_notifyNewlyAcquiredSkills();
  }

  // 3. 更新健康快照Map
  prevHealthMap.clear();
  for (const npc of npcEntityList) prevHealthMap.set(npc.id, npc.health);
  if (playerEntity) prevHealthMap.set(playerEntity.id, playerEntity.health);

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

  syncCameraToPlayerIfNeeded();
};

const applyDynamicMapDataSnapshot = (mapData: MapData) => {
  // 1. 保存旧的健康值快照
  const oldHealthMap = new Map<number, number>();
  for (const npc of npcEntityList) oldHealthMap.set(npc.id, npc.health);
  if (playerEntity) oldHealthMap.set(playerEntity.id, playerEntity.health);

  const aliveIds = new Set<number>();
  const hydrateList = <T extends Entity>(list: T[]): T[] => {
    return list.map((entity) => {
      aliveIds.add(entity.id);
      return H_getRenderableEntityFromSnapshot(entity);
    });
  };

  itemEntityList = hydrateList(mapData.itemEntities) as ItemEntity[];
  npcEntityList = hydrateList(mapData.dynamicEntitie.npcDynamicEntitys) as NpcDynamicEntity[];
  const playerEntityList = hydrateList(mapData.dynamicEntitie.playerDynamicEntitys) as PlayerDynamicEntity[];
  playerEntity = playerEntityList[0] || null;
  // 服务端保证本地玩家在列表首位,其余的都是其他玩家(多人模式需要一并渲染)
  otherPlayerEntityList = playerEntity
    ? playerEntityList.filter((player) => player.id !== playerEntity!.id)
    : playerEntityList;
  grenadeEntityList = hydrateList(mapData.dynamicEntitie.grenadeDynamicEntitys) as GrenadeDynamicEntity[];
  bulletEntityList = hydrateList(mapData.dynamicEntitie.bulletDynamicEntitys) as BulletDynamicEntity[];
  expOrbEntityList = hydrateList(mapData.dynamicEntitie.expOrbDynamicEntitys) as ExpOrbDynamicEntity[];
  skillOrbEntityList = hydrateList(mapData.dynamicEntitie.skillOrbDynamicEntitys ?? []) as SkillOrbDynamicEntity[];

  // 2. 生成数值浮层 (NPC + 玩家)
  generateFloatingNumbersFromHealthChange(npcEntityList, oldHealthMap);
  if (playerEntity) {
    generateFloatingNumbersFromHealthChange([playerEntity], oldHealthMap);
    H_notifyNewlyAcquiredSkills();
  }

  // 3. 更新健康快照Map
  prevHealthMap.clear();
  for (const npc of npcEntityList) prevHealthMap.set(npc.id, npc.health);
  if (playerEntity) prevHealthMap.set(playerEntity.id, playerEntity.health);

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

  syncCameraToPlayerIfNeeded();
};

const sendClientInstruct = (instruct: InstructObject) => {
  serviceTransport.postMessage(H_getWorkerTickPackage([instruct]));
};

const sendPlayerMoveInput = () => {
  sendClientInstruct(Instruct.I_PlayerMoveInput({
    W: PlayerDynamicEntity.playerMoveState.W,
    A: PlayerDynamicEntity.playerMoveState.A,
    S: PlayerDynamicEntity.playerMoveState.S,
    D: PlayerDynamicEntity.playerMoveState.D,
    Shift: PlayerDynamicEntity.playerMoveState.Shift,
  }, playerEntity ? playerEntity.id : -1));
};

const sendPlayerFireInput = (target: Point) => {
  sendClientInstruct(
    Instruct.I_PlayerFireInput(
      target,
      playerEntity ? playerEntity.id : -1
    )
  );
};

const sendPlayerDodgeInput = (direction: Point) => {
  sendClientInstruct(
    Instruct.I_PlayerDodgeInput(
      direction,
      playerEntity ? playerEntity.id : -1
    )
  );
};

const sendPlayerRespawn = () => {
  sendClientInstruct(Instruct.I_PlayerRespawn(playerEntity ? playerEntity.id : -1));
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
const NUMERICAL_CANVAS = ref<HTMLCanvasElement | null>(null);
const DEBUG_TERMINAL_MAX_LOGS = 120;
const EFFECT_SPRITE_FRAME_WIDTH = 100;
const EFFECT_SPRITE_FRAME_HEIGHT = 100;
const EFFECT_SPRITE_FRAME_COUNT = 30;
const EFFECT_SPRITE_FPS = 30;
const EFFECT_PATH_DYNAMIC_ENTITY_DEATH = dynamicEntityDeathEffectUrl;
const ENTITY_CACHE = new Map<number, Entity>();// 服务端实体快照对应的本地渲染实体缓存
const SERVER_TICK_MS = 20; // 服务端固定 50 FPS,前端在两帧之间插值渲染
const MIN_INTERPOLATION_DURATION_MS = 10;//最小插值持续时间（毫秒）
const MAX_INTERPOLATION_DURATION_MS = 80;//最大插值持续时间（毫秒）
const STAR_FIELD_STAR_COUNT = 40; // 星空背景星星数量,单位个
const STAR_FIELD_MIN_RADIUS = 0.5; // 星星最小半径,单位px
const STAR_FIELD_MAX_RADIUS = 1.5; // 星星最大半径,单位px
const STAR_FIELD_MAX_OPACITY_INCREMENT = 0.03; // 星星单帧基础透明度变化量,单位透明度比例
const STAR_FIELD_TWINKLE_SPEED = 0.125; // 星星闪烁速度倍率,越小闪烁越慢
const EDGE_SCROLL_ZONE = 150;   // 开火模式下相机边缘滚动的触发区域宽度,单位px
const EDGE_SCROLL_SPEED = 1200; // 开火模式下相机边缘滚动速度,单位px/秒
const DEATH_OVERLAY_EVENT_PREFIX = 'death_overlay_'; // 重生界面按钮事件区域id前缀
const MINIMAP_DESIGN_SIZE = 240;      // 设计稿(1920x1080)下的小地图边长,单位px
const MINIMAP_DESIGN_MIN_EDGE = 1080; // 设计稿的短边尺寸,作为等比缩放的基准,单位px
const MINIMAP_SIZE_MIN = 120;         // 小地图等比缩放后的最小边长,单位px
const MINIMAP_SIZE_MAX = 300;         // 小地图等比缩放后的最大边长,单位px
const MINIMAP_MARGIN_RATIO = 20 / 240;// 设计稿中小地图边距与边长的比例
const MINIMAP_MARGIN_MIN = 8;         // 小地图边距最小值,单位px
const MINIMAP_WORLD_HALF = 10050;  // 小地图映射的世界坐标半宽(略大于服务端世界边界,以容纳边界墙)
const MINIMAP_DEFAULT_COLOR = '#ffffff'; // 小地图实体未设置mapColor时的默认显示颜色
// 小地图缩放档位:各档显示范围的“世界半宽”(px)。
// 1 档 = 整张地图(以世界原点为中心);5 档 = 500×500px 范围(半宽 250);2~4 档居中取值。
// 除 1 档外,其余档位以相机视角中心为中心,并跟随相机移动。
const MINIMAP_ZOOM_WORLD_HALVES = [MINIMAP_WORLD_HALF, 3000, 1500, 750, 250];
const MINIMAP_ZOOM_EVENT_PREFIX = 'minimap_zoom_'; // 缩放按钮事件区域id前缀

// ---- 键盘快捷键设置(左下角入口) ----
/** 键盘设置事件区域id前缀 */
const KEYBOARD_SETTINGS_EVENT_PREFIX = 'keyboard_settings_';
/** 快捷键持久化存储键 */
const KEY_BINDING_STORAGE_KEY = 'pixelWarKeyBindings';
/** 快捷键功能分类 */
type KeyBindingCategory = '功能' | '移动';
/** 单个可自定义快捷键的功能描述 */
type KeyBindingDef = {
  id: string;              // 功能唯一标识
  label: string;           // 面板中显示的功能名
  hint: string;            // 功能作用简述
  defaultKey: string;      // 默认按键(归一化后的键名)
  category: KeyBindingCategory;
};
/** 所有可自定义快捷键的功能列表 */
const KEY_BINDING_DEFS: KeyBindingDef[] = [
  { id: 'toggleInventory', label: '背包', hint: '打开/关闭背包', defaultKey: 'e', category: '功能' },
  { id: 'toggleFire', label: '开火模式', hint: '切换开火模式', defaultKey: 'f', category: '功能' },
  { id: 'togglePerspective', label: '切换视角', hint: '第一/第三人称', defaultKey: '3', category: '功能' },
  { id: 'toggleServantHealth', label: '从者血条', hint: '显示从者血量', defaultKey: 't', category: '功能' },
  { id: 'toggleServantFacing', label: '从者朝向', hint: '显示从者朝向', defaultKey: 'y', category: '功能' },
  { id: 'toggleDebugTerminal', label: '调试终端', hint: '打开/关闭终端', defaultKey: '`', category: '功能' },
  { id: 'sprint', label: '疾跑', hint: '按住疾跑', defaultKey: 'shift', category: '功能' },
  { id: 'dodge', label: '闪现', hint: '需装备闪现技能', defaultKey: ' ', category: '功能' },
  { id: 'moveUp', label: '向上移动', hint: 'WASD 移动', defaultKey: 'w', category: '移动' },
  { id: 'moveDown', label: '向下移动', hint: 'WASD 移动', defaultKey: 's', category: '移动' },
  { id: 'moveLeft', label: '向左移动', hint: 'WASD 移动', defaultKey: 'a', category: '移动' },
  { id: 'moveRight', label: '向右移动', hint: 'WASD 移动', defaultKey: 'd', category: '移动' }
];
////////////////////
//<--常量区
////////////////////

////////////////////
//变量区-->
////////////////////
let cursorManager: CursorManager | null = null;
let effectManager: EffectManager | null = null;
let numericalManager = new NumericalManager();
let starFieldStars: StarFieldStar[] = [];// 星空背景的星星列表
let ctxGraphics: CanvasRenderingContext2D | null = null;
let ctxUi: CanvasRenderingContext2D | null = null;
let ctxEntity: CanvasRenderingContext2D | null = null;
let ctxNumerical: CanvasRenderingContext2D | null = null;

let offsetXX = 0;  // 原点在x轴上的偏移
let offsetYY = 0;  // 原点在y轴上的偏移
let prevPlayerIsDead: boolean | null = null; // 上一帧玩家是否死亡(用于检测首次进入与重生)
let pendingCameraResetToPlayer = false;      // 相机是否需要重置到玩家(延迟到画布就绪后执行)
let scale = 1;     // 缩放比例

let eventArea: Array<EventArea> = []; // 事件触发区域列表
let mouseX = 0;
let mouseY = 0;
let hoveredArea: EventArea | null = null;

let isDragging   = false;  // 是否正在拖动画布
let isMoveCanvas = false;  // 是否是通过拖动来移动画布
let dragStartX = 0;        // 拖动起始X坐标
let dragStartY = 0;        // 拖动起始Y坐标
let lastDragX  = 0;        // 上一次拖动的X位置
let lastDragY  = 0;        // 上一次拖动的Y位置

let cdtRafCursorId: number | null = null;
let cdtLastMouseX = 0;//光标绘制节流Cursor drawing throttling
let cdtLastMouseY = 0;

let isPageVisible = true;
let mouseInsideCanvas = true; // 鼠标是否位于画布内

let animationFrameId: number | null = null;                 // 动画帧ID
let lastTimestamp: number = 0;                              // 上一帧时间戳
let renderEntityList: Array<Entity> = [];                   // 要渲染的实体列表
let staticEntityList: StaticEntity[] = [];                  // 静态实体列表
let npcEntityList: NpcDynamicEntity[] = [];                 // NPC实体列表
let bulletEntityList: BulletDynamicEntity[] = [];           // 子弹动态实体列表
let grenadeEntityList: GrenadeDynamicEntity[] = [];
let itemEntityList: ItemEntity[] = [];                      // 物品实体列表
let expOrbEntityList: ExpOrbDynamicEntity[] = [];           // 经验球实体列表
let skillOrbEntityList: SkillOrbDynamicEntity[] = [];       // 技能球实体列表
let playerEntity: PlayerDynamicEntity | null = null;
// 其他玩家(多人模式):快照中除自己以外的玩家实体,单人模式恒为空
let otherPlayerEntityList: PlayerDynamicEntity[] = [];

// 背包界面状态
let inventoryVisible = false;                               // 背包界面是否打开
let inventoryDragPayload: InventoryDragPayload | null = null; // 当前拖拽中的条目
let inventoryPointerX = 0;                                  // 拖拽/悬停指针位置(canvas 坐标)
let inventoryPointerY = 0;
let inventoryDragStartX = 0;                                // 拖拽起点(判断是"点击"还是"拖拽")
let inventoryDragStartY = 0;
let inventoryHoverTarget: InventorySlotTarget = null;       // 当前悬停/拖拽目标格
let inventoryTooltipEntry: InventoryEntry | null = null;    // 需要显示浮窗的条目
let inventoryTooltipSkillTag: string = '';                  // 需要显示浮窗的技能标签
let inventoryTooltipInnateIndex: number | null = null;      // 需要显示浮窗的固有技能槽下标(提示不可编辑)
let prevOwnedSkillTags: Set<string> = new Set<string>();    // 上一帧玩家持有的技能(用于获得提示)

// 底部状态栏动画状态
let bottomStatusHealthRatio = 1;
let bottomStatusDamageRatio = 1;
let bottomStatusLastHealthRatio = 1;
let bottomStatusDamageFlash = 0;
let bottomStatusLastFrameTime = 0;
let bottomStatusHealthColor: RGB = { r: 40, g: 255, b: 143 };

let entityDebugFlags: EntityDebugFlags = {
  //属性相关
  showHealth: false,
  showHunger: false,
  showMovementSpeed: false,
  showMovementPassion: false,
  showTag: false,
  showLevel: false,
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
let showPlayerServantHealth = false;
let showPlayerServantFacingDirection = false;
let minimapZoomLevel = 1; // 小地图缩放档位(1..5):1=整张地图,5=500×500px

// 键盘快捷键设置状态
let keyBindings: Record<string, string> = {};      // 功能id -> 当前按键(归一化键名)
let keyboardSettingsVisible = false;               // 键盘设置面板是否展开
let keyboardSettingsAnim = 0;                      // 展开/收起动画进度(0..1)
let keyboardSettingsListeningId: string | null = null; // 当前正在录制新键位的功能id

// 健康值快照Map (用于生成数值浮层)
let prevHealthMap = new Map<number, number>();
let entityInterpolationMap = new Map<number, EntityInterpolationState>();
let entitySnapshotTimeMap = new Map<number, number>();
// 上一帧 NPC 归属快照,用于检测从者"吸附成功"(ownerId 由无主变为本玩家)
let prevNpcAbsorbStates = new Map<number, number | null>();

// ---- 专研(Research)界面状态 ----
const RESEARCH_OVERLAY_EVENT_PREFIX = 'research_option_'; // 专研选项卡事件区域id前缀
const RESEARCH_CARD_WIDTH = 214;    // 选项卡宽度(顶部小卡片,单位px)
const RESEARCH_CARD_HEIGHT = 104;   // 选项卡高度
const RESEARCH_CARD_GAP = 14;       // 选项卡间距
const RESEARCH_TOP_OFFSET = 58;     // 卡片组距画布顶部的距离(让出标题位置)
const RESEARCH_CONFIRM_DURATION = 0.6; // 选中强调阶段时长(秒)
const RESEARCH_CLOSE_DURATION = 0.45;  // 收场淡出阶段时长(秒)
/** 刚结算过的选项在该时长内不再弹出(等待权威端清空);超过后即使标签相同也允许再次展示,避免补发抽取被永久吞掉 */
const RESEARCH_RESOLVED_SUPPRESS_MS = 1200;
type ResearchUiPhase = 'idle' | 'confirm' | 'closing';
let researchUiOptions: string[] = [];          // 当前待选研究项标签
let researchUiPhase: ResearchUiPhase = 'idle'; // 界面阶段
let researchUiSelectedTag: string | null = null; // 被选中的研究项
let researchUiPhaseStart = 0;                  // 当前阶段开始时间(performance.now())
let researchUiAnimTime = 0;                    // 用于呼吸/流动动画的累计时间(秒)
let researchUiAnimLast = 0;
let researchUiResolvedTags: string[] = [];     // 刚结算过的选项(避免服务端清空滞后时重复弹出)
let researchUiResolvedAt = 0;                  // 记录刚结算选项的时间戳(用于抑制时长的判定)

////////////////////
//<--变量区
////////////////////

////////////////////
//辅助函数区-->
////////////////////

/**
 * 计算小地图的尺寸、边距与内部元素缩放比例
 * 以设计稿短边(1080px)为基准,按画布短边等比缩放,并限制在 [MIN, MAX] 之间,
 * 保证在超宽屏/小窗口/竖屏等场景下小地图依旧可用。
 */
const H_getMiniMapMetrics = (canvasWidth: number, canvasHeight: number) => {
  const minEdge = Math.min(canvasWidth, canvasHeight);
  const ratio = minEdge / MINIMAP_DESIGN_MIN_EDGE;
  const size = H_clamp(MINIMAP_DESIGN_SIZE * ratio, MINIMAP_SIZE_MIN, MINIMAP_SIZE_MAX);
  const margin = Math.max(MINIMAP_MARGIN_MIN, size * MINIMAP_MARGIN_RATIO);
  const scale = size / MINIMAP_DESIGN_SIZE; // 内部图形元素的缩放比例
  return { size, margin, scale };
};

/** 当前小地图档位对应的世界半宽(px) */
const H_getMiniMapWorldHalf = (): number => {
  const index = H_clamp(Math.round(minimapZoomLevel), 1, MINIMAP_ZOOM_WORLD_HALVES.length) - 1;
  return MINIMAP_ZOOM_WORLD_HALVES[index];
};

/**
 * 相机视角中心的世界坐标。
 * 第三人称跟随玩家、第一人称、鼠标拖动、开火模式边界滚动都会体现在偏移量里,
 * 所以直接由画布中心反推即可。
 */
const H_getCameraWorldCenter = (): Point => {
  if (!GRAPHICS_CANVAS.value) return { x: 0, y: 0 };
  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  return TOscreen2Canvas(width / 2, height / 2);
};

/** 切换小地图缩放档位(自动限制在 1..5) */
const setMiniMapZoomLevel = (level: number) => {
  const next = H_clamp(Math.round(level), 1, MINIMAP_ZOOM_WORLD_HALVES.length);
  if (next === minimapZoomLevel) return;
  minimapZoomLevel = next;
  drawUI();
};

/**
 * 小地图缩放控件布局(底部左侧“−”、右侧“+”,中间为档位标签)
 * 绘制与命中检测共用同一份计算结果。
 */
const H_getMiniMapZoomControls = (mapX: number, mapY: number, mapSize: number) => {
  const size = Math.max(14, Math.round(mapSize * 0.085));
  const inset = Math.max(5, Math.round(mapSize * 0.034));
  const y = mapY + mapSize - size - inset;
  return {
    size,
    inset,
    centerY: y + size / 2,
    zoomOut: { x: mapX + inset, y, width: size, height: size },
    zoomIn: { x: mapX + mapSize - inset - size, y, width: size, height: size },
    labelCenterX: mapX + mapSize / 2
  };
};

/** 绘制小地图外框:霓虹切角边框 + 内侧细线 + 四角机械支架 + 顶边流动刻度 */
const H_drawMiniMapFrame = (
  CtxUi: CanvasRenderingContext2D,
  mapX: number,
  mapY: number,
  mapSize: number,
  mapScale: number,
  time: number
) => {
  const cut = Math.max(5, mapSize * 0.055);

  // 内侧细线
  CtxUi.save();
  CtxUi.strokeStyle = 'rgba(150, 245, 255, 0.22)';
  CtxUi.lineWidth = 1;
  createChamferRect(CtxUi, mapX + 3.5, mapY + 3.5, mapSize - 7, mapSize - 7, Math.max(2, cut - 2));
  CtxUi.stroke();
  CtxUi.restore();

  // 外层霓虹(带发光)
  CtxUi.save();
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.55)';
  CtxUi.shadowBlur = 16 * mapScale;
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.92)';
  CtxUi.lineWidth = Math.max(1.2, 1.7 * mapScale);
  createChamferRect(CtxUi, mapX + 0.9, mapY + 0.9, mapSize - 1.8, mapSize - 1.8, cut);
  CtxUi.stroke();
  CtxUi.restore();

  // 四角机械支架
  drawHudCornerBrackets(CtxUi, mapX, mapY, mapSize, mapSize, Math.max(12, mapSize * 0.14), 'rgba(0, 229, 255, 0.9)');

  // 顶边能量刻度(随时间流动点亮),与底部状态栏风格一致
  const tickCount = Math.max(6, Math.round(mapSize / 20));
  const tickSpan = (mapSize - cut * 2) / tickCount;
  const flowIndex = Math.floor(time * 8) % tickCount;
  CtxUi.save();
  for (let i = 0; i < tickCount; i++) {
    const on = i === flowIndex;
    CtxUi.strokeStyle = on ? 'rgba(200, 255, 255, 0.95)' : 'rgba(0, 229, 255, 0.22)';
    CtxUi.lineWidth = on ? 2 : 1;
    CtxUi.beginPath();
    CtxUi.moveTo(mapX + cut + i * tickSpan + 2, mapY + 1);
    CtxUi.lineTo(mapX + cut + i * tickSpan + 2, mapY + (on ? 9 : 4));
    CtxUi.stroke();
  }
  CtxUi.restore();
};

/** 绘制单个小地图缩放按钮(机械切角风格,不可用时置灰) */
const H_drawMiniMapZoomButton = (
  CtxUi: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  kind: 'in' | 'out',
  enabled: boolean,
  hovered: boolean,
  mapScale: number
) => {
  const cut = Math.max(2, Math.min(rect.width, rect.height) * 0.24);
  const accent = enabled
    ? (hovered ? 'rgba(200, 255, 255, 0.98)' : 'rgba(0, 229, 255, 0.9)')
    : 'rgba(120, 160, 180, 0.4)';

  CtxUi.save();
  // 底板
  createChamferRect(CtxUi, rect.x, rect.y, rect.width, rect.height, cut);
  const grad = CtxUi.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  grad.addColorStop(0, enabled ? 'rgba(14, 44, 60, 0.85)' : 'rgba(10, 22, 30, 0.7)');
  grad.addColorStop(1, 'rgba(3, 12, 20, 0.72)');
  CtxUi.fillStyle = grad;
  CtxUi.fill();

  // 边框
  CtxUi.strokeStyle = accent;
  CtxUi.lineWidth = hovered && enabled ? 1.6 : 1;
  if (enabled && hovered) {
    CtxUi.shadowColor = accent;
    CtxUi.shadowBlur = 8 * mapScale;
  }
  createChamferRect(CtxUi, rect.x + 0.7, rect.y + 0.7, rect.width - 1.4, rect.height - 1.4, cut);
  CtxUi.stroke();
  CtxUi.shadowBlur = 0;

  // 符号(− / +)
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const arm = rect.width * 0.24;
  CtxUi.strokeStyle = accent;
  CtxUi.lineWidth = Math.max(1.4, rect.width * 0.13);
  CtxUi.lineCap = 'round';
  CtxUi.beginPath();
  CtxUi.moveTo(cx - arm, cy);
  CtxUi.lineTo(cx + arm, cy);
  if (kind === 'in') {
    CtxUi.moveTo(cx, cy - arm);
    CtxUi.lineTo(cx, cy + arm);
  }
  CtxUi.stroke();
  CtxUi.restore();
};

/** 绘制小地图底部条:渐变底托 + 左右缩放按钮 + 中间档位标签 */
const H_drawMiniMapZoomControls = (
  CtxUi: CanvasRenderingContext2D,
  mapX: number,
  mapY: number,
  mapSize: number,
  mapScale: number
) => {
  const cut = Math.max(5, mapSize * 0.055);
  const controls = H_getMiniMapZoomControls(mapX, mapY, mapSize);
  const canZoomOut = minimapZoomLevel > 1;
  const canZoomIn = minimapZoomLevel < MINIMAP_ZOOM_WORLD_HALVES.length;

  // 底部渐变底托(裁剪在切角形状内):让按钮与文字在实体圆点之上依旧清晰
  CtxUi.save();
  createChamferRect(CtxUi, mapX, mapY, mapSize, mapSize, cut);
  CtxUi.clip();
  const stripTop = controls.zoomOut.y - controls.inset * 1.4;
  const stripGrad = CtxUi.createLinearGradient(0, stripTop, 0, mapY + mapSize);
  stripGrad.addColorStop(0, 'rgba(2, 8, 14, 0)');
  stripGrad.addColorStop(1, 'rgba(2, 8, 14, 0.78)');
  CtxUi.fillStyle = stripGrad;
  CtxUi.fillRect(mapX, stripTop, mapSize, mapY + mapSize - stripTop);
  CtxUi.restore();

  // 左右两个缩放按钮
  H_drawMiniMapZoomButton(CtxUi, controls.zoomOut, 'out', canZoomOut,
    hoveredArea?.id === `${MINIMAP_ZOOM_EVENT_PREFIX}out`, mapScale);
  H_drawMiniMapZoomButton(CtxUi, controls.zoomIn, 'in', canZoomIn,
    hoveredArea?.id === `${MINIMAP_ZOOM_EVENT_PREFIX}in`, mapScale);

  // 中间档位标签:1 档为全图,其余显示档位与当前显示的世界范围
  const label = minimapZoomLevel === 1
    ? '全图'
    : `L${minimapZoomLevel} · ${Math.round(H_getMiniMapWorldHalf() * 2)}px`;
  CtxUi.save();
  CtxUi.font = `bold ${Math.max(9, mapSize * 0.052)}px Consolas, "Courier New", monospace`;
  CtxUi.textAlign = 'center';
  CtxUi.textBaseline = 'middle';
  CtxUi.fillStyle = 'rgba(224, 253, 255, 0.92)';
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.75)';
  CtxUi.shadowBlur = 6 * mapScale;
  CtxUi.fillText(label, controls.labelCenterX, controls.centerY);
  CtxUi.restore();
};

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

// ---- 键盘快捷键设置辅助函数 ----
/** 默认键位表 */
const H_defaultKeyBindings = (): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const def of KEY_BINDING_DEFS) map[def.id] = def.defaultKey;
  return map;
};

/** 归一化按键名:统一小写,并将 ~ 归并到 ` */
const H_normalizeKey = (raw: string): string => {
  if (raw === '~') return '`';
  return raw.toLowerCase();
};

/** 按键名 -> 面板显示文本 */
const H_formatKeyLabel = (key: string): string => {
  if (!key) return '未设置';
  if (key === ' ') return '空格';
  const named: Record<string, string> = {
    shift: 'Shift', control: 'Ctrl', alt: 'Alt', meta: 'Win',
    arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
    tab: 'Tab', enter: 'Enter', escape: 'Esc', backspace: 'Backspace', '`': '~'
  };
  return named[key] ?? key.toUpperCase();
};

/** 根据按键查找绑定的功能id(未绑定返回 null) */
const H_findBindingIdByKey = (key: string): string | null => {
  for (const def of KEY_BINDING_DEFS) {
    if (keyBindings[def.id] === key) return def.id;
  }
  return null;
};

/** 持久化当前键位 */
const H_saveKeyBindings = () => {
  try {
    localStorage.setItem(KEY_BINDING_STORAGE_KEY, JSON.stringify(keyBindings));
  } catch {
    // 忽略持久化失败(隐私模式等)
  }
};

/** 读取本地键位(与默认值合并) */
const H_loadKeyBindings = () => {
  const map = H_defaultKeyBindings();
  try {
    const raw = localStorage.getItem(KEY_BINDING_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const def of KEY_BINDING_DEFS) {
        const value = parsed[def.id];
        if (typeof value === 'string') map[def.id] = value;
      }
    }
  } catch {
    // 忽略读取失败,使用默认键位
  }
  keyBindings = map;
};

/** 设置某个功能的快捷键,若与其它功能冲突则互换 */
const H_applyKeyBinding = (id: string, key: string) => {
  const previous = keyBindings[id] ?? '';
  const conflictId = H_findBindingIdByKey(key);
  if (conflictId !== null && conflictId !== id) {
    keyBindings[conflictId] = previous;
  }
  keyBindings[id] = key;
  H_saveKeyBindings();
};

/** 恢复默认键位 */
const H_resetKeyBindings = () => {
  keyBindings = H_defaultKeyBindings();
  H_saveKeyBindings();
};

/** 切换键盘设置面板展开状态 */
const H_toggleKeyboardSettings = (visible?: boolean) => {
  keyboardSettingsVisible = visible ?? !keyboardSettingsVisible;
  if (!keyboardSettingsVisible) keyboardSettingsListeningId = null;
  drawUI();
};

/** 根据绑定id更新玩家移动状态 */
const H_setMoveStateForBinding = (bindingId: string, pressed: boolean) => {
  const state = PlayerDynamicEntity.playerMoveState;
  if (bindingId === 'moveUp') {
    state.W = pressed;
    if (perspectiveMode === 'first_person') firstPersonMoveW = pressed;
  } else if (bindingId === 'moveDown') {
    state.S = pressed;
    if (perspectiveMode === 'first_person') firstPersonMoveS = pressed;
  } else if (bindingId === 'moveLeft') {
    state.A = pressed;
    if (perspectiveMode === 'first_person') firstPersonMoveA = pressed;
  } else if (bindingId === 'moveRight') {
    state.D = pressed;
    if (perspectiveMode === 'first_person') firstPersonMoveD = pressed;
  }
  sendPlayerMoveInput();
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

const H_isPlayerServantNpc = (entity: NpcDynamicEntity): boolean => {
  if (!playerEntity) return false;
  if (entity.ownerId !== playerEntity.id) return false;
  return playerEntity.selectServantByID(entity.id) !== null;
};

const H_getNpcDebugFlags = (entity: NpcDynamicEntity): EntityDebugFlags => {
  if (!H_isPlayerServantNpc(entity)) return entityDebugFlags;
  return {
    ...entityDebugFlags,
    showHealth: entityDebugFlags.showHealth || showPlayerServantHealth,
    showFacingDirection: entityDebugFlags.showFacingDirection || showPlayerServantFacingDirection
  };
};

// 数学辅助函数
const H_clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
// 线性插值辅助函数
const H_lerp = (start: number, end: number, ratio: number) => start + (end - start) * ratio;
const H_lerpRgb = (start: RGB, end: RGB, ratio: number): RGB => ({
  r: H_lerp(start.r, end.r, ratio),
  g: H_lerp(start.g, end.g, ratio),
  b: H_lerp(start.b, end.b, ratio),
});

const H_rgbToCss = (color: RGB, alpha = 1) => {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
};

const H_getBottomStatusHealthColor = (healthRatio: number): RGB => {
  if (healthRatio > 0.5) return { r: 40, g: 255, b: 143 };  // 霓虹绿
  if (healthRatio > 0.2) return { r: 255, g: 176, b: 58 };  // 琥珀
  return { r: 255, g: 59, b: 92 };                          // 霓虹红
};

// 获取实体插值位置的辅助函数
const H_getInterpolatedEntityPosition = (entity: Entity, timestamp: number): Point => {
  const interpolation = entityInterpolationMap.get(entity.id);
  if (!interpolation) return entity.position;

  const ratio = H_clamp((timestamp - interpolation.startTime) / interpolation.duration, 0, 1);
  if (ratio >= 1) {
    entityInterpolationMap.delete(entity.id);
    return interpolation.to;
  }

  return {
    x: H_lerp(interpolation.from.x, interpolation.to.x, ratio),
    y: H_lerp(interpolation.from.y, interpolation.to.y, ratio),
  };
};
// 注册实体插值状态的辅助函数
const H_registerEntityInterpolation = (entity: Entity, snapshot: Entity, timestamp: number): void => {
  const lastSnapshotTime = entitySnapshotTimeMap.get(entity.id);
  const duration = lastSnapshotTime === undefined
    ? SERVER_TICK_MS
    : H_clamp(
        timestamp - lastSnapshotTime,
        MIN_INTERPOLATION_DURATION_MS,
        MAX_INTERPOLATION_DURATION_MS
      );
  const from = H_getInterpolatedEntityPosition(entity, timestamp);
  const to = { ...snapshot.position };

  entitySnapshotTimeMap.set(entity.id, timestamp);

  if (Math.hypot(to.x - from.x, to.y - from.y) < 0.001) {
    entityInterpolationMap.delete(entity.id);
    return;
  }

  entityInterpolationMap.set(entity.id, {
    from,
    to,
    startTime: timestamp,
    duration,
  });
};
// 删除实体渲染状态的辅助函数（如实体被删除时）
const H_deleteEntityRenderState = (id: number): void => {
  ENTITY_CACHE.delete(id);
  entityInterpolationMap.delete(id);
  entitySnapshotTimeMap.delete(id);
};

const H_hydrateEntitySnapshot = <T extends Entity>(entity: T, snapshot: T): T => {
  const texture = entity.texture;
  const texturePath = entity.texturePath;
  // 只覆盖快照中"有定义"的字段:避免快照里显式的 undefined 把实体构造器中的默认值覆盖掉
  // (例如 PlayerDynamicEntity.playerRule / inventory),否则渲染层读取默认属性会报错。
  // Worker 通道的快照来自类实例,WebSocket 通道来自 Java 服务端协议映射,两者都适用。
  const source = snapshot as unknown as Record<string, unknown>;
  const target = entity as unknown as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value === undefined) continue;
    target[key] = value;
  }
  // 贴图属于客户端资源(由实体类静态常量提供),服务端协议里不含贴图路径。
  // 若快照带的空字符串覆盖了它,loadTexture() 会因路径为空直接返回,实体将永远退化为纯色矩形。
  entity.texturePath = texturePath;
  entity.texture = texture;
  entity.updateCollisionBox();
  return entity;
};

// 从服务端实体快照获取可渲染实体的辅助函数，包含缓存和插值状态管理
const H_getRenderableEntityFromSnapshot = <T extends Entity>(snapshot: T): T => {
  const snapshotReceivedAt = performance.now();
  const cached = ENTITY_CACHE.get(snapshot.id) as T | undefined;
  if (cached) {
    H_registerEntityInterpolation(cached, snapshot, snapshotReceivedAt);
    return H_hydrateEntitySnapshot(cached, snapshot);
  }

  const entity = H_hydrateEntitySnapshot(H_createEntityFromSnapshot(snapshot) as T, snapshot);
  ENTITY_CACHE.set(entity.id, entity);
  entitySnapshotTimeMap.set(entity.id, snapshotReceivedAt);
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
  // 读取玩家自定义的快捷键(与默认键位合并)
  H_loadKeyBindings();
  onResizeCanvas();

  // 预加载技能图标贴图(resource/skill_icon 下的 100px × 100px PNG),避免首帧技能槽图标缺失
  H_preloadSkillIconTextures(H_getAllSkills().map((skill) => skill.icon));

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
    // 右键用于背包快捷操作,屏蔽画布默认右键菜单
    UI_CANVAS.value.addEventListener('contextmenu', onCanvasContextMenu);
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

  // 初始化数值层
  if (NUMERICAL_CANVAS.value) {
    ctxNumerical = NUMERICAL_CANVAS.value.getContext('2d');
    if (ctxNumerical) {
      H_applyDprToCanvas(NUMERICAL_CANVAS.value, ctxNumerical);
    }
    numericalManager.bindCanvas(NUMERICAL_CANVAS.value);
    numericalManager.setWorldToScreen(TOcanvas2Screen);
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
      // 吸附特效锚点每帧跟随被吸附的从者实体(从者会随玩家一起移动)
      resolveEntityPosition: (entityId: number) => {
        const npc = npcEntityList.find((entity) => entity.id === entityId);
        return npc ? { x: npc.position.x, y: npc.position.y } : null;
      },
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
  otherPlayerEntityList = [];
  renderEntityList = [];
  playerFireMode = false;
  effectManager?.reset();
  numericalManager.reset();

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

  // 前端页面可见性变化监听
  document.addEventListener('visibilitychange', handleVisibilityChange);
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
 * 绘制切角矩形路径(机械未来风格 HUD 面板,四个角斜切)
 * @param corners 指定需要斜切的角,默认四角全切
 */
const createChamferRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number,
  corners: { tl?: boolean; tr?: boolean; br?: boolean; bl?: boolean } = {}
) => {
  const { tl = true, tr = true, br = true, bl = true } = corners;
  const c = Math.max(0, Math.min(cut, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + (tl ? c : 0), y);
  ctx.lineTo(x + w - (tr ? c : 0), y);
  if (tr) ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - (br ? c : 0));
  if (br) ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + (bl ? c : 0), y + h);
  if (bl) ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + (tl ? c : 0));
  if (tl) ctx.lineTo(x + c, y);
  ctx.closePath();
};

/**
 * 绘制 HUD 四角机械支架(带霓虹发光)
 */
const drawHudCornerBrackets = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  color: string
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.11);
  ctx.lineCap = 'square';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  const arm = size * 0.72;
  const inset = arm * 0.16;
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x + w, y + h, -1, -1],
    [x, y + h, 1, -1]
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * inset, cy + sy * arm);
    ctx.lineTo(cx + sx * inset, cy + sy * inset);
    ctx.lineTo(cx + sx * arm, cy + sy * inset);
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * 绘制斜向条纹理(机械质感填充,调用前需自行裁剪到目标形状)
 */
const drawSlantedStripes = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  step: number,
  color: string
) => {
  if (w <= 0 || h <= 0) return;
  const gap = Math.max(4, step);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, gap * 0.14);
  ctx.beginPath();
  for (let sx = x - h; sx < x + w + h; sx += gap) {
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + h, y);
  }
  ctx.stroke();
  ctx.restore();
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
  const healthStatus = showPlayerServantHealth ? 'ON' : 'OFF';
  const facingStatus = showPlayerServantFacingDirection ? 'ON' : 'OFF';
  const text = `F 开火 | 3 视角 | T 从者血条:${healthStatus} | Y 从者朝向:${facingStatus}`;
  CtxUi.save();
  CtxUi.font = '14px "Microsoft YaHei", Arial, sans-serif';
  CtxUi.fillStyle = 'rgba(78,78,78,0.9)';
  CtxUi.textAlign = 'center';
  CtxUi.textBaseline = 'top';
  const maxTextWidth = Math.max(240, width - 24);
  let fontSize = 14;
  while (CtxUi.measureText(text).width > maxTextWidth && fontSize > 10) {
    fontSize -= 1;
    CtxUi.font = `${fontSize}px "Microsoft YaHei", Arial, sans-serif`;
  }
  const textWidth = Math.min(CtxUi.measureText(text).width, maxTextWidth);
  const padding = 10;
  const boxWidth = Math.min(width - 12, textWidth + padding * 2);
  const boxHeight = 30;
  const x = (width - boxWidth) / 2;
  const y = 0;
  // 半透明背景
  CtxUi.fillStyle = 'rgba(208,208,208,0.7)';
  createRoundRect(CtxUi, x, y, boxWidth, boxHeight, 5);
  CtxUi.fill();
  CtxUi.fillStyle = 'rgb(78,78,78)';
  CtxUi.font = `${fontSize}px "Microsoft YaHei", Arial, sans-serif`;
  CtxUi.fillText(text, width / 2, y + 8);
  CtxUi.restore();
};

/**
 * 在小地图上绘制一个玩家(等边三角形,顶点指向玩家朝向)
 * 已死亡/无血量的玩家不绘制,避免图标残留在小地图上
 */
const H_drawMiniMapPlayer = (
  CtxUi: CanvasRenderingContext2D,
  entity: PlayerDynamicEntity,
  worldToMap: (x: number, y: number) => { x: number; y: number },
  isInsideMap: (p: { x: number; y: number }) => boolean,
  mapScale: number,
  color: string
): void => {
  if (entity.isDead || !(entity.health > 0)) return;
  const p = worldToMap(entity.position.x, entity.position.y);
  if (!isInsideMap(p)) return;
  const r = Math.max(3, 4.5 * mapScale); // 三角形外接圆半径
  const angle = Math.atan2(entity.facingDirection.x, entity.facingDirection.y);
  CtxUi.save();
  CtxUi.translate(p.x, p.y);
  CtxUi.rotate(angle);
  CtxUi.fillStyle = color;
  CtxUi.beginPath();
  CtxUi.moveTo(0, -r);
  CtxUi.lineTo(-r * 0.866, r * 0.5);
  CtxUi.lineTo(r * 0.866, r * 0.5);
  CtxUi.closePath();
  CtxUi.fill();
  CtxUi.restore();
};

/**
 * 绘制小地图(左上角正方形地图,渲染在 canvas-ui 层)
 * - 尺寸随页面尺寸动态等比缩放(以设计稿短边为基准),缩放档位只改变显示范围,不改变地图尺寸
 * - 1 档显示整张地图;2~5 档以相机视角中心为中心显示局部(5 档为 500×500px),并跟随相机移动
 * - 圆点表示 NPC,等边三角形表示玩家(顶点指向玩家朝向),正方形表示静态实体
 * - 颜色依据实体的 mapColor 属性,undefined 时使用白色
 * - 底部左右两个按钮用于调整缩放档位
 */
const drawMiniMap = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  if (!CtxUi || !CANVAS) return;

  const { width: canvasWidth, height: canvasHeight } = H_getCanvasCssSize(CANVAS);
  const { size: mapSize, margin: mapMargin, scale: mapScale } = H_getMiniMapMetrics(canvasWidth, canvasHeight);
  const mapX = mapMargin;
  const mapY = mapMargin;
  const cut = Math.max(5, mapSize * 0.055);

  // 1 档以世界原点为中心显示整张地图;其余档位跟随相机视角中心
  const worldHalf = H_getMiniMapWorldHalf();
  const center = minimapZoomLevel === 1 ? { x: 0, y: 0 } : H_getCameraWorldCenter();
  const worldRange = worldHalf * 2;

  // 世界坐标 -> 小地图坐标(世界 y 轴向上,小地图 y 轴向下,需翻转)
  const worldToMap = (wx: number, wy: number): { x: number; y: number } => ({
    x: mapX + ((wx - center.x + worldHalf) / worldRange) * mapSize,
    y: mapY + ((center.y + worldHalf - wy) / worldRange) * mapSize,
  });

  const isInsideMap = (p: { x: number; y: number }): boolean =>
    p.x >= mapX && p.x <= mapX + mapSize && p.y >= mapY && p.y <= mapY + mapSize;

  const time = performance.now() / 1000;

  // ---- 地图内容(裁剪在切角边框内) ----
  CtxUi.save();
  createChamferRect(CtxUi, mapX, mapY, mapSize, mapSize, cut);
  CtxUi.clip();

  // 背景
  CtxUi.fillStyle = 'rgba(8, 12, 22, 0.78)';
  CtxUi.fillRect(mapX, mapY, mapSize, mapSize);

  // 绘制静态实体(正方形)
  const staticSize = Math.max(2, 3 * mapScale);
  for (const entity of staticEntityList) {
    const p = worldToMap(entity.position.x, entity.position.y);
    if (!isInsideMap(p)) continue;
    CtxUi.fillStyle = entity.mapColor ?? MINIMAP_DEFAULT_COLOR;
    CtxUi.fillRect(p.x - staticSize / 2, p.y - staticSize / 2, staticSize, staticSize);
  }

  // 绘制 NPC(圆点)
  const npcRadius = Math.max(1.5, 2.5 * mapScale);
  for (const entity of npcEntityList) {
    const p = worldToMap(entity.position.x, entity.position.y);
    if (!isInsideMap(p)) continue;
    CtxUi.fillStyle = entity.mapColor ?? MINIMAP_DEFAULT_COLOR;
    CtxUi.beginPath();
    CtxUi.arc(p.x, p.y, npcRadius, 0, Math.PI * 2);
    CtxUi.fill();
  }

  // 绘制其他玩家(多人模式,橙色三角形与本人区分)
  for (const entity of otherPlayerEntityList) {
    H_drawMiniMapPlayer(CtxUi, entity, worldToMap, isInsideMap, mapScale, entity.mapColor ?? 'rgba(255, 170, 0, 0.95)');
  }

  // 绘制玩家本人(青色三角形,顶点指向朝向)
  if (playerEntity) {
    H_drawMiniMapPlayer(CtxUi, playerEntity, worldToMap, isInsideMap, mapScale, playerEntity.mapColor ?? 'rgba(0, 255, 255, 0.9)');
  }

  CtxUi.restore();

  // ---- 炫酷外边框 + 缩放控件 ----
  H_drawMiniMapFrame(CtxUi, mapX, mapY, mapSize, mapScale, time);
  H_drawMiniMapZoomControls(CtxUi, mapX, mapY, mapSize, mapScale);

  // ---- 注册缩放按钮事件区域(每帧按前缀清理后重建,与重生界面同一套机制) ----
  eventArea = eventArea.filter(area => !area.id.startsWith(MINIMAP_ZOOM_EVENT_PREFIX));
  const controls = H_getMiniMapZoomControls(mapX, mapY, mapSize);
  if (minimapZoomLevel > 1) {
    eventArea.push({
      id: `${MINIMAP_ZOOM_EVENT_PREFIX}out`,
      rect: controls.zoomOut,
      type: 'button',
      cursor: 'pointer',
      onClick: () => { setMiniMapZoomLevel(minimapZoomLevel - 1); }
    });
  }
  if (minimapZoomLevel < MINIMAP_ZOOM_WORLD_HALVES.length) {
    eventArea.push({
      id: `${MINIMAP_ZOOM_EVENT_PREFIX}in`,
      rect: controls.zoomIn,
      type: 'button',
      cursor: 'pointer',
      onClick: () => { setMiniMapZoomLevel(minimapZoomLevel + 1); }
    });
  }
};

/**
 * 绘制键盘图标(键盘设置入口按钮)
 */
const H_drawKeyboardIcon = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) => {
  const w = size;
  const h = size * 0.66;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = size * 0.14;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.2, size * 0.09);
  ctx.lineJoin = 'round';
  // 键盘外框
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
  // 键位点阵
  const rows = 2;
  const cols = 4;
  const dot = Math.max(1, size * 0.09);
  const innerW = w * 0.68;
  const innerH = h * 0.42;
  const startX = cx - innerW / 2 + dot;
  const startY = cy - innerH / 2 + dot;
  const gapX = innerW / (cols - 1);
  const gapY = innerH / (rows - 1 || 1);
  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      ctx.beginPath();
      ctx.arc(startX + cc * gapX, startY + rr * gapY, dot * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 空格条
  ctx.fillRect(cx - w * 0.16, y + h - h * 0.26, w * 0.32, Math.max(1, size * 0.055));
  ctx.restore();
};

/**
 * 键盘设置入口按钮与展开面板的布局(绘制与命中检测共用)
 */
const H_getKeyboardSettingsLayout = (canvasHeight: number) => {
  const buttonSize = 44;
  const margin = 12;
  // 调试终端也位于左下角,终端展开时把入口按钮上移,避免遮挡
  const terminalOffset = debugTerminalVisible ? 240 : 0;
  const buttonX = margin;
  const buttonY = canvasHeight - margin - buttonSize - terminalOffset;

  const panelWidth = 380;
  const padding = 12;
  const columnGap = 10;
  const columns = 2;
  const itemHeight = 24;
  const rows = Math.ceil(KEY_BINDING_DEFS.length / columns);
  const headerHeight = 40;
  const footerHeight = 36;
  const panelHeight = headerHeight + rows * itemHeight + footerHeight;
  const panelX = margin;
  const panelY = Math.max(8, buttonY - 10 - panelHeight);
  const itemWidth = (panelWidth - padding * 2 - columnGap * (columns - 1)) / columns;

  return {
    buttonSize, buttonX, buttonY,
    panelX, panelY, panelWidth, panelHeight,
    padding, columnGap, columns, itemWidth, itemHeight, rows,
    headerHeight, footerHeight
  };
};

/** 键盘设置面板中第 index 个功能行的矩形(带展开动画偏移) */
const H_getKeyboardSettingItemRect = (
  layout: ReturnType<typeof H_getKeyboardSettingsLayout>,
  index: number,
  offsetY: number
) => {
  const col = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  return {
    x: layout.panelX + layout.padding + col * (layout.itemWidth + layout.columnGap),
    y: layout.panelY + offsetY + layout.headerHeight + row * layout.itemHeight,
    width: layout.itemWidth,
    height: layout.itemHeight - 3
  };
};

/**
 * 绘制左下角"键盘设置"入口按钮与展开面板(UI层)
 * - 按钮始终显示(背包打开时隐藏),点击后以动画向上展开
 * - 面板列出各功能当前快捷键,点击功能行后再按新键位即可修改(自动持久化)
 */
const drawKeyboardSettingsPanel = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  // 每帧先清理上一次注册的键盘设置事件区域
  eventArea = eventArea.filter(area => !area.id.startsWith(KEYBOARD_SETTINGS_EVENT_PREFIX));

  const { height } = H_getCanvasCssSize(CANVAS);

  // 推进展开/收起动画
  const target = keyboardSettingsVisible ? 1 : 0;
  keyboardSettingsAnim += (target - keyboardSettingsAnim) * 0.22;
  if (Math.abs(target - keyboardSettingsAnim) < 0.002) keyboardSettingsAnim = target;
  const eased = keyboardSettingsAnim * keyboardSettingsAnim * (3 - 2 * keyboardSettingsAnim);

  const layout = H_getKeyboardSettingsLayout(height);
  const hidden = inventoryVisible;

  // ---- 入口按钮 ----
  CtxUi.save();
  CtxUi.globalAlpha = hidden ? 0 : 1;
  const btnCut = Math.max(4, layout.buttonSize * 0.24);
  const btnAreaId = `${KEYBOARD_SETTINGS_EVENT_PREFIX}toggle`;
  const btnHovered = hoveredArea?.id === btnAreaId;
  createChamferRect(CtxUi, layout.buttonX, layout.buttonY, layout.buttonSize, layout.buttonSize, btnCut);
  const btnGrad = CtxUi.createLinearGradient(layout.buttonX, layout.buttonY, layout.buttonX, layout.buttonY + layout.buttonSize);
  btnGrad.addColorStop(0, btnHovered ? 'rgba(20, 60, 82, 0.95)' : 'rgba(12, 38, 54, 0.85)');
  btnGrad.addColorStop(1, 'rgba(3, 12, 20, 0.8)');
  CtxUi.fillStyle = btnGrad;
  CtxUi.fill();
  const btnAccent = keyboardSettingsVisible ? 'rgba(200, 255, 255, 0.98)' : 'rgba(0, 229, 255, 0.92)';
  CtxUi.strokeStyle = btnAccent;
  CtxUi.lineWidth = btnHovered || keyboardSettingsVisible ? 1.8 : 1.2;
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.75)';
  CtxUi.shadowBlur = btnHovered || keyboardSettingsVisible ? 12 : 6;
  createChamferRect(CtxUi, layout.buttonX + 0.7, layout.buttonY + 0.7, layout.buttonSize - 1.4, layout.buttonSize - 1.4, btnCut);
  CtxUi.stroke();
  CtxUi.shadowBlur = 0;
  H_drawKeyboardIcon(CtxUi, layout.buttonX + layout.buttonSize / 2, layout.buttonY + layout.buttonSize / 2, layout.buttonSize * 0.62, btnAccent);
  CtxUi.restore();

  if (!hidden) {
    eventArea.push({
      id: btnAreaId,
      rect: { x: layout.buttonX, y: layout.buttonY, width: layout.buttonSize, height: layout.buttonSize },
      type: 'button',
      cursor: 'pointer',
      onClick: () => { H_toggleKeyboardSettings(); }
    });
  }

  // ---- 展开面板 ----
  if (hidden || eased <= 0.01) return;

  const offsetY = (1 - eased) * 16;
  const panelBottom = layout.panelY + offsetY + layout.panelHeight;
  const cut = Math.max(6, layout.panelHeight * 0.05);

  CtxUi.save();
  CtxUi.globalAlpha = eased;
  CtxUi.textAlign = 'left';
  CtxUi.textBaseline = 'middle';

  // 底板
  createChamferRect(CtxUi, layout.panelX, layout.panelY + offsetY, layout.panelWidth, layout.panelHeight, cut);
  const panelGrad = CtxUi.createLinearGradient(layout.panelX, layout.panelY + offsetY, layout.panelX, panelBottom);
  panelGrad.addColorStop(0, 'rgba(14, 40, 60, 0.95)');
  panelGrad.addColorStop(0.5, 'rgba(7, 22, 34, 0.92)');
  panelGrad.addColorStop(1, 'rgba(3, 10, 18, 0.9)');
  CtxUi.fillStyle = panelGrad;
  CtxUi.fill();
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.5)';
  CtxUi.shadowBlur = 14;
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.85)';
  CtxUi.lineWidth = 1.4;
  createChamferRect(CtxUi, layout.panelX + 0.8, layout.panelY + offsetY + 0.8, layout.panelWidth - 1.6, layout.panelHeight - 1.6, cut);
  CtxUi.stroke();
  CtxUi.shadowBlur = 0;
  drawHudCornerBrackets(
    CtxUi,
    layout.panelX,
    layout.panelY + offsetY,
    layout.panelWidth,
    layout.panelHeight,
    Math.max(10, layout.panelHeight * 0.09),
    'rgba(0, 229, 255, 0.9)'
  );

  // 标题
  const titleY = layout.panelY + offsetY + layout.headerHeight / 2 + 2;
  CtxUi.font = 'bold 14px "Microsoft YaHei", Arial, sans-serif';
  CtxUi.fillStyle = '#eafdff';
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.8)';
  CtxUi.shadowBlur = 8;
  CtxUi.fillText('键盘设置', layout.panelX + layout.padding, titleY);
  CtxUi.shadowBlur = 0;
  CtxUi.font = '10px "Microsoft YaHei", Arial, sans-serif';
  CtxUi.fillStyle = 'rgba(122, 214, 240, 0.85)';
  CtxUi.fillText('点击功能后按下新键位 · Esc 取消', layout.panelX + layout.padding + 62, titleY);

  // 标题下分割线
  const headerLineY = layout.panelY + offsetY + layout.headerHeight - 8;
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.28)';
  CtxUi.lineWidth = 1;
  CtxUi.beginPath();
  CtxUi.moveTo(layout.panelX + layout.padding, headerLineY);
  CtxUi.lineTo(layout.panelX + layout.panelWidth - layout.padding, headerLineY);
  CtxUi.stroke();

  // 功能行
  for (let i = 0; i < KEY_BINDING_DEFS.length; i++) {
    const def = KEY_BINDING_DEFS[i];
    const rect = H_getKeyboardSettingItemRect(layout, i, offsetY);
    const itemAreaId = `${KEYBOARD_SETTINGS_EVENT_PREFIX}bind_${def.id}`;
    const isHovered = hoveredArea?.id === itemAreaId;
    const isListening = keyboardSettingsListeningId === def.id;

    createChamferRect(CtxUi, rect.x, rect.y, rect.width, rect.height, Math.max(2, rect.height * 0.28));
    const rowGrad = CtxUi.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    const highlight = isListening ? 'rgba(0, 229, 255, 0.28)' : (isHovered ? 'rgba(0, 229, 255, 0.16)' : 'rgba(8, 24, 36, 0.5)');
    rowGrad.addColorStop(0, highlight);
    rowGrad.addColorStop(1, 'rgba(4, 14, 24, 0.4)');
    CtxUi.fillStyle = rowGrad;
    CtxUi.fill();
    CtxUi.strokeStyle = isListening ? 'rgba(200, 255, 255, 0.95)' : (isHovered ? 'rgba(0, 229, 255, 0.7)' : 'rgba(0, 229, 255, 0.22)');
    CtxUi.lineWidth = isListening || isHovered ? 1.3 : 1;
    createChamferRect(CtxUi, rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1, Math.max(2, rect.height * 0.28));
    CtxUi.stroke();

    // 功能名
    CtxUi.font = '11px "Microsoft YaHei", Arial, sans-serif';
    CtxUi.fillStyle = def.category === '移动' ? 'rgba(200, 236, 255, 0.92)' : '#eafdff';
    CtxUi.textAlign = 'left';
    CtxUi.fillText(def.label, rect.x + 8, rect.y + rect.height / 2 + 0.5);

    // 快捷键标签
    const chipW = 56;
    const chipRect = { x: rect.x + rect.width - chipW - 4, y: rect.y + 2, width: chipW, height: rect.height - 4 };
    createChamferRect(CtxUi, chipRect.x, chipRect.y, chipRect.width, chipRect.height, Math.max(2, chipRect.height * 0.3));
    CtxUi.fillStyle = isListening ? 'rgba(0, 229, 255, 0.35)' : 'rgba(6, 18, 28, 0.85)';
    CtxUi.fill();
    CtxUi.strokeStyle = isListening ? 'rgba(200, 255, 255, 0.95)' : 'rgba(0, 229, 255, 0.45)';
    CtxUi.lineWidth = 1;
    createChamferRect(CtxUi, chipRect.x + 0.5, chipRect.y + 0.5, chipRect.width - 1, chipRect.height - 1, Math.max(2, chipRect.height * 0.3));
    CtxUi.stroke();
    CtxUi.font = 'bold 11px Consolas, "Courier New", monospace';
    CtxUi.textAlign = 'center';
    CtxUi.fillStyle = isListening ? '#ffffff' : '#cdefff';
    CtxUi.fillText(
      isListening ? '按键…' : H_formatKeyLabel(keyBindings[def.id] ?? ''),
      chipRect.x + chipRect.width / 2,
      chipRect.y + chipRect.height / 2 + 0.5
    );
    CtxUi.textAlign = 'left';

    eventArea.push({
      id: itemAreaId,
      rect,
      type: 'button',
      cursor: 'pointer',
      onClick: () => {
        keyboardSettingsListeningId = def.id;
        drawUI();
      }
    });
  }

  // 底部:重置按钮 + 说明
  const footerY = layout.panelY + offsetY + layout.headerHeight + layout.rows * layout.itemHeight + 6;
  const resetRect = { x: layout.panelX + layout.padding, y: footerY, width: 92, height: 22 };
  const resetAreaId = `${KEYBOARD_SETTINGS_EVENT_PREFIX}reset`;
  const resetHovered = hoveredArea?.id === resetAreaId;
  createChamferRect(CtxUi, resetRect.x, resetRect.y, resetRect.width, resetRect.height, 5);
  CtxUi.fillStyle = resetHovered ? 'rgba(0, 229, 255, 0.28)' : 'rgba(8, 24, 36, 0.7)';
  CtxUi.fill();
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.6)';
  CtxUi.lineWidth = 1;
  createChamferRect(CtxUi, resetRect.x + 0.5, resetRect.y + 0.5, resetRect.width - 1, resetRect.height - 1, 5);
  CtxUi.stroke();
  CtxUi.font = '11px "Microsoft YaHei", Arial, sans-serif';
  CtxUi.textAlign = 'center';
  CtxUi.fillStyle = '#cdefff';
  CtxUi.fillText('恢复默认', resetRect.x + resetRect.width / 2, resetRect.y + resetRect.height / 2 + 0.5);
  CtxUi.textAlign = 'left';
  CtxUi.font = '10px Consolas, "Courier New", monospace';
  CtxUi.fillStyle = 'rgba(122, 214, 240, 0.8)';
  CtxUi.fillText('已自动保存到本地', resetRect.x + resetRect.width + 10, resetRect.y + resetRect.height / 2 + 0.5);

  eventArea.push({
    id: resetAreaId,
    rect: resetRect,
    type: 'button',
    cursor: 'pointer',
    onClick: () => { H_resetKeyBindings(); drawUI(); }
  });

  CtxUi.restore();
};

/**
 * 绘制调试面板(UI层)
 */
const drawDebugBoard = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  if (!debugBoardVisible) return;

  const panelWidth = 320;
  const panelHeight = 180;
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
  textY += lineHeight;

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

  // 终端未打开时直接返回，不要执行 clearRect，否则会擦除先前绘制的底部状态栏
  if (!debugTerminalVisible){
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
 * 绘制底部状态栏(UI层)
 */
const drawBottomStatusBar = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  const { width, height } = H_getCanvasCssSize(CANVAS);
  const now = performance.now();
  const dt = bottomStatusLastFrameTime ? Math.min(0.05, (now - bottomStatusLastFrameTime) / 1000) : 0;
  bottomStatusLastFrameTime = now;

  // 面板尺寸:参考 1920x1080 设计稿(800x180 居中贴底),按屏幕宽度等比缩放
  const panelWidth = H_clamp(width * 0.42, 320, 800);
  const panelHeight = panelWidth * 0.225;
  const x = (width - panelWidth) / 2;
  const y = height - panelHeight;
  const time = now / 1000;

  const playerDead = !playerEntity || playerEntity.isDead || playerEntity.health <= 0;
  const healthMax = Math.max(1, playerEntity?.healthMax ?? 100);
  const currentHealth = playerDead ? 0 : Math.max(0, playerEntity?.health ?? 0);
  const targetHealthRatio = playerEntity && !playerDead
    ? H_clamp(playerEntity.health / healthMax, 0, 1)
    : 0;
  const targetHealthColor = H_getBottomStatusHealthColor(targetHealthRatio);

  if (targetHealthRatio < bottomStatusLastHealthRatio - 0.001) {
    bottomStatusDamageFlash = 1;
  }
  if (targetHealthRatio > bottomStatusDamageRatio) {
    bottomStatusDamageRatio = targetHealthRatio;
  }
  bottomStatusLastHealthRatio = targetHealthRatio;
  bottomStatusHealthRatio = H_lerp(bottomStatusHealthRatio, targetHealthRatio, 1 - Math.pow(0.0008, dt));
  bottomStatusDamageRatio = targetHealthRatio < bottomStatusDamageRatio
    ? H_lerp(bottomStatusDamageRatio, targetHealthRatio, 1 - Math.pow(0.08, dt))
    : H_lerp(bottomStatusDamageRatio, targetHealthRatio, 1 - Math.pow(0.0008, dt));
  bottomStatusHealthColor = H_lerpRgb(bottomStatusHealthColor, targetHealthColor, 1 - Math.pow(0.002, dt));
  bottomStatusDamageFlash = Math.max(0, bottomStatusDamageFlash - dt * 2.8);

  // 行高(设计稿自上而下: 30/30/40/80,共 180)
  const levelRowH = panelHeight / 6;
  const expRowH = panelHeight / 6;
  const barRowH = panelHeight * 2 / 9;
  const skillRowH = panelHeight * 4 / 9;
  const padding = Math.max(8, panelWidth * 0.02);

  // 机械切角尺寸与主题常量
  const cut = Math.max(6, panelHeight * 0.085);
  const accent = 'rgba(0, 229, 255, 1)';

  CtxUi.save();
  CtxUi.textAlign = 'left';
  CtxUi.textBaseline = 'middle';

  // ---- 面板主体:半透明玻璃底板(保留后方游戏画面可见) ----
  createChamferRect(CtxUi, x, y, panelWidth, panelHeight, cut);
  const panelGrad = CtxUi.createLinearGradient(x, y, x, y + panelHeight);
  panelGrad.addColorStop(0, 'rgba(14, 40, 60, 0.60)');
  panelGrad.addColorStop(0.45, 'rgba(7, 22, 34, 0.42)');
  panelGrad.addColorStop(1, 'rgba(3, 10, 18, 0.26)');
  CtxUi.fillStyle = panelGrad;
  CtxUi.fill();

  // 玻璃高光 + 扫描线纹理 + 移动光带(全部裁剪在面板内)
  CtxUi.save();
  createChamferRect(CtxUi, x, y, panelWidth, panelHeight, cut);
  CtxUi.clip();

  const sheen = CtxUi.createLinearGradient(x, y, x + panelWidth * 0.55, y + panelHeight);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
  sheen.addColorStop(0.35, 'rgba(255, 255, 255, 0.02)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  CtxUi.fillStyle = sheen;
  CtxUi.fillRect(x, y, panelWidth, panelHeight);

  CtxUi.fillStyle = 'rgba(120, 235, 255, 0.05)';
  const scanStep = Math.max(3, panelHeight / 36);
  for (let ly = y + scanStep; ly < y + panelHeight; ly += scanStep) {
    CtxUi.fillRect(x, Math.round(ly), panelWidth, 1);
  }

  const sweepH = panelHeight * 0.16;
  const sweepY = y + ((time * 0.35) % 1) * (panelHeight + sweepH) - sweepH;
  const sweepGrad = CtxUi.createLinearGradient(0, sweepY, 0, sweepY + sweepH);
  sweepGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
  sweepGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.10)');
  sweepGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
  CtxUi.fillStyle = sweepGrad;
  CtxUi.fillRect(x, sweepY, panelWidth, sweepH);
  CtxUi.restore();

  // ---- 霓虹边框(外发光) + 内侧细线 ----
  CtxUi.save();
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.5)';
  CtxUi.shadowBlur = 12;
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.85)';
  CtxUi.lineWidth = 1.6;
  createChamferRect(CtxUi, x + 0.8, y + 0.8, panelWidth - 1.6, panelHeight - 1.6, cut);
  CtxUi.stroke();
  CtxUi.restore();

  CtxUi.strokeStyle = 'rgba(150, 245, 255, 0.25)';
  CtxUi.lineWidth = 1;
  createChamferRect(CtxUi, x + 3.5, y + 3.5, panelWidth - 7, panelHeight - 7, Math.max(2, cut - 2));
  CtxUi.stroke();

  // ---- 顶边能量刻度(随时间流动点亮) ----
  const tickCount = Math.max(8, Math.round(panelWidth / 26));
  const tickSpan = (panelWidth - cut * 2) / tickCount;
  const flowIndex = Math.floor(time * 8) % tickCount;
  for (let i = 0; i < tickCount; i++) {
    const on = i === flowIndex;
    CtxUi.strokeStyle = on ? 'rgba(200, 255, 255, 0.95)' : 'rgba(0, 229, 255, 0.22)';
    CtxUi.lineWidth = on ? 2 : 1;
    CtxUi.beginPath();
    CtxUi.moveTo(x + cut + i * tickSpan + 2, y + 1);
    CtxUi.lineTo(x + cut + i * tickSpan + 2, y + (on ? 8 : 4));
    CtxUi.stroke();
  }

  // ---- 四角机械支架 ----
  drawHudCornerBrackets(CtxUi, x, y, panelWidth, panelHeight, Math.max(10, panelHeight * 0.15), 'rgba(0, 229, 255, 0.9)');

  // ---- 第1行: 玩家名称 + 分数(左) / 等级徽章(右) ----
  const levelBoxW = Math.max(52, panelWidth * 0.18);
  const levelBoxH = levelRowH * 0.76;
  const levelBoxX = x + panelWidth - padding - levelBoxW;
  const levelBoxY = y + (levelRowH - levelBoxH) / 2;
  const lvCut = levelBoxH * 0.34;

  CtxUi.save();
  createChamferRect(CtxUi, levelBoxX, levelBoxY, levelBoxW, levelBoxH, lvCut);
  const lvGrad = CtxUi.createLinearGradient(levelBoxX, levelBoxY, levelBoxX, levelBoxY + levelBoxH);
  lvGrad.addColorStop(0, 'rgba(0, 229, 255, 0.22)');
  lvGrad.addColorStop(1, 'rgba(0, 229, 255, 0.04)');
  CtxUi.fillStyle = lvGrad;
  CtxUi.fill();
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.6)';
  CtxUi.shadowBlur = 10;
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.9)';
  CtxUi.lineWidth = 1.5;
  createChamferRect(CtxUi, levelBoxX + 0.75, levelBoxY + 0.75, levelBoxW - 1.5, levelBoxH - 1.5, lvCut);
  CtxUi.stroke();
  CtxUi.restore();

  CtxUi.fillStyle = '#dcfeff';
  CtxUi.font = `bold ${Math.max(12, levelBoxH * 0.52)}px Consolas, "Courier New", monospace`;
  CtxUi.textAlign = 'center';
  CtxUi.textBaseline = 'middle';
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.85)';
  CtxUi.shadowBlur = 8;
  CtxUi.fillText(`LV ${playerEntity?.game_level ?? 0}`, levelBoxX + levelBoxW / 2, levelBoxY + levelBoxH / 2 + 0.5);
  CtxUi.shadowBlur = 0;

  // 名称与分数
  const nameX = x + padding;
  const nameY = y + levelRowH / 2;
  const markerSize = Math.max(4, levelRowH * 0.15);
  CtxUi.fillStyle = accent;
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.9)';
  CtxUi.shadowBlur = 8;
  CtxUi.beginPath();
  CtxUi.moveTo(nameX, nameY);
  CtxUi.lineTo(nameX + markerSize, nameY - markerSize * 1.15);
  CtxUi.lineTo(nameX + markerSize * 2, nameY);
  CtxUi.lineTo(nameX + markerSize, nameY + markerSize * 1.15);
  CtxUi.closePath();
  CtxUi.fill();

  const nameText = playerEntity?.name || 'Player';
  const nameTextX = nameX + markerSize * 2 + 8;
  CtxUi.textAlign = 'left';
  CtxUi.font = `bold ${Math.max(12, levelRowH * 0.5)}px "Microsoft YaHei", Arial, sans-serif`;
  CtxUi.fillStyle = '#eafdff';
  CtxUi.fillText(nameText, nameTextX, nameY);
  CtxUi.shadowBlur = 0;
  const nameW = CtxUi.measureText(nameText).width;
  CtxUi.font = `${Math.max(10, levelRowH * 0.36)}px Consolas, "Courier New", monospace`;
  CtxUi.fillStyle = 'rgba(122, 214, 240, 0.9)';
  CtxUi.fillText(
    `SCORE ${String(Math.floor(playerEntity?.player_score ?? 0)).padStart(5, '0')}`,
    nameTextX + nameW + 12,
    nameY + 1
  );

  // ---- 第2行: 经验能量条(当前等级到下一等级的升级进度) ----
  const expBarX = x + padding;
  const expBarW = panelWidth - padding * 2;
  const expBarH = Math.min(expRowH * 0.66, 14);
  const expBarY = y + levelRowH + (expRowH - expBarH) / 2;
  const expCut = Math.max(2, expBarH * 0.42);

  const gameLevel = playerEntity?.game_level ?? 0;
  const gameExp = playerEntity?.game_exp ?? 0;
  const expNeed = PlayerDynamicEntity.getExpToNextLevel(gameLevel);
  const expRatio = H_clamp(gameExp / expNeed, 0, 1);

  // 轨道
  createChamferRect(CtxUi, expBarX, expBarY, expBarW, expBarH, expCut);
  CtxUi.fillStyle = 'rgba(6, 20, 32, 0.72)';
  CtxUi.fill();
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.35)';
  CtxUi.lineWidth = 1;
  createChamferRect(CtxUi, expBarX + 0.5, expBarY + 0.5, expBarW - 1, expBarH - 1, expCut);
  CtxUi.stroke();

  // 填充(青色 -> 荧光绿渐变 + 发光 + 斜纹 + 能量前沿)
  if (expRatio > 0) {
    CtxUi.save();
    createChamferRect(CtxUi, expBarX, expBarY, expBarW, expBarH, expCut);
    CtxUi.clip();
    const expFillW = Math.max(expCut, expBarW * expRatio);
    const expGrad = CtxUi.createLinearGradient(expBarX, expBarY, expBarX + expFillW, expBarY);
    expGrad.addColorStop(0, 'rgba(0, 229, 255, 0.92)');
    expGrad.addColorStop(1, 'rgba(90, 255, 195, 0.95)');
    CtxUi.shadowColor = 'rgba(0, 229, 255, 0.85)';
    CtxUi.shadowBlur = 10;
    CtxUi.fillStyle = expGrad;
    CtxUi.fillRect(expBarX, expBarY, expFillW, expBarH);
    CtxUi.shadowBlur = 0;
    drawSlantedStripes(CtxUi, expBarX, expBarY, expFillW, expBarH, expBarH * 1.3, 'rgba(224, 255, 255, 0.22)');
    const expEdge = expBarX + expFillW;
    CtxUi.fillStyle = 'rgba(224, 255, 255, 0.95)';
    CtxUi.fillRect(expEdge - 1.5, expBarY, 2.5, expBarH);
    CtxUi.restore();
  }

  // 分段刻度
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.16)';
  CtxUi.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const tx = expBarX + (expBarW / 4) * i;
    CtxUi.beginPath();
    CtxUi.moveTo(tx, expBarY + 2);
    CtxUi.lineTo(tx, expBarY + expBarH - 2);
    CtxUi.stroke();
  }

  // 文本(暗色描边 + 霓虹白字)
  const expText = `EXP ${Math.floor(gameExp)} / ${Math.floor(expNeed)}`;
  CtxUi.font = `bold ${Math.max(9, expBarH * 0.7)}px Consolas, "Courier New", monospace`;
  CtxUi.textAlign = 'center';
  CtxUi.textBaseline = 'middle';
  CtxUi.fillStyle = 'rgba(0, 30, 40, 0.85)';
  CtxUi.fillText(expText, expBarX + expBarW / 2 + 1, expBarY + expBarH / 2 + 1.5);
  CtxUi.fillStyle = '#eafdff';
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.8)';
  CtxUi.shadowBlur = 6;
  CtxUi.fillText(expText, expBarX + expBarW / 2, expBarY + expBarH / 2 + 0.5);
  CtxUi.shadowBlur = 0;

  // ---- 第3行: 生命条(左,青色霓虹) + 体力条(右,琥珀霓虹) ----
  const barY = y + levelRowH + expRowH;
  const barH = barRowH * 0.6;
  const barYCenter = barY + (barRowH - barH) / 2;
  const barGap = Math.max(6, panelWidth * 0.015);
  const halfBarW = (panelWidth - padding * 2 - barGap) / 2;
  const barCut = Math.max(2, barH * 0.4);

  // 能量条轨道
  const drawBarTrack = (bx: number, borderColor: string) => {
    createChamferRect(CtxUi, bx, barYCenter, halfBarW, barH, barCut);
    CtxUi.fillStyle = 'rgba(6, 18, 28, 0.78)';
    CtxUi.fill();
    CtxUi.strokeStyle = borderColor;
    CtxUi.lineWidth = 1.2;
    createChamferRect(CtxUi, bx + 0.6, barYCenter + 0.6, halfBarW - 1.2, barH - 1.2, barCut);
    CtxUi.stroke();
  };

  // 能量条分段刻度
  const drawBarTicks = (bx: number) => {
    CtxUi.save();
    CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.16)';
    CtxUi.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const tx = bx + (halfBarW / 5) * i;
      CtxUi.beginPath();
      CtxUi.moveTo(tx, barYCenter + 2);
      CtxUi.lineTo(tx, barYCenter + barH - 2);
      CtxUi.stroke();
    }
    CtxUi.restore();
  };

  // 能量条标签(标签色 + 数值白)
  const drawBarLabel = (bx: number, label: string, value: string, labelColor: string) => {
    CtxUi.save();
    CtxUi.font = `bold ${Math.max(9, barH * 0.56)}px Consolas, "Courier New", monospace`;
    CtxUi.textBaseline = 'middle';
    const gap = Math.max(4, barH * 0.4);
    const totalW = CtxUi.measureText(label).width + gap + CtxUi.measureText(value).width;
    let tx = bx + (halfBarW - totalW) / 2;
    const ty = barYCenter + barH / 2 + 0.5;
    CtxUi.textAlign = 'left';
    CtxUi.shadowColor = 'rgba(0, 0, 0, 0.8)';
    CtxUi.shadowBlur = 4;
    CtxUi.fillStyle = labelColor;
    CtxUi.fillText(label, tx, ty);
    tx += CtxUi.measureText(label).width + gap;
    CtxUi.fillStyle = '#f2feff';
    CtxUi.fillText(value, tx, ty);
    CtxUi.restore();
  };

  // 生命条
  const hpX = x + padding;
  const hpRatio = H_clamp(bottomStatusHealthRatio, 0, 1);
  const damageRatio = H_clamp(bottomStatusDamageRatio, 0, 1);
  const lowHealth = hpRatio < 0.3 && !playerDead;
  const lowPulse = 0.5 + 0.5 * Math.sin(time * 7);

  drawBarTrack(hpX, `rgba(25, 204, 228, ${lowHealth ? 0.55 + lowPulse * 0.45 : 0.6})`);

  CtxUi.save();
  createChamferRect(CtxUi, hpX, barYCenter, halfBarW, barH, barCut);
  CtxUi.clip();
  // 掉血残影
  if (damageRatio > hpRatio) {
    CtxUi.fillStyle = 'rgba(255, 59, 92, 0.45)';
    CtxUi.fillRect(hpX, barYCenter, halfBarW * damageRatio, barH);
  }
  // 主填充(发光 + 斜纹 + 能量前沿)
  const hpFillW = halfBarW * hpRatio;
  if (hpFillW > 0) {
    CtxUi.shadowColor = H_rgbToCss(bottomStatusHealthColor, 0.9);
    CtxUi.shadowBlur = 12;
    CtxUi.fillStyle = H_rgbToCss(bottomStatusHealthColor, 0.95);
    CtxUi.fillRect(hpX, barYCenter, hpFillW, barH);
    CtxUi.shadowBlur = 0;
    drawSlantedStripes(CtxUi, hpX, barYCenter, hpFillW, barH, barH * 1.2, 'rgba(3, 18, 26, 0.30)');
    CtxUi.fillStyle = 'rgba(255, 255, 255, 0.85)';
    CtxUi.fillRect(hpX + hpFillW - 1.5, barYCenter, 2.5, barH);
  }
  // 低血量警告脉冲
  if (lowHealth) {
    CtxUi.fillStyle = `rgba(255, 59, 92, ${0.08 + lowPulse * 0.18})`;
    CtxUi.fillRect(hpX, barYCenter, halfBarW, barH);
  }
  // 受击闪白
  if (bottomStatusDamageFlash > 0) {
    CtxUi.fillStyle = `rgba(255, 255, 255, ${bottomStatusDamageFlash * 0.4})`;
    CtxUi.fillRect(hpX, barYCenter, halfBarW, barH);
  }
  CtxUi.restore();

  drawBarTicks(hpX);
  drawBarLabel(hpX, 'HP', `${Math.ceil(currentHealth)} / ${Math.ceil(healthMax)}`, 'rgba(0, 229, 255, 0.95)');

  // 体力条
  const staminaMax = Math.max(1, playerEntity?.staminaMax ?? 100);
  const currentStamina = playerDead ? 0 : Math.max(0, playerEntity?.stamina ?? 0);
  const staminaRatio = playerDead ? 0 : H_clamp(currentStamina / staminaMax, 0, 1);
  const staminaX = hpX + halfBarW + barGap;
  const sprinting = playerEntity?.isSprinting ?? false;
  const staminaBorder = sprinting ? 'rgba(255, 190, 60, 0.95)' : 'rgba(248, 198, 69, 0.7)';

  drawBarTrack(staminaX, staminaBorder);

  CtxUi.save();
  createChamferRect(CtxUi, staminaX, barYCenter, halfBarW, barH, barCut);
  CtxUi.clip();
  const staminaFillW = halfBarW * staminaRatio;
  if (staminaFillW > 0) {
    CtxUi.shadowColor = 'rgba(255, 190, 60, 0.85)';
    CtxUi.shadowBlur = 12;
    CtxUi.fillStyle = sprinting ? 'rgba(255, 196, 76, 0.98)' : 'rgba(248, 198, 69, 0.9)';
    CtxUi.fillRect(staminaX, barYCenter, staminaFillW, barH);
    CtxUi.shadowBlur = 0;
    drawSlantedStripes(CtxUi, staminaX, barYCenter, staminaFillW, barH, barH * 1.2, 'rgba(40, 24, 2, 0.25)');
    CtxUi.fillStyle = 'rgba(255, 250, 228, 0.9)';
    CtxUi.fillRect(staminaX + staminaFillW - 1.5, barYCenter, 2.5, barH);
  }
  CtxUi.restore();

  drawBarTicks(staminaX);
  drawBarLabel(staminaX, 'SP', `${Math.ceil(currentStamina)} / ${Math.ceil(staminaMax)}`, 'rgba(255, 190, 60, 0.95)');

  // ---- 第4行: 技能槽(10个,参考设计稿;空槽留空) ----
  // 槽位与背包"技能装配区"逐格对应(下标一致,不压缩、不错位):
  // - 前 INVENTORY_INNATE_SKILL_SLOT_COUNT 格 = 固有技能槽(固定功能键,不可更改)
  // - 后 INVENTORY_EXTENDED_SKILL_SLOT_COUNT 格 = 拓展技能槽(对应 equippedSkills 的同下标槽位)
  const skills: (BottomStatusSkill | null)[] = new Array(BOTTOM_STATUS_SKILL_SLOT_COUNT).fill(null);
  skills[0] = {
    key: 'F',
    title: 'FIRE',
    subtitle: playerFireMode ? 'ARMED' : 'AIM',
    color: playerFireMode ? '#ffcf5a' : '#58d9ff',
    cooldownNow: playerEntity?.playerRule.fireCooldownNow ?? 0,
    cooldownMax: playerEntity?.playerRule.fireCooldownMax ?? 1,
    active: playerFireMode
  };
  skills[1] = {
    key: 'SHIFT',
    title: 'SPRINT',
    subtitle: playerEntity?.isSprinting ? 'RUN' : 'WALK',
    color: '#ffa94d',
    cooldownNow: 0,
    cooldownMax: 1,
    active: playerEntity?.isSprinting ?? false
  };

  // 拓展技能槽:按下标填入已装配技能(空格保留为空槽,与背包装配区位置严格一致)
  // 冷却取自权威端下发的 equippedSkillCooldowns(与装配区同下标),
  // 由 drawBottomStatusSkill 绘制冷却扇形遮罩 + 剩余秒数,让玩家一眼看出技能是否就绪
  if (playerEntity) {
    const equippedTags = H_ensurePlayerInventory(playerEntity.inventory).equippedSkills;
    const cooldownRemaining = Array.isArray(playerEntity.equippedSkillCooldowns)
      ? playerEntity.equippedSkillCooldowns
      : [];
    for (let slot = INVENTORY_INNATE_SKILL_SLOT_COUNT; slot < BOTTOM_STATUS_SKILL_SLOT_COUNT; slot++) {
      const tag = equippedTags[slot];
      if (!tag) continue;
      const skill = H_getSkillByTag(tag);
      if (!skill) continue;
      // 技能内置CD:0 表示就绪;maxCooldown 为 0 的技能(无冷却)恒为就绪
      const cooldownNow = Math.max(0, cooldownRemaining[slot] ?? 0);
      skills[slot] = {
        key: '',
        title: skill.name,
        subtitle: skill.shortName,
        color: skill.color,
        cooldownNow,
        cooldownMax: skill.maxCooldown,
        active: cooldownNow <= 0,
        icon: skill.icon,
        equipped: true
      };
    }
  }

  const skillCount = BOTTOM_STATUS_SKILL_SLOT_COUNT;
  const skillGap = Math.max(2, panelWidth * 0.005);
  const skillAreaX = x + padding;
  const skillAreaW = panelWidth - padding * 2;
  const footerH = panelHeight * 0.08; // 底部预留:技能副标题空间
  const skillAreaY = y + levelRowH + expRowH + barRowH;
  const skillAreaH = skillRowH - footerH;
  const widthSlotSize = Math.floor((skillAreaW - skillGap * (skillCount - 1)) / skillCount);
  const slotSize = Math.max(20, Math.min(widthSlotSize, skillAreaH * 0.82));
  const slotsTotalW = slotSize * skillCount + skillGap * (skillCount - 1);
  const slotsStartX = skillAreaX + (skillAreaW - slotsTotalW) / 2;
  const slotY = skillAreaY + (skillAreaH - slotSize) / 2;
  const slotCut = slotSize * 0.26;
  // 副标题统一贴齐面板底部内侧一行(空间不足时由绘制函数自动省略)
  const slotSubtitleY = skillAreaY + skillRowH - panelHeight * 0.045;

  for (let i = 0; i < skillCount; i++) {
    const slotX = slotsStartX + i * (slotSize + skillGap);
    const skill = skills[i];
    if (skill) {
      drawBottomStatusSkill(CtxUi, skill, slotX, slotY, slotSize, slotCut, slotSubtitleY, time);
    } else {
      drawEmptyBottomStatusSkill(CtxUi, slotX, slotY, slotSize, slotCut);
    }
  }

  CtxUi.restore();
};

/**
 * 绘制空的技能槽(机械风格:虚线切角框 + 中心微标)
 */
const drawEmptyBottomStatusSkill = (
  CtxUi: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  cut: number
) => {
  CtxUi.save();
  createChamferRect(CtxUi, x, y, size, size, cut);
  CtxUi.fillStyle = 'rgba(6, 16, 26, 0.34)';
  CtxUi.fill();

  CtxUi.setLineDash([Math.max(2, size * 0.07), Math.max(2, size * 0.06)]);
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.22)';
  CtxUi.lineWidth = 1;
  createChamferRect(CtxUi, x + 0.5, y + 0.5, size - 1, size - 1, cut);
  CtxUi.stroke();
  CtxUi.setLineDash([]);

  // 中心十字微标
  const cx = x + size / 2;
  const cy = y + size / 2;
  const m = size * 0.1;
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.18)';
  CtxUi.beginPath();
  CtxUi.moveTo(cx - m, cy);
  CtxUi.lineTo(cx + m, cy);
  CtxUi.moveTo(cx, cy - m);
  CtxUi.lineTo(cx, cy + m);
  CtxUi.stroke();
  CtxUi.restore();
};

/**
 * 绘制固定功能键的矢量图标(开火 / 疾跑等)
 * @param key 功能键标识(与 bottomStatusBar 技能条目的 key 一致)
 */
const H_drawFixedFunctionIcon = (
  ctx: CanvasRenderingContext2D,
  key: string,
  cx: number,
  cy: number,
  inner: number,
  paint: string,
  glowColor: string | null,
  strokeWidth: number
) => {
  ctx.save();
  ctx.fillStyle = paint;
  ctx.strokeStyle = paint;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
  }

  ctx.beginPath();
  if (key === 'F') {
    // 开火:三角形
    ctx.moveTo(cx - inner * 0.28, cy + inner * 0.28);
    ctx.lineTo(cx + inner * 0.3, cy);
    ctx.lineTo(cx - inner * 0.28, cy - inner * 0.28);
    ctx.closePath();
  } else if (key === 'SHIFT') {
    // 疾跑:两个向右的三角形(快进)
    const triW = inner * 0.24;
    const triH = inner * 0.3;
    const gapX = inner * 0.1;
    for (let k = 0; k < 2; k++) {
      const bx = cx - (triW + gapX) / 2 + k * (triW + gapX);
      ctx.moveTo(bx, cy - triH);
      ctx.lineTo(bx, cy + triH);
      ctx.lineTo(bx + triW, cy);
      ctx.closePath();
    }
  } else if (key === 'SP') {
    // 闪避:闪电
    ctx.moveTo(cx - inner * 0.28, cy + inner * 0.26);
    ctx.lineTo(cx + inner * 0.2, cy);
    ctx.lineTo(cx - inner * 0.28, cy - inner * 0.26);
    ctx.lineTo(cx - inner * 0.08, cy);
    ctx.closePath();
  } else if (key === 'C') {
    // 从者网格:方形
    ctx.rect(cx - inner * 0.25, cy - inner * 0.25, inner * 0.5, inner * 0.5);
  } else {
    // 视角:圆形
    ctx.arc(cx, cy, inner * 0.25, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
};

/**
 * 绘制底部状态栏技能槽(UI层,机械未来风格)
 */
const drawBottomStatusSkill = (
  CtxUi: CanvasRenderingContext2D,
  skill: BottomStatusSkill,
  x: number,
  y: number,
  size: number,
  cut: number,
  subtitleY: number,
  time: number
) => {
  const cooldownMax = Math.max(0.001, skill.cooldownMax);
  const cooldownRatio = H_clamp(skill.cooldownNow / cooldownMax, 0, 1);
  const ready = cooldownRatio <= 0;
  const active = !!skill.active;
  const highlight = ready || active;
  const pulse = ready ? 0.55 + Math.sin(time * 5.5) * 0.25 : 0.2;
  const centerX = x + size / 2;
  // 槽内布局:底部预留快捷键标签条,图标占据其余空间,避免二者重叠
  const keyStrip = Math.max(9, size * 0.24);
  const iconAreaH = size - keyStrip;
  const centerY = y + iconAreaH / 2 + size * 0.02;

  CtxUi.save();

  // 槽体底板(透明玻璃渐变)
  createChamferRect(CtxUi, x, y, size, size, cut);
  const bgGrad = CtxUi.createLinearGradient(x, y, x, y + size);
  bgGrad.addColorStop(0, ready ? 'rgba(14, 44, 60, 0.72)' : 'rgba(8, 22, 32, 0.6)');
  bgGrad.addColorStop(1, 'rgba(3, 12, 20, 0.5)');
  CtxUi.fillStyle = bgGrad;
  CtxUi.fill();

  // 霓虹边框(就绪/激活时发光)
  CtxUi.strokeStyle = highlight ? skill.color : 'rgba(120, 160, 180, 0.45)';
  CtxUi.lineWidth = highlight ? 1.8 : 1;
  if (highlight) {
    CtxUi.shadowColor = skill.color;
    CtxUi.shadowBlur = active ? 16 : 10;
  }
  createChamferRect(CtxUi, x + 0.9, y + 0.9, size - 1.8, size - 1.8, cut);
  CtxUi.stroke();
  CtxUi.shadowBlur = 0;

  // 侧边导轨刻度
  CtxUi.strokeStyle = `${skill.color}${highlight ? '77' : '33'}`;
  CtxUi.lineWidth = 1;
  const railInset = size * 0.09;
  CtxUi.beginPath();
  CtxUi.moveTo(x + railInset, y + size * 0.28);
  CtxUi.lineTo(x + railInset, y + size * 0.72);
  CtxUi.moveTo(x + size - railInset, y + size * 0.28);
  CtxUi.lineTo(x + size - railInset, y + size * 0.72);
  CtxUi.stroke();

  // 技能图标:已装配技能使用 resource/skill_icon 下的 PNG 贴图;固定功能键仍绘制矢量图形
  const inner = iconAreaH * 0.72;
  let iconDrawn = false;
  if (skill.equipped === true && skill.icon) {
    CtxUi.save();
    CtxUi.shadowColor = highlight ? skill.color : 'transparent';
    CtxUi.shadowBlur = highlight ? 10 : 0;
    // 冷却中压暗贴图
    iconDrawn = H_drawSkillIconTexture(
      CtxUi,
      skill.icon,
      centerX,
      centerY,
      iconAreaH * 0.78,
      ready ? 1 : 0.5
    );
    CtxUi.restore();
  }

  if (!iconDrawn && skill.equipped !== true) {
    H_drawFixedFunctionIcon(
      CtxUi,
      skill.key,
      centerX,
      centerY,
      inner,
      `${skill.color}${ready ? 'e6' : '80'}`,
      highlight ? skill.color : null,
      Math.max(1, size * 0.07)
    );
  }
  CtxUi.shadowBlur = 0;

  // 冷却扇形遮罩 / 就绪呼吸内框
  if (cooldownRatio > 0) {
    CtxUi.save();
    createChamferRect(CtxUi, x, y, size, size, cut);
    CtxUi.clip();
    CtxUi.fillStyle = 'rgba(3, 12, 20, 0.7)';
    CtxUi.beginPath();
    CtxUi.moveTo(centerX, centerY);
    CtxUi.arc(centerX, centerY, size * 1.1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cooldownRatio, false);
    CtxUi.closePath();
    CtxUi.fill();
    CtxUi.restore();

    CtxUi.save();
    CtxUi.fillStyle = '#eafdff';
    CtxUi.shadowColor = skill.color;
    CtxUi.shadowBlur = 8;
    CtxUi.font = `bold ${Math.max(11, size * 0.26)}px Consolas, "Courier New", monospace`;
    CtxUi.textAlign = 'center';
    CtxUi.textBaseline = 'middle';
    CtxUi.fillText(skill.cooldownNow.toFixed(1), centerX, centerY);
    CtxUi.restore();
  } else {
    CtxUi.save();
    CtxUi.strokeStyle = skill.color;
    CtxUi.globalAlpha = Math.max(0.15, pulse * 0.55);
    CtxUi.lineWidth = 1;
    createChamferRect(CtxUi, x + 4, y + 4, size - 8, size - 8, Math.max(2, cut - 2));
    CtxUi.stroke();
    CtxUi.restore();
  }

  // 快捷键标签(槽内底部,必要时缩字号以适配槽宽;已装配技能无快捷键,不绘制)
  CtxUi.textAlign = 'center';
  CtxUi.textBaseline = 'middle';
  if (skill.key !== '') {
    let keyFont = Math.max(9, size * 0.18);
    CtxUi.font = `bold ${keyFont}px Consolas, "Courier New", monospace`;
    while (keyFont > 7 && CtxUi.measureText(skill.key).width > size * 0.82) {
      keyFont -= 0.5;
      CtxUi.font = `bold ${keyFont}px Consolas, "Courier New", monospace`;
    }
    CtxUi.fillStyle = highlight ? '#eafdff' : 'rgba(150, 180, 195, 0.85)';
    if (highlight) {
      CtxUi.shadowColor = skill.color;
      CtxUi.shadowBlur = 6;
    }
    CtxUi.fillText(skill.key, centerX, y + size - keyStrip / 2);
    CtxUi.shadowBlur = 0;
  }

  // 副标题(槽外下方,状态提示;空间不足时省略避免重叠)
  const subtitleFont = Math.max(8, size * 0.15);
  if (subtitleY - (y + size) >= subtitleFont) {
    CtxUi.font = `${subtitleFont}px Consolas, "Courier New", monospace`;
    CtxUi.fillStyle = active ? skill.color : 'rgba(120, 190, 215, 0.85)';
    let subText = skill.subtitle;
    if (CtxUi.measureText(subText).width > size * 1.15) {
      subText = subText.slice(0, 4);
    }
    CtxUi.fillText(subText, centerX, subtitleY);
  }

  CtxUi.restore();
};

////////////////////
// 背包界面相关 -->
////////////////////

/** 背包(持有物)网格列数 */
const INVENTORY_BAG_COLS = 10;
/** 背包(持有物)网格行数 */
const INVENTORY_BAG_ROWS = 2;
/** 背包界面的持有物格数(需与数据层容量一致) */
const INVENTORY_BAG_SLOT_COUNT = INVENTORY_BAG_COLS * INVENTORY_BAG_ROWS;
/** 技能装配区槽位数量 */
const INVENTORY_EQUIP_COUNT = INVENTORY_SKILL_SLOT_COUNT;
/** 底部状态栏技能槽数量 */
const BOTTOM_STATUS_SKILL_SLOT_COUNT = INVENTORY_SKILL_SLOT_COUNT;
/** 研究项展示区列数(4 列 × 2 行恰好容纳全部 8 个研究项) */
const INVENTORY_RESEARCH_COLUMNS = 4;
/** 研究项展示区行数上限 */
const INVENTORY_RESEARCH_MAX_ROWS = 2;
/**
 * 背包格子整体缩放系数。
 * 缩小背包界面以腾出上部分空间展示研究项(格子变小→背包区变矮)。
 */
const INVENTORY_SLOT_SHRINK = 0.8;

/** 背包界面中的命中目标 */
type InventorySlotTarget =
  | { zone: 'bag'; index: number }
  | { zone: 'equip'; index: number }
  | { zone: 'trash'; index: -1 }
  | null;

/** 拖拽中的条目快照(拖拽期间背包可能被服务端快照覆盖,因此只保留必要数据) */
type InventoryDragPayload = {
  kind: 'skill' | 'item';
  tag: string;
  name: string;
  count: number;
  color: string;
  uid: string;
  fromZone: 'bag' | 'equip';
  fromIndex: number;
};

/** 背包界面布局(绘制与命中检测共用同一份计算结果) */
type InventoryLayout = {
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
  padding: number;
  slotGap: number;
  slotSize: number;
  headerHeight: number;
  bagX: number;
  bagY: number;
  bagWidth: number;
  bagHeight: number;
  labelHeight: number;
  dividerY: number;
  equipX: number;
  equipY: number;
  equipSlotSize: number;
  /** 固有技能槽(前 2 格)与拓展技能槽(后 8 格)之间的额外间距 */
  equipGroupGap: number;
  equipWidth: number;
  trashX: number;
  trashY: number;
  trashSize: number;
  hintHeight: number;
  hintY: number;
  /** 研究项展示区(位于背包上方)左上角与宽度 */
  researchX: number;
  researchY: number;
  researchWidth: number;
  /** 单个研究项卡片的宽高与间距 */
  researchCardWidth: number;
  researchCardHeight: number;
  researchGap: number;
  /** 研究项展示区总高度(含最大行数) */
  researchHeight: number;
};

/** 矩形命中检测 */
const H_pointInRect = (
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
  tolerance: number = 0
): boolean => {
  return (
    x >= rect.x - tolerance &&
    x <= rect.x + rect.width + tolerance &&
    y >= rect.y - tolerance &&
    y <= rect.y + rect.height + tolerance
  );
};

/**
 * 计算背包界面布局
 * 格子尺寸同时受画布宽高约束,保证在窄屏/矮屏下仍完整可见。
 */
const H_getInventoryLayout = (canvasWidth: number, canvasHeight: number): InventoryLayout => {
  const padding = H_clamp(canvasWidth * 0.018, 14, 26);
  const slotGap = H_clamp(canvasWidth * 0.005, 4, 9);
  const maxPanelWidth = Math.min(canvasWidth * 0.94, 1120);
  const maxPanelHeight = canvasHeight * 0.9;
  // 标题/标签/提示等固定区域折算成的格子高度倍率
  const fixedSlotRatio = 1.5;
  const equipSlotRatio = 0.78;
  // 研究项卡片高度与行间距折算成的格子高度倍率
  const researchCardRatio = 0.66;
  const researchGapRatio = 0.18;
  // 研究项展示区折算成格子高度:标签(0.36) + N 行卡片 + 行间距
  const researchSlotRatio =
    0.36
    + INVENTORY_RESEARCH_MAX_ROWS * researchCardRatio
    + (INVENTORY_RESEARCH_MAX_ROWS - 1) * researchGapRatio;

  const slotFromWidth =
    (maxPanelWidth - padding * 2 - slotGap * (INVENTORY_BAG_COLS - 1)) / INVENTORY_BAG_COLS;
  const slotFromHeight =
    (maxPanelHeight - padding * 2 - slotGap * (INVENTORY_BAG_ROWS + 2)) /
    (INVENTORY_BAG_ROWS + equipSlotRatio + fixedSlotRatio + researchSlotRatio);
  // 缩小背包格子以腾出上部分空间展示研究项
  const slotSize = Math.max(
    20,
    Math.floor(Math.min(slotFromWidth, slotFromHeight) * INVENTORY_SLOT_SHRINK)
  );

  const bagWidth = slotSize * INVENTORY_BAG_COLS + slotGap * (INVENTORY_BAG_COLS - 1);
  const bagHeight = slotSize * INVENTORY_BAG_ROWS + slotGap * (INVENTORY_BAG_ROWS - 1);
  const equipSlotSize = Math.round(slotSize * equipSlotRatio);
  // 固有技能槽与拓展技能槽之间留出额外间距,让两组槽位在视觉上一眼可辨
  const equipGroupGap = slotGap * 2;
  const equipWidth =
    equipSlotSize * INVENTORY_EQUIP_COUNT
    + slotGap * (INVENTORY_EQUIP_COUNT - 1)
    + equipGroupGap;
  const trashSize = equipSlotSize;
  const equipRowWidth = equipWidth + slotGap * 4 + trashSize;
  const contentWidth = Math.max(bagWidth, equipRowWidth);

  const headerHeight = Math.round(slotSize * 0.6);
  const labelHeight = Math.round(slotSize * 0.36);
  const dividerHeight = Math.round(slotSize * 0.24);
  const hintHeight = Math.round(slotSize * 0.36);

  // ---- 研究项展示区 ----
  const researchGap = Math.round(slotSize * researchGapRatio);
  const researchCardHeight = Math.round(slotSize * researchCardRatio);
  const researchCardWidth = Math.floor(
    (contentWidth - researchGap * (INVENTORY_RESEARCH_COLUMNS - 1)) / INVENTORY_RESEARCH_COLUMNS
  );
  const researchHeight =
    researchCardHeight * INVENTORY_RESEARCH_MAX_ROWS
    + researchGap * (INVENTORY_RESEARCH_MAX_ROWS - 1);

  const panelWidth = contentWidth + padding * 2;
  const panelHeight =
    padding * 2 +
    headerHeight +
    labelHeight +
    researchHeight +
    dividerHeight +
    labelHeight +
    bagHeight +
    dividerHeight +
    labelHeight +
    equipSlotSize +
    hintHeight;

  const panelX = (canvasWidth - panelWidth) / 2;
  const panelY = Math.max(8, (canvasHeight - panelHeight) / 2 - canvasHeight * 0.02);
  const researchX = panelX + padding;
  const researchY = panelY + padding + headerHeight + labelHeight;
  const bagX = panelX + padding + (contentWidth - bagWidth) / 2;
  const bagY = researchY + researchHeight + dividerHeight + labelHeight;
  const equipX = panelX + padding + (contentWidth - equipRowWidth) / 2;
  const equipY = bagY + bagHeight + dividerHeight + labelHeight;
  const trashX = equipX + equipWidth + slotGap * 4;

  return {
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    padding,
    slotGap,
    slotSize,
    headerHeight,
    bagX,
    bagY,
    bagWidth,
    bagHeight,
    labelHeight,
    dividerY: bagY + bagHeight + dividerHeight / 2,
    equipX,
    equipY,
    equipSlotSize,
    equipGroupGap,
    equipWidth,
    trashX,
    trashY: equipY,
    trashSize,
    hintHeight,
    hintY: panelY + panelHeight - padding * 0.7,
    researchX,
    researchY,
    researchWidth: contentWidth,
    researchCardWidth,
    researchCardHeight,
    researchGap,
    researchHeight
  };
};

/** 背包格矩形 */
const H_getInventoryBagSlotRect = (
  layout: InventoryLayout,
  index: number
): { x: number; y: number; width: number; height: number } => {
  const col = index % INVENTORY_BAG_COLS;
  const row = Math.floor(index / INVENTORY_BAG_COLS);
  return {
    x: layout.bagX + col * (layout.slotSize + layout.slotGap),
    y: layout.bagY + row * (layout.slotSize + layout.slotGap),
    width: layout.slotSize,
    height: layout.slotSize
  };
};

/**
 * 技能装配槽矩形
 * 前 INVENTORY_INNATE_SKILL_SLOT_COUNT 格为固有技能槽,其余为拓展技能槽,
 * 固有段与拓展段之间插入 layout.equipGroupGap 的额外间距。
 */
const H_getInventoryEquipSlotRect = (
  layout: InventoryLayout,
  index: number
): { x: number; y: number; width: number; height: number } => {
  const stride = layout.equipSlotSize + layout.slotGap;
  const x = index < INVENTORY_INNATE_SKILL_SLOT_COUNT
    ? layout.equipX + index * stride
    : layout.equipX
      + INVENTORY_INNATE_SKILL_SLOT_COUNT * stride
      + layout.equipGroupGap
      + (index - INVENTORY_INNATE_SKILL_SLOT_COUNT) * stride;
  return {
    x,
    y: layout.equipY,
    width: layout.equipSlotSize,
    height: layout.equipSlotSize
  };
};

/** 垃圾桶矩形 */
const H_getInventoryTrashRect = (
  layout: InventoryLayout
): { x: number; y: number; width: number; height: number } => ({
  x: layout.trashX,
  y: layout.trashY,
  width: layout.trashSize,
  height: layout.trashSize
});

/**
 * 命中断言:返回指针所在的背包界面区域
 */
const H_hitTestInventorySlot = (
  layout: InventoryLayout,
  x: number,
  y: number,
  tolerance: number = 0
): InventorySlotTarget => {
  if (H_pointInRect(x, y, H_getInventoryTrashRect(layout), tolerance)) {
    return { zone: 'trash', index: -1 };
  }
  for (let i = 0; i < INVENTORY_EQUIP_COUNT; i++) {
    if (H_pointInRect(x, y, H_getInventoryEquipSlotRect(layout, i), tolerance)) {
      return { zone: 'equip', index: i };
    }
  }
  for (let i = 0; i < INVENTORY_BAG_SLOT_COUNT; i++) {
    if (H_pointInRect(x, y, H_getInventoryBagSlotRect(layout, i), tolerance)) {
      return { zone: 'bag', index: i };
    }
  }
  return null;
};

/**
 * 绘制背包格/技能槽的机械风格边框
 */
const H_drawInventorySlotFrame = (
  CtxUi: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  options: {
    accent?: string;
    hovered?: boolean;
    draggingOver?: boolean;
    invalid?: boolean;
    dashed?: boolean;
  } = {}
) => {
  const cut = Math.max(3, Math.min(rect.width, rect.height) * 0.22);
  const accent = options.invalid
    ? 'rgba(255, 90, 104, 0.9)'
    : options.accent ?? 'rgba(0, 229, 255, 0.8)';
  const highlight = options.hovered === true || options.draggingOver === true;

  CtxUi.save();
  createChamferRect(CtxUi, rect.x, rect.y, rect.width, rect.height, cut);
  const grad = CtxUi.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  grad.addColorStop(0, highlight ? 'rgba(0, 229, 255, 0.22)' : 'rgba(10, 30, 44, 0.5)');
  grad.addColorStop(1, 'rgba(4, 14, 24, 0.38)');
  CtxUi.fillStyle = grad;
  CtxUi.fill();

  if (options.dashed) {
    CtxUi.setLineDash([Math.max(2, rect.width * 0.09), Math.max(2, rect.width * 0.07)]);
  }
  CtxUi.strokeStyle = accent;
  CtxUi.lineWidth = highlight ? 1.6 : 1;
  if (highlight) {
    CtxUi.shadowColor = accent;
    CtxUi.shadowBlur = 10;
  }
  createChamferRect(CtxUi, rect.x + 0.6, rect.y + 0.6, rect.width - 1.2, rect.height - 1.2, cut);
  CtxUi.stroke();
  CtxUi.restore();
};

/**
 * 固有技能槽的展示定义(与底部状态栏前 2 格固定功能键逐一对应)
 * 数组下标即技能帖槽下标:下标 0 = 开火,下标 1 = 疾跑
 */
const INNATE_SKILL_SLOT_VIEWS = [
  { key: 'F', name: '开火', color: '#58d9ff' },
  { key: 'SHIFT', name: '疾跑', color: '#ffa94d' }
] as const;

/**
 * 绘制"固有技能槽"的锁定外观
 * 与可编辑的拓展技能槽形成明显区别:金色霓虹边框 + 暗金底色 + 斜向底纹 + 内侧细线。
 * @param dragOver 当前是否有拖拽条目悬停在本槽位上(悬停时整体转红,提示不可放置)
 */
const H_drawInventoryInnateSlotFrame = (
  CtxUi: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  dragOver: boolean
) => {
  const cut = Math.max(3, Math.min(rect.width, rect.height) * 0.22);
  const accent = dragOver ? 'rgba(255, 90, 104, 0.95)' : 'rgba(255, 208, 106, 0.92)';

  CtxUi.save();
  // 底板:暗金渐变(区别于拓展槽的青色玻璃)
  createChamferRect(CtxUi, rect.x, rect.y, rect.width, rect.height, cut);
  const grad = CtxUi.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  grad.addColorStop(0, dragOver ? 'rgba(70, 26, 26, 0.66)' : 'rgba(62, 48, 16, 0.62)');
  grad.addColorStop(1, dragOver ? 'rgba(30, 12, 12, 0.60)' : 'rgba(24, 19, 8, 0.58)');
  CtxUi.fillStyle = grad;
  CtxUi.fill();

  // 底纹:斜向条纹,表达"锁定 / 不可操作"
  CtxUi.save();
  createChamferRect(CtxUi, rect.x, rect.y, rect.width, rect.height, cut);
  CtxUi.clip();
  drawSlantedStripes(
    CtxUi,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    Math.max(6, rect.width * 0.24),
    dragOver ? 'rgba(255, 90, 104, 0.14)' : 'rgba(255, 208, 106, 0.13)'
  );
  CtxUi.restore();

  // 金色(或警示红)霓虹边框
  CtxUi.strokeStyle = accent;
  CtxUi.lineWidth = 1.6;
  CtxUi.shadowColor = accent;
  CtxUi.shadowBlur = 10;
  createChamferRect(CtxUi, rect.x + 0.7, rect.y + 0.7, rect.width - 1.4, rect.height - 1.4, cut);
  CtxUi.stroke();
  CtxUi.shadowBlur = 0;

  // 内侧细线
  CtxUi.strokeStyle = 'rgba(255, 236, 180, 0.26)';
  CtxUi.lineWidth = 1;
  createChamferRect(CtxUi, rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6, Math.max(2, cut - 2));
  CtxUi.stroke();
  CtxUi.restore();
};

/**
 * 绘制小锁图标(标识不可编辑的固有技能槽)
 */
const H_drawLockIcon = (
  CtxUi: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) => {
  const bodyW = size * 0.72;
  const bodyH = size * 0.56;
  const bodyY = cy + size * 0.06;
  CtxUi.save();
  CtxUi.strokeStyle = color;
  CtxUi.fillStyle = color;
  CtxUi.lineWidth = Math.max(1, size * 0.16);
  CtxUi.lineCap = 'round';
  // 锁梁
  CtxUi.beginPath();
  CtxUi.arc(cx, bodyY - bodyH * 0.04, bodyW * 0.33, Math.PI, 0);
  CtxUi.stroke();
  // 锁体
  createChamferRect(CtxUi, cx - bodyW / 2, bodyY, bodyW, bodyH, Math.max(1, size * 0.12));
  CtxUi.fill();
  CtxUi.restore();
};

/**
 * 绘制技能图标(贴图路径由技能只读属性 icon 指定,资源位于 resource/skill_icon,100px × 100px PNG)
 */
const H_drawInventorySkillIcon = (
  CtxUi: CanvasRenderingContext2D,
  skillTag: string,
  cx: number,
  cy: number,
  size: number,
  color: string
) => {
  const skill = H_getSkillByTag(skillTag);
  if (!skill) return;

  CtxUi.save();
  CtxUi.shadowColor = color;
  CtxUi.shadowBlur = size * 0.24;
  // 预留内边距,保持与物品图标一致的视觉占比
  H_drawSkillIconTexture(CtxUi, skill.icon, cx, cy, size * 0.74);
  CtxUi.restore();
};

/**
 * 绘制物品图标
 */
const H_drawInventoryItemIcon = (
  CtxUi: CanvasRenderingContext2D,
  icon: 'gem' | 'square',
  cx: number,
  cy: number,
  size: number,
  color: string
) => {
  CtxUi.save();
  CtxUi.shadowColor = color;
  CtxUi.shadowBlur = size * 0.3;
  CtxUi.fillStyle = color;

  if (icon === 'gem') {
    // 宝石:菱形切面 + 高光
    const radius = size * 0.32;
    CtxUi.beginPath();
    CtxUi.moveTo(cx, cy - radius);
    CtxUi.lineTo(cx + radius * 0.82, cy - radius * 0.12);
    CtxUi.lineTo(cx, cy + radius);
    CtxUi.lineTo(cx - radius * 0.82, cy - radius * 0.12);
    CtxUi.closePath();
    CtxUi.fill();
    CtxUi.fillStyle = 'rgba(255, 255, 255, 0.7)';
    CtxUi.beginPath();
    CtxUi.moveTo(cx, cy - radius);
    CtxUi.lineTo(cx + radius * 0.82, cy - radius * 0.12);
    CtxUi.lineTo(cx, cy - radius * 0.08);
    CtxUi.closePath();
    CtxUi.fill();
  } else {
    const half = size * 0.26;
    CtxUi.beginPath();
    CtxUi.rect(cx - half, cy - half, half * 2, half * 2);
    CtxUi.fill();
  }
  CtxUi.restore();
};

/**
 * 绘制背包条目内容(技能图标 / 物品图标 + 数量角标 + 可选名称)
 */
const H_drawInventoryEntryContent = (
  CtxUi: CanvasRenderingContext2D,
  entry: { kind: 'skill' | 'item'; tag: string; name: string; count: number; color: string },
  rect: { x: number; y: number; width: number; height: number },
  options: { alpha?: number; showName?: boolean } = {}
) => {
  const size = Math.min(rect.width, rect.height);
  const showName = options.showName === true;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2 - (showName ? size * 0.08 : 0);

  CtxUi.save();
  if (options.alpha !== undefined) CtxUi.globalAlpha = options.alpha;

  if (entry.kind === 'skill') {
    H_drawInventorySkillIcon(CtxUi, entry.tag, cx, cy, size, entry.color);
    if (showName) {
      CtxUi.fillStyle = 'rgba(224, 253, 255, 0.92)';
      CtxUi.font = `bold ${Math.max(9, size * 0.16)}px "Microsoft YaHei", Arial, sans-serif`;
      CtxUi.textAlign = 'center';
      CtxUi.textBaseline = 'middle';
      CtxUi.fillText(entry.name, cx, rect.y + rect.height - size * 0.15);
    }
  } else {
    H_drawInventoryItemIcon(CtxUi, H_getItemDefinition(entry.tag).icon, cx, cy, size, entry.color);
    if (entry.count > 1) {
      const text = `x${entry.count}`;
      CtxUi.font = `bold ${Math.max(9, size * 0.24)}px Consolas, "Courier New", monospace`;
      CtxUi.textAlign = 'right';
      CtxUi.textBaseline = 'alphabetic';
      CtxUi.lineWidth = 3;
      CtxUi.strokeStyle = 'rgba(2, 10, 18, 0.9)';
      CtxUi.strokeText(text, rect.x + rect.width - size * 0.06, rect.y + rect.height - size * 0.06);
      CtxUi.fillStyle = '#eafdff';
      CtxUi.fillText(text, rect.x + rect.width - size * 0.06, rect.y + rect.height - size * 0.06);
    }
  }
  CtxUi.restore();
};

/**
 * 绘制垃圾桶图标
 */
const H_drawInventoryTrashIcon = (
  CtxUi: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  hovered: boolean
) => {
  const size = Math.min(rect.width, rect.height);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const color = hovered ? '#ff9aa4' : 'rgba(255, 107, 120, 0.9)';
  const bodyW = size * 0.4;
  const bodyH = size * 0.44;
  const top = cy - bodyH * 0.34;

  CtxUi.save();
  CtxUi.strokeStyle = color;
  CtxUi.lineWidth = Math.max(1.2, size * 0.06);
  CtxUi.lineJoin = 'round';
  CtxUi.shadowColor = 'rgba(255, 90, 104, 0.8)';
  CtxUi.shadowBlur = hovered ? size * 0.45 : size * 0.2;

  // 桶身
  CtxUi.beginPath();
  CtxUi.moveTo(cx - bodyW / 2, top);
  CtxUi.lineTo(cx + bodyW / 2, top);
  CtxUi.lineTo(cx + bodyW * 0.36, top + bodyH);
  CtxUi.lineTo(cx - bodyW * 0.36, top + bodyH);
  CtxUi.closePath();
  CtxUi.stroke();
  // 桶盖
  CtxUi.beginPath();
  CtxUi.moveTo(cx - bodyW * 0.64, top);
  CtxUi.lineTo(cx + bodyW * 0.64, top);
  CtxUi.stroke();
  // 提手
  CtxUi.beginPath();
  CtxUi.moveTo(cx - bodyW * 0.2, top - size * 0.07);
  CtxUi.lineTo(cx + bodyW * 0.2, top - size * 0.07);
  CtxUi.stroke();
  // 桶身竖纹
  CtxUi.globalAlpha = 0.7;
  CtxUi.beginPath();
  CtxUi.moveTo(cx - bodyW * 0.13, top + bodyH * 0.18);
  CtxUi.lineTo(cx - bodyW * 0.13, top + bodyH * 0.8);
  CtxUi.moveTo(cx + bodyW * 0.13, top + bodyH * 0.18);
  CtxUi.lineTo(cx + bodyW * 0.13, top + bodyH * 0.8);
  CtxUi.stroke();
  CtxUi.restore();
};

/**
 * 绘制条目浮窗(名称/数量/说明)
 */
const H_drawInventoryTooltip = (
  CtxUi: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  anchorX: number,
  anchorY: number,
  title: string,
  subtitle: string,
  description: string,
  color: string
) => {
  const titleFont = 'bold 14px "Microsoft YaHei", Arial, sans-serif';
  const descFont = '12px "Microsoft YaHei", Arial, sans-serif';
  const padding = 10;

  CtxUi.save();
  CtxUi.font = titleFont;
  const titleWidth = CtxUi.measureText(title).width;
  CtxUi.font = descFont;
  const descWidth = CtxUi.measureText(description).width;
  const subtitleWidth = subtitle ? CtxUi.measureText(subtitle).width : 0;
  const boxWidth = Math.min(canvasWidth - 24, Math.max(titleWidth + subtitleWidth + 20, descWidth) + padding * 2);
  const boxHeight = description ? 62 : 40;

  let boxX = anchorX + 18;
  let boxY = anchorY + 16;
  if (boxX + boxWidth > canvasWidth - 12) boxX = anchorX - boxWidth - 18;
  if (boxY + boxHeight > canvasHeight - 12) boxY = anchorY - boxHeight - 16;
  boxX = Math.max(12, boxX);
  boxY = Math.max(12, boxY);

  createChamferRect(CtxUi, boxX, boxY, boxWidth, boxHeight, 8);
  const grad = CtxUi.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
  grad.addColorStop(0, 'rgba(10, 32, 46, 0.96)');
  grad.addColorStop(1, 'rgba(4, 14, 24, 0.94)');
  CtxUi.fillStyle = grad;
  CtxUi.shadowColor = `${color}88`;
  CtxUi.shadowBlur = 16;
  CtxUi.fill();
  CtxUi.shadowBlur = 0;
  CtxUi.strokeStyle = color;
  CtxUi.lineWidth = 1.2;
  createChamferRect(CtxUi, boxX + 0.6, boxY + 0.6, boxWidth - 1.2, boxHeight - 1.2, 8);
  CtxUi.stroke();

  CtxUi.textAlign = 'left';
  CtxUi.textBaseline = 'middle';
  CtxUi.font = titleFont;
  CtxUi.fillStyle = '#eafdff';
  CtxUi.fillText(title, boxX + padding, boxY + padding + 7);
  if (subtitle) {
    CtxUi.font = '11px Consolas, "Courier New", monospace';
    CtxUi.fillStyle = color;
    CtxUi.fillText(subtitle, boxX + padding + titleWidth + 10, boxY + padding + 8);
  }
  if (description) {
    CtxUi.font = descFont;
    CtxUi.fillStyle = 'rgba(170, 220, 240, 0.9)';
    CtxUi.fillText(description, boxX + padding, boxY + padding + 30);
  }
  CtxUi.restore();
};

/**
 * 发送背包状态同步指令
 */
const sendInventoryUpdate = (inventory: PlayerInventory) => {
  sendClientInstruct(Instruct.I_InventoryUpdate(playerEntity ? playerEntity.id : -1, inventory));
};

/**
 * 发送使用背包物品指令
 */
const sendInventoryUseItem = (uid: string) => {
  sendClientInstruct(Instruct.I_InventoryUseItem(playerEntity ? playerEntity.id : -1, uid));
};

/**
 * 打开/关闭背包界面
 */
const toggleInventory = (visible?: boolean) => {
  inventoryVisible = visible ?? !inventoryVisible;
  inventoryDragPayload = null;
  inventoryHoverTarget = null;
  inventoryTooltipEntry = null;
  inventoryTooltipSkillTag = '';
  inventoryTooltipInnateIndex = null;
  drawUI();
};

/**
 * 应用一次拖拽(或点击放置)结果
 * @returns 背包是否发生了变化
 */
const H_applyInventoryDrop = (payload: InventoryDragPayload, target: InventorySlotTarget): boolean => {
  const player = playerEntity;
  if (!player || !target) return false;
  // 固有技能槽禁止任何更改:既不能作为拖拽来源,也不能作为放置目标
  if (payload.fromZone === 'equip' && H_inventoryIsInnateSkillSlot(payload.fromIndex)) return false;
  if (target.zone === 'equip' && H_inventoryIsInnateSkillSlot(target.index)) return false;
  const inventory = H_ensurePlayerInventory(player.inventory);
  let changed = false;

  if (target.zone === 'trash') {
    // 垃圾桶:销毁
    changed = payload.fromZone === 'bag'
      ? H_inventoryDestroyEntry(inventory, payload.uid)
      : H_inventoryDestroyEquipped(inventory, payload.fromIndex);
  } else if (target.zone === 'equip') {
    // 物品不能装配到技能槽
    if (payload.kind === 'skill') {
      if (payload.fromZone === 'equip') {
        changed = H_inventoryMoveSkillSlot(inventory, payload.fromIndex, target.index);
      } else {
        changed = H_inventoryEquipSkill(inventory, payload.tag, target.index);
      }
    }
  } else if (target.zone === 'bag') {
    if (payload.fromZone === 'equip') {
      // 从技能槽放回背包:优先放入点击的格子,该格被占用时退回第一个空格
      changed = H_inventoryUnequipSkillToSlot(inventory, payload.fromIndex, target.index)
        || H_inventoryUnequipSkill(inventory, payload.fromIndex);
    } else {
      changed = H_inventoryMoveEntry(inventory, payload.fromIndex, target.index);
    }
  }

  if (changed) sendInventoryUpdate(inventory);
  return changed;
};

/**
 * 判断目标格是否与"拿起来源"是同一格
 */
const H_isSameInventorySlot = (payload: InventoryDragPayload, target: InventorySlotTarget): boolean => {
  if (!target) return false;
  if (target.zone === 'bag' && payload.fromZone === 'bag' && target.index === payload.fromIndex) return true;
  if (target.zone === 'equip' && payload.fromZone === 'equip' && target.index === payload.fromIndex) return true;
  return false;
};

/**
 * 在指定位置拿起一个条目(左键按下且手上没有条目时调用)
 */
const handleInventoryPickUp = (canvas: HTMLCanvasElement, x: number, y: number) => {
  if (!playerEntity) return;
  const { width, height } = H_getCanvasCssSize(canvas);
  const layout = H_getInventoryLayout(width, height);
  const inventory = H_ensurePlayerInventory(playerEntity.inventory);
  const target = H_hitTestInventorySlot(layout, x, y);
  if (!target) return;
  // 固有技能槽不可拿起(禁止拖拽/替换/卸下)
  if (target.zone === 'equip' && H_inventoryIsInnateSkillSlot(target.index)) return;

  if (target.zone === 'bag') {
    const entry = H_inventoryGetEntryAtSlot(inventory, target.index);
    if (entry === null) return;
    inventoryDragPayload = {
      kind: entry.kind,
      tag: entry.tag,
      name: entry.name,
      count: entry.count,
      color: entry.color,
      uid: entry.uid,
      fromZone: 'bag',
      fromIndex: target.index
    };
  } else if (target.zone === 'equip') {
    const tag = inventory.equippedSkills[target.index];
    if (tag === null) return;
    const skill = H_getSkillByTag(tag);
    inventoryDragPayload = {
      kind: 'skill',
      tag,
      name: skill?.name ?? tag,
      count: 1,
      color: skill?.color ?? '#9fe8ff',
      uid: '',
      fromZone: 'equip',
      fromIndex: target.index
    };
  }
};

/**
 * 背包界面下的鼠标左键按下处理
 * - 手上已有条目:点击目标格完成放置(再次点原格=放回)
 * - 手上没有条目:拿起该格的条目
 * @returns 是否已消费该事件
 */
const handleInventoryLeftDown = (canvas: HTMLCanvasElement, x: number, y: number): boolean => {
  if (!playerEntity) return false;
  const { width, height } = H_getCanvasCssSize(canvas);
  const layout = H_getInventoryLayout(width, height);
  const target = H_hitTestInventorySlot(layout, x, y);

  if (inventoryDragPayload) {
    const payload = inventoryDragPayload;
    // 点回原格:放回原处
    if (H_isSameInventorySlot(payload, target)) {
      inventoryDragPayload = null;
      return true;
    }
    // 点在面板空白处:保持拿起状态
    if (!target) return true;
    // 放置到目标格(目标不合法时保持拿起,例如把物品拖到技能槽)
    if (H_applyInventoryDrop(payload, target)) {
      inventoryDragPayload = null;
    }
    return true;
  }

  handleInventoryPickUp(canvas, x, y);
  return true;
};

/**
 * 背包界面下的鼠标右键处理
 * - 手上已有条目:取消拿起(放回原处)
 * - 背包物品:使用
 * - 背包技能:快捷装配到第一个空槽
 * - 技能槽:卸下回背包
 */
const handleInventoryRightDown = (canvas: HTMLCanvasElement, x: number, y: number) => {
  if (!playerEntity) return;
  // 取消拿起
  if (inventoryDragPayload) {
    inventoryDragPayload = null;
    drawUI();
    return;
  }

  const { width, height } = H_getCanvasCssSize(canvas);
  const layout = H_getInventoryLayout(width, height);
  const inventory = H_ensurePlayerInventory(playerEntity.inventory);
  const target = H_hitTestInventorySlot(layout, x, y);
  if (!target) return;
  // 固有技能槽不可卸下/销毁
  if (target.zone === 'equip' && H_inventoryIsInnateSkillSlot(target.index)) return;

  if (target.zone === 'bag') {
    const entry = H_inventoryGetEntryAtSlot(inventory, target.index);
    if (entry === null) return;
    if (entry.kind === 'item') {
      // 使用物品
      sendInventoryUseItem(entry.uid);
      return;
    }
    // 技能:快捷装配
    if (H_inventoryAutoEquipSkill(inventory, entry.tag) !== null) {
      sendInventoryUpdate(inventory);
    }
    drawUI();
    return;
  }

  if (target.zone === 'equip') {
    if (H_inventoryUnequipSkill(inventory, target.index)) {
      sendInventoryUpdate(inventory);
    }
    drawUI();
  }
};

/**
 * 背包界面下的鼠标抬起处理
 * - 拖动过(位移超过阈值):按落点结算移动/装配/销毁
 * - 未拖动(单击):保留"拿起"状态,等待点击目标格放置
 */
const handleInventoryMouseUp = (canvas: HTMLCanvasElement, x: number, y: number, moved: boolean) => {
  const payload = inventoryDragPayload;
  if (!payload) {
    drawUI();
    return;
  }
  // 单击:进入"拿起"状态(条目跟随光标,点击目标格即可放置)
  if (!moved) {
    drawUI();
    return;
  }

  const { width, height } = H_getCanvasCssSize(canvas);
  const layout = H_getInventoryLayout(width, height);
  const target = H_hitTestInventorySlot(layout, x, y, layout.slotGap);
  inventoryDragPayload = null;

  // 拖回原格或不合法落点:视为取消(不产生变化)
  if (H_isSameInventorySlot(payload, target)) {
    drawUI();
    return;
  }
  if (target) {
    H_applyInventoryDrop(payload, target);
  }
  drawUI();
};

/**
 * 绘制背包界面(UI层)
 */
/** 按最大宽度截断文本(超出时以省略号结尾) */
const H_fitText = (CtxUi: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (maxWidth <= 0) return '';
  if (CtxUi.measureText(text).width <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length > 1) {
    chars.pop();
    const candidate = `${chars.join('')}…`;
    if (CtxUi.measureText(candidate).width <= maxWidth) return candidate;
  }
  return '…';
};

/**
 * 绘制单个研究项卡片(背包界面上部的研究项展示区使用)。
 * 左:类别色图标 / 中:名称 + 实际属性加成 / 右上:等级(有上限时显示 当前/上限)。
 */
const H_drawInventoryResearchCard = (
  CtxUi: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  entry: { tag: string; level: number; value: number }
) => {
  const definition = H_getResearchDefinition(entry.tag);
  const legendary = definition?.category === 'legendary';
  const accent = legendary ? RESEARCH_LEGENDARY_COLOR : RESEARCH_NORMAL_COLOR;
  const cut = Math.max(3, Math.min(rect.width, rect.height) * 0.2);

  CtxUi.save();

  // 背板(切角 + 类别配色)
  createChamferRect(CtxUi, rect.x, rect.y, rect.width, rect.height, cut);
  const grad = CtxUi.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  grad.addColorStop(0, legendary ? 'rgba(58, 44, 16, 0.72)' : 'rgba(12, 32, 52, 0.72)');
  grad.addColorStop(1, legendary ? 'rgba(28, 20, 8, 0.6)' : 'rgba(6, 16, 28, 0.6)');
  CtxUi.fillStyle = grad;
  CtxUi.fill();
  CtxUi.strokeStyle = legendary ? 'rgba(255, 207, 77, 0.55)' : 'rgba(79, 168, 255, 0.5)';
  CtxUi.lineWidth = 1;
  createChamferRect(CtxUi, rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1, cut);
  CtxUi.stroke();

  // 左侧类别色条
  CtxUi.fillStyle = accent;
  CtxUi.globalAlpha = 0.9;
  CtxUi.fillRect(rect.x + 2, rect.y + cut * 0.6, 2, Math.max(4, rect.height - cut * 1.2));
  CtxUi.globalAlpha = 1;

  // 图标
  H_drawResearchGlyph(
    CtxUi,
    entry.tag,
    rect.x + rect.height * 0.44,
    rect.y + rect.height * 0.5,
    Math.min(rect.height * 0.66, rect.width * 0.26),
    accent
  );

  // 等级(右上角)
  CtxUi.textAlign = 'right';
  CtxUi.textBaseline = 'top';
  CtxUi.font = `bold ${Math.max(9, rect.height * 0.2)}px Consolas, "Courier New", monospace`;
  CtxUi.fillStyle = accent;
  const levelText = definition && definition.maxLevel !== null
    ? `Lv.${entry.level}/${definition.maxLevel}`
    : `Lv.${entry.level}`;
  CtxUi.fillText(levelText, rect.x + rect.width - 6, rect.y + 3);

  // 名称 + 实际属性加成
  const textX = rect.x + rect.height * 0.86;
  const textWidth = Math.max(0, rect.x + rect.width - 6 - textX);
  CtxUi.textAlign = 'left';
  CtxUi.textBaseline = 'middle';
  CtxUi.font = `bold ${Math.max(10, rect.height * 0.23)}px "Microsoft YaHei", Arial, sans-serif`;
  CtxUi.fillStyle = legendary ? '#ffe6a3' : '#dff0ff';
  CtxUi.fillText(
    H_fitText(CtxUi, definition?.name ?? entry.tag, textWidth),
    textX,
    rect.y + rect.height * 0.36
  );

  CtxUi.font = `${Math.max(9, rect.height * 0.19)}px "Microsoft YaHei", Arial, sans-serif`;
  CtxUi.fillStyle = 'rgba(196, 214, 230, 0.92)';
  // 不动堡垒额外展示"当前剩余 / 该等级上限"的实际状态
  const effectText = entry.tag === 'immovable_fortress'
    ? `剩余 ${Math.round(Math.max(0, entry.value))} / ${Math.round(RESEARCH_FORTRESS_ABSORB_PER_LEVEL * entry.level)}`
    : H_getResearchEffectText(entry.tag, entry.level);
  CtxUi.fillText(H_fitText(CtxUi, effectText, textWidth), textX, rect.y + rect.height * 0.7);

  CtxUi.restore();
};

const drawInventoryPanel = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  // 玩家死亡时自动关闭背包(玩家尚未同步到本地时不关闭,否则首帧会被误关)
  if (inventoryVisible && playerEntity && (playerEntity.isDead || playerEntity.health <= 0)) {
    inventoryVisible = false;
    inventoryDragPayload = null;
    inventoryHoverTarget = null;
  }
  if (!inventoryVisible || !playerEntity) return;

  const { width, height } = H_getCanvasCssSize(CANVAS);
  const layout = H_getInventoryLayout(width, height);
  const inventory = H_ensurePlayerInventory(playerEntity.inventory);
  const time = performance.now() / 1000;
  const cut = H_clamp(layout.panelHeight * 0.026, 6, 14);
  const panelRight = layout.panelX + layout.panelWidth;
  const panelBottom = layout.panelY + layout.panelHeight;

  // 命中目标(拖拽时使用指针位置,否则使用鼠标位置)
  inventoryHoverTarget = inventoryDragPayload
    ? H_hitTestInventorySlot(layout, inventoryPointerX, inventoryPointerY, layout.slotGap)
    : H_hitTestInventorySlot(layout, mouseX, mouseY);

  CtxUi.save();
  CtxUi.textAlign = 'left';
  CtxUi.textBaseline = 'middle';

  // 全屏遮罩
  CtxUi.fillStyle = 'rgba(2, 6, 12, 0.42)';
  CtxUi.fillRect(0, 0, width, height);

  // ---- 面板主体:半透明玻璃 ----
  createChamferRect(CtxUi, layout.panelX, layout.panelY, layout.panelWidth, layout.panelHeight, cut);
  const panelGrad = CtxUi.createLinearGradient(layout.panelX, layout.panelY, layout.panelX, panelBottom);
  panelGrad.addColorStop(0, 'rgba(14, 40, 60, 0.86)');
  panelGrad.addColorStop(0.5, 'rgba(7, 22, 34, 0.74)');
  panelGrad.addColorStop(1, 'rgba(3, 10, 18, 0.68)');
  CtxUi.fillStyle = panelGrad;
  CtxUi.fill();

  // 扫描线纹理 + 移动光带(裁剪在面板内)
  CtxUi.save();
  createChamferRect(CtxUi, layout.panelX, layout.panelY, layout.panelWidth, layout.panelHeight, cut);
  CtxUi.clip();
  CtxUi.fillStyle = 'rgba(120, 235, 255, 0.045)';
  const scanStep = Math.max(3, layout.panelHeight / 56);
  for (let ly = layout.panelY + scanStep; ly < panelBottom; ly += scanStep) {
    CtxUi.fillRect(layout.panelX, Math.round(ly), layout.panelWidth, 1);
  }
  const sweepH = layout.panelHeight * 0.16;
  const sweepY = layout.panelY + ((time * 0.2) % 1) * (layout.panelHeight + sweepH) - sweepH;
  const sweepGrad = CtxUi.createLinearGradient(0, sweepY, 0, sweepY + sweepH);
  sweepGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
  sweepGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.06)');
  sweepGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
  CtxUi.fillStyle = sweepGrad;
  CtxUi.fillRect(layout.panelX, sweepY, layout.panelWidth, sweepH);
  CtxUi.restore();

  // ---- 霓虹边框 + 内侧细线 + 四角支架 ----
  CtxUi.save();
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.5)';
  CtxUi.shadowBlur = 14;
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.85)';
  CtxUi.lineWidth = 1.6;
  createChamferRect(CtxUi, layout.panelX + 0.8, layout.panelY + 0.8, layout.panelWidth - 1.6, layout.panelHeight - 1.6, cut);
  CtxUi.stroke();
  CtxUi.restore();
  CtxUi.strokeStyle = 'rgba(150, 245, 255, 0.22)';
  CtxUi.lineWidth = 1;
  createChamferRect(CtxUi, layout.panelX + 4, layout.panelY + 4, layout.panelWidth - 8, layout.panelHeight - 8, Math.max(2, cut - 2));
  CtxUi.stroke();
  drawHudCornerBrackets(
    CtxUi,
    layout.panelX,
    layout.panelY,
    layout.panelWidth,
    layout.panelHeight,
    Math.max(12, layout.panelHeight * 0.055),
    'rgba(0, 229, 255, 0.9)'
  );

  // ---- 标题栏 ----
  const headerCenterY = layout.panelY + layout.padding + layout.headerHeight / 2;
  CtxUi.font = `bold ${Math.max(14, layout.slotSize * 0.32)}px "Microsoft YaHei", Arial, sans-serif`;
  CtxUi.fillStyle = '#eafdff';
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.8)';
  CtxUi.shadowBlur = 10;
  CtxUi.fillText('背包', layout.panelX + layout.padding, headerCenterY);
  CtxUi.shadowBlur = 0;
  const titleWidth = CtxUi.measureText('背包').width;
  CtxUi.font = `${Math.max(10, layout.slotSize * 0.19)}px Consolas, "Courier New", monospace`;
  CtxUi.fillStyle = 'rgba(122, 214, 240, 0.85)';
  CtxUi.fillText('INVENTORY', layout.panelX + layout.padding + titleWidth + 10, headerCenterY + 1);
  CtxUi.textAlign = 'right';
  CtxUi.fillStyle = 'rgba(0, 229, 255, 0.85)';
  CtxUi.fillText('E / ESC 关闭', panelRight - layout.padding, headerCenterY);
  CtxUi.textAlign = 'left';

  // 标题下分割线
  const headerLineY = layout.panelY + layout.padding + layout.headerHeight;
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.28)';
  CtxUi.lineWidth = 1;
  CtxUi.beginPath();
  CtxUi.moveTo(layout.panelX + layout.padding, headerLineY);
  CtxUi.lineTo(panelRight - layout.padding, headerLineY);
  CtxUi.stroke();

  // ---- 研究项展示区(利用缩小的背包腾出的上部分空间) ----
  const researchEntries = Array.isArray(playerEntity.research)
    ? playerEntity.research.filter((entry) => entry !== null && typeof entry.tag === 'string')
    : [];
  const researchLabelFontSize = Math.max(11, layout.slotSize * 0.22);
  const researchLabelY = layout.researchY - layout.labelHeight / 2;
  CtxUi.font = `bold ${researchLabelFontSize}px "Microsoft YaHei", Arial, sans-serif`;
  CtxUi.fillStyle = 'rgba(224, 253, 255, 0.92)';
  CtxUi.fillText('专研', layout.panelX + layout.padding, researchLabelY);
  const researchTitleWidth = CtxUi.measureText('专研').width;
  CtxUi.font = `${Math.max(10, layout.slotSize * 0.19)}px Consolas, "Courier New", monospace`;
  CtxUi.fillStyle = 'rgba(122, 214, 240, 0.8)';
  CtxUi.fillText(
    researchEntries.length > 0 ? `${researchEntries.length} 项已研究` : 'RESEARCH',
    layout.panelX + layout.padding + researchTitleWidth + 12,
    researchLabelY + 1
  );

  if (researchEntries.length === 0) {
    // 尚未获得任何研究项:显示占位提示
    const placeholder = {
      x: layout.researchX,
      y: layout.researchY,
      width: layout.researchWidth,
      height: layout.researchHeight
    };
    CtxUi.save();
    CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.18)';
    CtxUi.lineWidth = 1;
    CtxUi.setLineDash([6, 6]);
    createChamferRect(CtxUi, placeholder.x, placeholder.y, placeholder.width, placeholder.height, 6);
    CtxUi.stroke();
    CtxUi.setLineDash([]);
    CtxUi.font = `${Math.max(10, layout.slotSize * 0.2)}px "Microsoft YaHei", Arial, sans-serif`;
    CtxUi.fillStyle = 'rgba(140, 190, 215, 0.75)';
    CtxUi.textAlign = 'center';
    CtxUi.fillText(
      '暂无研究项',
      placeholder.x + placeholder.width / 2,
      placeholder.y + placeholder.height / 2
    );
    CtxUi.textAlign = 'left';
    CtxUi.restore();
  } else {
    const maxResearchCards = INVENTORY_RESEARCH_COLUMNS * INVENTORY_RESEARCH_MAX_ROWS;
    for (let i = 0; i < researchEntries.length && i < maxResearchCards; i++) {
      const col = i % INVENTORY_RESEARCH_COLUMNS;
      const row = Math.floor(i / INVENTORY_RESEARCH_COLUMNS);
      H_drawInventoryResearchCard(
        CtxUi,
        {
          x: layout.researchX + col * (layout.researchCardWidth + layout.researchGap),
          y: layout.researchY + row * (layout.researchCardHeight + layout.researchGap),
          width: layout.researchCardWidth,
          height: layout.researchCardHeight
        },
        researchEntries[i]
      );
    }
  }

  // ---- 持有物标签 ----
  const labelFontSize = Math.max(11, layout.slotSize * 0.22);
  CtxUi.font = `bold ${labelFontSize}px "Microsoft YaHei", Arial, sans-serif`;
  CtxUi.fillStyle = 'rgba(224, 253, 255, 0.92)';
  CtxUi.fillText('容量', layout.panelX + layout.padding, layout.bagY - layout.labelHeight / 2);
  const bagLabelWidth = CtxUi.measureText('容量').width;
  CtxUi.font = `${Math.max(10, layout.slotSize * 0.19)}px Consolas, "Courier New", monospace`;
  CtxUi.fillStyle = 'rgba(122, 214, 240, 0.8)';
  CtxUi.fillText(
    `${H_inventoryUsedSlotCount(inventory)} / ${INVENTORY_BAG_CAPACITY}`,
    layout.panelX + layout.padding + bagLabelWidth + 12,
    layout.bagY - layout.labelHeight / 2 + 1
  );

  // ---- 背包格 ----
  for (let i = 0; i < INVENTORY_BAG_SLOT_COUNT; i++) {
    const rect = H_getInventoryBagSlotRect(layout, i);
    const entry = H_inventoryGetEntryAtSlot(inventory, i);
    const isTarget = inventoryHoverTarget?.zone === 'bag' && inventoryHoverTarget.index === i;
    const hovered = isTarget && inventoryDragPayload === null;
    const draggingOver = isTarget && inventoryDragPayload !== null;
    // 该格是当前“拿起”的来源:淡化显示,表示条目已跟随光标
    const held = inventoryDragPayload !== null
      && inventoryDragPayload.fromZone === 'bag'
      && inventoryDragPayload.fromIndex === i;
    H_drawInventorySlotFrame(CtxUi, rect, {
      accent: entry ? `${entry.color}cc` : 'rgba(0, 229, 255, 0.2)',
      hovered,
      draggingOver,
      dashed: !entry
    });
    if (entry) {
      H_drawInventoryEntryContent(CtxUi, entry, rect, {
        showName: entry.kind === 'skill',
        alpha: held ? 0.25 : 1
      });
    }
  }

  // ---- 分割线 ----
  CtxUi.save();
  CtxUi.strokeStyle = 'rgba(0, 229, 255, 0.3)';
  CtxUi.lineWidth = 1;
  CtxUi.beginPath();
  CtxUi.moveTo(layout.panelX + layout.padding, layout.dividerY);
  CtxUi.lineTo(panelRight - layout.padding, layout.dividerY);
  CtxUi.stroke();
  // 中部分割菱形
  const dividerSize = Math.max(4, layout.slotSize * 0.11);
  CtxUi.fillStyle = 'rgba(0, 229, 255, 0.9)';
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.8)';
  CtxUi.shadowBlur = 8;
  CtxUi.beginPath();
  CtxUi.moveTo(width / 2, layout.dividerY - dividerSize);
  CtxUi.lineTo(width / 2 + dividerSize, layout.dividerY);
  CtxUi.lineTo(width / 2, layout.dividerY + dividerSize);
  CtxUi.lineTo(width / 2 - dividerSize, layout.dividerY);
  CtxUi.closePath();
  CtxUi.fill();
  CtxUi.restore();

  // ---- 技能装配区标签 ----
  CtxUi.font = `bold ${labelFontSize}px "Microsoft YaHei", Arial, sans-serif`;
  CtxUi.fillStyle = 'rgba(224, 253, 255, 0.92)';
  CtxUi.fillText('技能装配区', layout.panelX + layout.padding, layout.equipY - layout.labelHeight / 2);
  // const equipLabelWidth = CtxUi.measureText('技能装配区').width;
  // CtxUi.font = `${Math.max(10, layout.slotSize * 0.19)}px "Microsoft YaHei", Arial, sans-serif`;
  // CtxUi.fillStyle = 'rgba(122, 214, 240, 0.8)';
  // CtxUi.fillText(
  //   '拖拽调整顺序 · 拖回上方卸下 · 拖入垃圾桶销毁',
  //   layout.panelX + layout.padding + equipLabelWidth + 14,
  //   layout.equipY - layout.labelHeight / 2 + 1
  // );

  // ---- 技能槽:前 2 格固有(锁定,不可编辑)/ 后 8 格拓展(可拖动/替换/排序) ----
  const equippedTags = inventory.equippedSkills;
  for (let i = 0; i < INVENTORY_EQUIP_COUNT; i++) {
    const rect = H_getInventoryEquipSlotRect(layout, i);
    const isTarget = inventoryHoverTarget?.zone === 'equip' && inventoryHoverTarget.index === i;
    const hovered = isTarget && inventoryDragPayload === null;
    const draggingOver = isTarget && inventoryDragPayload !== null;

    // ---- 固有技能槽:内容固定,不注册任何事件区域(不可拿起/卸下/销毁) ----
    if (H_inventoryIsInnateSkillSlot(i)) {
      const view = INNATE_SKILL_SLOT_VIEWS[i];
      H_drawInventoryInnateSlotFrame(CtxUi, rect, draggingOver);
      if (view) {
        H_drawFixedFunctionIcon(
          CtxUi,
          view.key,
          rect.x + rect.width / 2,
          rect.y + rect.height * 0.4,
          layout.equipSlotSize * 0.52,
          `${view.color}e6`,
          null,
          Math.max(1, rect.width * 0.06)
        );
        // 能力名
        CtxUi.font = `bold ${Math.max(9, layout.equipSlotSize * 0.2)}px "Microsoft YaHei", Arial, sans-serif`;
        CtxUi.textAlign = 'center';
        CtxUi.textBaseline = 'middle';
        CtxUi.fillStyle = 'rgba(255, 240, 205, 0.92)';
        CtxUi.fillText(view.name, rect.x + rect.width / 2, rect.y + rect.height * 0.76);
        // 锁定图标(右上角)
        H_drawLockIcon(
          CtxUi,
          rect.x + rect.width - layout.equipSlotSize * 0.19,
          rect.y + layout.equipSlotSize * 0.2,
          layout.equipSlotSize * 0.24,
          'rgba(255, 214, 120, 0.95)'
        );
        // 悬停时给出"不可更改"提示
        if (hovered) {
          CtxUi.save();
          CtxUi.font = `${Math.max(9, layout.equipSlotSize * 0.18)}px "Microsoft YaHei", Arial, sans-serif`;
          CtxUi.textAlign = 'center';
          CtxUi.textBaseline = 'middle';
          CtxUi.fillStyle = 'rgba(255, 214, 120, 0.98)';
          CtxUi.shadowColor = 'rgba(255, 208, 106, 0.85)';
          CtxUi.shadowBlur = 8;
          CtxUi.fillText('不可更改', rect.x + rect.width / 2, rect.y - layout.equipSlotSize * 0.16);
          CtxUi.restore();
        }
      }
      continue;
    }

    // ---- 拓展技能槽:可移动/替换/排序 ----
    const tag = equippedTags[i];
    const skill = tag ? H_getSkillByTag(tag) : null;
    const invalid = draggingOver && inventoryDragPayload !== null && inventoryDragPayload.kind !== 'skill';

    H_drawInventorySlotFrame(CtxUi, rect, {
      accent: skill ? `${skill.color}cc` : 'rgba(0, 229, 255, 0.22)',
      hovered,
      draggingOver,
      invalid,
      dashed: !skill
    });

    // 槽位序号
    CtxUi.font = `${Math.max(8, layout.equipSlotSize * 0.2)}px Consolas, "Courier New", monospace`;
    CtxUi.fillStyle = 'rgba(120, 190, 215, 0.65)';
    CtxUi.textAlign = 'left';
    CtxUi.textBaseline = 'top';
    CtxUi.fillText(`${i + 1}`, rect.x + layout.equipSlotSize * 0.09, rect.y + layout.equipSlotSize * 0.07);
    CtxUi.textBaseline = 'middle';

    if (skill && tag) {
      const heldFromEquip = inventoryDragPayload !== null
        && inventoryDragPayload.fromZone === 'equip'
        && inventoryDragPayload.fromIndex === i;
      H_drawInventoryEntryContent(
        CtxUi,
        { kind: 'skill', tag, name: skill.name, count: 1, color: skill.color },
        rect,
        { showName: true, alpha: heldFromEquip ? 0.25 : 1 }
      );
    }
  }

  // ---- 分组说明:固有技能槽(锁定) / 拓展技能槽(可调整) ----
  const innateFirst = H_getInventoryEquipSlotRect(layout, 0);
  const innateLast = H_getInventoryEquipSlotRect(layout, INVENTORY_INNATE_SKILL_SLOT_COUNT - 1);
  const extendedFirst = H_getInventoryEquipSlotRect(layout, INVENTORY_INNATE_SKILL_SLOT_COUNT);
  const extendedLast = H_getInventoryEquipSlotRect(layout, INVENTORY_EQUIP_COUNT - 1);
  const captionY = layout.equipY + layout.equipSlotSize + layout.hintHeight * 0.55;
  /** 以最大可用宽度自动缩小字号后居中绘制说明文案(窄屏下不溢出到相邻分组) */
  const drawGroupCaption = (text: string, centerX: number, maxWidth: number, color: string) => {
    let fontSize = Math.max(9, layout.equipSlotSize * 0.19);
    CtxUi.font = `${fontSize}px "Microsoft YaHei", Arial, sans-serif`;
    while (fontSize > 8 && CtxUi.measureText(text).width > maxWidth) {
      fontSize -= 0.5;
      CtxUi.font = `${fontSize}px "Microsoft YaHei", Arial, sans-serif`;
    }
    CtxUi.fillStyle = color;
    CtxUi.fillText(text, centerX, captionY);
  };
  CtxUi.textAlign = 'center';
  CtxUi.textBaseline = 'middle';
  drawGroupCaption(
    '固有技能',
    (innateFirst.x + innateLast.x + innateLast.width) / 2,
    innateLast.x + innateLast.width - innateFirst.x + layout.equipGroupGap,
    'rgba(255, 214, 120, 0.9)'
  );
  CtxUi.textAlign = 'left';

  // ---- 垃圾桶 ----
  const trashRect = H_getInventoryTrashRect(layout);
  const trashTarget = inventoryHoverTarget?.zone === 'trash';
  H_drawInventorySlotFrame(CtxUi, trashRect, {
    accent: 'rgba(255, 90, 104, 0.85)',
    hovered: trashTarget && inventoryDragPayload === null,
    draggingOver: trashTarget && inventoryDragPayload !== null,
    dashed: true
  });
  H_drawInventoryTrashIcon(CtxUi, trashRect, trashTarget);

  // ---- 底部操作提示 ----
  // CtxUi.font = `${Math.max(10, layout.slotSize * 0.2)}px "Microsoft YaHei", Arial, sans-serif`;
  // CtxUi.fillStyle = 'rgba(150, 214, 235, 0.85)';
  // CtxUi.textAlign = 'center';
  // CtxUi.fillText(
  //   '左键点击/拖拽:拿起并放置　·　右键:使用物品 / 装配·卸下技能　·　拖入垃圾桶:销毁',
  //   width / 2,
  //   layout.hintY
  // );
  // CtxUi.textAlign = 'left';

  // ---- 悬停浮窗 ----
  inventoryTooltipEntry = null;
  inventoryTooltipSkillTag = '';
  inventoryTooltipInnateIndex = null;
  if (inventoryDragPayload === null && inventoryHoverTarget) {
    if (inventoryHoverTarget.zone === 'bag') {
      inventoryTooltipEntry = inventory.entries[inventoryHoverTarget.index] ?? null;
    } else if (inventoryHoverTarget.zone === 'equip') {
      if (H_inventoryIsInnateSkillSlot(inventoryHoverTarget.index)) {
        inventoryTooltipInnateIndex = inventoryHoverTarget.index;
      } else {
        inventoryTooltipSkillTag = equippedTags[inventoryHoverTarget.index] ?? '';
      }
    }
  }

  if (inventoryTooltipEntry) {
    const entry = inventoryTooltipEntry;
    if (entry.kind === 'skill') {
      const skill = H_getSkillByTag(entry.tag);
      H_drawInventoryTooltip(
        CtxUi,
        width,
        height,
        mouseX,
        mouseY,
        entry.name,
        '技能',
        skill?.description ?? '',
        entry.color
      );
    } else {
      const definition = H_getItemDefinition(entry.tag);
      H_drawInventoryTooltip(
        CtxUi,
        width,
        height,
        mouseX,
        mouseY,
        entry.name,
        `x${entry.count}`,
        definition.description,
        entry.color
      );
    }
  } else if (inventoryTooltipSkillTag) {
    const skill = H_getSkillByTag(inventoryTooltipSkillTag);
    H_drawInventoryTooltip(
      CtxUi,
      width,
      height,
      mouseX,
      mouseY,
      skill?.name ?? inventoryTooltipSkillTag,
      '已装配',
      skill?.description ?? '',
      skill?.color ?? '#9fe8ff'
    );
  } else if (inventoryTooltipInnateIndex !== null) {
    const view = INNATE_SKILL_SLOT_VIEWS[inventoryTooltipInnateIndex];
    H_drawInventoryTooltip(
      CtxUi,
      width,
      height,
      mouseX,
      mouseY,
      view?.name ?? '固有技能',
      '固有技能槽',
      '固定能力,不可移动、替换、卸下或更改',
      view?.color ?? '#ffd96a'
    );
  }

  // ---- 拖拽中的条目 ----
  if (inventoryDragPayload) {
    const ghostSize = layout.slotSize;
    const ghostRect = {
      x: inventoryPointerX - ghostSize / 2,
      y: inventoryPointerY - ghostSize / 2,
      width: ghostSize,
      height: ghostSize
    };
    H_drawInventorySlotFrame(CtxUi, ghostRect, {
      accent: `${inventoryDragPayload.color}dd`,
      hovered: true
    });
    H_drawInventoryEntryContent(
      CtxUi,
      {
        kind: inventoryDragPayload.kind,
        tag: inventoryDragPayload.tag,
        name: inventoryDragPayload.name,
        count: inventoryDragPayload.count,
        color: inventoryDragPayload.color
      },
      ghostRect,
      { alpha: 0.92 }
    );
  }

  CtxUi.restore();
};

/**
 * 检测玩家新获得的技能并给出飘字提示
 */
const H_notifyNewlyAcquiredSkills = () => {
  const currentTags = new Set<string>();
  if (playerEntity) {
    const inventory = H_ensurePlayerInventory(playerEntity.inventory);
    for (const entry of inventory.entries) {
      if (entry !== null && entry.kind === 'skill') currentTags.add(entry.tag);
    }
    for (const tag of inventory.equippedSkills) {
      if (tag) currentTags.add(tag);
    }
    for (const tag of currentTags) {
      if (prevOwnedSkillTags.has(tag)) continue;
      const skill = H_getSkillByTag(tag);
      numericalManager.addNumber(
        `获得技能:${skill?.name ?? tag}`,
        playerEntity.position.x,
        playerEntity.position.y + 20,
        skill?.color ?? '#9fe8ff'
      );
    }
  }
  prevOwnedSkillTags = currentTags;
};

////////////////////
// <-- 背包界面相关
////////////////////

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
      entity.draw(ctxEntity, worldToScreen, canvasSize, H_getNpcDebugFlags(entity));
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
  // 绘制经验球
  for (const entity of expOrbEntityList) {
   
  // 绘制技能球
  for (const entity of skillOrbEntityList) {
    if (entity.isInViewport(worldToScreen, canvasSize, margin)) {
      entity.draw(ctxEntity, worldToScreen, canvasSize, entityDebugFlags);
    }
  } if (entity.isInViewport(worldToScreen, canvasSize, margin)) {
      entity.draw(ctxEntity, worldToScreen, canvasSize, entityDebugFlags);
    }
  }
  // 绘制其他玩家(多人模式;玩家本人由下方单独绘制,以支持"死亡后不渲染")
  for (const entity of otherPlayerEntityList) {
    if (entity.isDead) continue;
    if (!entity.isInViewport(worldToScreen, canvasSize, margin)) continue;
    entity.draw(ctxEntity, worldToScreen, canvasSize, undefined);
    // 橙色外框用于区分其他玩家与自己(按身体渲染尺寸描边,而非碰撞体积)
    const screenPos = worldToScreen(entity.position.x, entity.position.y);
    ctxEntity.save();
    ctxEntity.strokeStyle = 'rgba(255, 170, 0, 0.9)';
    ctxEntity.lineWidth = 2;
    ctxEntity.strokeRect(
      screenPos.x - entity.renderWidth / 2 - 1.5,
      screenPos.y - entity.renderHeight / 2 - 1.5,
      entity.renderWidth + 3,
      entity.renderHeight + 3
    );
    ctxEntity.restore();
  }

  // 绘制玩家实体(死亡后不渲染,等待重生)
  if (playerEntity && !playerEntity.isDead) {
    if (playerEntity.isInViewport(worldToScreen, canvasSize, margin)) {
      playerEntity.draw(ctxEntity, worldToScreen, canvasSize, entityDebugFlags);
    }
  }
};

/**
 * 绘制重生界面按钮
 */
////////////////////
// 专研(Research)界面 -->
////////////////////

/** 专研界面是否处于活动状态(有待选项或正在播放动画) */
const H_isResearchOverlayActive = (): boolean => {
  return researchUiPhase !== 'idle' || researchUiOptions.length > 0;
};

/** 绘制专研研究项的矢量图标(不依赖外部贴图),以 (cx,cy) 为中心、size 为整体尺寸 */
const H_drawResearchGlyph = (
  ctx: CanvasRenderingContext2D,
  tag: string,
  cx: number,
  cy: number,
  size: number,
  color: string
) => {
  const s = size;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (tag) {
    case 'move_speed': {
      for (let i = 0; i < 3; i++) {
        const x = cx - s * 0.36 + i * s * 0.32;
        ctx.beginPath();
        ctx.moveTo(x, cy - s * 0.32);
        ctx.lineTo(x + s * 0.22, cy);
        ctx.lineTo(x, cy + s * 0.32);
        ctx.stroke();
      }
      break;
    }
    case 'fire_rate': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.42, cy);
      ctx.lineTo(cx + s * 0.24, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.22, cy - s * 0.2);
      ctx.lineTo(cx + s * 0.44, cy);
      ctx.lineTo(cx + s * 0.22, cy + s * 0.2);
      ctx.closePath();
      ctx.fill();
      for (let i = -1; i <= 1; i++) {
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.42, cy + i * s * 0.24);
        ctx.lineTo(cx - s * 0.16, cy + i * s * 0.24);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'cooldown': {
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - s * 0.24);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + s * 0.2, cy + s * 0.08);
      ctx.stroke();
      break;
    }
    case 'stamina': {
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.12, cy - s * 0.42);
      ctx.lineTo(cx - s * 0.24, cy + s * 0.06);
      ctx.lineTo(cx + s * 0.02, cy + s * 0.06);
      ctx.lineTo(cx - s * 0.12, cy + s * 0.42);
      ctx.lineTo(cx + s * 0.26, cy - s * 0.08);
      ctx.lineTo(cx, cy - s * 0.08);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'health': {
      const arm = s * 0.15;
      const len = s * 0.42;
      ctx.fillRect(cx - arm, cy - len, arm * 2, len * 2);
      ctx.fillRect(cx - len, cy - arm, len * 2, arm * 2);
      break;
    }
    case 'death_keep': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.42);
      ctx.lineTo(cx + s * 0.34, cy - s * 0.26);
      ctx.lineTo(cx + s * 0.34, cy + s * 0.06);
      ctx.quadraticCurveTo(cx + s * 0.34, cy + s * 0.34, cx, cy + s * 0.44);
      ctx.quadraticCurveTo(cx - s * 0.34, cy + s * 0.34, cx - s * 0.34, cy + s * 0.06);
      ctx.lineTo(cx - s * 0.34, cy - s * 0.26);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'immovable_fortress': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.4, cy + s * 0.34);
      ctx.lineTo(cx - s * 0.4, cy - s * 0.08);
      ctx.lineTo(cx - s * 0.24, cy - s * 0.08);
      ctx.lineTo(cx - s * 0.24, cy - s * 0.34);
      ctx.lineTo(cx - s * 0.06, cy - s * 0.34);
      ctx.lineTo(cx - s * 0.06, cy - s * 0.08);
      ctx.lineTo(cx + s * 0.06, cy - s * 0.08);
      ctx.lineTo(cx + s * 0.06, cy - s * 0.34);
      ctx.lineTo(cx + s * 0.24, cy - s * 0.34);
      ctx.lineTo(cx + s * 0.24, cy - s * 0.08);
      ctx.lineTo(cx + s * 0.4, cy - s * 0.08);
      ctx.lineTo(cx + s * 0.4, cy + s * 0.34);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'lucky_star': {
      const points = 5;
      const outer = s * 0.44;
      const inner = outer * 0.44;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = -Math.PI / 2 + (i * Math.PI) / points;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.36, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
};

/** 按字符自动换行绘制文本(适配中文),返回下一行 y 坐标 */
const H_drawWrappedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number => {
  const chars = Array.from(text);
  let line = '';
  let drawn = 0;
  let cursorY = y;
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      if (drawn >= maxLines) break;
      ctx.fillText(line, x, cursorY);
      drawn++;
      cursorY += lineHeight;
      line = chars[i];
    } else {
      line = test;
    }
  }
  if (line.length > 0 && drawn < maxLines) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
};

/** 绘制单个专研候选卡片(顶部小卡片样式:左侧图标 + 右侧名称/说明/效果) */
const H_drawResearchCard = (
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  tag: string,
  alpha: number,
  selected: boolean,
  hovered: boolean,
  pulse: number
) => {
  const def = H_getResearchDefinition(tag);
  if (!def) return;
  const legendary = def.category === 'legendary';
  const accent = legendary ? RESEARCH_LEGENDARY_COLOR : RESEARCH_NORMAL_COLOR;
  const currentLevel = playerEntity ? H_getResearchLevel(playerEntity.research, tag) : 0;

  ctx.save();
  ctx.globalAlpha = alpha;

  // 背板
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  if (legendary) {
    grad.addColorStop(0, 'rgba(48, 36, 12, 0.94)');
    grad.addColorStop(1, 'rgba(22, 16, 6, 0.94)');
  } else {
    grad.addColorStop(0, 'rgba(10, 26, 44, 0.94)');
    grad.addColorStop(1, 'rgba(6, 14, 26, 0.94)');
  }
  ctx.shadowColor = accent;
  ctx.shadowBlur = selected ? 26 : (hovered ? 16 : 8) * (0.7 + pulse * 0.3);
  ctx.fillStyle = grad;
  createChamferRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 斜纹质感
  ctx.save();
  createChamferRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
  ctx.clip();
  drawSlantedStripes(
    ctx,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    12,
    legendary ? 'rgba(255, 207, 77, 0.06)' : 'rgba(79, 168, 255, 0.06)'
  );
  ctx.restore();

  // 描边
  ctx.strokeStyle = selected ? accent : (legendary ? 'rgba(255, 207, 77, 0.55)' : 'rgba(79, 168, 255, 0.5)');
  ctx.lineWidth = selected ? 2.2 : 1.2;
  createChamferRect(ctx, rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1, 12);
  ctx.stroke();

  // 左侧图标
  const iconCx = rect.x + 32;
  const iconCy = rect.y + rect.height / 2;
  ctx.beginPath();
  ctx.arc(iconCx, iconCy, 22, 0, Math.PI * 2);
  ctx.fillStyle = legendary ? 'rgba(255, 207, 77, 0.12)' : 'rgba(79, 168, 255, 0.12)';
  ctx.fill();
  ctx.strokeStyle = legendary ? 'rgba(255, 207, 77, 0.65)' : 'rgba(79, 168, 255, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  H_drawResearchGlyph(ctx, tag, iconCx, iconCy, 26, accent);

  // 右侧文本区
  const textX = rect.x + 60;
  const textRight = rect.x + rect.width - 12;

  const nextLevel = def.maxLevel !== null ? Math.min(def.maxLevel, currentLevel + 1) : currentLevel + 1;

  // 名称
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillStyle = legendary ? '#ffe6a3' : '#dff0ff';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  ctx.fillText(def.name, textX, rect.y + 24);
  ctx.shadowBlur = 0;

  // 等级(右对齐)
  ctx.font = '11px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillStyle = legendary ? 'rgba(255, 224, 150, 0.88)' : 'rgba(150, 205, 255, 0.88)';
  ctx.textAlign = 'right';
  ctx.fillText(currentLevel > 0 ? `Lv.${currentLevel} → Lv.${nextLevel}` : `新研究 · Lv.${nextLevel}`, textRight, rect.y + 24);
  ctx.textAlign = 'left';

  // 说明
  ctx.font = '11px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillStyle = 'rgba(196, 214, 230, 0.82)';
  H_drawWrappedText(ctx, def.description, textX, rect.y + 46, textRight - textX, 14, 2);

  // 效果(高亮)
  ctx.font = 'bold 12px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillStyle = accent;
  ctx.fillText(H_getResearchEffectText(tag, nextLevel), textX, rect.y + rect.height - 14);

  ctx.restore();
};

/**
 * 绘制专研界面(顶部小卡片形式,不遮挡视野、不影响操作)。
 * 卡片横向排列在画布顶部居中位置,同时注册选项卡的悬停/点击事件区域。
 */
const drawResearchOverlay = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  // 移除旧的选项卡区域,避免重复注册
  eventArea = eventArea.filter(area => !area.id.startsWith(RESEARCH_OVERLAY_EVENT_PREFIX));

  const now = performance.now();
  const dt = researchUiAnimLast > 0 ? Math.min(0.1, (now - researchUiAnimLast) / 1000) : 0;
  researchUiAnimLast = now;
  researchUiAnimTime += dt;

  const pending = playerEntity && !playerEntity.isDead && Array.isArray(playerEntity.researchPendingOptions)
    ? playerEntity.researchPendingOptions.filter((tag) => typeof tag === 'string' && tag.length > 0)
    : [];

  // idle 阶段跟随权威端的待选项(出现则展开,清空则收起)
  if (researchUiPhase === 'idle') {
    if (pending.length > 0) {
      // 若与刚结算的选项相同,说明服务端尚未清空(网络延迟),在抑制时长内保持收起避免重复弹出;
      // 超过抑制时长后即使标签相同也允许再次展示,保证跨级补发的抽取机会不会被吞掉。
      const sameAsResolved = researchUiResolvedTags.length === pending.length
        && pending.every((tag) => researchUiResolvedTags.includes(tag))
        && (now - researchUiResolvedAt) < RESEARCH_RESOLVED_SUPPRESS_MS;
      if (!sameAsResolved) {
        researchUiOptions = pending;
      }
    } else {
      if (researchUiOptions.length > 0) {
        researchUiOptions = [];
      }
      researchUiResolvedTags = [];
    }
  }

  // 阶段推进
  if (researchUiPhase === 'confirm') {
    if ((now - researchUiPhaseStart) / 1000 >= RESEARCH_CONFIRM_DURATION) {
      researchUiPhase = 'closing';
      researchUiPhaseStart = now;
    }
  } else if (researchUiPhase === 'closing') {
    if ((now - researchUiPhaseStart) / 1000 >= RESEARCH_CLOSE_DURATION) {
      researchUiPhase = 'idle';
      researchUiSelectedTag = null;
      researchUiResolvedTags = [...researchUiOptions];
      researchUiResolvedAt = now;
      researchUiOptions = [];
      researchUiAnimLast = 0;
      return;
    }
  }

  if (researchUiOptions.length === 0) return;

  const { width } = H_getCanvasCssSize(CANVAS);

  const closeProgress = researchUiPhase === 'closing'
    ? Math.min(1, (now - researchUiPhaseStart) / 1000 / RESEARCH_CLOSE_DURATION)
    : 0;
  const overlayAlpha = 1 - closeProgress;
  const selectedTag = researchUiSelectedTag;
  const pulse = 0.5 + 0.5 * Math.sin(researchUiAnimTime * 2.4);

  CtxUi.save();
  CtxUi.globalAlpha = overlayAlpha;

  // 顶部轻量渐变(不遮挡玩法视野,仅提升小卡片可读性)
  const backdropHeight = RESEARCH_TOP_OFFSET + RESEARCH_CARD_HEIGHT + 20;
  const backdrop = CtxUi.createLinearGradient(0, 0, 0, backdropHeight);
  backdrop.addColorStop(0, 'rgba(2, 6, 16, 0.62)');
  backdrop.addColorStop(1, 'rgba(2, 6, 16, 0)');
  CtxUi.fillStyle = backdrop;
  CtxUi.fillRect(0, 0, width, backdropHeight);

  // 标题(顶部居中,小字号)
  CtxUi.textAlign = 'center';
  CtxUi.textBaseline = 'middle';
  CtxUi.font = 'bold 15px "Microsoft YaHei", Arial, sans-serif';
  CtxUi.shadowColor = 'rgba(120, 210, 255, 0.6)';
  CtxUi.shadowBlur = 14;
  CtxUi.fillStyle = '#eaf6ff';
  CtxUi.fillText('专研 · 选择一项研究以提升自身能力', width / 2, RESEARCH_TOP_OFFSET - 24);
  CtxUi.shadowBlur = 0;

  // 选项卡布局(整体在顶部居中)
  const count = researchUiOptions.length;
  const gap = RESEARCH_CARD_GAP;
  const totalWidth = count * RESEARCH_CARD_WIDTH + (count - 1) * gap;
  const startX = (width - totalWidth) / 2;
  const cardY = RESEARCH_TOP_OFFSET;

  for (let i = 0; i < count; i++) {
    const tag = researchUiOptions[i];
    const baseRect = {
      x: startX + i * (RESEARCH_CARD_WIDTH + gap),
      y: cardY,
      width: RESEARCH_CARD_WIDTH,
      height: RESEARCH_CARD_HEIGHT
    };
    const hovered = researchUiPhase === 'idle'
      && hoveredArea?.id === `${RESEARCH_OVERLAY_EVENT_PREFIX}${i}`;
    const isSelected = selectedTag === tag;

    // 缩放:悬停略放大;选中阶段选中项放大、其余缩小
    let scale = 1;
    if (researchUiPhase === 'confirm') {
      scale = isSelected ? 1.05 + 0.05 * pulse : 0.95;
    } else if (researchUiPhase === 'closing') {
      scale = isSelected ? 1.1 : 0.92;
    } else if (hovered) {
      scale = 1.03;
    }

    // 透明度:选中阶段未选中项变暗
    let alpha = 1;
    if (researchUiPhase === 'confirm') {
      alpha = isSelected ? 1 : 0.3;
    } else if (researchUiPhase === 'closing') {
      alpha = isSelected ? 1 : 0.12;
    }

    const cx = baseRect.x + baseRect.width / 2;
    const cy = baseRect.y + baseRect.height / 2;
    CtxUi.save();
    CtxUi.translate(cx, cy - closeProgress * 16);
    CtxUi.scale(scale, scale);
    CtxUi.translate(-cx, -cy);
    H_drawResearchCard(
      CtxUi,
      baseRect,
      tag,
      alpha,
      isSelected && researchUiPhase !== 'idle',
      hovered,
      pulse
    );
    CtxUi.restore();

    // 选中时的扩散光环
    if (isSelected && researchUiPhase === 'confirm') {
      const ringProgress = Math.min(1, (now - researchUiPhaseStart) / 1000 / RESEARCH_CONFIRM_DURATION);
      const def = H_getResearchDefinition(tag);
      const accent = def?.category === 'legendary' ? RESEARCH_LEGENDARY_COLOR : RESEARCH_NORMAL_COLOR;
      CtxUi.save();
      CtxUi.globalAlpha = overlayAlpha * (1 - ringProgress) * 0.8;
      CtxUi.strokeStyle = accent;
      CtxUi.lineWidth = 2;
      CtxUi.beginPath();
      CtxUi.arc(cx, cy, 30 + ringProgress * 130, 0, Math.PI * 2);
      CtxUi.stroke();
      CtxUi.restore();
    }

    // 事件区域(idle 阶段才注册,避免动画期间误点)
    if (researchUiPhase === 'idle') {
      eventArea.push({
        id: `${RESEARCH_OVERLAY_EVENT_PREFIX}${i}`,
        rect: baseRect,
        type: 'button',
        cursor: 'pointer',
        onClick: () => {
          if (researchUiPhase !== 'idle') return;
          if (!researchUiOptions.includes(tag)) return;
          researchUiSelectedTag = tag;
          researchUiPhase = 'confirm';
          researchUiPhaseStart = performance.now();
          // 立即把选择提交给权威端;界面动画继续按本地状态播放
          if (playerEntity) {
            sendClientInstruct(Instruct.I_ResearchChoose(playerEntity.id, tag));
          }
          drawUI();
        }
      });
    }
  }

  CtxUi.restore();
};

////////////////////
// <-- 专研(Research)界面
////////////////////

const drawDeathOverlayButton = (
  CtxUi: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  label: string,
  hovered: boolean,
  primary: boolean
) => {
  CtxUi.save();
  if (primary) {
    CtxUi.fillStyle = hovered
      ? 'rgba(89, 227, 255, 0.95)'
      : 'rgba(47, 168, 255, 0.92)';
    CtxUi.shadowColor = 'rgba(47, 168, 255, 0.5)';
    CtxUi.shadowBlur = hovered ? 26 : 14;
  } else {
    CtxUi.fillStyle = hovered ? 'rgba(255, 90, 104, 0.24)' : 'rgba(255, 255, 255, 0.08)';
    CtxUi.shadowBlur = 0;
    CtxUi.strokeStyle = 'rgba(255, 120, 130, 0.6)';
    CtxUi.lineWidth = 1;
  }
  CtxUi.beginPath();
  createRoundRect(CtxUi, rect.x, rect.y, rect.width, rect.height, 8);
  CtxUi.fill();
  if (!primary) {
    CtxUi.stroke();
  }
  CtxUi.shadowBlur = 0;

  CtxUi.font = 'bold 16px "Microsoft YaHei", Arial, sans-serif';
  CtxUi.textAlign = 'center';
  CtxUi.textBaseline = 'middle';
  CtxUi.fillStyle = primary ? '#03141a' : '#e8f6ff';
  CtxUi.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
  CtxUi.restore();
};

/**
 * 绘制重生界面(死亡界面,渲染在 canvas-ui 层)
 * 同时负责注册/移除重生界面按钮的事件区域
 */
const drawDeathOverlay = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  const { width, height } = H_getCanvasCssSize(CANVAS);

  // 先移除旧的重生界面按钮区域,避免重复注册
  eventArea = eventArea.filter(area => !area.id.startsWith(DEATH_OVERLAY_EVENT_PREFIX));

  const playerDead = !playerEntity || playerEntity.isDead || playerEntity.health <= 0;
  if (!playerDead) return;

  // 本次死亡明细(掉落经验/物品/技能 + 专研降级)
  const report = playerEntity?.lastDeathReport ?? null;
  const droppedExp = Math.max(0, Math.round(report?.droppedExp ?? 0));
  const droppedItems = Array.isArray(report?.items) ? report!.items : [];
  const droppedSkills = Array.isArray(report?.skillTags) ? report!.skillTags : [];
  const downgrades = Array.isArray(report?.researchDowngrades) ? report!.researchDowngrades : [];

  // 列表行截断上限:超出时用「… 等 N 项」占用最后一行,保证面板不无限变高
  const H_clampDeathLines = (total: number, cap: number, build: (index: number) => string): string[] => {
    if (total <= 0) return [];
    if (total <= cap) {
      return Array.from({ length: total }, (_unused, index) => build(index));
    }
    const lines = Array.from({ length: cap }, (_unused, index) => build(index));
    lines[cap - 1] = `… 等 ${total} 项`;
    return lines;
  };

  const expLines = [droppedExp > 0 ? `-${droppedExp} EXP` : '无经验掉落'];
  const itemLines = H_clampDeathLines(droppedItems.length, 4, (index) => {
    const stack = droppedItems[index];
    const name = stack.name || H_getItemDefinition(stack.tag).name || stack.tag;
    return `${name} ×${stack.count}`;
  });
  const skillLines = H_clampDeathLines(droppedSkills.length, 3, (index) => {
    const tag = droppedSkills[index];
    return `技能 · ${H_getSkillByTag(tag)?.name ?? tag}`;
  });
  const downgradeLines = H_clampDeathLines(downgrades.length, 4, (index) => {
    const entry = downgrades[index];
    const name = H_getResearchDefinition(entry.tag)?.name ?? entry.tag;
    return entry.to > 0 ? `${name}  Lv.${entry.from} → Lv.${entry.to}` : `${name}  Lv.${entry.from} → 已移除`;
  });

  // 面板尺寸
  const lineH = 17;
  const sectionHeaderH = 18;
  const sectionGap = 6;
  const sections = [
    { header: '掉落经验', lines: expLines, headerColor: '#7ce0ff', lineColor: 'rgba(214, 236, 248, 0.9)' },
    { header: '掉落物品', lines: itemLines, headerColor: '#ffcf7a', lineColor: 'rgba(226, 236, 245, 0.9)' },
    { header: '掉落技能', lines: skillLines, headerColor: '#8ef0c8', lineColor: 'rgba(214, 244, 232, 0.9)' },
    { header: '专研降级', lines: downgradeLines, headerColor: '#ffa2ad', lineColor: 'rgba(255, 214, 219, 0.9)' }
  ];
  const emptyState = droppedItems.length === 0 && droppedSkills.length === 0 && downgrades.length === 0;

  let bodyHeight = 0;
  for (const section of sections) {
    const count = section.lines.length > 0 ? section.lines.length : 1;
    bodyHeight += sectionHeaderH + count * lineH + sectionGap;
  }
  if (emptyState) bodyHeight += lineH;

  const buttonHeight = 44;
  const panelWidth = Math.min(420, Math.max(300, width - 40));
  const panelHeight = 62 + bodyHeight + 14 + buttonHeight + 26;
  const panelX = (width - panelWidth) / 2;
  const panelY = Math.max(12, (height - panelHeight) / 2);
  const contentX = panelX + 22;
  const contentWidth = panelWidth - 44;

  CtxUi.save();

  // 全屏半透明遮罩
  CtxUi.fillStyle = 'rgba(2, 4, 10, 0.66)';
  CtxUi.fillRect(0, 0, width, height);

  // 面板背景与描边
  const panelGradient = CtxUi.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
  panelGradient.addColorStop(0, 'rgba(16, 28, 40, 0.96)');
  panelGradient.addColorStop(1, 'rgba(8, 13, 22, 0.96)');
  CtxUi.shadowColor = 'rgba(0, 229, 255, 0.22)';
  CtxUi.shadowBlur = 42;
  CtxUi.fillStyle = panelGradient;
  CtxUi.beginPath();
  createRoundRect(CtxUi, panelX, panelY, panelWidth, panelHeight, 14);
  CtxUi.fill();
  CtxUi.shadowBlur = 0;
  CtxUi.strokeStyle = 'rgba(91, 221, 255, 0.45)';
  CtxUi.lineWidth = 1;
  CtxUi.beginPath();
  createRoundRect(CtxUi, panelX + 0.5, panelY + 0.5, panelWidth - 1, panelHeight - 1, 14);
  CtxUi.stroke();

  // 死亡标题
  CtxUi.font = 'bold 32px "Microsoft YaHei", Arial, sans-serif';
  CtxUi.textAlign = 'center';
  CtxUi.textBaseline = 'middle';
  CtxUi.shadowColor = 'rgba(255, 90, 104, 0.55)';
  CtxUi.shadowBlur = 18;
  CtxUi.fillStyle = '#ff5a68';
  CtxUi.fillText('你已阵亡', panelX + panelWidth / 2, panelY + 40);
  CtxUi.shadowBlur = 0;

  // 标题下分割线
  CtxUi.strokeStyle = 'rgba(91, 221, 255, 0.25)';
  CtxUi.beginPath();
  CtxUi.moveTo(contentX, panelY + 64);
  CtxUi.lineTo(contentX + contentWidth, panelY + 64);
  CtxUi.stroke();

  // 区块内容
  CtxUi.textAlign = 'left';
  CtxUi.textBaseline = 'middle';
  let cursorY = panelY + 64 + 14;
  for (const section of sections) {
    CtxUi.font = 'bold 13px "Microsoft YaHei", Arial, sans-serif';
    CtxUi.fillStyle = section.headerColor;
    CtxUi.fillText(section.header, contentX, cursorY);
    cursorY += sectionHeaderH;

    CtxUi.font = '13px "Microsoft YaHei", Arial, sans-serif';
    CtxUi.fillStyle = section.lineColor;
    if (section.lines.length === 0) {
      CtxUi.fillStyle = 'rgba(150, 170, 185, 0.6)';
      CtxUi.fillText('（无）', contentX + 10, cursorY);
      cursorY += lineH;
    } else {
      for (const line of section.lines) {
        CtxUi.fillText(H_fitText(CtxUi, line, contentWidth - 10), contentX + 10, cursorY);
        cursorY += lineH;
      }
    }
    cursorY += sectionGap;
  }

  if (emptyState) {
    CtxUi.font = '12px "Microsoft YaHei", Arial, sans-serif';
    CtxUi.fillStyle = 'rgba(150, 170, 185, 0.68)';
    CtxUi.fillText('本次死亡没有掉落任何物品或技能', contentX, cursorY);
    cursorY += lineH;
  }

  // 按钮布局(面板底部居中)
  const buttonGap = 16;
  const buttonWidth = Math.min(140, (panelWidth - 48 - buttonGap) / 2);
  const buttonsY = panelY + panelHeight - buttonHeight - 22;
  const totalButtonsWidth = buttonWidth * 2 + buttonGap;
  const buttonsX = panelX + (panelWidth - totalButtonsWidth) / 2;

  const respawnRect = { x: buttonsX, y: buttonsY, width: buttonWidth, height: buttonHeight };
  const exitRect = { x: buttonsX + buttonWidth + buttonGap, y: buttonsY, width: buttonWidth, height: buttonHeight };

  drawDeathOverlayButton(
    CtxUi,
    respawnRect,
    '重生',
    hoveredArea?.id === `${DEATH_OVERLAY_EVENT_PREFIX}respawn`,
    true
  );
  drawDeathOverlayButton(
    CtxUi,
    exitRect,
    '退出游戏',
    hoveredArea?.id === `${DEATH_OVERLAY_EVENT_PREFIX}exit`,
    false
  );

  CtxUi.restore();

  // 注册按钮事件区域
  eventArea.push({
    id: `${DEATH_OVERLAY_EVENT_PREFIX}respawn`,
    rect: respawnRect,
    type: 'button',
    cursor: 'pointer',
    onClick: () => { sendPlayerRespawn(); }
  });
  eventArea.push({
    id: `${DEATH_OVERLAY_EVENT_PREFIX}exit`,
    rect: exitRect,
    type: 'button',
    cursor: 'pointer',
    onClick: () => { router.push('/home'); }
  });
};

/**
 * 绘制UI层
 */
const drawUI = () => {
  if (!ctxUi || !UI_CANVAS.value) return;
  const { width, height } = H_getCanvasCssSize(UI_CANVAS.value);
  ctxUi.clearRect(0, 0, width, height);
  //drawUIRuler(ctxUi, UI_CANVAS.value);
  //drawInstructions(ctxUi, UI_CANVAS.value);
  drawMiniMap(ctxUi, UI_CANVAS.value);
  drawBottomStatusBar(ctxUi, UI_CANVAS.value);
  drawDebugBoard(ctxUi, UI_CANVAS.value);
  drawInventoryPanel(ctxUi, UI_CANVAS.value);
  drawDebugTerminal(ctxUi, UI_CANVAS.value);
  drawKeyboardSettingsPanel(ctxUi, UI_CANVAS.value);
  drawResearchOverlay(ctxUi, UI_CANVAS.value);
  drawDeathOverlay(ctxUi, UI_CANVAS.value);
};

/**
 * 加载所有实体的纹理
 */
const loadEntityTextures = async () => {
  const allEntities = [...staticEntityList, ...itemEntityList, ...npcEntityList, ...bulletEntityList, ...grenadeEntityList, ...expOrbEntityList, ...skillOrbEntityList];
  await Promise.all(allEntities.map(e => e.loadTexture()));
  drawEntities(); // 加载完成后重绘
};

const refreshRenderEntityList = () => {
  renderEntityList = [...staticEntityList, ...itemEntityList, ...npcEntityList, ...bulletEntityList, ...grenadeEntityList, ...expOrbEntityList, ...skillOrbEntityList];
};


const applyFirstPersonCameraMovement = (_deltaTime: number) => {
  if (perspectiveMode !== 'first_person') return;
  if (!playerEntity || !GRAPHICS_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  offsetXX = width / 2 - playerEntity.position.x;
  offsetYY = height / 2 + playerEntity.position.y;
};

/**
 * 开火模式下,鼠标触碰游戏界面四边界时移动相机视角
 * 例如鼠标移动到顶部边界,相机视角向上移动
 * @param deltaTime 帧间隔(秒)
 */
const applyFireModeEdgeScroll = (deltaTime: number) => {
  if (!playerFireMode) return;                      // 仅在开火模式下生效
  if (perspectiveMode === 'first_person') return;   // 第一人称视角由玩家位置控制
  if (!playerEntity || playerEntity.isDead) return; // 玩家死亡时不滚动
  if (!mouseInsideCanvas) return;                   // 鼠标不在画布内时不滚动
  if (!GRAPHICS_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);

  let dirX = 0;
  let dirY = 0;
  if (mouseX <= EDGE_SCROLL_ZONE) dirX = 1;                   // 左边界:相机向左移动
  else if (mouseX >= width - EDGE_SCROLL_ZONE) dirX = -1;     // 右边界:相机向右移动
  if (mouseY <= EDGE_SCROLL_ZONE) dirY = 1;                   // 顶边界:相机向上移动
  else if (mouseY >= height - EDGE_SCROLL_ZONE) dirY = -1;    // 底边界:相机向下移动

  if (dirX === 0 && dirY === 0) return;

  offsetXX += dirX * EDGE_SCROLL_SPEED * deltaTime;
  offsetYY += dirY * EDGE_SCROLL_SPEED * deltaTime;
};

/**
 * 动画循环
 * 更新动态实体位置并重绘实体层
 * @param timestamp 当前时间戳
 */
const animateEntities = (timestamp: number) => {
  if (!isPageVisible) {
    // 页面隐藏时，不进行任何绘制，只保持循环
    lastTimestamp = timestamp;
    animationFrameId = requestAnimationFrame(animateEntities);
    return;
  }
  if (!lastTimestamp) {// 初始帧
    lastTimestamp = timestamp;
    animationFrameId = requestAnimationFrame(animateEntities);
    return;
  }

  // 画布就绪后执行待处理的相机重置(首次进入/重生时)
  if (pendingCameraResetToPlayer) {
    resetCameraToPlayer();
  }

  const deltaTime = Math.min(0.033, (timestamp - lastTimestamp) / 1000); // 当前时间减去上一帧的时间等于此帧的时间-并且限制最大33ms
  if (deltaTime > 0) {
    applyFirstPersonCameraMovement(deltaTime);  // 移动第一人称视角(背景)
    applyFireModeEdgeScroll(deltaTime);         // 开火模式下鼠标边界滚动相机
    drawGraphics();                             // 重绘星空和网格层
    drawEntities();                             // 重绘实体层
    effectManager?.updateAndDraw(deltaTime);    // 渲染特效层
    
    // 更新并绘制数值层
    numericalManager.update(deltaTime);
    if (ctxNumerical && NUMERICAL_CANVAS.value) {
      const { width, height } = H_getCanvasCssSize(NUMERICAL_CANVAS.value);
      ctxNumerical.clearRect(0, 0, width, height);
      numericalManager.draw();
    }

    drawUI();

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
  { name: '/show_level', args: ['on', 'off', 'toggle'] },
  { name: '/show_hunger', args: ['on', 'off', 'toggle'] },
  { name: '/show_health', args: ['on', 'off', 'toggle'] },
  { name: '/show_debug_board', args: ['on', 'off', 'toggle'] },
  { name: '/perception_range', args: ['on', 'off', 'toggle'] },
  { name: '/movement_range', args: ['on', 'off', 'toggle'] },
  { name: '/movement_speed', args: ['on', 'off', 'toggle'] },
  { name: '/movement_passion', args: ['on', 'off', 'toggle'] },
  { name: '/all', args: ['on', 'off'] },
  { name: '/clear', args: [] as string[] },
  { name: '/tick_pause', args: [] as string[] }
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
      pushDebugTerminalLog('/show_level [on|off|toggle]');
      pushDebugTerminalLog('/show_hunger [on|off|toggle]');
      pushDebugTerminalLog('/show_health [on|off|toggle]');
      pushDebugTerminalLog('/perception_range [on|off|toggle]');
      pushDebugTerminalLog('/movement_range [on|off|toggle]');
      pushDebugTerminalLog('/movement_speed [on|off|toggle]');
      pushDebugTerminalLog('/movement_passion [on|off|toggle]');

      pushDebugTerminalLog('/all [on|off]');
      pushDebugTerminalLog('/clear');
      pushDebugTerminalLog('/tick_pause');
      break;
    }
    case 'status':{
      pushDebugTerminalLog(`Perspective: ${perspectiveMode === 'first_person' ? 'FIRST_PERSON' : 'THIRD_PERSON'}`);

      pushDebugTerminalLog(`Trajectory: ${entityDebugFlags.showHistoricalTrajectory ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`CollisionBoxes: ${entityDebugFlags.showCollisionBoxes ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`FacingArrow: ${entityDebugFlags.showFacingDirection ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`TagText: ${entityDebugFlags.showTag ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`LevelText: ${entityDebugFlags.showLevel ? 'ON' : 'OFF'}`);
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
    case 'show_level':{
      applyDebugFlagCommand('LevelText', entityDebugFlags.showLevel, args, (v) => { entityDebugFlags.showLevel = v; });
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
      entityDebugFlags.showLevel = nextValue;
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
    case 'tick_pause': {
      sendClientInstruct(Instruct.I_TickPause());
      pushDebugTerminalLog(`[SYS] Toggle game pause`);
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
  const key = H_normalizeKey(e.key);
  const bindingId = H_findBindingIdByKey(key);
  const noModifier = !e.ctrlKey && !e.metaKey && !e.altKey;

  // 键盘设置正在录制新键位:优先拦截,避免误触发游戏操作
  if (keyboardSettingsListeningId !== null) {
    e.preventDefault();
    if (key === 'escape') {
      keyboardSettingsListeningId = null;
      drawUI();
      return;
    }
    // 忽略单独的修饰键,等待真正的按键
    if (key === 'shift' || key === 'control' || key === 'alt' || key === 'meta') {
      return;
    }
    const targetId = keyboardSettingsListeningId;
    keyboardSettingsListeningId = null;
    H_applyKeyBinding(targetId, key);
    drawUI();
    return;
  }

  // 背包(调试终端未打开时生效)
  if (!debugTerminalVisible && noModifier && bindingId === 'toggleInventory' && !e.repeat) {
    e.preventDefault();
    // 专研界面打开时不允许切换到背包
    if (H_isResearchOverlayActive()) return;
    if (!playerEntity) {
      pushDebugTerminalLog('[WARN] Player not ready, cannot open inventory.');
      return;
    }
    toggleInventory();
    return;
  }

  // 背包打开时,ESC 关闭背包
  if (inventoryVisible && key === 'escape') {
    e.preventDefault();
    toggleInventory(false);
    return;
  }

  // 调试终端开关
  if (noModifier && bindingId === 'toggleDebugTerminal') {
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

  // 其它功能/移动快捷键(仅无修饰键)
  if (!noModifier) return;

  switch (bindingId) {
    case 'toggleFire': {
      if (e.repeat) return;
      e.preventDefault();
      playerFireMode = !playerFireMode;
      drawUI();
      return;
    }
    case 'togglePerspective': {
      if (e.repeat) return;
      e.preventDefault();
      setPerspectiveMode(perspectiveMode === 'first_person' ? 'third_person' : 'first_person');
      return;
    }
    case 'toggleServantHealth': {
      if (e.repeat) return;
      e.preventDefault();
      showPlayerServantHealth = !showPlayerServantHealth;
      drawEntities();
      drawUI();
      return;
    }
    case 'toggleServantFacing': {
      if (e.repeat) return;
      e.preventDefault();
      showPlayerServantFacingDirection = !showPlayerServantFacingDirection;
      drawEntities();
      drawUI();
      return;
    }
    case 'sprint': {// 疾跑(按住,需在移动过程中生效)
      e.preventDefault();
      if (!PlayerDynamicEntity.playerMoveState.Shift) {
        PlayerDynamicEntity.playerMoveState.Shift = true;
        sendPlayerMoveInput();
      }
      return;
    }
    case 'dodge': {// 闪现:仅在装备了闪现技能时可用
      e.preventDefault();
      if (!playerEntity || !playerEntity.hasEquippedSkill(DodgeSkill.TAG)) {
        return;
      }
      sendPlayerDodgeInput(playerEntity.facingDirection);
      return;
    }
    case 'moveUp':
    case 'moveDown':
    case 'moveLeft':
    case 'moveRight': {// 移动
      e.preventDefault();
      H_setMoveStateForBinding(bindingId, true);
      return;
    }
    default: {
      return;
    }
  }
};

const onGlobalKeyUp = (e: KeyboardEvent) => {
  const key = H_normalizeKey(e.key);
  const bindingId = H_findBindingIdByKey(key);
  if (bindingId === 'sprint') {
    PlayerDynamicEntity.playerMoveState.Shift = false;
    sendPlayerMoveInput();
    return;
  }
  if (bindingId === 'moveUp' || bindingId === 'moveDown'
      || bindingId === 'moveLeft' || bindingId === 'moveRight') {
    H_setMoveStateForBinding(bindingId, false);
  }
};

/**
 * 画布点击事件处理(绑定到UI Canvas)
 */
const onCanvasClick = (e: MouseEvent) => {
  if (!UI_CANVAS.value || !ctxGraphics) return;

  // 背包界面打开时,点击事件不参与世界交互(背包的拖拽/点击已在 mousedown/mouseup 中处理)
  if (inventoryVisible) return;

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
};

const onCanvasDoubleClick = (e: MouseEvent) => {
  // 背包界面打开时,双击背包物品 = 使用该物品
  if (!inventoryVisible || !playerEntity) return;
  const { width, height } = H_getCanvasCssSize(e.currentTarget as HTMLCanvasElement);
  const layout = H_getInventoryLayout(width, height);
  const target = H_hitTestInventorySlot(layout, e.offsetX, e.offsetY);
  if (!target || target.zone !== 'bag') return;
  const entry = H_inventoryGetEntryAtSlot(H_ensurePlayerInventory(playerEntity.inventory), target.index);
  if (entry === null || entry.kind !== 'item') return;
  // 双击前会先发生一次单击(拿起)与一次单击(放回),此处直接使用物品
  inventoryDragPayload = null;
  sendInventoryUseItem(entry.uid);
  drawUI();
};

/**
 * 画布右键菜单处理:背包界面打开时屏蔽浏览器默认右键菜单(右键用于快捷操作)
 */
const onCanvasContextMenu = (e: MouseEvent) => {
  if (!inventoryVisible) return;
  e.preventDefault();
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

  // 数值层 DPR 适配
  if (NUMERICAL_CANVAS.value && ctxNumerical) {
    H_applyDprToCanvas(NUMERICAL_CANVAS.value, ctxNumerical);
    numericalManager.bindCanvas(NUMERICAL_CANVAS.value);
    numericalManager.setWorldToScreen(TOcanvas2Screen);
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

  // 背包界面打开时,鼠标交互全部交给背包界面(禁用画布拖动/开火/从者编辑)
  if (inventoryVisible) {
    e.preventDefault();
    inventoryPointerX = screenX;
    inventoryPointerY = screenY;
    inventoryDragStartX = screenX;
    inventoryDragStartY = screenY;
    if (UI_CANVAS.value) {
      if (e.button === 2) {
        handleInventoryRightDown(UI_CANVAS.value, screenX, screenY);
      } else {
        handleInventoryLeftDown(UI_CANVAS.value, screenX, screenY);
      }
    }
    drawUI();
    return;
  }

  if (H_getHitEventArea(screenX, screenY)) return;

  if (e.button === 0 && playerFireMode) {
    e.preventDefault();
    sendPlayerFireInput(TOscreen2Canvas(screenX, screenY));
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
  mouseInsideCanvas = true;
  // 更新鼠标世界坐标,用于调试面板
  const worldCoord = TOscreen2Canvas(mouseX, mouseY);
  mouseWorldX = worldCoord.x;
  mouseWorldY = worldCoord.y;

  if (!UI_CANVAS.value) return;

  // 背包界面打开时,仅维护指针位置与光标样式(高亮由每帧绘制时重算)
  if (inventoryVisible) {
    inventoryPointerX = mouseX;
    inventoryPointerY = mouseY;
    cursorManager?.setNowCursorType(inventoryDragPayload ? 'move' : 'pointer');
    return;
  }

  // 专研顶部小卡片不拦截鼠标事件:悬停/点击由通用的事件区域机制处理(见下方通用分支)

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
  // 背包界面打开时,抬起鼠标即结算背包拖拽/点击
  if (inventoryVisible) {
    if (UI_CANVAS.value) {
      const moved = Math.hypot(inventoryPointerX - inventoryDragStartX, inventoryPointerY - inventoryDragStartY) > 4;
      handleInventoryMouseUp(UI_CANVAS.value, inventoryPointerX, inventoryPointerY, moved);
    }
    isDragging = false;
    isMoveCanvas = false;
    return;
  }
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
  mouseInsideCanvas = false;
  cursorManager?.setFocused(false);
};

/**
 * 窗口鼠标进入(显示光标)
 */
const onWindowMouseEnter = () => {
  mouseInsideCanvas = true;
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
  // 关闭服务端连接(Worker 或 WebSocket)
  serviceTransport.dispose();

  if (UI_CANVAS.value) {
    UI_CANVAS.value.removeEventListener('mousedown', onMousedown);
    UI_CANVAS.value.removeEventListener('mousemove', onMouseMove);
    UI_CANVAS.value.removeEventListener('mouseup', onMouseUp);
    UI_CANVAS.value.removeEventListener('mouseleave', onMouseUp);
    UI_CANVAS.value.removeEventListener('click', onCanvasClick);
    UI_CANVAS.value.removeEventListener('dblclick', onCanvasDoubleClick);
    UI_CANVAS.value.removeEventListener('contextmenu', onCanvasContextMenu);
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
  document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    <!-- 数值显示层 -->
    <canvas id="canvas-numerical" ref="NUMERICAL_CANVAS"></canvas>
    <!-- 鼠标指针 -->
    <canvas id="canvas-cursor"></canvas>
  </div>
</template>
<style scoped>
.view-pixel-war-container{position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;overflow:hidden;cursor:none;}
#canvas-graphics{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-entity{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-effects{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-ui{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:auto;cursor:none;}
#canvas-cursor{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-numerical{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
</style>
