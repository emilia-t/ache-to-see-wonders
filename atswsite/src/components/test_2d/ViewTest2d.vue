<script setup lang="ts">
// The relative position of this file: src/components/test_2d/ViewTest2d.vue
import { ref, computed, onMounted, onUnmounted } from 'vue';

type TypeCursorName = 'crosshair' | 'default' | 'eraser' | 'help' | 'move' | 'notAllowed' | 'pen' | 'pointer';
type TypeEffectName = 'default' | 'eraser';
type PerspectiveMode = 'first_person' | 'third_person';

interface Resolution { width: number; height: number }
interface PenPoint {x: number; y: number; g: number};//g是压力值，0-1通过鼠标移动速度模拟
interface PenTrajectory {
  id: number;//轨迹ID
  color: RGB;//笔迹颜色
  thickness: number;//笔迹粗细
  resolution: Resolution;//分辨率
  startPoint: Point;//参照点
  endPoint: Point;//终结点
  list: Array<PenPoint>;//笔迹点以startPoint为起点的偏移坐标值和压力值
}
interface RGB { r: number; g: number; b: number; }
interface Point { x: number; y: number };
interface EventArea {
  id: string;                    // 唯一标识
  rect: {                         // 矩形区域
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type: 'button' | 'element' | 'menu';  // 区域类型
  data?: any;                     // 附加数据
  cursor?: TypeCursorName;                 // 鼠标样式
  onClick?: (e: MouseEvent, area: EventArea) => void;
  onHover?: (e: MouseEvent, area: EventArea, isHovering: boolean) => void;
}
interface InherentProp {
  name: string;
  color: RGB;
  opacity: 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1;
};
interface Element {
  id: number;
  type: "point" | "line" | "segment";
  points: Array<Point>;
  inherentProp: InherentProp;
  customProp: Object;
};
interface PointElement extends Element {
  type: "point"
};
interface LineElement extends Element {
  type: "line"
};
interface SegmentElement extends Element {
  type: "segment"
};
interface CachedImage {
  img: HTMLImageElement;
  offsetX: number;
  offsetY: number;
}
interface CollisionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Texture {
  img: HTMLImageElement;
  loaded: boolean;
  path: string;
}

class CursorManager {
  private cursorFilePath = {
    crosshair: "./cursor/crosshair.png",
    default: "./cursor/default.png",
    eraser: "./cursor/eraser.png",
    help: "./cursor/help.png",
    move: "./cursor/move.png",
    notAllowed: "./cursor/notAllowed.png",
    pen: "./cursor/pen.png",
    pointer: "./cursor/pointer.png"
  } as const;
  private dragFilePath = {
    default: "./cursor/default.gif",
    eraser: "./cursor/eraser.gif"
  } as const;
  private pngCache: Record<TypeCursorName, CachedImage  | null> = {
    crosshair: null,
    default: null,
    eraser: null,
    help: null,
    move: null,
    notAllowed: null,
    pen: null,
    pointer: null
  };
  private gifCache: Record<TypeEffectName, CachedImage  | null> = {
    default: null,
    eraser: null
  };
  private nowCursorType: TypeCursorName = 'default';
  private nowCursorX = 0;      // 指针位置（屏幕坐标）
  private nowCursorY = 0;
  private nowScale = 1;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private focused = true;       // 指针是否可见（鼠标移出浏览器时不可见）
  private effectDrag = false;    // 是否显示拖影特效
  
  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) {
      throw new Error(`Cursor canvas not found: ${canvasId}`);
    }
    this.canvas = canvas;
    this.ctx = this.canvas.getContext('2d')!;
    this.loadPng();
    //this.loadGif();
  }

  public setNowCursorType(type: TypeCursorName) {
    this.nowCursorType = type;
    this.drawCursor(type, this.nowCursorX, this.nowCursorY, this.nowScale);
  }

  /**
   * 按需调整画布尺寸和 DPR 变换（仅在需要时执行）
   */
  private updateCanvasSizeIfNeeded(rect: DOMRect) {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.round(rect.width * dpr);
    const displayHeight = Math.round(rect.height * dpr);
    
    // 检查画布物理尺寸是否已变化
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /**
   * 加载所有 PNG 光标图片
   */
  loadPng() {
    for (const [key, path] of Object.entries(this.cursorFilePath)) {
      const cursorKey = key as TypeCursorName;
      const img = new Image();
      img.src = path;
      img.onload = () => {
        const offset = this.calcOffset(cursorKey, img.width, img.height);
        this.pngCache[cursorKey] = { img, offsetX: offset.x, offsetY: offset.y };
        if (this.focused && this.nowCursorType === cursorKey) {
          this.drawCursor(this.nowCursorType, this.nowCursorX, this.nowCursorY, this.nowScale);
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load cursor image: ${path}`);
      };
      this.pngCache[cursorKey] = null;
    }
  }

  /**
   * 计算光标的偏移值
   */
  private calcOffset(type: TypeCursorName, imgWidth: number, imgHeight: number): { x: number, y: number } {
    switch (type) {
      case 'crosshair':
      case 'move':
      case 'notAllowed':
        return { x: imgWidth / 2, y: imgHeight / 2 };
      case 'eraser':
      case 'pen':
        return { x: 0, y: imgHeight };
      case 'default':
      case 'help':
      case 'pointer':
      default:
        return { x: 0, y: 0 };
    }
  }

  /**
   * 加载所有 GIF 拖影图片
   */
  loadGif() {
    for (const [key, path] of Object.entries(this.dragFilePath)) {
      const dragKey = key as TypeEffectName;
      const img = new Image();
      img.src = path;
      img.onload = () => {
        const offset = this.calcOffset(dragKey as TypeCursorName, img.width, img.height);
        this.gifCache[dragKey] = { img, offsetX: offset.x, offsetY: offset.y };
        if (this.focused && this.effectDrag && this.nowCursorType === dragKey) {
          this.drawCursor(this.nowCursorType, this.nowCursorX, this.nowCursorY, this.nowScale);
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load drag cursor image: ${path}`);
      };
	    this.gifCache[dragKey] = null;
    }
  }
  /**
   * 绘制光标到画布
   * 
   * @param Type 光标类型（与 cursorFilePath 的键对应）
   * @param X 鼠标屏幕 X 坐标
   * @param Y 鼠标屏幕 Y 坐标
   * @param scale 缩放比例
   */
  drawCursor(Type: TypeCursorName | 'auto', X: number, Y: number, scale: number = 1) {
    this.nowCursorX = X;
    this.nowCursorY = Y;
    const actualType = Type === 'auto' ? this.nowCursorType : Type;
    this.nowCursorType = actualType;
    this.nowScale = scale;

    const rect = this.canvas.getBoundingClientRect();
    this.updateCanvasSizeIfNeeded(rect);
    const localX = X - rect.left;
    const localY = Y - rect.top;

    // 如果失去焦点，清除画布并返回
    if (!this.focused) {
      this.ctx.clearRect(0, 0, rect.width, rect.height);
      return;
    }

    // 清除画布
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    let cached: CachedImage | null = null;
    if (this.effectDrag && actualType in this.gifCache) {
      cached = this.gifCache[actualType as TypeEffectName];
    }
    if (!cached) {
      cached = this.pngCache[actualType];
    }

    if (cached && cached.img.complete && cached.img.naturalWidth > 0) {
      const { img, offsetX, offsetY } = cached;
      const drawX = localX - offsetX * scale;
      const drawY = localY - offsetY * scale;
      const width = img.width * scale;
      const height = img.height * scale;
      this.ctx.drawImage(img, drawX, drawY, width, height);
    } else {
      // 图片未加载或不存在，绘制默认光标形状（十字准星）
      this.drawDefaultCursor(localX, localY);
    }
  }

  /**
   * 绘制默认光标（备用方案）
   */
  private drawDefaultCursor(x: number, y: number) {
    this.ctx.save();
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    // 绘制十字
    this.ctx.beginPath();
    this.ctx.moveTo(x - 10, y);
    this.ctx.lineTo(x + 10, y);
    this.ctx.moveTo(x, y - 10);
    this.ctx.lineTo(x, y + 10);
    this.ctx.stroke();
    // 中心圆点
    this.ctx.beginPath();
    this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
    this.ctx.fillStyle = '#fff';
    this.ctx.fill();
    this.ctx.strokeStyle = '#000';
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * 设置焦点状态（鼠标是否在画布内）
   */
  setFocused(focused: boolean) {
    this.focused = focused;
    this.drawCursor(this.nowCursorType, this.nowCursorX, this.nowCursorY, this.nowScale);
  }

  /**
   * 设置拖影特效开关
   */
  setEffectDrag(effect: boolean) {
    this.effectDrag = effect;
    this.drawCursor(this.nowCursorType, this.nowCursorX, this.nowCursorY, this.nowScale);
  }
}

class Entity {
  private static nextEntityId = 100;
  id: number;
  type: 'static' | 'dynamic' | 'item';
  position: Point;           // 世界坐标-画布坐标
  width: number;
  height: number;
  texturePath: string;
  texture: Texture | null;
  name: string;
  collisionBox: CollisionBox;
  tag?: string;              // 属性标签，如 "箱子", "猫"

  constructor(
    type: 'static' | 'dynamic' | 'item',
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag?: string
  ) {
    this.id = Entity.nextEntityId++;
    this.type = type;
    this.position = position;
    this.width = width;
    this.height = height;
    this.texturePath = texturePath;
    this.texture = null;
    this.name = name;
    this.tag = tag || name;
    this.collisionBox = {
      x: position.x - width / 2,
      y: position.y - height / 2,
      width: width,
      height: height,
    };
  }

  // 更新碰撞盒-位置变化时调用
  updateCollisionBox() {
    this.collisionBox.x = this.position.x - this.width / 2;
    this.collisionBox.y = this.position.y - this.height / 2;
  }

  // 加载纹理
  async loadTexture(): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = this.texturePath;
      img.onload = () => {
        this.texture = { img, loaded: true, path: this.texturePath };
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load texture: ${this.texturePath}`);
        this.texture = { img, loaded: false, path: this.texturePath };
        resolve();
      };
    });
  }
}

class StaticEntity extends Entity {
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag?: string
  ) {
    super('static', position, width, height, texturePath, name, tag);
  }
}

class BoxStaticEntity extends StaticEntity {
  static readonly WIDTH = 50;
  static readonly HEIGHT = 50;
  static readonly TEXTURE_PATH = './textures/box.png';

  constructor(
    position: Point,
    name: string = 'Wooden Box',
    tag: string = 'box'
  ) {
    super(
      position,
      BoxStaticEntity.WIDTH,
      BoxStaticEntity.HEIGHT,
      BoxStaticEntity.TEXTURE_PATH,
      name,
      tag
    );
  }
}

class WallStaticEntity extends StaticEntity {
  static readonly WIDTH = 50;
  static readonly HEIGHT = 50;
  static readonly TEXTURE_PATH = './textures/wall.png';

  constructor(
    position: Point,
    name: string = 'Stone Wall',
    tag: string = 'wall'
  ) {
    super(
      position,
      WallStaticEntity.WIDTH,
      WallStaticEntity.HEIGHT,
      WallStaticEntity.TEXTURE_PATH,
      name,
      tag
    );
  }
}

class ItemEntity extends Entity {
  lifetimeTotal: number; // 初始寿命（秒）
  lifetimeRemaining: number; // 寿命剩余时间（秒）
  isDisappearing: boolean; // 是否进入消失特效阶段
  disappearDuration: number; // 消失特效总时长（秒）
  disappearTimer: number; // 消失特效剩余时长（秒）

  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag?: string,
    lifetimeSeconds: number = 300
  ) {
    super('item', position, width, height, texturePath, name, tag);
    this.lifetimeTotal = Math.max(0, lifetimeSeconds);
    this.lifetimeRemaining = this.lifetimeTotal;
    this.isDisappearing = false;
    this.disappearDuration = 0.45;
    this.disappearTimer = 0;
    // ItemEntity 不参与碰撞体积计算
    this.collisionBox = {
      x: position.x,
      y: position.y,
      width: 0,
      height: 0,
    };
  }

  // item 无碰撞盒，位置变化不需要更新碰撞盒
  updateCollisionBox() {}

  updateLifetime(dt: number) {
    if (this.isDisappearing) {
      this.disappearTimer = Math.max(0, this.disappearTimer - dt);
      return;
    }
    if (this.lifetimeRemaining <= 0) {
      this.beginDisappear();
      return;
    }
    this.lifetimeRemaining = Math.max(0, this.lifetimeRemaining - dt);
    if (this.lifetimeRemaining <= 0) {
      this.beginDisappear();
    }
  }

  beginDisappear() {
    if (this.isDisappearing) return;
    this.isDisappearing = true;
    this.disappearTimer = this.disappearDuration;
  }

  isReadyToRemove() {
    return this.isDisappearing && this.disappearTimer <= 0;
  }

  getLifetimeOpacity() {
    if (this.lifetimeTotal <= 0) return 1;
    const ratio = this.lifetimeRemaining / this.lifetimeTotal;
    if (ratio > 0.75) return 1;
    if (ratio > 0.5) return 0.75;
    if (ratio > 0.25) return 0.5;
    return 0.25;
  }
}

class GrilledFishItemEntity extends ItemEntity {
  static readonly WIDTH = 40;
  static readonly HEIGHT = 40;
  static readonly TEXTURE_PATH = './textures/grilled_fish.png';

  constructor(
    position: Point,
    name: string = 'Grilled Fish',
    tag: string = 'grilled_fish'
  ) {
    super(
      position,
      GrilledFishItemEntity.WIDTH,
      GrilledFishItemEntity.HEIGHT,
      GrilledFishItemEntity.TEXTURE_PATH,
      name,
      tag,
      60
    );
  }
}

class DynamicEntity extends Entity {
  nextTarget: Point;            // 下一刻要去的地点-世界坐标
  health: number;               // 生命值
  speed: number;                // 当前有效移动速度-单位/秒
  wanderRange: number;          // 随机游走半径（固定属性）
  perceptionRange: number;      // 感知范围（固定属性）
  minMoveSpeed: number;         // 最小运动速度（固定属性，10~200）
  maxMoveSpeed: number;         // 最大运动速度（固定属性，10~200）
  movementPassion: number;      // 运动激情值（每次换目标重置，80%~120%）
  isMoving: boolean;
  facingDirection: Point;       // 朝向矢量（单位向量，世界坐标）
  stayDurationRemaining: number; // 到点后随机驻足剩余时间（秒）
  targetHistory: Point[];       // 目标点历史记录
  curvePoints: Point[];         // 平滑路径采样点
  currentCurveIndex: number;    // 当前路径上的索引
  lastMoveDirection: Point | null; // 上一段移动的单位方向，用于路径衔接
  insideStaticDamageTimer: number; // 被挤压在静态实体内的伤害计时器
  wasInsideStaticEntity: boolean; // 上一帧是否处于静态实体内部
  insideStaticRetargetCooldown: number; // 被挤压时重新寻路冷却（秒）
  insideStaticBlockedTimer: number; // 被挤压且无法前进时的阻塞计时器
  damageFlashTimer: number; // 受伤发红特效计时器（秒）
  crowdStuckTimer: number; // 动态实体群体拥挤导致停滞的计时器
  crowdRetargetCooldown: number; // 停滞后重新寻路冷却，避免所有实体同频
  lastStuckCheckPos: Point; // 用于判断是否卡住的上一帧位置
  noMoveDuration: number; // 连续未位移时长（秒）
  noMoveLastPos: Point; // 未位移检测的上一位置
  isDead: boolean; // 是否已死亡
  deathEffectTimer: number; // 死亡特效剩余时长（秒）
  deathEffectDuration: number; // 死亡特效总时长（秒）

  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag?: string
  ) {
    super('dynamic', position, width, height, texturePath, name, tag);
    const speedA = 10 + Math.random() * 190;
    const speedB = 10 + Math.random() * 190;
    this.minMoveSpeed = Math.min(speedA, speedB);
    this.maxMoveSpeed = Math.max(speedA, speedB);
    this.movementPassion = 1;
    this.health = 100;
    this.speed = this.minMoveSpeed;
    this.wanderRange = 30 * ((this.width / 2) + (this.height / 2));
    this.perceptionRange = 8 * ((this.width / 2) + (this.height / 2));
    this.refreshMoveSpeedForNewTarget();
    this.nextTarget = { ...position };
    this.isMoving = false;
    this.facingDirection = { x: 0, y: 1 }; // 默认朝北（向上）
    this.stayDurationRemaining = 0;
    this.targetHistory = [{ ...position }];
    this.curvePoints = [];
    this.currentCurveIndex = 0;
    this.lastMoveDirection = null;
    this.insideStaticDamageTimer = 0;
    this.wasInsideStaticEntity = false;
    this.insideStaticRetargetCooldown = 0;
    this.insideStaticBlockedTimer = 0;
    this.damageFlashTimer = 0;
    this.crowdStuckTimer = 0;
    this.crowdRetargetCooldown = 0;
    this.lastStuckCheckPos = { ...position };
    this.noMoveDuration = 0;
    this.noMoveLastPos = { ...position };
    this.isDead = false;
    this.deathEffectDuration = 0.8;
    this.deathEffectTimer = 0;
  }

  applyDamage(amount: number) {
    if (amount <= 0 || this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    // 受伤后触发短暂红色闪烁
    this.damageFlashTimer = Math.max(this.damageFlashTimer, 0.25);
    if (this.health <= 0) {
      this.triggerDeath();
    }
  }

  updateDamageEffect(dt: number) {
    if (this.damageFlashTimer <= 0) return;
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
  }

  updateDeathEffect(dt: number) {
    if (!this.isDead || this.deathEffectTimer <= 0) return;
    this.deathEffectTimer = Math.max(0, this.deathEffectTimer - dt);
  }

  isDeathEffectFinished() {
    return this.isDead && this.deathEffectTimer <= 0;
  }

  private triggerDeath() {
    this.isDead = true;
    this.isMoving = false;
    this.stayDurationRemaining = 0;
    this.insideStaticDamageTimer = 0;
    this.wasInsideStaticEntity = false;
    this.insideStaticBlockedTimer = 0;
    this.crowdStuckTimer = 0;
    this.curvePoints = [{ ...this.position }];
    this.targetHistory = [{ ...this.position }];
    this.currentCurveIndex = 0;
    this.nextTarget = { ...this.position };
    this.deathEffectTimer = this.deathEffectDuration;
  }

  // 检测群体拥挤导致的停滞，必要时打断当前运动以触发重新寻路
  updateCrowdStuckState(dt: number) {
    if (this.isDead) return;
    this.crowdRetargetCooldown = Math.max(0, this.crowdRetargetCooldown - dt);

    const moved = Math.hypot(
      this.position.x - this.lastStuckCheckPos.x,
      this.position.y - this.lastStuckCheckPos.y
    );
    this.lastStuckCheckPos = { ...this.position };

    // 已停着的不计入“拥挤停滞”
    if (!this.isMoving) {
      this.crowdStuckTimer = 0;
      return;
    }

    if (moved < 0.2) {
      this.crowdStuckTimer += dt;
    } else {
      this.crowdStuckTimer = 0;
      return;
    }

    // 长时间几乎不动，说明可能挤成平衡，强制退出当前移动状态等待重新寻路
    if (this.crowdStuckTimer >= 1.2 && this.crowdRetargetCooldown <= 0) {
      this.isMoving = false;
      this.stayDurationRemaining = 0;
      this.crowdStuckTimer = 0;
      this.crowdRetargetCooldown = 0.8 + Math.random() * 0.8;
    }
  }

  // 超过 10 秒未位移则触发重新寻路
  updateNoMovementWatchdog(dt: number): boolean {
    if (this.isDead) return false;
    const moved = Math.hypot(
      this.position.x - this.noMoveLastPos.x,
      this.position.y - this.noMoveLastPos.y
    );

    if (moved > 0.5) {
      this.noMoveDuration = 0;
      this.noMoveLastPos = { ...this.position };
      return false;
    }

    this.noMoveDuration += dt;
    if (this.noMoveDuration >= 10) {
      this.noMoveDuration = 0;
      this.noMoveLastPos = { ...this.position };
      this.isMoving = false;
      this.stayDurationRemaining = 0;
      this.insideStaticRetargetCooldown = 0;
      return true;
    }
    return false;
  }

  // 每次运动到新目标前刷新速度参数
  private refreshMoveSpeedForNewTarget() {
    this.movementPassion = 0.8 + Math.random() * 0.4; // 80%~120%
    const baseSpeed = this.minMoveSpeed + Math.random() * (this.maxMoveSpeed - this.minMoveSpeed);
    this.speed = baseSpeed * this.movementPassion;
  }

  /**
   * 根据 targetHistory 生成平滑路径点（CatmullRom 样条采样）
   */
  generateSmoothPath() {
    const points = this.targetHistory;
    if (points.length < 2) {
      // 不足两点，路径就是单点
      this.curvePoints = [this.position];
      return;
    }

    const samples: Point[] = [];
    const segmentsPerSpan = 15; // 每段曲线采样点数

    // 为生成 CatmullRom 曲线，需要前后扩展点
    const extended = [...points];
    // 首尾扩展（用于保证曲线经过首尾点）
    extended.unshift({
      x: points[0].x - (points[1].x - points[0].x),
      y: points[0].y - (points[1].y - points[0].y)
    });
    extended.push({
      x: points[points.length - 1].x + (points[points.length - 1].x - points[points.length - 2].x),
      y: points[points.length - 1].y + (points[points.length - 1].y - points[points.length - 2].y)
    });

    // 对每三个控制点之间插值（CatmullRom 曲线）
    for (let i = 1; i < extended.length - 2; i++) {
      const p0 = extended[i - 1];
      const p1 = extended[i];
      const p2 = extended[i + 1];
      const p3 = extended[i + 2];

      for (let t = 0; t <= 1; t += 1 / segmentsPerSpan) {
        const t2 = t * t;
        const t3 = t2 * t;

        // CatmullRom 公式
        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        samples.push({ x, y });
      }
    }

    // 确保最后一个点精确等于目标点
    samples.push({ ...points[points.length - 1] });
    this.curvePoints = samples;
  }

  private getInflatedStaticBoxes(staticEntities: StaticEntity[], extraPadding = 8): CollisionBox[] {
    const inflateX = this.width / 2 + extraPadding;
    const inflateY = this.height / 2 + extraPadding;
    return staticEntities.map(se => ({
      x: se.collisionBox.x - inflateX,
      y: se.collisionBox.y - inflateY,
      width: se.collisionBox.width + inflateX * 2,
      height: se.collisionBox.height + inflateY * 2,
    }));
  }

  private isPointInBox(point: Point, box: CollisionBox): boolean {
    return (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    );
  }

  private isPointBlocked(point: Point, boxes: CollisionBox[]): boolean {
    for (const box of boxes) {
      if (this.isPointInBox(point, box)) return true;
    }
    return false;
  }

  // 线段与 AABB 相交检测（Liang-Barsky）
  private isSegmentIntersectBox(a: Point, b: Point, box: CollisionBox): boolean {
    const xMin = box.x;
    const xMax = box.x + box.width;
    const yMin = box.y;
    const yMax = box.y + box.height;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const p = [-dx, dx, -dy, dy];
    const q = [a.x - xMin, xMax - a.x, a.y - yMin, yMax - a.y];

    let t0 = 0;
    let t1 = 1;
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-9) {
        if (q[i] < 0) return false;
        continue;
      }
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
    return t0 <= t1;
  }

  private isSegmentBlocked(a: Point, b: Point, boxes: CollisionBox[]): boolean {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.001) return this.isPointBlocked(a, boxes);
    for (const box of boxes) {
      if (this.isPointInBox(a, box) || this.isPointInBox(b, box) || this.isSegmentIntersectBox(a, b, box)) {
        return true;
      }
    }
    return false;
  }

  private buildAvoidancePath(target: Point, staticEntities: StaticEntity[]): Point[] | null {
    const start = { ...this.position };
    const boxes = this.getInflatedStaticBoxes(staticEntities);

    if (this.isPointBlocked(start, boxes) || this.isPointBlocked(target, boxes)) {
      return null;
    }

    if (!this.isSegmentBlocked(start, target, boxes)) {
      return [start, target];
    }

    const clearance = 18;
    const waypointCandidates: Point[] = [];
    for (const box of boxes) {
      waypointCandidates.push(
        { x: box.x - clearance, y: box.y - clearance },
        { x: box.x + box.width + clearance, y: box.y - clearance },
        { x: box.x - clearance, y: box.y + box.height + clearance },
        { x: box.x + box.width + clearance, y: box.y + box.height + clearance }
      );
    }

    const uniqueCandidates = waypointCandidates.filter((p, idx, arr) => {
      if (this.isPointBlocked(p, boxes)) return false;
      return arr.findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) < 0.001) === idx;
    });

    uniqueCandidates.sort((a, b) => {
      const sa = Math.hypot(start.x - a.x, start.y - a.y) + Math.hypot(target.x - a.x, target.y - a.y);
      const sb = Math.hypot(start.x - b.x, start.y - b.y) + Math.hypot(target.x - b.x, target.y - b.y);
      return sa - sb;
    });

    const oneHopLimit = Math.min(uniqueCandidates.length, 40);
    for (let i = 0; i < oneHopLimit; i++) {
      const wp = uniqueCandidates[i];
      if (!this.isSegmentBlocked(start, wp, boxes) && !this.isSegmentBlocked(wp, target, boxes)) {
        return [start, wp, target];
      }
    }

    const twoHopLimit = Math.min(uniqueCandidates.length, 18);
    for (let i = 0; i < twoHopLimit; i++) {
      const wp1 = uniqueCandidates[i];
      if (this.isSegmentBlocked(start, wp1, boxes)) continue;
      for (let j = 0; j < twoHopLimit; j++) {
        if (i === j) continue;
        const wp2 = uniqueCandidates[j];
        if (
          !this.isSegmentBlocked(wp1, wp2, boxes) &&
          !this.isSegmentBlocked(wp2, target, boxes)
        ) {
          return [start, wp1, wp2, target];
        }
      }
    }

    return null;
  }

  // 将折线路径采样成连续点，避免长线段下运动步进过粗
  private buildPolylineSamples(points: Point[], stepLen = 12): Point[] {
    if (points.length <= 1) return points.map(p => ({ ...p }));
    const samples: Point[] = [{ ...points[0] }];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.001) continue;
      const steps = Math.max(1, Math.ceil(dist / stepLen));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        samples.push({
          x: a.x + dx * t,
          y: a.y + dy * t,
        });
      }
    }
    return samples;
  }

  private isPathClear(points: Point[], boxes: CollisionBox[]): boolean {
    if (points.length < 2) return true;
    for (let i = 0; i < points.length - 1; i++) {
      if (this.isSegmentBlocked(points[i], points[i + 1], boxes)) return false;
    }
    return true;
  }

  // 对避障折线做圆角化，尽量保持曲线观感；若圆角后不安全则回退为原折线
  private buildRoundedAvoidanceSamples(points: Point[], boxes: CollisionBox[]): Point[] {
    if (points.length <= 2) return this.buildPolylineSamples(points);

    const rounded: Point[] = [{ ...points[0] }];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const inDx = prev.x - curr.x;
      const inDy = prev.y - curr.y;
      const outDx = next.x - curr.x;
      const outDy = next.y - curr.y;
      const inLen = Math.hypot(inDx, inDy);
      const outLen = Math.hypot(outDx, outDy);

      if (inLen < 0.001 || outLen < 0.001) {
        rounded.push({ ...curr });
        continue;
      }

      const cut = Math.min(22, inLen * 0.35, outLen * 0.35);
      if (cut < 4) {
        rounded.push({ ...curr });
        continue;
      }

      const entry = {
        x: curr.x + (inDx / inLen) * cut,
        y: curr.y + (inDy / inLen) * cut,
      };
      const exit = {
        x: curr.x + (outDx / outLen) * cut,
        y: curr.y + (outDy / outLen) * cut,
      };

      rounded.push(entry);
      const curveSteps = 6;
      for (let s = 1; s < curveSteps; s++) {
        const t = s / curveSteps;
        const omt = 1 - t;
        rounded.push({
          x: omt * omt * entry.x + 2 * omt * t * curr.x + t * t * exit.x,
          y: omt * omt * entry.y + 2 * omt * t * curr.y + t * t * exit.y,
        });
      }
      rounded.push(exit);
    }
    rounded.push({ ...points[points.length - 1] });

    // 先校验圆角路径是否仍可通行，再进行细分采样
    if (this.isPathClear(rounded, boxes)) {
      return this.buildPolylineSamples(rounded, 8);
    }
    return this.buildPolylineSamples(points, 12);
  }

  // 当常规寻路失败时的兜底：优先脱离静态实体；否则尝试近邻目标，避免长期静止
  tryFallbackTarget(staticEntities: StaticEntity[]): boolean {
    const current = { ...this.position };

    // 1) 若当前被挤在静态实体内，优先做“脱困位移”
    if (this.isInsideStaticEntity(staticEntities)) {
      let bestDir: Point | null = null;
      let bestScore = -Infinity;
      const angleStep = Math.PI / 8; // 22.5 度
      const escapeDistance = Math.max(this.width, this.height) * 1.2;
      const currentOverlap = this.getTotalStaticOverlap(current, staticEntities);

      for (let a = 0; a < Math.PI * 2; a += angleStep) {
        const dir = { x: Math.cos(a), y: Math.sin(a) };
        const probe = {
          x: current.x + dir.x * escapeDistance,
          y: current.y + dir.y * escapeDistance,
        };
        const overlap = this.getTotalStaticOverlap(probe, staticEntities);
        const score = currentOverlap - overlap;
        if (score > bestScore) {
          bestScore = score;
          bestDir = dir;
        }
      }

      // 直接做一小步脱困位移，不生成“忽略障碍”的远目标点
      if (bestDir && bestScore > 0.0001) {
        this.position = {
          x: current.x + bestDir.x * escapeDistance,
          y: current.y + bestDir.y * escapeDistance,
        };
        this.updateCollisionBox();
        this.noMoveDuration = 0;
        this.noMoveLastPos = { ...this.position };
        this.facingDirection = { ...bestDir };
        this.isMoving = false;
        this.nextTarget = { ...this.position };
        return true;
      }
    }

    // 2) 不在静态实体内（或脱困失败）时，尝试近邻随机点
    const radiusList = [80, 140, 200];
    for (const radius of radiusList) {
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const probe = {
          x: current.x + Math.cos(angle) * radius,
          y: current.y + Math.sin(angle) * radius,
        };
        if (this.setTarget(probe, staticEntities)) {
          return true;
        }
      }
    }

    // 3) 不再使用“忽略障碍”的目标，避免生成围栏外不可达点
    return false;
  }

  // 设置新的目标点
  setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    const currentPos = { ...this.position };
    const preferStraight = options.preferStraight === true;

    // 避免重复添加相同目标
    const dx = target.x - currentPos.x;
    const dy = target.y - currentPos.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.1) return false;

    const plannedPath = this.buildAvoidancePath(target, staticEntities);
    if (!plannedPath) {
      return false;
    }

    // 每次新目标都重新生成激情值并刷新有效速度
    this.refreshMoveSpeedForNewTarget();

    // 每次设新目标都从当前位置重新规划，避免沿用旧目标点
    const newHistory: Point[] = [];

    // 仅在直达且非“直线优先”时使用前导锚点，保持连续曲线
    if (plannedPath.length === 2 && !preferStraight && this.lastMoveDirection) {
      const tailLen = Math.min(Math.max(distance * 0.2, 20), 80);
      newHistory.push({
        x: currentPos.x - this.lastMoveDirection.x * tailLen,
        y: currentPos.y - this.lastMoveDirection.y * tailLen,
      });
    }
    newHistory.push(currentPos);

    const inflatedBoxes = this.getInflatedStaticBoxes(staticEntities);

    // 直达路径可加入一个弯曲控制点；避障路径则直接使用规划拐点
    if (plannedPath.length === 2 && !preferStraight && distance > 30) {
      const midX = (currentPos.x + target.x) / 2;
      const midY = (currentPos.y + target.y) / 2;
      const invLen = 1 / distance;
      const perpX = -dy * invLen;
      const perpY = dx * invLen;

      let bendSign = this.id % 2 === 0 ? 1 : -1;
      if (this.lastMoveDirection) {
        const cross = this.lastMoveDirection.x * dy - this.lastMoveDirection.y * dx;
        if (Math.abs(cross) > 0.001) {
          bendSign = cross >= 0 ? 1 : -1;
        }
      }

      const bend = Math.min(distance * 0.25, 120);
      const bendPoint = {
        x: midX + perpX * bend * bendSign,
        y: midY + perpY * bend * bendSign,
      };

      // 仅当弯曲中点及两段连接都可通行时才使用弯曲控制点
      const bendIsSafe =
        !this.isPointBlocked(bendPoint, inflatedBoxes) &&
        !this.isSegmentBlocked(currentPos, bendPoint, inflatedBoxes) &&
        !this.isSegmentBlocked(bendPoint, target, inflatedBoxes);

      if (bendIsSafe) {
        newHistory.push(bendPoint);
      }
    } else {
      for (let i = 1; i < plannedPath.length - 1; i++) {
        newHistory.push({ ...plannedPath[i] });
      }
    }

    newHistory.push({ ...target });
    this.targetHistory = newHistory;

    // 直达路径默认平滑曲线；若“直线优先”则改用折线采样（本质直线）
    if (plannedPath.length === 2 && !preferStraight) {
      this.generateSmoothPath();

      // 前导锚点仅用于塑形，不应该成为实体实际回走的路径
      if (this.curvePoints.length > 1) {
        let startIndex = 0;
        let minDist = Infinity;
        for (let i = 0; i < this.curvePoints.length; i++) {
          const p = this.curvePoints[i];
          const d = Math.hypot(p.x - currentPos.x, p.y - currentPos.y);
          if (d < minDist) {
            minDist = d;
            startIndex = i;
          }
        }

        if (startIndex >= this.curvePoints.length - 1) {
          startIndex = this.curvePoints.length - 2;
        }
        if (startIndex > 0) {
          this.curvePoints = this.curvePoints.slice(startIndex);
        }
        this.curvePoints[0] = { ...currentPos };
      }
    } else {
      this.curvePoints = this.buildRoundedAvoidanceSamples(newHistory, inflatedBoxes);
      if (this.curvePoints.length === 0) {
        this.curvePoints = [{ ...currentPos }];
      } else {
        this.curvePoints[0] = { ...currentPos };
      }
    }

    // 重置路径索引
    this.currentCurveIndex = 0;
    this.isMoving = true;
    this.stayDurationRemaining = 0;
    this.insideStaticBlockedTimer = 0;
    this.crowdStuckTimer = 0;
    this.noMoveDuration = 0;
    this.noMoveLastPos = { ...this.position };
    this.nextTarget = target;
    return true;
  }

  // 到点后随机驻足 0~5 秒
  private enterStayStateAfterArrival() {
    this.stop();
    this.stayDurationRemaining = Math.random() * 5;
  }

  // 更新驻足计时
  updateStayDuration(dt: number) {
    if (this.isDead) return;
    if (this.isMoving || this.stayDurationRemaining <= 0) return;
    this.stayDurationRemaining = Math.max(0, this.stayDurationRemaining - dt);
  }

  // 当前是否在任一静态实体内部
  isInsideStaticEntity(staticEntities: StaticEntity[]) {
    return this.getTotalStaticOverlap(this.position, staticEntities) > 0.0001;
  }

  // 被挤压在静态实体中时：每 1 秒扣 2 点血
  updateStaticCompressionEffects(dt: number, staticEntities: StaticEntity[]) {
    if (this.isDead) return;
    const insideNow = this.isInsideStaticEntity(staticEntities);

    if (!insideNow) {
      this.insideStaticDamageTimer = 0;
      this.wasInsideStaticEntity = false;
      return;
    }

    // 首次被挤入静态实体时立刻受伤
    if (!this.wasInsideStaticEntity) {
      this.applyDamage(2);
      this.insideStaticDamageTimer = 0;
      this.wasInsideStaticEntity = true;
    }

    this.insideStaticDamageTimer += dt;
    while (this.insideStaticDamageTimer >= 1) {
      this.insideStaticDamageTimer -= 1;
      this.applyDamage(2);
    }
  }

  // 当前是否可分配新的游走目标（被挤压时做 1 秒节流，避免疯狂重算）
  canGetNewWanderTarget(dt: number, staticEntities: StaticEntity[]) {
    if (this.isDead) return false;
    if (this.isMoving || this.stayDurationRemaining > 0) return false;

    if (!this.isInsideStaticEntity(staticEntities)) {
      this.insideStaticRetargetCooldown = 0;
      return true;
    }

    this.insideStaticRetargetCooldown = Math.max(0, this.insideStaticRetargetCooldown - dt);
    if (this.insideStaticRetargetCooldown <= 0) {
      this.insideStaticRetargetCooldown = 1;
      return true;
    }
    return false;
  }

  // 停止移动
  stop() {
    this.isMoving = false;
    this.nextTarget = { ...this.position };
    this.targetHistory = [{ ...this.position }];
    this.curvePoints = [{ ...this.position }];
    this.currentCurveIndex = 0;
    this.insideStaticBlockedTimer = 0;
    this.crowdStuckTimer = 0;
    this.noMoveLastPos = { ...this.position };
  }

  // 更新位置-基于时间差 dt 秒
  update(dt: number, staticEntities: StaticEntity[]) {
    if (this.isDead) return;
    if (!this.isMoving) return;
    if (this.curvePoints.length === 0) return;
    const oldPos = { ...this.position };

    // 若已到达曲线终点
    if (this.currentCurveIndex >= this.curvePoints.length - 1) {
      this.enterStayStateAfterArrival();
      return;
    }

    const step = this.speed * dt;
    let remaining = step;
    let newPos = { ...this.position };

    while (remaining > 0 && this.currentCurveIndex < this.curvePoints.length - 1) {
      const end = this.curvePoints[this.currentCurveIndex + 1];
      const dx = end.x - newPos.x;
      const dy = end.y - newPos.y;
      const distanceToEnd = Math.hypot(dx, dy);

      if (distanceToEnd <= remaining) {
        // 可以到达终点
        newPos = end;
        remaining -= distanceToEnd;
        this.currentCurveIndex++;
      } else {
        // 只能走部分距离
        const ratio = remaining / distanceToEnd;
        newPos = {
          x: newPos.x + dx * ratio,
          y: newPos.y + dy * ratio
        };
        remaining = 0;
      }
    }

    // 碰撞检测：如果当前已挤在静态实体内，允许“减少重叠”的位移，以便脱困
    const oldOverlap = this.getTotalStaticOverlap(this.position, staticEntities);
    const newOverlap = this.getTotalStaticOverlap(newPos, staticEntities);
    const collided = newOverlap > 0.0001 && newOverlap + 0.0001 >= oldOverlap;

    if (!collided) {
      this.insideStaticBlockedTimer = 0;
      this.position = newPos;
      this.updateCollisionBox();
      const moveDx = this.position.x - oldPos.x;
      const moveDy = this.position.y - oldPos.y;
      const moveDistance = Math.hypot(moveDx, moveDy);
      if (moveDistance > 0.0001) {
        const moveDirection = {
          x: moveDx / moveDistance,
          y: moveDy / moveDistance,
        };
        this.lastMoveDirection = moveDirection;
        this.facingDirection = moveDirection;
      }

      // 本帧抵达终点后进入驻足状态
      if (this.currentCurveIndex >= this.curvePoints.length - 1) {
        this.enterStayStateAfterArrival();
      }
    } else {
      // 在静态实体外碰撞仍停止；若已在静态实体内，保留移动状态以便后续脱困
      if (oldOverlap <= 0.0001) {
        this.stop();
        this.curvePoints = [this.position];
        this.currentCurveIndex = 0;
        this.lastMoveDirection = null;
      } else {
        // 长时间无法前进则进入待重算状态，交给 1 秒节流的重算逻辑处理
        this.insideStaticBlockedTimer += dt;
        if (this.insideStaticBlockedTimer >= 0.4) {
          this.isMoving = false;
          this.insideStaticBlockedTimer = 0;
        }
      }
    }
  }

  private getTotalStaticOverlap(pos: Point, staticEntities: StaticEntity[]): number {
    let total = 0;
    for (const se of staticEntities) {
      total += this.getOverlapArea(pos, se);
    }
    return total;
  }

  private getOverlapArea(pos: Point, staticEntity: StaticEntity): number {
    const myBox = {
      x: pos.x - this.width / 2,
      y: pos.y - this.height / 2,
      width: this.width,
      height: this.height,
    };
    const otherBox = staticEntity.collisionBox;

    const overlapX = Math.min(myBox.x + myBox.width, otherBox.x + otherBox.width) - Math.max(myBox.x, otherBox.x);
    const overlapY = Math.min(myBox.y + myBox.height, otherBox.y + otherBox.height) - Math.max(myBox.y, otherBox.y);
    if (overlapX <= 0 || overlapY <= 0) return 0;
    return overlapX * overlapY;
  }

  // 检测与静态实体的碰撞
  private checkCollision(newPos: Point, staticEntity: StaticEntity): boolean {
    const myBox = {
      x: newPos.x - this.width / 2,
      y: newPos.y - this.height / 2,
      width: this.width,
      height: this.height,
    };
    const otherBox = staticEntity.collisionBox;
    return !(
      myBox.x + myBox.width <= otherBox.x ||
      myBox.x >= otherBox.x + otherBox.width ||
      myBox.y + myBox.height <= otherBox.y ||
      myBox.y >= otherBox.y + otherBox.height
    );
  }
}

class CatDynamicEntity extends DynamicEntity {
  static readonly CAT_HUNGER_TOO_FULL_THRESHOLD = 180; // 超过该饱腹值后不主动拾取烤鱼
  chasingItemId: number | null;
  hungerMeter: number; // 饥饿值（0~200）
  hungerDecayTimer: number; // 饥饿衰减计时器（秒）
  hungerDamageTimer: number; // 饥饿伤害计时器（秒）

  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string = 'Cat'
  ) {
    super(position, width, height, texturePath, name, 'cat');
    this.chasingItemId = null;
    this.hungerMeter = 100;
    this.hungerDecayTimer = 0;
    this.hungerDamageTimer = 0;
    this.tag = 'cat';
    this.health = 50;
    this.minMoveSpeed = 50;
    this.maxMoveSpeed = 100;
    this.wanderRange = 12 * ((this.width / 2) + (this.height / 2));
    this.perceptionRange = 8 * ((this.width / 2) + (this.height / 2));
    const baseSpeed = this.minMoveSpeed + Math.random() * (this.maxMoveSpeed - this.minMoveSpeed);
    this.speed = baseSpeed * this.movementPassion;
  }

  clearChasingItem() {
    this.chasingItemId = null;
  }

  addHunger(amount: number) {
    if (amount <= 0 || this.isDead) return;
    this.hungerMeter = Math.min(200, Math.max(0, this.hungerMeter + amount));
    if (this.hungerMeter > 0) {
      this.hungerDamageTimer = 0;
    }
  }

  updateHunger(dt: number) {
    if (this.isDead) return;

    this.hungerDecayTimer += dt;
    while (this.hungerDecayTimer >= 1) {
      this.hungerDecayTimer -= 1;
      this.hungerMeter = Math.max(0, this.hungerMeter - 1);
    }

    if (this.hungerMeter <= 0) {
      this.hungerDamageTimer += dt;
      while (this.hungerDamageTimer >= 1) {
        this.hungerDamageTimer -= 1;
        this.applyDamage(1);
      }
    } else {
      this.hungerDamageTimer = 0;
    }
  }
}

class RagdollCatDynamicEntity extends CatDynamicEntity {
  static readonly TEXTURE_PATH = './textures/cat_ragdoll.png';
  static readonly FIXED_WIDTH = 50;
  static readonly FIXED_HEIGHT = 50;

  constructor(
    position: Point,
    name: string = 'Cat'
  ) {
    super(
      position,
      RagdollCatDynamicEntity.FIXED_WIDTH,
      RagdollCatDynamicEntity.FIXED_HEIGHT,
      RagdollCatDynamicEntity.TEXTURE_PATH,
      name
    );
  }
}


////////////////////
//常量区-->
////////////////////
const GRAPHICS_CANVAS = ref<HTMLCanvasElement | null>(null);
const UI_CANVAS = ref<HTMLCanvasElement | null>(null);
const ENTITY_CANVAS = ref<HTMLCanvasElement | null>(null);
const BT1_PADDING = 30;//bt1是左侧元素添加按钮的
const BT1_HEIGHT = 50;
const BT1_WIDTH = 105;
const BT1_SPACING = 20;
const BT1_INI = [
  {
    id: 'btn_point',
    label: 'Point',
    type: 'point',
    icon: '●',
    size: 16,
    color: { r: 66, g: 133, b: 244 },
    x: 30,
    y: BT1_PADDING,
    onClick: () => {
      if(drawStatusPoint){
        onCancelPoint();
      }else{
        onInventPoint();
      }
      drawUI(); // 更新UI以反映当前模式
    }
  },
  {
    id: 'btn_line',
    label: 'Line',
    type: 'line',
    icon: '─',
    size: 16,
    color: { r: 52, g: 168, b: 83 },
    x: 30,
    y: BT1_PADDING + (BT1_HEIGHT + BT1_SPACING),
    onClick: () => {
      if(drawStatusLine){
        onCancelLine();
      }else{
        onInventLine();
      }
      drawUI();
    }
  },
  {
    id: 'btn_segment',
    label: 'Segment',
    type: 'segment',
    icon: '◢',
    size: 12,
    color: { r: 251, g: 188, b: 5 },
    x: 30,
    y: BT1_PADDING + (BT1_HEIGHT + BT1_SPACING) * 2,
    onClick: () => {
      if(drawStatusSegment){
        onCancelSegment();
      }else{
        onInventSegment();
      }
      drawUI();
    }
  },
  {
    id: 'btn_pen',
    label: 'Pen',
    type: 'pen',
    icon: '✎',
    size: 16,
    color: { r: 251, g: 188, b: 5 },
    x: 30,
    y: BT1_PADDING + (BT1_HEIGHT + BT1_SPACING) * 3,
    onClick: () => {
      if(drawStatusPen){
        onCancelPen();
      }else{
        onInventPen();
      }
      drawUI();
    }
  },
  {
    id: 'btn_eraser',
    label: 'Eraser',
    type: 'eraser',
    icon: '🧽',
    size: 16,
    color: { r: 128, g: 128, b: 128 },
    x: 30,
    y: BT1_PADDING + (BT1_HEIGHT + BT1_SPACING) * 4,
    onClick: () => {
      if(drawStatusEraser){
        onCancelEraser();
      }else{
        onInventEraser();
      }
      drawUI();
    }
  },
];
const LOCAL_STORAGE_KEY = 'viewTest2dState';
const DEBUG_TERMINAL_MAX_LOGS = 120;
const MAX_SPEED_PEN = 10; // 笔迹速度对应的最大压力值
const RDEC_ITERATIONS = 3; // 解析动态实体碰撞算法迭代次数
const RDEC_SEPARATION_EPSILON = 0.1; // 碰撞分离时的微小偏移量，避免实体卡在一起
const FIRST_PERSON_CAMERA_SPEED = 480; // 第一人称视角下 WASD 视图移动速度（单位/秒）
////////////////////
//<--常量区
////////////////////

////////////////////
//变量区-->
////////////////////
let cursorManager: CursorManager | null = null;
let ctxGraphics: CanvasRenderingContext2D | null = null;
let ctxUi: CanvasRenderingContext2D | null = null;
let ctxEntity: CanvasRenderingContext2D | null = null;

let offsetXX = 0;  // 原点在x轴上的偏移
let offsetYY = 0;  // 原点在y轴上的偏移
let scale = 1;    // 缩放比例
let elementIdIndex = 1;

let renderElementList: Array<Element> = [];  // 要渲染的元素
let penTrajectoryList: Array<PenTrajectory> = [];// 笔迹列表

let eventArea: Array<EventArea> = []; // 事件触发区域列表
let mouseX = 0;
let mouseY = 0;
let hasMousePosition = false; // 鼠标位置是否有效
let hoveredArea: EventArea | null = null;
let drawStatusPoint = false;
let drawStatusLine = false;
let drawStatusSegment = false;
let drawStatusPen = false;
let drawStatusEraser = false;
let isErasing = false;
let isDragging = false;
let isDrawing = false; // 是否正在绘制中（用于线和线段）
let isWriting = false; // 是否正在书写中（用于笔迹）
let isMoveCanvas = false; // 是否正在拖动画布
let drawLineStartPoint: Point | null = null; // 绘制起点（用于线）
let drawTempPoints: Array<Point> = []; // 临时存储绘制中的点
let drawPenTempTrajectory: PenTrajectory | null = null; // 临时存储绘制中的笔迹点
let dragStartX = 0;      // 拖动起始X坐标
let dragStartY = 0;      // 拖动起始Y坐标
let dragTotalX = 0;      // 累计X方向拖动长度
let dragTotalY = 0;      // 累计Y方向拖动长度
let lastDragX = 0;       // 上一次拖动的X位置
let lastDragY = 0;       // 上一次拖动的Y位置
let lastPenPoint: Point | null = null;    // 上一个笔迹点（用于压力计算）
let lastPenTime: number = 0;               // 上一个点的时间戳
let mouseLeftButtonDown = false; // 鼠标左键是否按下
let eraserRadius = 5; // 橡皮擦半径大小

let cdtRafCursorId: number | null = null;
let cdtLastMouseX = 0;//光标绘制节流Cursor drawing throttling
let cdtLastMouseY = 0;

let animationFrameId: number | null = null;                 // 动画帧ID
let lastTimestamp: number = 0;                              // 上一帧时间戳
let renderEntityList: Array<Entity> = [];                   // 要渲染的实体列表
let staticEntityList: StaticEntity[] = [];                  // 静态实体列表
let dynamicEntityList: DynamicEntity[] = [];                // 动态实体列表
let itemEntityList: ItemEntity[] = [];                      // 物品实体列表

let debugCollisionBoxes = false;
let debugShowTrajectory = false;
let debugShowFacingDirection = false;
let debugShowMovementPassion = false;
let debugShowMovementSpeed = false;
let debugShowMovementHealth = false;
let debugShowHunger = false;
let debugShowTag = false;
let debugShowMovementRange = false;
let debugShowInterestRange = false;
let debugTerminalVisible = false;
let debugTerminalInput = '';
let debugTerminalLogs: string[] = [];
let debugTerminalScrollOffset = 0; // 终端日志向上滚动的行偏移（0=最新）
let perspectiveMode: PerspectiveMode = 'third_person';
let firstPersonMoveW = false;
let firstPersonMoveA = false;
let firstPersonMoveS = false;
let firstPersonMoveD = false;


////////////////////
//<--变量区
////////////////////

////////////////////
//辅助函数区-->
////////////////////

// 辅助函数：点到无限直线距离
const H_pointToLineDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const cross = Math.abs((x2 - x1) * (y1 - py) - (y2 - y1) * (x1 - px));
  return cross / Math.sqrt(lenSq);
};

// 辅助函数：点到线段距离
const H_pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
};

/**
 * 道格拉斯-普克算法简化点集
 * @param points 原始点数组 (PenPoint[])
 * @param tolerance 容差 (像素单位)
 * @returns 简化后的点数组
 */
function H_simplifyPoints(points: PenPoint[], tolerance: number): PenPoint[] {
  if (points.length <= 2) return points;

  // 找到距离首尾连线最远的点
  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = H_perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // 如果最大距离大于容差，则递归简化两段
  if (maxDist > tolerance) {
    const left = points.slice(0, maxIndex + 1);
    const right = points.slice(maxIndex);
    const simplifiedLeft = H_simplifyPoints(left, tolerance);
    const simplifiedRight = H_simplifyPoints(right, tolerance);
    // 合并时注意去掉重复的中间点
    return simplifiedLeft.slice(0, -1).concat(simplifiedRight);
  } else {
    // 否则只保留首尾点
    return [first, last];
  }
}

/**
 * 计算点到线段的最短距离
 */
function H_perpendicularDistance(p: PenPoint, p1: PenPoint, p2: PenPoint): number {
  const x0 = p.x, y0 = p.y;
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // p1 和 p2 重合，直接计算到 p1 的距离
    return Math.hypot(x0 - x1, y0 - y1);
  }

  // 投影参数 t
  let t = ((x0 - x1) * dx + (y0 - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(x0 - projX, y0 - projY);
}

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
////////////////////
//<--辅助函数区
////////////////////

////////////////////
//初始化函数区-->
////////////////////
const startSetting = () => {
  onResizeCanvas();
  createEventArea();
  const loaded = localStorageLoad();
  if(!loaded){
    if (GRAPHICS_CANVAS.value) {
      const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
      offsetXX = width / 2;// 初始化原点偏移量为画布中心
      offsetYY = height / 2;
    }
  }

  if (UI_CANVAS.value) {// 添加事件监听（全部绑定到UI Canvas）
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

  // 初始化测试实体（移除所有静态障碍物）
  staticEntityList = [];
  dynamicEntityList = [];
  itemEntityList = [];
  renderEntityList = [];

  const catSpawnCenter = { x: -50, y: -50 };

  // 动态实体示例：猫-随机游走
  const cat1 = new RagdollCatDynamicEntity(
      { x: catSpawnCenter.x - 50, y: catSpawnCenter.y + 50 },
      'Cat a'
  );
  const cat2 = new RagdollCatDynamicEntity(
      { x: catSpawnCenter.x +50, y: catSpawnCenter.y -50 },
      'Cat b'
  );
  
  dynamicEntityList.push(cat1);
  dynamicEntityList.push(cat2);

  // 物品实体示例：烤鱼，可被动态实体拾取
  itemEntityList.push(
    new GrilledFishItemEntity({ x: catSpawnCenter.x - 100, y: catSpawnCenter.y - 40 }, 'Grilled Fish A'),
    new GrilledFishItemEntity({ x: catSpawnCenter.x + 80, y: catSpawnCenter.y + 20 }, 'Grilled Fish B'),
    new GrilledFishItemEntity({ x: catSpawnCenter.x + 50, y: catSpawnCenter.y + 300 }, 'Grilled Fish D'),
    new GrilledFishItemEntity({ x: catSpawnCenter.x - 50, y: catSpawnCenter.y + 250 }, 'Grilled Fish E'),
    new GrilledFishItemEntity({ x: catSpawnCenter.x -200, y: catSpawnCenter.y + 50 }, 'Grilled Fish F'),
    new GrilledFishItemEntity({ x: catSpawnCenter.x + 100, y: catSpawnCenter.y -200 }, 'Grilled Fish G')
  );
  // 将实体合并到 renderEntityList
  renderEntityList = [...staticEntityList, ...itemEntityList, ...dynamicEntityList];



  // 加载纹理并开始动画
  loadEntityTextures().then(() => {
    drawEntities();
    // 启动动画循环
    animationFrameId = requestAnimationFrame(animateEntities);
  });
  
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

const createEventArea = () => {
  eventArea = []; // 清空后重新创建
  // 为每个按钮创建事件区域
  BT1_INI.forEach(button => {
    eventArea.push({
      id: button.id,
      rect: {
        x: button.x,
        y: button.y,
        width: BT1_WIDTH,
        height: BT1_HEIGHT
      },
      type: 'button',
      data: button,
      cursor: 'pointer',
      onClick: (e, area) => {
        if (area.data?.onClick) {
          area.data.onClick();
        }
      },
      onHover: (e, area, isHovering) => {
        if (isHovering) {
          UI_CANVAS.value!.style.cursor = 'pointer';
        } else {
          UI_CANVAS.value!.style.cursor = 'default';
        }
      }
    });
  });
};

/**
 * 创建坐标轴刻度标记（图形层）
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

  // X轴刻度（在X轴上绘制）
  if (offsetYY >= 0 && offsetYY <= height) {
    // 计算X轴可见区域的坐标范围
    const minX = Math.min(canvasLeftTop.x, canvasRightBottom.x);
    const maxX = Math.max(canvasLeftTop.x, canvasRightBottom.x);

    // 计算第一个刻度的坐标（按gridSize取整）
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

  // Y轴刻度（在Y轴上绘制）
  if (offsetXX >= 0 && offsetXX <= width) {
    // 计算Y轴可见区域的坐标范围
    const minY = Math.min(canvasLeftTop.y, canvasRightBottom.y);
    const maxY = Math.max(canvasLeftTop.y, canvasRightBottom.y);

    // 计算第一个刻度的坐标（按gridSize取整）
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
 * 创建坐标辅助轴（带刻度）（图形层）
 * @param xColor X轴颜色
 * @param yColor Y轴颜色
 */
const createAxis = (xColor: RGB, yColor: RGB) => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);

  // 保存当前上下文状态
  ctxGraphics.save();

  // 绘制X轴（红色）
  ctxGraphics.beginPath();
  ctxGraphics.strokeStyle = `rgb(${xColor.r}, ${xColor.g}, ${xColor.b})`;
  ctxGraphics.lineWidth = 2;
  ctxGraphics.moveTo(0, offsetYY);
  ctxGraphics.lineTo(width, offsetYY);
  ctxGraphics.stroke();

  // 绘制Y轴（绿色）
  ctxGraphics.beginPath();
  ctxGraphics.strokeStyle = `rgb(${yColor.r}, ${yColor.g}, ${yColor.b})`;
  ctxGraphics.lineWidth = 2;
  ctxGraphics.moveTo(offsetXX, 0);
  ctxGraphics.lineTo(offsetXX, height);
  ctxGraphics.stroke();

  // 绘制箭头（X轴箭头）
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

  // 绘制箭头（Y轴箭头）
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
 * 绘制网格辅助线（图形层）
 */
const createGrid = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  const gridSize = 50 * scale; // 网格大小，随缩放比例变化

  ctxGraphics.save();
  ctxGraphics.strokeStyle = "#e0e0e0";
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
 * 绘制点
 */
const createPoint = (point: Point, inherentProp: InherentProp, customProp: Object): PointElement | boolean => {
  let element: PointElement = {
    id: elementIdIndex++,
    type: "point",
    points: [point],
    inherentProp: inherentProp,
    customProp: customProp
  };

  renderElementList.push(element);

  return element;
};

/**
 * 绘制直线
 */
const createLine = (points: Array<Point>, inherentProp: InherentProp, customProp: Object): LineElement | boolean => {
  if (points.length !== 2) return false;
  let element: LineElement = {
    id: elementIdIndex++,
    type: "line",
    points: points,
    inherentProp: inherentProp,
    customProp: customProp
  };

  renderElementList.push(element);

  return element;
};

/**
 * 绘制线段
 */
const createSegment = (points: Array<Point>, inherentProp: InherentProp, customProp: Object): SegmentElement | boolean => {
  if (points.length < 3) return false;
  let element: SegmentElement = {
    id: elementIdIndex++,
    type: "segment",
    points: points,
    inherentProp: inherentProp,
    customProp: customProp
  };

  renderElementList.push(element);

  return element;
};

////////////////////
//<--各种创建函数区
////////////////////

////////////////////
//其他函数区-->
////////////////////

/**
 * 清空画布所有内容
 */
const graphicsClear = () => {
  // 清空元素列表
  renderElementList = [];
  // 清空笔迹列表
  penTrajectoryList = []; 

  // 重置绘制状态
  drawStatusPoint = false;
  drawStatusLine = false;
  drawStatusSegment = false;
  drawStatusPen = false;
  drawStatusEraser = false;
  drawTempPoints = [];
  drawLineStartPoint = null;
  isDrawing = false;

  // 恢复鼠标样式
  if (UI_CANVAS.value) {
    if(cursorManager){
      cursorManager.setNowCursorType('default');
    }
  }

  // 重绘
  drawGraphics();
  drawUI();
};

/**
 * 保存数据到本地存储
 */
const localStorageSave = () => {
  const simplifiedTrajectories = penTrajectoryList.map(trajectory => {
    if (trajectory.list.length <= 2) return trajectory; // 少于2点不处理

    const simplifiedList = H_simplifyPoints(trajectory.list, 0.8); // 容差0.8像素
    return {
      ...trajectory,
      list: simplifiedList
    };
  });

  const state = {
    offsetXX,
    offsetYY,
    renderElementList,
    elementIdIndex,
    penTrajectoryList: simplifiedTrajectories
  };
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    console.log('状态已保存');
  } catch (e) {
    console.error('保存失败', e);
    alert('保存失败，可能是存储空间已满，请删除部分笔迹后重试');
  }
};

/**
 * 加载本地存储到数据
 */
const localStorageLoad = (): boolean => {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) return false;
  try {
    const state = JSON.parse(saved);
    if (state.offsetXX !== undefined) offsetXX = state.offsetXX;
    if (state.offsetYY !== undefined) offsetYY = state.offsetYY;
    if (state.renderElementList) renderElementList = state.renderElementList;
    if (state.elementIdIndex) {
      elementIdIndex = state.elementIdIndex;
    } else {
      // 兼容旧数据：计算最大id
      let maxId = 0;
      renderElementList.forEach(e => { if (e.id > maxId) maxId = e.id; });
      elementIdIndex = maxId + 1;
    }
    if (state.penTrajectoryList) penTrajectoryList = state.penTrajectoryList;
    return true;
  } catch (e) {
    console.error('加载失败', e);
    return false;
  }
};

/**
 * 将屏幕坐标转换为画布坐标
 * @param screenX 屏幕X坐标
 * @param screenY 屏幕Y坐标
 * @returns 画布坐标对象
 */
const TOscreen2Canvas = (screenX: number, screenY: number) => {
  return {
    x: screenX - offsetXX,
    y: offsetYY - screenY  // 因为屏幕Y轴向下，画布Y轴向上
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

/**
 * 绘制笔迹轨迹（图形层）
 */
const drawPenTrajectory = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;
  ctxGraphics.save();
  penTrajectoryList.forEach(trajectory => {
    if(ctxGraphics === null) return;
    if (trajectory.list.length === 0) return;
    const { startPoint, color, thickness, list } = trajectory;
    ctxGraphics.beginPath();
    ctxGraphics.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctxGraphics.lineWidth = thickness;
    ctxGraphics.lineCap = 'round';
    ctxGraphics.lineJoin = 'round';

    // 第一个点
    const firstScreen = TOcanvas2Screen(startPoint.x + list[0].x, startPoint.y + list[0].y);
    ctxGraphics.moveTo(firstScreen.x, firstScreen.y);

    for (let i = 1; i < list.length; i++) {
      const p = list[i];
      const screenPos = TOcanvas2Screen(startPoint.x + p.x, startPoint.y + p.y);
      ctxGraphics.lineTo(screenPos.x, screenPos.y);
    }
    ctxGraphics.stroke();
  });
  ctxGraphics.restore();
};

/**
 * 绘制正在绘制中的笔迹（图形层）
 */
const drawPenTrajectoryIng = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value || !drawPenTempTrajectory) return;
  const trajectory = drawPenTempTrajectory;
  if (trajectory.list.length === 0) return;
  ctxGraphics.save();
  const { startPoint, color, thickness, list } = trajectory;
  ctxGraphics.beginPath();
  ctxGraphics.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`;
  ctxGraphics.lineWidth = thickness;
  ctxGraphics.lineCap = 'round';
  ctxGraphics.lineJoin = 'round';
  ctxGraphics.setLineDash([5, 3]); // 虚线表示临时笔迹

  const firstScreen = TOcanvas2Screen(startPoint.x + list[0].x, startPoint.y + list[0].y);
  ctxGraphics.moveTo(firstScreen.x, firstScreen.y);

  for (let i = 1; i < list.length; i++) {
    const p = list[i];
    const screenPos = TOcanvas2Screen(startPoint.x + p.x, startPoint.y + p.y);
    ctxGraphics.lineTo(screenPos.x, screenPos.y);
  }
  ctxGraphics.stroke();
  ctxGraphics.restore();
};

/**
 * 绘制元素（图形层）
 */
const drawElement = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;

  // 遍历渲染列表中的所有元素
  renderElementList.forEach(element => {
    if (ctxGraphics === null) return;
    // 保存当前上下文状态
    ctxGraphics.save();

    // 设置通用属性
    if (element.inherentProp.color) {
      ctxGraphics.strokeStyle = `rgb(${element.inherentProp.color.r}, ${element.inherentProp.color.g}, ${element.inherentProp.color.b})`;
      ctxGraphics.fillStyle = `rgb(${element.inherentProp.color.r}, ${element.inherentProp.color.g}, ${element.inherentProp.color.b})`;
    }

    // 设置透明度
    if (element.inherentProp.opacity) {
      ctxGraphics.globalAlpha = element.inherentProp.opacity;
    }

    // 根据元素类型绘制
    switch (element.type) {
      case 'point':
        drawPointElement(element as PointElement);
        break;
      case 'line':
        drawLineElement(element as LineElement);
        break;
      case 'segment':
        drawSegmentElement(element as SegmentElement);
        break;
    }

    // 恢复上下文状态
    ctxGraphics.restore();
  });
};

/**
 * 绘制点元素（图形层）
 */
const drawPointElement = (element: PointElement) => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value || element.points.length === 0) return;

  const point = element.points[0];

  // 将画布坐标转换为屏幕坐标
  const screenPos = TOcanvas2Screen(point.x, point.y);

  ctxGraphics.beginPath();

  // 绘制点（半径为5的圆）
  ctxGraphics.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
  ctxGraphics.fill();

  // 绘制点的边框
  ctxGraphics.strokeStyle = '#000';
  ctxGraphics.lineWidth = 1;
  ctxGraphics.stroke();

  // 绘制点的名称（如果有）
  if (element.inherentProp.name) {
    ctxGraphics.font = '12px Arial';
    ctxGraphics.fillStyle = '#000';
    ctxGraphics.globalAlpha = 1;
    ctxGraphics.fillText(element.inherentProp.name, screenPos.x + 10, screenPos.y - 10);
  }
};

/**
 * 绘制直线元素（图形层）
 */
const drawLineElement = (element: LineElement) => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value || element.points.length < 2) return;

  const startPoint = element.points[0];
  const endPoint = element.points[1];

  // 将画布坐标转换为屏幕坐标
  const startScreen = TOcanvas2Screen(startPoint.x, startPoint.y);
  const endScreen = TOcanvas2Screen(endPoint.x, endPoint.y);

  ctxGraphics.beginPath();
  ctxGraphics.moveTo(startScreen.x, startScreen.y);
  ctxGraphics.lineTo(endScreen.x, endScreen.y);

  // 设置线宽
  ctxGraphics.lineWidth = 2;
  ctxGraphics.stroke();

  // 绘制直线上的两个端点标记
  ctxGraphics.beginPath();
  ctxGraphics.arc(startScreen.x, startScreen.y, 3, 0, Math.PI * 2);
  ctxGraphics.fillStyle = '#00f';
  ctxGraphics.fill();

  ctxGraphics.beginPath();
  ctxGraphics.arc(endScreen.x, endScreen.y, 3, 0, Math.PI * 2);
  ctxGraphics.fill();

  // 绘制直线名称
  if (element.inherentProp.name) {
    // 计算中点位置
    const midX = (startScreen.x + endScreen.x) / 2;
    const midY = (startScreen.y + endScreen.y) / 2;

    ctxGraphics.font = '12px Arial';
    ctxGraphics.fillStyle = '#000';
    ctxGraphics.globalAlpha = 1;
    ctxGraphics.fillText(element.inherentProp.name, midX + 10, midY - 10);
  }
  // 绘制每个顶点的标记
  element.points.forEach((point, index) => {
    if (ctxGraphics === null) return;
    const screenPos = TOcanvas2Screen(point.x, point.y);

    ctxGraphics.beginPath();
    ctxGraphics.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
    ctxGraphics.fillStyle = '#f00';
    ctxGraphics.fill();
    ctxGraphics.strokeStyle = '#000';
    ctxGraphics.lineWidth = 1;
    ctxGraphics.stroke();

    // 绘制顶点编号
    ctxGraphics.font = '10px Arial';
    ctxGraphics.fillStyle = '#000';
    ctxGraphics.globalAlpha = 1;
    ctxGraphics.fillText(index.toString(), screenPos.x + 8, screenPos.y - 8);
  });
};

/**
 * 绘制线段元素（图形层）
 */
const drawSegmentElement = (element: SegmentElement) => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value || element.points.length < 2) return;
  let ptLength = element.points.length - 1;
  ctxGraphics.beginPath();

  // 将第一个点转换为屏幕坐标并移动到该点
  const firstScreen = TOcanvas2Screen(element.points[0].x, element.points[0].y);
  ctxGraphics.moveTo(firstScreen.x, firstScreen.y);

  // 依次连接各个点
  for (let i = 1; i < element.points.length; i++) {
    const screenPos = TOcanvas2Screen(element.points[i].x, element.points[i].y);
    ctxGraphics.lineTo(screenPos.x, screenPos.y);
  }

  // 如果是闭合线段（首尾相连），可以填充
  const isClosed =
    element.points[0].x === element.points[element.points.length - 1].x &&
    element.points[0].y === element.points[element.points.length - 1].y;

  if (isClosed) {
    // 闭合路径
    ctxGraphics.closePath();
    // 填充
    ctxGraphics.globalAlpha = element.inherentProp.opacity * 0.3;
    ctxGraphics.fill();
    // 描边
    ctxGraphics.globalAlpha = element.inherentProp.opacity;
    ctxGraphics.stroke();
  } else {
    // 只描边
    ctxGraphics.stroke();
  }

  // 绘制每个顶点的标记
  element.points.forEach((point, index) => {
    if (ctxGraphics === null) return;
    if (isClosed) { if (index === ptLength) { return; } }
    const screenPos = TOcanvas2Screen(point.x, point.y);

    ctxGraphics.beginPath();
    ctxGraphics.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
    ctxGraphics.fillStyle = '#f00';
    ctxGraphics.fill();
    ctxGraphics.strokeStyle = '#000';
    ctxGraphics.lineWidth = 1;
    ctxGraphics.stroke();

    // 绘制顶点编号
    ctxGraphics.font = '10px Arial';
    ctxGraphics.fillStyle = '#000';
    ctxGraphics.globalAlpha = 1;
    ctxGraphics.fillText(index.toString(), screenPos.x + 8, screenPos.y - 8);
  });

  // 绘制线段名称
  if (element.inherentProp.name) {
    // 计算中心点
    let sumX = 0, sumY = 0;
    element.points.forEach(point => {
      sumX += point.x;
      sumY += point.y;
    });
    const centerX = sumX / element.points.length;
    const centerY = sumY / element.points.length;
    const screenCenter = TOcanvas2Screen(centerX, centerY);

    ctxGraphics.font = '12px Arial';
    ctxGraphics.fillStyle = '#000';
    ctxGraphics.globalAlpha = 1;
    ctxGraphics.fillText(element.inherentProp.name, screenCenter.x + 10, screenCenter.y - 10);
  }
};

/**
 * 绘制图形添加按钮（UI层）
 */
const drawUIButtons = (CtxUi: CanvasRenderingContext2D) => {

  const startX = BT1_PADDING;
  const startY = BT1_PADDING;

  CtxUi.save();

  // 绘制面板背景
  const panelWidth = BT1_WIDTH + 40;
  const panelHeight = BT1_INI.length * (BT1_HEIGHT + BT1_SPACING) + 40 - BT1_SPACING;
  CtxUi.beginPath();
  createRoundRect(CtxUi, startX - 15, startY - 15, panelWidth, panelHeight, 12);
  CtxUi.fillStyle = 'rgba(255,255,255,0.8)';
  CtxUi.fill();
  CtxUi.shadowColor = 'rgba(0, 0, 0, 0.1)';
  CtxUi.shadowBlur = 5;
  CtxUi.shadowOffsetX = 1;
  CtxUi.shadowOffsetY = 1;

  // 重置阴影（避免影响后续绘制）
  CtxUi.shadowColor = 'transparent';

  // 绘制每个按钮
  BT1_INI.forEach((button) => {
    if(CtxUi===null)return;
    const x = button.x;
    const y = button.y;

    // 根据当前模式决定按钮背景色强度
    let isActive = false;
    if (button.type === 'point' && drawStatusPoint) isActive = true;
    if (button.type === 'line' && drawStatusLine) isActive = true;
    if (button.type === 'segment' && drawStatusSegment) isActive = true;
    if (button.type === 'pen' && drawStatusPen) isActive = true;
    if (button.type === 'eraser' && drawStatusEraser) isActive = true;

    const bgOpacity = isActive ? 0.3 : 0.1;
    CtxUi.fillStyle = `rgba(${button.color.r}, ${button.color.g}, ${button.color.b}, ${bgOpacity})`;
    CtxUi.shadowColor = 'rgba(0, 0, 0, 0.1)';
    CtxUi.shadowBlur = 5;
    CtxUi.shadowOffsetX = 1;
    CtxUi.shadowOffsetY = 1;
    CtxUi.beginPath();
    createRoundRect(CtxUi, x, y, BT1_WIDTH, BT1_HEIGHT, 8);
    CtxUi.fill();

    // 绘制按钮边框
    CtxUi.strokeStyle = `rgb(${button.color.r}, ${button.color.g}, ${button.color.b})`;
    CtxUi.lineWidth = 2;
    CtxUi.shadowBlur = 0;
    CtxUi.stroke();

    // 绘制图标（大圆点）
    CtxUi.font = '30px "Segoe UI", Arial, sans-serif';
    CtxUi.fillStyle = `rgb(${button.color.r}, ${button.color.g}, ${button.color.b})`;
    CtxUi.textAlign = 'center';
    CtxUi.textBaseline = 'middle';
    CtxUi.fillText(button.icon, x + 25, y + BT1_HEIGHT / 2);

    // 绘制按钮文字
    CtxUi.font = 'bold ' + button.size + 'px "Microsoft YaHei", Arial, sans-serif';
    CtxUi.fillStyle = '#333';
    CtxUi.textAlign = 'left';
    CtxUi.fillText(button.label, x + 45, y + BT1_HEIGHT / 2);
  });

  // 绘制分隔线
  CtxUi.beginPath();
  CtxUi.strokeStyle = '#ddd';
  CtxUi.lineWidth = 1;
  CtxUi.setLineDash([5, 3]);
  CtxUi.moveTo(startX - 5, startY + BT1_INI.length * (BT1_HEIGHT + BT1_SPACING) + 5);
  CtxUi.lineTo(startX + BT1_WIDTH + 5, startY + BT1_INI.length * (BT1_HEIGHT + BT1_SPACING) + 5);
  CtxUi.stroke();

  // 重置虚线设置
  CtxUi.setLineDash([]);

  CtxUi.restore();
};

/**
 * 绘制顶部提示信息（UI层）
 */
const drawInstructions = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  if (!CtxUi || !CANVAS) return;
  const { width } = H_getCanvasCssSize(CANVAS);
  const text = 'Ctrl + S = Save    Ctrl + F = Clear    ~ = Debug Terminal';
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
 * 绘制调试终端（UI层）
 */
const drawDebugTerminal = (CtxUi: CanvasRenderingContext2D, CANVAS: HTMLCanvasElement) => {
  if (!debugTerminalVisible) return;

  const { height, width } = H_getCanvasCssSize(CANVAS);
  const terminalWidth = Math.min(560, Math.max(320, width - 30));
  const terminalHeight = 220;
  const x = 12;
  const y = height - terminalHeight - 12;

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
 * 绘制比例尺（UI层）
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
 * 绘制图形层（网格、轴、元素、临时预览）
 */
const drawGraphics = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);

  // 清空画布
  ctxGraphics.clearRect(0, 0, width, height);

  // 设置背景色
  ctxGraphics.fillStyle = '#f0f0f0';
  ctxGraphics.fillRect(0, 0, width, height);

  // 绘制网格
  createGrid();

  // 绘制坐标轴
  createAxis({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 });

  // 绘制刻度与刻度数值
  createAxisMark();

  // 渲染元素
  drawElement();

  // 渲染笔迹
  drawPenTrajectory();

  // 绘制正在绘制中的笔迹
  drawPenTrajectoryIng();

  // 绘制临时线段预览（如果正在绘制线段）
  if (drawStatusSegment && drawTempPoints.length >= 1) {
    drawTempSegment();
  }
  
  // 绘制临时点预览（如果正在绘制线且已有第一个点）
  if (drawStatusLine && drawLineStartPoint) {
    showTempPoint(drawLineStartPoint);
    
    // 如果有鼠标位置，可以显示从起点到鼠标的预览线
    if (hasMousePosition) {
      ctxGraphics.save();
      ctxGraphics.beginPath();
      const startScreen = TOcanvas2Screen(drawLineStartPoint.x, drawLineStartPoint.y);
      ctxGraphics.moveTo(startScreen.x, startScreen.y);
      ctxGraphics.lineTo(mouseX, mouseY);
      ctxGraphics.strokeStyle = 'rgba(52, 168, 83, 0.5)';
      ctxGraphics.lineWidth = 2;
      ctxGraphics.setLineDash([5, 3]);
      ctxGraphics.stroke();
      ctxGraphics.restore();
    }
  }
};

/**
 * 绘制所有实体到 canvas-entity
 */
const drawEntities = () => {
  if (!ctxEntity || !ENTITY_CANVAS.value) return;

  const { width, height } = H_getCanvasCssSize(ENTITY_CANVAS.value);
  ctxEntity.clearRect(0, 0, width, height);

  // 绘制静态实体
  staticEntityList.forEach(entity => drawSingleEntity(entity));
  // 绘制物品实体
  itemEntityList.forEach(entity => drawSingleEntity(entity));
  // 绘制动态实体
  dynamicEntityList.forEach(entity => drawSingleEntity(entity));

  // 绘制碰撞盒调试框
  if (debugCollisionBoxes) {
    drawDebugCollisionBoxes();
  }

  // 绘制调试轨迹
  if (debugShowTrajectory) {
    drawDebugHistoricalTrajectory();
  }

  // 绘制朝向调试箭头
  if (debugShowFacingDirection) {
    drawDebugFacingDirection();
  }

  // 绘制随机游走范围调试圆
  if (debugShowMovementRange) {
    drawDebugMovementRange();
  }

  // 绘制兴趣范围调试圆（烤鱼吸引半径）
  if (debugShowInterestRange) {
    drawDebugInterestRange();
  }
};

/**
 * 绘制UI层（按钮、标尺、提示）
 */
const drawUI = () => {
  if (!ctxUi || !UI_CANVAS.value) return;
  const { width, height } = H_getCanvasCssSize(UI_CANVAS.value);
  ctxUi.clearRect(0, 0, width, height);
  drawUIButtons(ctxUi);
  drawUIRuler(ctxUi, UI_CANVAS.value);
  drawInstructions(ctxUi, UI_CANVAS.value);
  drawEraserPreview(ctxUi);
  drawDebugTerminal(ctxUi, UI_CANVAS.value);
};

/**
 *  绘制橡皮擦范围预览
 */
const drawEraserPreview = (CtxUi: CanvasRenderingContext2D) => {
  if (drawStatusEraser && hasMousePosition && mouseLeftButtonDown) {//仅在橡皮擦模式下且鼠标在画布内
    CtxUi.save();
    CtxUi.beginPath();
    CtxUi.arc(mouseX, mouseY, eraserRadius, 0, Math.PI * 2);
    CtxUi.strokeStyle = 'rgba(128,128,128,0.5)';
    CtxUi.lineWidth = 2;
    CtxUi.setLineDash([3, 3]);
    CtxUi.stroke();
    CtxUi.fillStyle = 'rgba(128,128,128,0.1)';
    CtxUi.fill();
    CtxUi.restore();
  }
};

/**
 * 绘制临时线段（预览，图形层）
 */
const drawTempSegment = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value || drawTempPoints.length < 2) return;
  
  ctxGraphics.save();
  ctxGraphics.beginPath();
  
  const firstScreen = TOcanvas2Screen(drawTempPoints[0].x, drawTempPoints[0].y);
  ctxGraphics.moveTo(firstScreen.x, firstScreen.y);
  
  for (let i = 1; i < drawTempPoints.length; i++) {
    const screenPos = TOcanvas2Screen(drawTempPoints[i].x, drawTempPoints[i].y);
    ctxGraphics.lineTo(screenPos.x, screenPos.y);
  }
  
  ctxGraphics.strokeStyle = '#ff9900';
  ctxGraphics.lineWidth = 2;
  ctxGraphics.setLineDash([5, 3]); // 虚线表示预览
  ctxGraphics.stroke();
  
  // 绘制临时点
  drawTempPoints.forEach(point => {
    showTempPoint(point);
  });
  
  ctxGraphics.restore();
};

/**
 * 绘制单个实体
 */
const drawSingleEntity = (entity: Entity) => {
  if (!ctxEntity) return;

  const screenPos = TOcanvas2Screen(entity.position.x, entity.position.y);
  const halfW = entity.width / 2;
  const halfH = entity.height / 2;
  const left = screenPos.x - halfW;
  const top = screenPos.y - halfH;

  // 物品实体：按寿命分段透明 + 独立消失特效
  if (entity.type === 'item') {
    const item = entity as ItemEntity;
    const lifeOpacity = item.getLifetimeOpacity();
    const disappearProgress = item.isDisappearing && item.disappearDuration > 0
      ? 1 - item.disappearTimer / item.disappearDuration
      : 0;
    const clampedDisappearProgress = Math.max(0, Math.min(1, disappearProgress));
    const spriteAlpha = item.isDisappearing
      ? lifeOpacity * (1 - clampedDisappearProgress)
      : lifeOpacity;

    ctxEntity.save();
    ctxEntity.globalAlpha = Math.max(0, Math.min(1, spriteAlpha));
    if (entity.texture && entity.texture.loaded) {
      ctxEntity.drawImage(entity.texture.img, left, top, entity.width, entity.height);
    } else {
      ctxEntity.fillStyle = '#f5c16c';
      ctxEntity.fillRect(left, top, entity.width, entity.height);
      ctxEntity.strokeStyle = '#000';
      ctxEntity.strokeRect(left, top, entity.width, entity.height);
    }
    ctxEntity.restore();

    // 物品消失特效：金色碎光与径向光晕（与动态实体死亡特效区分）
    if (item.isDisappearing) {
      const p = clampedDisappearProgress;
      const baseRadius = Math.max(entity.width, entity.height) * (0.3 + p * 0.9);
      const alpha = 1 - p;
      ctxEntity.save();

      ctxEntity.beginPath();
      ctxEntity.arc(screenPos.x, screenPos.y, baseRadius, 0, Math.PI * 2);
      ctxEntity.strokeStyle = `rgba(255, 215, 120, ${alpha})`;
      ctxEntity.lineWidth = 2;
      ctxEntity.stroke();

      const rays = 6;
      for (let i = 0; i < rays; i++) {
        const angle = p * Math.PI * 2 + (i * Math.PI * 2) / rays;
        const inner = baseRadius * 0.6;
        const outer = baseRadius * 1.25;
        ctxEntity.beginPath();
        ctxEntity.moveTo(
          screenPos.x + Math.cos(angle) * inner,
          screenPos.y + Math.sin(angle) * inner
        );
        ctxEntity.lineTo(
          screenPos.x + Math.cos(angle) * outer,
          screenPos.y + Math.sin(angle) * outer
        );
        ctxEntity.strokeStyle = `rgba(255, 235, 150, ${alpha * 0.9})`;
        ctxEntity.lineWidth = 1.5;
        ctxEntity.stroke();
      }

      ctxEntity.beginPath();
      ctxEntity.arc(screenPos.x, screenPos.y, baseRadius * 0.45, 0, Math.PI * 2);
      ctxEntity.fillStyle = `rgba(255, 240, 170, ${alpha * 0.25})`;
      ctxEntity.fill();

      ctxEntity.restore();
    }

    ctxEntity.font = '12px "Microsoft YaHei"';
    ctxEntity.fillStyle = '#ffffff';
    ctxEntity.shadowColor = 'rgba(0,0,0,0.5)';
    ctxEntity.shadowBlur = 2;
    ctxEntity.textAlign = 'center';
    ctxEntity.textBaseline = 'top';
    ctxEntity.fillText(entity.name, screenPos.x, screenPos.y + halfH + 6);
    if (debugShowTag && entity.tag) {
      ctxEntity.font = '10px Arial';
      ctxEntity.fillStyle = '#ffff00';
      ctxEntity.fillText(entity.tag, screenPos.x, screenPos.y + halfH + 20);
    }
    ctxEntity.textAlign = 'start';
    ctxEntity.textBaseline = 'alphabetic';
    ctxEntity.shadowColor = 'transparent';
    return;
  }

  // 动态实体死亡特效：贴图淡出 + 扩散光环
  if (entity.type === 'dynamic') {
    const dynamicEntity = entity as DynamicEntity;
    if (dynamicEntity.isDead) {
      const progress = dynamicEntity.deathEffectDuration <= 0
        ? 1
        : 1 - dynamicEntity.deathEffectTimer / dynamicEntity.deathEffectDuration;
      const clampedProgress = Math.max(0, Math.min(1, progress));

      ctxEntity.save();
      ctxEntity.globalAlpha = 1 - clampedProgress;
      if (entity.texture && entity.texture.loaded) {
        ctxEntity.drawImage(
          entity.texture.img,
          left,
          top,
          entity.width,
          entity.height
        );
      } else {
        ctxEntity.fillStyle = '#66cc66';
        ctxEntity.fillRect(left, top, entity.width, entity.height);
      }
      ctxEntity.restore();

      ctxEntity.save();
      const ringRadius = Math.max(entity.width, entity.height) * (0.35 + clampedProgress * 1.1);
      ctxEntity.beginPath();
      ctxEntity.arc(screenPos.x, screenPos.y, ringRadius, 0, Math.PI * 2);
      ctxEntity.strokeStyle = `rgba(255, 80, 20, ${1 - clampedProgress})`;
      ctxEntity.lineWidth = 3;
      ctxEntity.stroke();

      ctxEntity.beginPath();
      ctxEntity.arc(screenPos.x, screenPos.y, ringRadius * 0.55, 0, Math.PI * 2);
      ctxEntity.fillStyle = `rgba(255, 40, 0, ${(1 - clampedProgress) * 0.25})`;
      ctxEntity.fill();
      ctxEntity.restore();
      return;
    }
  }

  // 绘制纹理或默认颜色
  if (entity.texture && entity.texture.loaded) {
    ctxEntity.drawImage(
      entity.texture.img,
      left,
      top,
      entity.width,
      entity.height
    );
  } else {
    // 默认颜色填充-根据类型不同
    ctxEntity.fillStyle = entity.type === 'static' ? '#aaaaaa' : '#66cc66';
    ctxEntity.fillRect(left, top, entity.width, entity.height);
    ctxEntity.strokeStyle = '#000';
    ctxEntity.strokeRect(left, top, entity.width, entity.height);
  }

  // 动态实体受伤时：在原贴图上叠加半透明红色（仅作用于非透明像素）
  if (entity.type === 'dynamic') {
    const dynamicEntity = entity as DynamicEntity;
    if (dynamicEntity.damageFlashTimer > 0) {
      const intensity = Math.min(1, dynamicEntity.damageFlashTimer / 0.25);
      ctxEntity.save();
      ctxEntity.globalCompositeOperation = 'source-atop';
      ctxEntity.fillStyle = `rgba(255, 0, 0, ${0.45 * intensity})`;
      ctxEntity.fillRect(left, top, entity.width, entity.height);
      ctxEntity.restore();
    }
  }

  // 动态实体顶部状态条：生命值（绿）+ 饥饿值（黄）
  if (entity.type === 'dynamic') {
    const dynamicEntity = entity as DynamicEntity;
    const healthMax = dynamicEntity instanceof CatDynamicEntity ? 50 : 100;
    const healthRatio = Math.max(0, Math.min(1, dynamicEntity.health / healthMax));
    const hungerRatio = dynamicEntity instanceof CatDynamicEntity
      ? Math.max(0, Math.min(1, dynamicEntity.hungerMeter / 200))
      : 0;
    const barWidth = Math.max(36, entity.width);
    const barHeight = 4;
    const barX = screenPos.x - barWidth / 2;
    const topY = screenPos.y - halfH - 16;

    // 血条底
    ctxEntity.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctxEntity.fillRect(barX, topY, barWidth, barHeight);
    // 血条值
    ctxEntity.fillStyle = '#2ecc71';
    ctxEntity.fillRect(barX, topY, barWidth * healthRatio, barHeight);

    // 饥饿条底
    const hungerY = topY + barHeight + 3;
    ctxEntity.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctxEntity.fillRect(barX, hungerY, barWidth, barHeight);
    // 饥饿条值
    ctxEntity.fillStyle = '#f1c40f';
    ctxEntity.fillRect(barX, hungerY, barWidth * hungerRatio, barHeight);
  }

  // 绘制属性标签-名称
  ctxEntity.font = '12px "Microsoft YaHei"';
  ctxEntity.fillStyle = '#ffffff';
  ctxEntity.shadowColor = 'rgba(0,0,0,0.5)';
  ctxEntity.shadowBlur = 2;
  ctxEntity.textAlign = 'center';
  ctxEntity.textBaseline = 'top';
  ctxEntity.fillText(entity.name, screenPos.x, screenPos.y + halfH + 6);
  if (debugShowTag && entity.tag) {
    ctxEntity.font = '10px Arial';
    ctxEntity.fillStyle = '#ffff00';
    ctxEntity.fillText(entity.tag, screenPos.x, screenPos.y + halfH + 20);
  }

  // 动态实体调试文本：从下到上逐行叠加显示
  if (entity.type === 'dynamic' && (debugShowMovementPassion || debugShowMovementSpeed || debugShowMovementHealth || debugShowHunger)) {
    const dynamicEntity = entity as DynamicEntity;
    const debugLines: string[] = [];
    if (debugShowHunger && dynamicEntity instanceof CatDynamicEntity) {
      debugLines.push(`hunger: ${dynamicEntity.hungerMeter.toFixed(0)}`);
    }
    if (debugShowMovementHealth) {
      debugLines.push(`health: ${dynamicEntity.health.toFixed(0)}`);
    }
    if (debugShowMovementSpeed) {
      debugLines.push(`speed: ${dynamicEntity.speed.toFixed(2)}`);
    }
    if (debugShowMovementPassion) {
      debugLines.push(`passion: ${(dynamicEntity.movementPassion * 100).toFixed(1)}%`);
    }

    if (debugLines.length > 0) {
      const lineHeight = 14;
      const baseY = screenPos.y - halfH - 28; // 最靠近头部的一行
      ctxEntity.font = '11px Consolas, "Courier New", monospace';
      ctxEntity.fillStyle = '#87cefa';
      ctxEntity.textAlign = 'center';
      ctxEntity.textBaseline = 'bottom';

      for (let i = 0; i < debugLines.length; i++) {
        ctxEntity.fillText(debugLines[i], screenPos.x, baseY - i * lineHeight);
      }
    }
  }

  // 恢复默认文本排版设置，避免影响其他绘制
  ctxEntity.textAlign = 'start';
  ctxEntity.textBaseline = 'alphabetic';
  ctxEntity.shadowColor = 'transparent';
};

/**
 * 绘制动态实体的历史移动轨迹（调试用）
 * 显示曲线路径、历史目标点、当前目标点
 */
const drawDebugHistoricalTrajectory = () => {
  if (!ctxEntity) return;
  ctxEntity.save();

  for (const entity of dynamicEntityList) {
    // 1. 绘制平滑曲线路径（计划路径）
    if (entity.curvePoints && entity.curvePoints.length > 1) {
      ctxEntity.beginPath();
      ctxEntity.lineWidth = 2;
      ctxEntity.strokeStyle = '#00ffff';  // 青色
      ctxEntity.setLineDash([5, 5]);      // 虚线

      const firstScreen = TOcanvas2Screen(entity.curvePoints[0].x, entity.curvePoints[0].y);
      ctxEntity.moveTo(firstScreen.x, firstScreen.y);
      for (let i = 1; i < entity.curvePoints.length; i++) {
        const screenPos = TOcanvas2Screen(entity.curvePoints[i].x, entity.curvePoints[i].y);
        ctxEntity.lineTo(screenPos.x, screenPos.y);
      }
      ctxEntity.stroke();
    }

    // 2. 绘制历史目标点（targetHistory）
    if (entity.targetHistory && entity.targetHistory.length > 0) {
      ctxEntity.fillStyle = 'rgba(255, 165, 0, 0.8)'; // 橙色
      ctxEntity.strokeStyle = '#000';
      ctxEntity.lineWidth = 1;
      ctxEntity.setLineDash([]);
      for (const pt of entity.targetHistory) {
        const screenPos = TOcanvas2Screen(pt.x, pt.y);
        ctxEntity.beginPath();
        ctxEntity.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2);
        ctxEntity.fill();
        ctxEntity.stroke();
      }
    }

    // 3. 绘制下一个目标点（nextTarget）
    const nextTarget = entity.nextTarget;
    if (nextTarget && !(nextTarget.x === entity.position.x && nextTarget.y === entity.position.y)) {
      const screenPos = TOcanvas2Screen(nextTarget.x, nextTarget.y);
      ctxEntity.beginPath();
      ctxEntity.arc(screenPos.x, screenPos.y, 6, 0, Math.PI * 2);
      ctxEntity.fillStyle = 'rgba(255, 0, 0, 0.6)'; // 半透明红
      ctxEntity.fill();
      ctxEntity.strokeStyle = '#fff';
      ctxEntity.stroke();
    }
  }

  ctxEntity.restore();
};

/**
 * 绘制碰撞盒调试框
 */
const drawDebugCollisionBoxes = () => {
  if (!ctxEntity) return;
  ctxEntity.save();
  ctxEntity.strokeStyle = '#ff0000';
  ctxEntity.lineWidth = 1;
  ctxEntity.setLineDash([4, 4]);
  [...staticEntityList, ...dynamicEntityList].forEach(entity => {
    if(ctxEntity===null)return;
    const box = entity.collisionBox;
    const topLeft = TOcanvas2Screen(box.x, box.y + box.height); // 注意Y轴转换
    const width = box.width;
    const height = box.height;
    ctxEntity.strokeRect(topLeft.x, topLeft.y, width, height);
  });
  ctxEntity.restore();
};

/**
 * 绘制动态实体朝向箭头（调试用）
 */
const drawDebugFacingDirection = () => {
  if (!ctxEntity) return;
  ctxEntity.save();
  ctxEntity.strokeStyle = '#1e90ff';
  ctxEntity.fillStyle = '#1e90ff';
  ctxEntity.lineWidth = 2;
  ctxEntity.setLineDash([]);

  for (const entity of dynamicEntityList) {
    const center = TOcanvas2Screen(entity.position.x, entity.position.y);
    const direction = entity.facingDirection;
    const dirLen = Math.hypot(direction.x, direction.y);
    if (dirLen < 0.0001) continue;

    const unitX = direction.x / dirLen;
    const unitY = direction.y / dirLen;
    const arrowLength = Math.max(entity.width, entity.height) * 0.9;
    const tipCanvas = {
      x: entity.position.x + unitX * arrowLength,
      y: entity.position.y + unitY * arrowLength,
    };
    const tip = TOcanvas2Screen(tipCanvas.x, tipCanvas.y);

    // 箭身
    ctxEntity.beginPath();
    ctxEntity.moveTo(center.x, center.y);
    ctxEntity.lineTo(tip.x, tip.y);
    ctxEntity.stroke();

    // 箭头
    const headLength = 8;
    const angle = Math.atan2(tip.y - center.y, tip.x - center.x);
    ctxEntity.beginPath();
    ctxEntity.moveTo(tip.x, tip.y);
    ctxEntity.lineTo(
      tip.x - headLength * Math.cos(angle - Math.PI / 6),
      tip.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctxEntity.lineTo(
      tip.x - headLength * Math.cos(angle + Math.PI / 6),
      tip.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctxEntity.closePath();
    ctxEntity.fill();
  }

  ctxEntity.restore();
};

/**
 * 绘制动态实体随机游走范围（调试用）
 */
const drawDebugMovementRange = () => {
  if (!ctxEntity) return;
  ctxEntity.save();
  ctxEntity.strokeStyle = 'rgba(0, 255, 127, 0.75)';
  ctxEntity.lineWidth = 1.5;
  ctxEntity.setLineDash([6, 4]);

  for (const entity of dynamicEntityList) {
    const center = TOcanvas2Screen(entity.position.x, entity.position.y);
    const radius = Math.max(1, entity.wanderRange);
    ctxEntity.beginPath();
    ctxEntity.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctxEntity.stroke();
  }

  ctxEntity.restore();
};

/**
 * 绘制猫的兴趣范围（烤鱼吸引半径，调试用）
 */
const drawDebugInterestRange = () => {
  if (!ctxEntity) return;
  ctxEntity.save();
  ctxEntity.strokeStyle = 'rgba(255, 165, 0, 0.9)';
  ctxEntity.lineWidth = 1.5;
  ctxEntity.setLineDash([4, 4]);

  for (const entity of dynamicEntityList) {
    if (!(entity instanceof CatDynamicEntity)) continue;
    const center = TOcanvas2Screen(entity.position.x, entity.position.y);
    ctxEntity.beginPath();
    ctxEntity.arc(center.x, center.y, Math.max(1, entity.perceptionRange), 0, Math.PI * 2);
    ctxEntity.stroke();
  }

  ctxEntity.restore();
};

/**
 * 显示临时点（用于绘制中的预览，图形层）
 */
const showTempPoint = (point: Point) => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;
  
  const screenPos = TOcanvas2Screen(point.x, point.y);
  
  ctxGraphics.save();
  ctxGraphics.beginPath();
  ctxGraphics.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
  ctxGraphics.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctxGraphics.fill();
  ctxGraphics.strokeStyle = '#ff9900';
  ctxGraphics.lineWidth = 2;
  ctxGraphics.stroke();
  ctxGraphics.restore();
};

/**
 * 显示点击效果（图形层）
 */
const showClickEffect = (x: number, y: number) => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;

  // 保存当前上下文状态
  ctxGraphics.save();

  // 绘制点击波纹效果
  let radius = 0;
  const maxRadius = 20;
  const startTime = performance.now();

  const animateRipple = () => {
    const currentTime = performance.now();
    const progress = (currentTime - startTime) / 300; // 300ms动画
    if (ctxGraphics === null) return;
    if (progress < 1) {
      radius = maxRadius * progress;

      // 重绘整个画布（需要触发完整重绘）
      drawGraphics();

      // 在顶部绘制点击效果
      ctxGraphics.beginPath();
      ctxGraphics.arc(x, y, radius, 0, Math.PI * 2);
      ctxGraphics.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctxGraphics.lineWidth = 2;
      ctxGraphics.stroke();

      ctxGraphics.beginPath();
      ctxGraphics.arc(x, y, radius * 0.7, 0, Math.PI * 2);
      ctxGraphics.strokeStyle = 'rgba(100, 100, 255, 0.6)';
      ctxGraphics.lineWidth = 1.5;
      ctxGraphics.stroke();

      requestAnimationFrame(animateRipple);
    } else {
      // 动画结束，重绘清除效果
      drawGraphics();
    }
  };

  requestAnimationFrame(animateRipple);
};

/**
 * 擦除鼠标周围的所有元素
 * @param screenX 鼠标屏幕X坐标
 * @param screenY 鼠标屏幕Y坐标
 * @returns 是否删除了元素
 */
const eraserElements = (screenX: number, screenY: number): boolean => {
  const elementsToDelete = new Set<number>();
  const trajectoriesToDelete = new Set<number>();

  // 检查几何元素
  renderElementList.forEach(el => {
    if (el.type === 'point') {
      const pt = el.points[0];
      const screenPt = TOcanvas2Screen(pt.x, pt.y);
      const dist = Math.hypot(screenX - screenPt.x, screenY - screenPt.y);
      if (dist <= eraserRadius) elementsToDelete.add(el.id);
    }
    else if (el.type === 'line') {
      const p1 = el.points[0];
      const p2 = el.points[1];
      const s1 = TOcanvas2Screen(p1.x, p1.y);
      const s2 = TOcanvas2Screen(p2.x, p2.y);
      const dist = H_pointToLineDistance(screenX, screenY, s1.x, s1.y, s2.x, s2.y);
      if (dist <= eraserRadius) elementsToDelete.add(el.id);
    }
    else if (el.type === 'segment') {
      let minDist = Infinity;
      for (let i = 0; i < el.points.length - 1; i++) {
        const a = el.points[i];
        const b = el.points[i + 1];
        const sa = TOcanvas2Screen(a.x, a.y);
        const sb = TOcanvas2Screen(b.x, b.y);
        const dist = H_pointToSegmentDistance(screenX, screenY, sa.x, sa.y, sb.x, sb.y);
        minDist = Math.min(minDist, dist);
      }
      if (minDist <= eraserRadius) elementsToDelete.add(el.id);
    }
  });

  // 检查笔迹轨迹
  penTrajectoryList.forEach((traj, idx) => {
    if (traj.list.length < 2) return;

    // 1. 快速计算轨迹在屏幕空间的包围盒
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of traj.list) {
      const canvasX = traj.startPoint.x + p.x;
      const canvasY = traj.startPoint.y + p.y;
      const screen = TOcanvas2Screen(canvasX, canvasY);
      if (screen.x < minX) minX = screen.x;
      if (screen.x > maxX) maxX = screen.x;
      if (screen.y < minY) minY = screen.y;
      if (screen.y > maxY) maxY = screen.y;
    }

    // 2. 包围盒与橡皮擦圆相交判断（快速剔除）
    const radius = eraserRadius; // 使用实际橡皮擦半径
    if (screenX + radius < minX || screenX - radius > maxX ||
        screenY + radius < minY || screenY - radius > maxY) {
      return; // 完全不相交，跳过
    }

    // 3. 精确检查每条线段
    let minDist = Infinity;
    for (let i = 0; i < traj.list.length - 1; i++) {
      const p1 = traj.list[i];
      const p2 = traj.list[i + 1];
      const canvas1 = { x: traj.startPoint.x + p1.x, y: traj.startPoint.y + p1.y };
      const canvas2 = { x: traj.startPoint.x + p2.x, y: traj.startPoint.y + p2.y };
      const s1 = TOcanvas2Screen(canvas1.x, canvas1.y);
      const s2 = TOcanvas2Screen(canvas2.x, canvas2.y);
      const dist = H_pointToSegmentDistance(screenX, screenY, s1.x, s1.y, s2.x, s2.y);
      if (dist < minDist) minDist = dist;
      if (minDist <= radius) break; // 找到命中即可提前退出
    }

    if (minDist <= radius) trajectoriesToDelete.add(idx);
  });

  let deleted = false;
  if (elementsToDelete.size > 0) {
    renderElementList = renderElementList.filter(el => !elementsToDelete.has(el.id));
    deleted = true;
  }
  if (trajectoriesToDelete.size > 0) {
    penTrajectoryList = penTrajectoryList.filter((_, idx) => !trajectoriesToDelete.has(idx));
    deleted = true;
  }
  return deleted;
};

/**
 * 加载所有实体的纹理
 */
const loadEntityTextures = async () => {
  const allEntities = [...staticEntityList, ...itemEntityList, ...dynamicEntityList];
  await Promise.all(allEntities.map(e => e.loadTexture()));
  drawEntities(); // 加载完成后重绘
};

const updateItemEntityLifetimes = (deltaTime: number): boolean => {
  if (itemEntityList.length === 0) return false;
  let removedAny = false;
  const remainingItems: ItemEntity[] = [];
  for (const item of itemEntityList) {
    item.updateLifetime(deltaTime);
    if (item.isReadyToRemove()) {
      removedAny = true;
      continue;
    }
    remainingItems.push(item);
  }
  if (removedAny) {
    itemEntityList = remainingItems;
  }
  return removedAny;
};

const updateDynamicEntityItemPickups = (): boolean => {
  if (itemEntityList.length === 0 || dynamicEntityList.length === 0) return false;

  let pickedAny = false;
  for (const item of itemEntityList) {
    if (item.isDisappearing) continue;
    for (const dynamicEntity of dynamicEntityList) {
      if (dynamicEntity.isDead) continue;
      const distance = Math.hypot(
        dynamicEntity.position.x - item.position.x,
        dynamicEntity.position.y - item.position.y
      );
      const pickupRadius = dynamicEntity.width * 0.45 + Math.max(item.width, item.height) * 0.5;
      if (distance <= pickupRadius) {
        if (
          item instanceof GrilledFishItemEntity &&
          dynamicEntity instanceof CatDynamicEntity &&
          dynamicEntity.hungerMeter > CatDynamicEntity.CAT_HUNGER_TOO_FULL_THRESHOLD
        ) {
          // 非常饱腹时不主动拾取烤鱼
          continue;
        }
        item.beginDisappear();
        if (item instanceof GrilledFishItemEntity && dynamicEntity instanceof CatDynamicEntity) {
          dynamicEntity.addHunger(20);
        }
        pickedAny = true;
        break;
      }
    }
  }
  return pickedAny;
};

const findNearestGrilledFishForCat = (cat: CatDynamicEntity, radius: number): GrilledFishItemEntity | null => {
  let nearest: GrilledFishItemEntity | null = null;
  let minDistance = radius;
  for (const item of itemEntityList) {
    if (!(item instanceof GrilledFishItemEntity)) continue;
    if (item.isDisappearing) continue;
    const distance = Math.hypot(cat.position.x - item.position.x, cat.position.y - item.position.y);
    if (distance <= minDistance) {
      minDistance = distance;
      nearest = item;
    }
  }
  return nearest;
};

const getActiveGrilledFishById = (itemId: number): GrilledFishItemEntity | null => {
  for (const item of itemEntityList) {
    if (!(item instanceof GrilledFishItemEntity)) continue;
    if (item.id !== itemId) continue;
    if (item.isDisappearing) return null;
    return item;
  }
  return null;
};

/**
 * 为动态实体生成随机目标点-随机游走
 * 目标点在实体附近圆形范围内，并避开静态实体
 */
const setRandomTargetForDynamic = (entity: DynamicEntity): boolean => {
  if (!GRAPHICS_CANVAS.value) return false;
  if (entity instanceof CatDynamicEntity) {
    entity.clearChasingItem();
  }

  const radius = Math.max(1, entity.wanderRange);
  const center = entity.position;

  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const angle = Math.random() * Math.PI * 2;
    // 使用 sqrt(rand) 让点在圆面积上分布更均匀
    const dist = radius * Math.sqrt(Math.random());
    const target: Point = {
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist,
    };

    let safe = true;
    for (const se of staticEntityList) {
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
    if (!safe) {
      attempts++;
      continue;
    }

    if (entity.setTarget(target, staticEntityList)) {
      console.log(`设置新目标: (${target.x.toFixed(2)}, ${target.y.toFixed(2)})`);
      return true;
    }

    attempts++;
  }

  if (entity.tryFallbackTarget(staticEntityList)) {
    console.warn(`常规目标重算失败（尝试 ${maxAttempts} 次），已启用兜底移动策略`);
    return true;
  }

  console.warn(`无法找到可抵达目标点（尝试 ${maxAttempts} 次），兜底策略也失败`);
  return false;
};

/**
 * 处理动态实体之间的碰撞挤压（AABB 分离）
 * 通过最小重叠轴把两个实体各推开一半，形成互相挤压而非穿透的效果
 */
const resolveDynamicEntityCollisions = () => {
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

/**
 * 更新动态实体-每帧调用
 * @param deltaTime 时间差-秒
 */
const updateDynamicEntities = (deltaTime: number) => {
  const expiredAnyItem = updateItemEntityLifetimes(deltaTime);

  // 1) 先更新各自移动
  for (const entity of dynamicEntityList) {
    if (entity instanceof CatDynamicEntity) {
      entity.updateHunger(deltaTime);
    }
    entity.update(deltaTime, staticEntityList);
    entity.updateDamageEffect(deltaTime);
    entity.updateDeathEffect(deltaTime);
  }

  // 2) 统一做动态实体间碰撞挤压，避免彼此穿透
  resolveDynamicEntityCollisions();

  // 3) 再处理停滞检测、驻足计时与下一目标分配
  for (const entity of dynamicEntityList) {
    entity.updateCrowdStuckState(deltaTime);
    entity.updateStayDuration(deltaTime);
    entity.updateStaticCompressionEffects(deltaTime, staticEntityList);

    // 猫优先追逐附近烤鱼：可达时直接改目标
    if (entity instanceof CatDynamicEntity && !entity.isDead) {
      const canSeekFish = entity.hungerMeter <= CatDynamicEntity.CAT_HUNGER_TOO_FULL_THRESHOLD;
      if (!canSeekFish) {
        // 非常饱腹时，不再主动追鱼；若正在追，立即取消
        if (entity.chasingItemId !== null) {
          entity.clearChasingItem();
          entity.stop();
          entity.stayDurationRemaining = 0.3 + Math.random() * 0.7;
        }
      } else {
        // 当前追逐目标已消失（被拾取/进入消失特效/移除）时，立即中断追逐
        if (entity.chasingItemId !== null) {
          const activeTargetFish = getActiveGrilledFishById(entity.chasingItemId);
          if (!activeTargetFish) {
            entity.clearChasingItem();
            entity.stop();
            entity.stayDurationRemaining = 0.3 + Math.random() * 0.7;
            continue;
          }
        }

        const nearestFish = findNearestGrilledFishForCat(entity, entity.perceptionRange);
        if (nearestFish) {
          const alreadyHeadingToFish =
            entity.isMoving &&
            Math.hypot(
              entity.nextTarget.x - nearestFish.position.x,
              entity.nextTarget.y - nearestFish.position.y
            ) < 8;
          if (!alreadyHeadingToFish) {
            const redirected = entity.setTarget(
              { ...nearestFish.position },
              staticEntityList,
              { preferStraight: true }
            );
            if (redirected) {
              entity.chasingItemId = nearestFish.id;
              continue;
            }
          }
        }
      }
    }

    // 超过 10 秒未位移：强制重新生成目标并重新规划路径
    if (entity.updateNoMovementWatchdog(deltaTime)) {
      setRandomTargetForDynamic(entity);
      continue;
    }

    // 非移动且驻足结束后，再生成随机目标
    if (entity.canGetNewWanderTarget(deltaTime, staticEntityList)) {
      setRandomTargetForDynamic(entity);
    }
  }
  const pickedAnyItem = updateDynamicEntityItemPickups();

  const aliveEntities = dynamicEntityList.filter(entity => !entity.isDeathEffectFinished());
  if (aliveEntities.length !== dynamicEntityList.length || pickedAnyItem || expiredAnyItem) {
    dynamicEntityList = aliveEntities;
    renderEntityList = [...staticEntityList, ...itemEntityList, ...dynamicEntityList];
  }
};

const applyFirstPersonCameraMovement = (deltaTime: number) => {
  if (perspectiveMode !== 'first_person') return;
  if (!(firstPersonMoveW || firstPersonMoveA || firstPersonMoveS || firstPersonMoveD)) return;

  let dx = 0;
  let dy = 0;
  if (firstPersonMoveA) dx += 1;
  if (firstPersonMoveD) dx -= 1;
  if (firstPersonMoveW) dy += 1;
  if (firstPersonMoveS) dy -= 1;

  const len = Math.hypot(dx, dy);
  if (len < 0.0001) return;

  const velocity = FIRST_PERSON_CAMERA_SPEED * deltaTime;
  offsetXX += (dx / len) * velocity;
  offsetYY += (dy / len) * velocity;
  drawGraphics();
};

/**
 * 动画循环
 * 更新动态实体位置并重绘实体层
 * @param timestamp 当前时间戳
 */
const animateEntities = (timestamp: number) => {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
    animationFrameId = requestAnimationFrame(animateEntities);
    return;
  }

  const deltaTime = Math.min(0.033, (timestamp - lastTimestamp) / 1000); // 限制最大33ms
  if (deltaTime > 0) {
    applyFirstPersonCameraMovement(deltaTime);
    updateDynamicEntities(deltaTime);
    drawEntities();   // 重绘实体层
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

const DEBUG_COMMAND_SPECS = [
  { name: '/help', args: [] as string[] },
  { name: '/status', args: [] as string[] },
  { name: '/create_a_grilled_fish', args: ['absolute', 'relative'] },
  { name: '/set_perspective', args: ['first', 'third'] },
  { name: '/trajectory', args: ['on', 'off', 'toggle'] },
  { name: '/collision', args: ['on', 'off', 'toggle'] },
  { name: '/facing', args: ['on', 'off', 'toggle'] },
  { name: '/show_tag', args: ['on', 'off', 'toggle'] },
  { name: '/show_hunger', args: ['on', 'off', 'toggle'] },
  { name: '/perception_range', args: ['on', 'off', 'toggle'] },
  { name: '/movement_range', args: ['on', 'off', 'toggle'] },
  { name: '/movement_speed', args: ['on', 'off', 'toggle'] },
  { name: '/movement_passion', args: ['on', 'off', 'toggle'] },
  { name: '/movement_health', args: ['on', 'off', 'toggle'] },
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

const createGrilledFishAt = (position: Point, name?: string) => {
  const index = itemEntityList.filter(item => item instanceof GrilledFishItemEntity).length + 1;
  const fish = new GrilledFishItemEntity(position, name || `Grilled Fish ${index}`);
  itemEntityList.push(fish);
  renderEntityList = [...staticEntityList, ...itemEntityList, ...dynamicEntityList];
  fish.loadTexture().then(() => {
    drawEntities();
  });
};

const executeDebugTerminalCommand = (rawCommand: string) => {
  const commandText = rawCommand.trim();
  if (!commandText) return;

  pushDebugTerminalLog(`> ${commandText}`);

  const [rawCmd, ...args] = commandText.split(/\s+/);
  const cmd = rawCmd.replace(/^\//, '').toLowerCase();

  switch (cmd) {
    case 'help':
      pushDebugTerminalLog('Commands:');
      pushDebugTerminalLog('/help');
      pushDebugTerminalLog('/status');
      pushDebugTerminalLog('/create_a_grilled_fish <absolute|relative> <x:int> <y:int>');
      pushDebugTerminalLog('/set_perspective <first|third>');
      pushDebugTerminalLog('/trajectory [on|off|toggle]');
      pushDebugTerminalLog('/collision [on|off|toggle]');
      pushDebugTerminalLog('/facing [on|off|toggle]');
      pushDebugTerminalLog('/show_tag [on|off|toggle]');
      pushDebugTerminalLog('/show_hunger [on|off|toggle]');
      pushDebugTerminalLog('/perception_range [on|off|toggle]');
      pushDebugTerminalLog('/movement_range [on|off|toggle]');
      pushDebugTerminalLog('/movement_speed [on|off|toggle]');
      pushDebugTerminalLog('/movement_passion [on|off|toggle]');
      pushDebugTerminalLog('/movement_health [on|off|toggle]');
      pushDebugTerminalLog('/all [on|off]');
      pushDebugTerminalLog('/clear');
      break;
    case 'status':
      pushDebugTerminalLog(`Perspective: ${perspectiveMode === 'first_person' ? 'FIRST_PERSON' : 'THIRD_PERSON'}`);
      pushDebugTerminalLog(`Trajectory: ${debugShowTrajectory ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`CollisionBoxes: ${debugCollisionBoxes ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`FacingArrow: ${debugShowFacingDirection ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`TagText: ${debugShowTag ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`HungerText: ${debugShowHunger ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`InterestRange: ${debugShowInterestRange ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`MovementRange: ${debugShowMovementRange ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`MovementSpeedText: ${debugShowMovementSpeed ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`MovementPassionText: ${debugShowMovementPassion ? 'ON' : 'OFF'}`);
      pushDebugTerminalLog(`MovementHealthText: ${debugShowMovementHealth ? 'ON' : 'OFF'}`);
      break;
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
    case 'create_a_grilled_fish': {
      if (args.length < 3) {
        pushDebugTerminalLog('[ERR] Missing args. Use: /create_a_grilled_fish <absolute|relative> <x:int> <y:int>');
        break;
      }
      const type = args[0].toLowerCase();
      const xToken = args[1];
      const yToken = args[2];

      if (type !== 'absolute' && type !== 'relative') {
        pushDebugTerminalLog('[ERR] Invalid type. Use: absolute | relative');
        break;
      }
      if (!isIntegerToken(xToken) || !isIntegerToken(yToken)) {
        pushDebugTerminalLog('[ERR] x and y must be integers.');
        break;
      }

      const x = Number.parseInt(xToken, 10);
      const y = Number.parseInt(yToken, 10);
      const targetPos = type === 'absolute' ? { x, y } : TOscreen2Canvas(x, y);
      createGrilledFishAt(targetPos);
      pushDebugTerminalLog(
        `[OK] Grilled fish created at world=(${targetPos.x.toFixed(0)}, ${targetPos.y.toFixed(0)}) from ${type}=(${x}, ${y})`
      );
      break;
    }
    case 'trajectory':
      applyDebugFlagCommand('Trajectory', debugShowTrajectory, args, (v) => { debugShowTrajectory = v; });
      break;
    case 'collision':
      applyDebugFlagCommand('CollisionBoxes', debugCollisionBoxes, args, (v) => { debugCollisionBoxes = v; });
      break;
    case 'facing':
      applyDebugFlagCommand('FacingArrow', debugShowFacingDirection, args, (v) => { debugShowFacingDirection = v; });
      break;
    case 'show_tag':
      applyDebugFlagCommand('TagText', debugShowTag, args, (v) => { debugShowTag = v; });
      break;
    case 'show_hunger':
      applyDebugFlagCommand('HungerText', debugShowHunger, args, (v) => { debugShowHunger = v; });
      break;
    case 'perception_range':
      applyDebugFlagCommand('InterestRange', debugShowInterestRange, args, (v) => { debugShowInterestRange = v; });
      break;
    case 'movement_range':
      applyDebugFlagCommand('MovementRange', debugShowMovementRange, args, (v) => { debugShowMovementRange = v; });
      break;
    case 'movement_speed':
      applyDebugFlagCommand('MovementSpeedText', debugShowMovementSpeed, args, (v) => { debugShowMovementSpeed = v; });
      break;
    case 'movement_passion':
      applyDebugFlagCommand('MovementPassionText', debugShowMovementPassion, args, (v) => { debugShowMovementPassion = v; });
      break;
    case 'movement_health':
      applyDebugFlagCommand('MovementHealthText', debugShowMovementHealth, args, (v) => { debugShowMovementHealth = v; });
      break;
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
      debugShowTrajectory = nextValue;
      debugCollisionBoxes = nextValue;
      debugShowFacingDirection = nextValue;
      debugShowTag = nextValue;
      debugShowHunger = nextValue;
      debugShowInterestRange = nextValue;
      debugShowMovementRange = nextValue;
      debugShowMovementSpeed = nextValue;
      debugShowMovementPassion = nextValue;
      debugShowMovementHealth = nextValue;
      pushDebugTerminalLog(`[OK] All debug features: ${nextValue ? 'ON' : 'OFF'}`);
      drawEntities();
      break;
    }
    case 'clear':
      debugTerminalLogs = [];
      debugTerminalScrollOffset = 0;
      break;
    default:
      pushDebugTerminalLog(`[ERR] Unknown command: ${rawCmd}`);
      pushDebugTerminalLog("Type /help to list commands.");
      break;
  }
};

/**
 * 处理绘制点
 */
const handleDrawPoint = (canvasPos: Point) => {
  const pointProp: InherentProp = { 
    name: `P${renderElementList.filter(e => e.type === 'point').length + 1}`, 
    color: { r: 66, g: 133, b: 244 }, 
    opacity: 1 
  };
  
  createPoint(canvasPos, pointProp, {});
  showClickEffect(TOcanvas2Screen(canvasPos.x, canvasPos.y).x, TOcanvas2Screen(canvasPos.x, canvasPos.y).y);

  drawGraphics();
};

/**
 * 处理绘制线
 */
const handleDrawLine = (canvasPos: Point) => {
  if (!drawLineStartPoint) {
    // 第一个点
    drawLineStartPoint = canvasPos;
    drawTempPoints = [canvasPos];
    
    // 重绘图形以显示临时点
    drawGraphics();
  } else {
    // 第二个点，创建直线
    const lineProp: InherentProp = { 
      name: `L${renderElementList.filter(e => e.type === 'line').length + 1}`, 
      color: { r: 52, g: 168, b: 83 }, 
      opacity: 0.8 
    };
    
    createLine([drawLineStartPoint, canvasPos], lineProp, {});
    
    // 显示创建动画
    showClickEffect(TOcanvas2Screen(canvasPos.x, canvasPos.y).x, TOcanvas2Screen(canvasPos.x, canvasPos.y).y);
    
    // 重置状态，准备画下一条线
    drawLineStartPoint = null;
    drawTempPoints = [];
    
    drawGraphics();
  }
};

/**
 * 处理绘制线段
 */
const handleDrawSegment = (canvasPos: Point) => {
  // 添加点到临时数组
  drawTempPoints.push(canvasPos);
  
  // 如果已经有至少两个点，重绘图形以显示临时线段
  drawGraphics();
  
  // 如果点击了第一个点附近（闭合线段），自动完成
  if (drawTempPoints.length >= 3) {
    const firstPoint = drawTempPoints[0];
    const distance = Math.sqrt(
      Math.pow(canvasPos.x - firstPoint.x, 2) + 
      Math.pow(canvasPos.y - firstPoint.y, 2)
    );
    
    // 如果距离<=3单位，认为是闭合操作
    if (distance <= 3) {
      drawTempPoints.pop(); // 移除当前点（用第一个点闭合）
      // 闭合线段，将第一个点作为最后一个点
      drawTempPoints.push(firstPoint);
      
      // 创建线段
      const segmentProp: InherentProp = { 
        name: `S${renderElementList.filter(e => e.type === 'segment').length + 1}`, 
        color: { r: 251, g: 188, b: 5 }, 
        opacity: 0.6 
      };
      
      createSegment(drawTempPoints, segmentProp, {});
      
      // 重置状态
      drawTempPoints = [];
      drawGraphics();
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
      pushDebugTerminalLog('[SYS] Debug terminal opened. Type /help');
    }
    drawUI();
    return;
  }

  // 终端打开时，接管输入
  if (debugTerminalVisible) {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeDebugTerminalCommand(debugTerminalInput);
      debugTerminalInput = '';
      drawUI();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      debugTerminalInput = debugTerminalInput.slice(0, -1);
      drawUI();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      debugTerminalVisible = false;
      drawUI();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      autoCompleteDebugCommand();
      drawUI();
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      debugTerminalInput += e.key;
      drawUI();
    }
    return;
  }

  if (perspectiveMode === 'first_person' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
      e.preventDefault();
      if (key === 'w') firstPersonMoveW = true;
      if (key === 'a') firstPersonMoveA = true;
      if (key === 's') firstPersonMoveS = true;
      if (key === 'd') firstPersonMoveD = true;
      return;
    }
  }

  // 仅当按下 Ctrl 或 Command 时才处理
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 's':
        e.preventDefault();
        localStorageSave();
        break;
      case 'f':
        e.preventDefault();
        graphicsClear();
        break;
    }
  }
};

const onGlobalKeyUp = (e: KeyboardEvent) => {
  const key = e.key.toLowerCase();
  if (key === 'w') firstPersonMoveW = false;
  if (key === 'a') firstPersonMoveA = false;
  if (key === 's') firstPersonMoveS = false;
  if (key === 'd') firstPersonMoveD = false;
};

/**
 * 进入绘制点事件
 */
const onInventPoint = () => {
  onCancelLine(true);
  onCancelSegment(true);
  onCancelPen(true);
  onCancelEraser(true);
  
  drawStatusPoint = true;
  drawTempPoints = [];
  isDrawing = false;
  
  if (UI_CANVAS.value && cursorManager) {
    cursorManager.setNowCursorType('crosshair');
  }
  
  window.addEventListener('keydown', onKeyDown);
  drawUI();      // 更新按钮高亮
  drawGraphics(); // 刷新图形层（清除可能的临时点）
};

/**
 * 退出绘制点事件
 */
const onCancelPoint = (skipRedraw = false) => {
  drawStatusPoint = false;
  drawTempPoints = [];
  if (UI_CANVAS.value && cursorManager) {// 恢复鼠标样式
    cursorManager.setNowCursorType('default');
  }
  window.removeEventListener('keydown', onKeyDown);// 移除键盘监听
  if (!skipRedraw) {
    drawUI(); // 更新按钮高亮
    drawGraphics(); // 清除可能的临时点
  }
};

/**
 * 进入绘制线事件（两点确定一条无限延伸的直线）
 */
const onInventLine = () => {
  onCancelPoint(true);
  onCancelSegment(true);
  onCancelPen(true);
  onCancelEraser(true);
  
  drawStatusLine = true;
  drawTempPoints = [];
  drawLineStartPoint = null;
  isDrawing = true;
  
  if (UI_CANVAS.value && cursorManager) {
    cursorManager.setNowCursorType('crosshair');
  }
  
  window.addEventListener('keydown', onKeyDown);
  drawUI();
  drawGraphics();
};

/**
 * 退出绘制线事件
 */
const onCancelLine = (skipRedraw = false) => {
  drawStatusLine = false;
  drawTempPoints = [];
  drawLineStartPoint = null;
  isDrawing = false;
  if (UI_CANVAS.value && cursorManager) {// 恢复鼠标样式
    cursorManager.setNowCursorType('default');
  }
  window.removeEventListener('keydown', onKeyDown);// 移除键盘监听
  if (!skipRedraw) {
    drawUI();
    drawGraphics();
  }
};

/**
 * 进入绘制线段事件（多点连续线段）
 */
const onInventSegment = () => {
  onCancelPoint(true);
  onCancelLine(true);
  onCancelPen(true);
  onCancelEraser(true);
  
  drawStatusSegment = true;
  drawTempPoints = [];
  isDrawing = true;
  
  if (UI_CANVAS.value && cursorManager) {
    cursorManager.setNowCursorType('crosshair');
  }
  
  window.addEventListener('keydown', onKeyDown);
  drawUI();
  drawGraphics();
};

/**
 * 进入笔迹绘制事件
 */
const onInventPen = () => {
  onCancelPoint(true);
  onCancelLine(true);
  onCancelSegment(true);
  onCancelEraser(true);
  
  drawStatusPen = true;
  drawPenTempTrajectory = null;
  isWriting = false;
  
  if (cursorManager) {
    cursorManager.setNowCursorType('pen');
  }
  
  window.addEventListener('keydown', onKeyDown);
  drawUI();
  drawGraphics();
};

/**
 * 退出绘制线段事件
 */
const onCancelSegment = (skipRedraw = false) => {
  drawStatusSegment = false;
  drawTempPoints = [];
  isDrawing = false;
  if (UI_CANVAS.value && cursorManager) {// 恢复鼠标样式
    cursorManager.setNowCursorType('default');
  }
  window.removeEventListener('keydown', onKeyDown);// 移除键盘监听
  if (!skipRedraw) {
    drawUI();
    drawGraphics();
  }
};

/**
 * 退出笔迹绘制事件
 */
const onCancelPen = (skipRedraw = false) => {
  drawStatusPen = false;
  isWriting = false;
  drawPenTempTrajectory = null;
  lastPenPoint = null;
  if (cursorManager) {// 恢复鼠标样式
    cursorManager.setNowCursorType('default');
  }
  window.removeEventListener('keydown', onKeyDown);// 移除键盘监听
  if (!skipRedraw) {
    drawUI();
    drawGraphics();
  }
};

/**
 * 进入橡皮擦模式
 */
const onInventEraser = () => {
  onCancelPoint(true);
  onCancelLine(true);
  onCancelSegment(true);
  onCancelPen(true);
  
  drawStatusEraser = true;
  isErasing = false;
  
  if (cursorManager) {
    cursorManager.setNowCursorType('eraser');
  }
  
  window.addEventListener('keydown', onKeyDown);
  drawUI();
  drawGraphics();
};

/**
 * 退出橡皮擦模式
 */
const onCancelEraser = (skipRedraw = false) => {
  drawStatusEraser = false;
  isErasing = false;

  if (cursorManager) {
    cursorManager.setNowCursorType('default');
  }

  window.removeEventListener('keydown', onKeyDown);
  if (!skipRedraw) {
    drawUI();
    drawGraphics();
  }
};

/**
 * 键盘事件处理（ESC退出绘制）
 */
const onKeyDown = (e: KeyboardEvent) => {
  if (debugTerminalVisible) return;
  if (e.key === 'Escape') {
    if (drawStatusPoint) {
      onCancelPoint();
    } else if (drawStatusLine) {
      onCancelLine();
    } else if (drawStatusSegment) {
      onCancelSegment();
    } else if (drawStatusPen) {
      onCancelPen();
    } else if (drawStatusEraser) {
      onCancelEraser();
    }
  }
};

/**
 * 画布点击事件处理（绑定到UI Canvas）
 */
const onCanvasClick = (e: MouseEvent) => {
  if (!UI_CANVAS.value || !ctxGraphics) return;

  // 获取点击位置的屏幕坐标
  const screenX = e.offsetX;
  const screenY = e.offsetY;
  
  // 首先检查是否点击了按钮区域
  const hitArea = H_getHitEventArea(screenX, screenY);
  if (hitArea) {
    if (hitArea.onClick) {
      hitArea.onClick(e, hitArea);
      drawUI();
    }
    e.stopPropagation();
    return;
  }

  if (!hitArea && (drawStatusPoint || drawStatusLine || drawStatusSegment)) {
  // 非绘制状态才处理实体点击-避免干扰绘制
  for (const entity of dynamicEntityList) {
    const screenPos = TOcanvas2Screen(entity.position.x, entity.position.y);
    const halfW = entity.width / 2;
    const halfH = entity.height / 2;
    if (
      screenX >= screenPos.x - halfW &&
      screenX <= screenPos.x + halfW &&
      screenY >= screenPos.y - halfH &&
      screenY <= screenPos.y + halfH
    ) {
      // 设置动态实体的新目标为当前鼠标点击的画布坐标
      const targetCanvas = TOscreen2Canvas(screenX, screenY);
      if (!entity.setTarget(targetCanvas, staticEntityList)) {
        setRandomTargetForDynamic(entity);
      }
      break;
    }
  }
}

  // 转换为画布坐标
  const canvasPos = TOscreen2Canvas(screenX, screenY);

  // 处理绘制状态
  if(dragTotalX < 1 && dragTotalY < 1){
    if (drawStatusPoint) {
      handleDrawPoint(canvasPos);
    } else if (drawStatusLine) {
      handleDrawLine(canvasPos);
    } else if (drawStatusSegment) {
      handleDrawSegment(canvasPos);
    }
  }
  
  dragTotalX = 0;
  dragTotalY = 0;
};

const onCanvasDoubleClick = (e: MouseEvent) => {
  if (!UI_CANVAS.value) return;
  // 只处理图形区域双击
  const screenX = e.offsetX;
  const screenY = e.offsetY;
  // 检查是否点击按钮区域，如果是则忽略
  if (H_getHitEventArea(screenX, screenY)) return;

  if(drawTempPoints.length >= 4){
    drawTempPoints.pop();//删除双击造成得多余的一个点
    // 创建线段
    const segmentProp: InherentProp = { 
      name: `S${renderElementList.filter(e => e.type === 'segment').length + 1}`, 
      color: { r: 251, g: 188, b: 5 }, 
      opacity: 0.6 
    };
    
    createSegment(drawTempPoints, segmentProp, {});
      
    // 重置状态
    drawTempPoints = [];
    drawGraphics();
  }
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
    // 向上滚动：查看更早的日志
    debugTerminalScrollOffset = Math.min(maxScrollOffset, debugTerminalScrollOffset + step);
  } else if (e.deltaY > 0) {
    // 向下滚动：回到更新的日志
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

  // 如果还没有设置偏移量，初始化为画布中心
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
 * 鼠标按下事件（绑定到UI Canvas）
 */
const onMousedown = (e: MouseEvent) => {
  mouseLeftButtonDown = true;
  const screenX = e.offsetX;
  const screenY = e.offsetY;

  if (H_getHitEventArea(screenX, screenY)) return;

  // 橡皮擦模式
  if (drawStatusEraser) {
    e.preventDefault();
    isErasing = true;
    const deleted = eraserElements(screenX, screenY);
    if (deleted) drawGraphics();
    drawUI();
    return;
  }

  // 笔迹绘制模式
  if (drawStatusPen) {
    e.preventDefault();
    const canvasPos = TOscreen2Canvas(screenX, screenY);
    // 开始新轨迹
    drawPenTempTrajectory = {
      id: Date.now(),
      color: { r: 0, g: 0, b: 0 }, // 黑色，后续可自定义
      thickness: 2,
      resolution: { width: 0, height: 0 },
      startPoint: canvasPos,
      endPoint: canvasPos,
      list: [{ x: 0, y: 0, g: 1.0 }] // 第一个点偏移为0，压力默认为1
    };
    isWriting = true;
    lastPenPoint = canvasPos;
    lastPenTime = performance.now();
    return; // 阻止画布拖动
  }

  // 拖动移动视图逻辑
  if (perspectiveMode === 'first_person') {
    return;
  }
  const canvasPos = TOscreen2Canvas(screenX, screenY);
  dragStartX = canvasPos.x;
  dragStartY = canvasPos.y;
  
  // 记录上一次拖动的屏幕位置
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  isDragging = true;
  isMoveCanvas = true;
};

/**
 * 鼠标移动事件（绑定到UI Canvas）
 */
const onMouseMove = (e: MouseEvent) => {
  // 更新鼠标位置
  mouseX = e.offsetX;
  mouseY = e.offsetY;
  hasMousePosition = true;

  if (!UI_CANVAS.value) return;

  // 橡皮擦擦除除中
  if (isErasing) {
    e.preventDefault();
    const deleted = eraserElements(mouseX, mouseY);
    if (deleted) {
      drawGraphics(); // 有元素被擦除，重绘图形层
    }
    drawUI(); // 更新UI层以显示橡皮擦范围预览
  }

  // 如果正在书写笔迹
  if (isWriting && drawPenTempTrajectory) {
    e.preventDefault();
    const canvasPos = TOscreen2Canvas(mouseX, mouseY);
    const now = performance.now();
    // 计算压力（根据速度）
    let pressure = 0.5; // 默认
    if (lastPenPoint && lastPenTime) {
      const dx = canvasPos.x - lastPenPoint.x;
      const dy = canvasPos.y - lastPenPoint.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      const dt = now - lastPenTime;
      if (dt > 0) {
        const speed = distance / dt; // 像素/毫秒
        pressure = parseFloat(Math.max(0, Math.min(1, 1 - speed / MAX_SPEED_PEN)).toFixed(2));
      }
    }
    // 计算相对于起点的偏移
    const offsetX = canvasPos.x - drawPenTempTrajectory.startPoint.x;
    const offsetY = canvasPos.y - drawPenTempTrajectory.startPoint.y;
    drawPenTempTrajectory.list.push({ x: offsetX, y: offsetY, g: pressure });
    drawPenTempTrajectory.endPoint = canvasPos;

    lastPenPoint = canvasPos;
    lastPenTime = now;

    drawGraphics(); // 重绘以显示新点
    return;
  }

  // 悬停检测
  const hitArea = H_getHitEventArea(mouseX, mouseY);
  hoveredArea = hitArea;

  // 更新光标样式（优先移动、悬停、绘制、默认）
  if (hitArea) {
    cursorManager?.setNowCursorType(hitArea.cursor || 'pointer');
  } else {
    if (isMoveCanvas) {
      cursorManager?.setNowCursorType('move');
    } else if (drawStatusEraser) {
      cursorManager?.setNowCursorType('eraser');
    } else if (drawStatusPoint || drawStatusLine || drawStatusSegment) {
      cursorManager?.setNowCursorType('crosshair');
    } else if (drawStatusPen) {
      cursorManager?.setNowCursorType('pen');
    } else {
      cursorManager?.setNowCursorType('default');
    }
  }

  if (!isDragging) {
    // 如果正在绘制状态，实时更新预览（重绘图形）
    if (drawStatusLine || drawStatusSegment) {
      drawGraphics();
    }
    return;
  }

  // 计算本次移动的增量
  const deltaX = e.clientX - lastDragX;
  const deltaY = e.clientY - lastDragY;

  // 更新累计拖动长度
  dragTotalX += Math.abs(deltaX);
  dragTotalY += Math.abs(deltaY);

  // 更新偏移量（实现画布拖动）
  offsetXX += deltaX;
  offsetYY += deltaY;

  // 更新位置
  lastDragX = e.clientX;
  lastDragY = e.clientY;

  // 重绘图形
  drawGraphics();
};

/**
 * 鼠标释放事件（绑定到UI Canvas）
 */
const onMouseUp = () => {
  mouseLeftButtonDown = false;
  // 如果正在书写，结束笔迹
  if (isWriting && drawPenTempTrajectory) {
    if (drawPenTempTrajectory.list.length > 0) {
      penTrajectoryList.push(drawPenTempTrajectory);
    }
    drawPenTempTrajectory = null;
    isWriting = false;
    lastPenPoint = null;
    drawGraphics();
    return;
  }

  // 结束擦除
  if (isErasing) {
    isErasing = false;
    drawGraphics(); // 更新状态
    drawUI();
    return;
  }

  isDragging = false;
  isMoveCanvas = false;

  if (!(drawStatusPoint || drawStatusLine || drawStatusSegment || drawStatusPen || drawStatusEraser)) {
    cursorManager?.setNowCursorType('default');
  }
};

/**
 * 窗口鼠标移动（用于自定义光标）
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
 * 窗口鼠标离开（隐藏光标）
 */
const onWindowMouseLeave = () => {
  cursorManager?.setFocused(false);
};

/**
 * 窗口鼠标进入（显示光标）
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
  window.removeEventListener('keydown', onKeyDown);
});
//next_继续优化动态实体的游走轨迹
////////////////////
//<--vue事件处理区
////////////////////
</script>
<template>
  <div class="view-test2d-container">
    <canvas id="canvas-graphics" ref="GRAPHICS_CANVAS"></canvas>
    <canvas id="canvas-entity" ref="ENTITY_CANVAS"></canvas>
    <canvas id="canvas-ui" ref="UI_CANVAS"></canvas>
    <canvas id="canvas-cursor"></canvas>
  </div>
</template>
<style scoped>
.view-test2d-container{position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;cursor:none;}
#canvas-graphics{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-entity{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-ui{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:auto;cursor:none;}
#canvas-cursor{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
</style>
