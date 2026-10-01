import type {
  Point,
  CanvasEffectEventPayload,
  LoadedEffectSprite,
  ActiveCanvasEffect,
  ServantAbsorbEffect,
} from '@/components/pixel_war/interface/Interface';
import type { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';

/** 从者吸附特效:拖尾长度(格,与参考图标注的 14 格一致) */
const SERVANT_ABSORB_TRAIL_CELLS = 14;
/** 从者吸附特效:网格单元边长(px,与服务端从者网格一致) */
const SERVANT_ABSORB_CELL_SIZE = 25;
/** 从者吸附特效:总时长(秒) */
const SERVANT_ABSORB_DURATION = 0.5;
/** 从者吸附特效:拖尾亮度衰减指数(越大衰减越快) */
const SERVANT_ABSORB_TRAIL_FALLOFF = 1.8;
/** 从者吸附特效:吸附能量块/光晕颜色 */
const SERVANT_ABSORB_GLOW_COLOR = '#6d8cff';
/** 从者吸附特效:能量块亮芯颜色 */
const SERVANT_ABSORB_CORE_COLOR = '#dbe6ff';
/** 从者吸附特效:光晕层叠层数(层数×单层透明度 = 中心最亮强度) */
const SERVANT_ABSORB_GLOW_STEPS = 4;
/** 从者吸附特效:单层光晕透明度(不宜过高,否则中心闪光过曝) */
const SERVANT_ABSORB_GLOW_LAYER_ALPHA = 0.055;
/** 从者吸附特效:吸附能量块透明度 */
const SERVANT_ABSORB_BLOCK_ALPHA = 0.55;
/** 从者吸附特效:能量块亮芯透明度 */
const SERVANT_ABSORB_CORE_ALPHA = 0.32;

/**
 * 将方向吸附到 8 个方向之一(上/下/左/右 + 4 个 45° 斜向)
 * 吸附方向只允许这 8 种,避免出现任意角度
 * @returns 单位方向向量;向量长度过小时返回 null
 */
const H_snapDirectionToEight = (dx: number, dy: number): Point | null => {
  if (Math.hypot(dx, dy) < 0.001) return null;
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: Math.cos(angle), y: Math.sin(angle) };
};

type EffectManagerOptions = {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  effectPathByKind: Record<string, string>;
  worldToScreen: (worldX: number, worldY: number) => Point;
  getCanvasCssSize: (canvas: HTMLCanvasElement) => { width: number; height: number };
  /** 可选:按实体 id 获取实体当前世界坐标(用于让特效锚点跟随实体移动) */
  resolveEntityPosition?: (entityId: number) => Point | null;
};

class EffectManager {
  private readonly frameWidth: number;
  private readonly frameHeight: number;
  private readonly frameCount: number;
  private readonly fps: number;
  private readonly duration: number;
  private readonly effectPathByKind: Record<string, string>;
  private readonly worldToScreen: (worldX: number, worldY: number) => Point;
  private readonly getCanvasCssSize: (canvas: HTMLCanvasElement) => { width: number; height: number };
  private readonly resolveEntityPosition: ((entityId: number) => Point | null) | null;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private nextEffectId = 1;
  private activeEffects: ActiveCanvasEffect[] = [];
  private activeAbsorbEffects: ServantAbsorbEffect[] = [];
  private effectSpriteMap: Record<string, LoadedEffectSprite | null> = {};
  private emittedEntityIdsByKind = new Map<string, Set<number>>();

  constructor(options: EffectManagerOptions) {
    this.frameWidth = options.frameWidth;
    this.frameHeight = options.frameHeight;
    this.frameCount = options.frameCount;
    this.fps = options.fps;
    this.duration = this.frameCount / this.fps;
    this.effectPathByKind = { ...options.effectPathByKind };
    this.worldToScreen = options.worldToScreen;
    this.getCanvasCssSize = options.getCanvasCssSize;
    this.resolveEntityPosition = options.resolveEntityPosition ?? null;

    for (const path of Object.values(this.effectPathByKind)) {
      this.effectSpriteMap[path] = null;
    }
  }

  bindCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
  }

  applyDprToCanvas() {
    if (!this.canvas || !this.ctx) return;

    const { width, height } = this.getCanvasCssSize(this.canvas);
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const displayWidth = Math.round(width * dpr);
    const displayHeight = Math.round(height * dpr);

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  reset() {
    this.nextEffectId = 1;
    this.activeEffects = [];
    this.activeAbsorbEffects = [];
    this.emittedEntityIdsByKind.clear();
    this.clearCanvas();
  }

  async loadEffectTextures() {
    const uniquePaths = Array.from(new Set(Object.values(this.effectPathByKind).filter(Boolean)));
    await Promise.all(uniquePaths.map(path => this.loadSingleEffectSprite(path)));
  }

  emitEffect(payload: CanvasEffectEventPayload) {
    if (!this.isWorldRectInVisibleRange(payload.position.x, payload.position.y, payload.width, payload.height)) {
      return false;
    }

    const spritePath = this.getEffectSpritePathByKind(payload.kind);
    if (!spritePath) return false;

    this.activeEffects.push({
      id: this.nextEffectId++,
      kind: payload.kind,
      worldX: payload.position.x,
      worldY: payload.position.y,
      width: payload.width,
      height: payload.height,
      tag: payload.tag,
      spritePath,
      elapsed: 0,
    });
    return true;
  }

  emitEffectOnceByEntity(payload: CanvasEffectEventPayload, entityId: number) {
    const emittedSet = this.getOrCreateEmittedSet(payload.kind);
    if (emittedSet.has(entityId)) return false;

    emittedSet.add(entityId);
    return this.emitEffect(payload);
  }

  emitDynamicEntityDeath(entity: DynamicEntity) {
    return this.emitEffectOnceByEntity(
      {
        kind: 'dynamic_entity_death',
        position: { ...entity.position },
        width: entity.width,
        height: entity.height,
        tag: entity.tag,
        entityType: entity.type,
      },
      entity.id
    );
  }

  /**
   * 播放"从者吸附成功"特效
   * 特效锚点每帧跟随被吸附的从者实体(从者会随玩家移动),
   * 拖尾方向由"玩家位置 → 吸附格子位置"决定,并吸附到 8 个方向之一
   * (上/下/左/右 + 4 个 45° 斜向),即朝玩家被吸附的那一面向外拖出。
   * @param entityId 被吸附的从者实体 id(锚点跟随该实体)
   * @param playerPosition 玩家世界坐标(用于判定吸附方向/面)
   * @param absorbedPosition 被吸附的从者格子世界坐标
   * @param color 被吸附 NPC 的本体颜色
   * @returns 是否成功播放
   */
  emitServantAbsorb(entityId: number, playerPosition: Point, absorbedPosition: Point, color: string) {
    const direction = H_snapDirectionToEight(
      absorbedPosition.x - playerPosition.x,
      absorbedPosition.y - playerPosition.y
    );
    // 方向不可判定(玩家与格子重合)时不播放
    if (!direction) return false;

    const length = SERVANT_ABSORB_TRAIL_CELLS * SERVANT_ABSORB_CELL_SIZE;
    // 锚点离屏(预留拖尾长度作为余量)时直接跳过
    if (!this.isWorldPointInVisibleRange(absorbedPosition.x, absorbedPosition.y, length)) return false;

    this.activeAbsorbEffects.push({
      id: this.nextEffectId++,
      entityId,
      anchorX: absorbedPosition.x,
      anchorY: absorbedPosition.y,
      dirX: direction.x,
      dirY: direction.y,
      length,
      cellSize: SERVANT_ABSORB_CELL_SIZE,
      color: color || '#ffffff',
      elapsed: 0,
    });
    return true;
  }

  updateAndDraw(deltaTime: number) {
    if (!this.ctx || !this.canvas) return;

    const { width, height } = this.getCanvasCssSize(this.canvas);
    this.ctx.clearRect(0, 0, width, height);

    const remainingEffects: ActiveCanvasEffect[] = [];
    for (const effect of this.activeEffects) {
      const nextElapsed = effect.elapsed + Math.max(0, deltaTime);
      if (nextElapsed >= this.duration) continue;

      const frameIndex = Math.min(this.frameCount - 1, Math.floor(nextElapsed * this.fps));
      const sprite = this.effectSpriteMap[effect.spritePath];
      const screenPos = this.worldToScreen(effect.worldX, effect.worldY);
      const drawX = screenPos.x - effect.width / 2;
      const drawY = screenPos.y - effect.height / 2;

      if (sprite && sprite.loaded) {
        this.ctx.drawImage(
          sprite.img,
          frameIndex * this.frameWidth,
          0,
          this.frameWidth,
          this.frameHeight,
          drawX,
          drawY,
          effect.width,
          effect.height
        );
      }

      remainingEffects.push({
        ...effect,
        elapsed: nextElapsed,
      });
    }

    this.activeEffects = remainingEffects;

    this.updateAndDrawServantAbsorbs(deltaTime);
  }

  /**
   * 更新并绘制从者吸附特效(程序化绘制,不走雪碧图)
   */
  private updateAndDrawServantAbsorbs(deltaTime: number) {
    if (this.activeAbsorbEffects.length === 0) return;

    const remaining: ServantAbsorbEffect[] = [];
    for (const effect of this.activeAbsorbEffects) {
      const nextElapsed = effect.elapsed + Math.max(0, deltaTime);
      if (nextElapsed >= SERVANT_ABSORB_DURATION) continue;

      // 吸附特效跟随被吸附的从者移动:每帧刷新锚点为该实体的当前位置
      const livePosition = this.resolveEntityPosition ? this.resolveEntityPosition(effect.entityId) : null;
      const nextEffect: ServantAbsorbEffect = {
        ...effect,
        anchorX: livePosition ? livePosition.x : effect.anchorX,
        anchorY: livePosition ? livePosition.y : effect.anchorY,
        elapsed: nextElapsed,
      };
      this.drawServantAbsorbEffect(nextEffect);
      remaining.push(nextEffect);
    }
    this.activeAbsorbEffects = remaining;
  }

  /**
   * 绘制单个从者吸附特效
   * 1. 拖尾:14 个网格单元拼成条状矩形,亮度由锚点向外逐格递减(参考图中的分格渐变)
   * 2. 光晕:锚点处的蓝色辉光
   * 3. 能量块:锚点格上的方块 + 亮芯
   */
  private drawServantAbsorbEffect(effect: ServantAbsorbEffect) {
    const ctx = this.ctx;
    if (!ctx) return;

    const fade = 1 - effect.elapsed / SERVANT_ABSORB_DURATION;
    if (fade <= 0) return;

    const anchor = this.worldToScreen(effect.anchorX, effect.anchorY);
    // 世界坐标 Y 向上、屏幕坐标 Y 向下,所以取反
    const angle = Math.atan2(-effect.dirY, effect.dirX);
    const cellSize = effect.cellSize;
    const cellLength = effect.length / SERVANT_ABSORB_TRAIL_CELLS;

    ctx.save();
    ctx.translate(anchor.x, anchor.y);
    ctx.rotate(angle);
    // 叠加混合,在深色场景中呈现能量辉光
    ctx.globalCompositeOperation = 'lighter';

    // ---- 1. 条状拖尾(从锚点格子外侧开始向外延伸) ----
    ctx.fillStyle = effect.color;
    for (let i = 0; i < SERVANT_ABSORB_TRAIL_CELLS; i++) {
      const ratio = 1 - i / SERVANT_ABSORB_TRAIL_CELLS;
      ctx.globalAlpha = fade * Math.pow(ratio, SERVANT_ABSORB_TRAIL_FALLOFF);
      ctx.fillRect(cellSize / 2 + i * cellLength, -cellSize / 2, cellLength, cellSize);
    }

    // ---- 2. 锚点光晕(层叠同心圆模拟径向渐变,总强度保持柔和) ----
    const glowRadius = cellSize * 1.6;
    ctx.fillStyle = SERVANT_ABSORB_GLOW_COLOR;
    for (let i = SERVANT_ABSORB_GLOW_STEPS; i >= 1; i--) {
      ctx.globalAlpha = fade * SERVANT_ABSORB_GLOW_LAYER_ALPHA;
      ctx.beginPath();
      ctx.arc(0, 0, (i / SERVANT_ABSORB_GLOW_STEPS) * glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- 3. 吸附能量块 ----
    ctx.globalAlpha = fade * SERVANT_ABSORB_BLOCK_ALPHA;
    ctx.fillStyle = SERVANT_ABSORB_GLOW_COLOR;
    ctx.fillRect(-cellSize / 2, -cellSize / 2, cellSize, cellSize);
    ctx.fillStyle = SERVANT_ABSORB_CORE_COLOR;
    ctx.globalAlpha = fade * SERVANT_ABSORB_CORE_ALPHA;
    const coreSize = cellSize * 0.36;
    ctx.fillRect(-coreSize / 2, -coreSize / 2, coreSize, coreSize);

    ctx.restore();
  }

  private clearCanvas() {
    if (!this.ctx || !this.canvas) return;
    const { width, height } = this.getCanvasCssSize(this.canvas);
    this.ctx.clearRect(0, 0, width, height);
  }

  private getOrCreateEmittedSet(kind: string) {
    let set = this.emittedEntityIdsByKind.get(kind);
    if (!set) {
      set = new Set<number>();
      this.emittedEntityIdsByKind.set(kind, set);
    }
    return set;
  }

  private isWorldRectInVisibleRange(worldX: number, worldY: number, width: number, height: number) {
    if (!this.canvas) return false;

    const screenPos = this.worldToScreen(worldX, worldY);
    const halfW = width / 2;
    const halfH = height / 2;
    const left = screenPos.x - halfW;
    const top = screenPos.y - halfH;
    const right = left + width;
    const bottom = top + height;
    const { width: canvasWidth, height: canvasHeight } = this.getCanvasCssSize(this.canvas);

    return right >= 0 && bottom >= 0 && left <= canvasWidth && top <= canvasHeight;
  }

  private isWorldPointInVisibleRange(worldX: number, worldY: number, margin: number) {
    if (!this.canvas) return false;

    const screenPos = this.worldToScreen(worldX, worldY);
    const { width: canvasWidth, height: canvasHeight } = this.getCanvasCssSize(this.canvas);
    return (
      screenPos.x >= -margin &&
      screenPos.x <= canvasWidth + margin &&
      screenPos.y >= -margin &&
      screenPos.y <= canvasHeight + margin
    );
  }

  private getEffectSpritePathByKind(kind: string) {
    const path = this.effectPathByKind[kind];
    if (!path) {
      console.warn(`Unknown effect kind: ${kind}`);
      return '';
    }
    return path;
  }

  private loadSingleEffectSprite(path: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = path;
      img.onload = () => {
        this.effectSpriteMap[path] = { img, loaded: true, path };
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load effect sprite: ${path}`);
        this.effectSpriteMap[path] = { img, loaded: false, path };
        resolve();
      };
    });
  }
}

export { EffectManager };
