import type {
  Point,
  CanvasEffectEventPayload,
  LoadedEffectSprite,
  ActiveCanvasEffect,
} from '@/components/test_2d/interface/InterfaceTest2d';
import type { DynamicEntity } from '@/components/test_2d/class/Entity/DynamicEntity/DynamicEntity';

type EffectManagerOptions = {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  effectPathByKind: Record<string, string>;
  worldToScreen: (worldX: number, worldY: number) => Point;
  getCanvasCssSize: (canvas: HTMLCanvasElement) => { width: number; height: number };
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

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private nextEffectId = 1;
  private activeEffects: ActiveCanvasEffect[] = [];
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
