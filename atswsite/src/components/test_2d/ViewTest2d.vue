<script setup lang="ts">
// The relative position of this file: src/components/test_2d/ViewTest2d.vue
import { ref, computed, onMounted, onUnmounted } from 'vue';

type TypeCursorName = 'crosshair' | 'default' | 'eraser' | 'help' | 'move' | 'notAllowed' | 'pen' | 'pointer';
type TypeEffectName = 'default' | 'eraser';

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
    this.loadGif();
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

////////////////////
//常量区-->
////////////////////
const GRAPHICS_CANVAS = ref<HTMLCanvasElement | null>(null);
const UI_CANVAS = ref<HTMLCanvasElement | null>(null);
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
const MAX_SPEED_PEN = 10; // 笔迹速度对应的最大压力值
////////////////////
//<--常量区
////////////////////

////////////////////
//变量区-->
////////////////////
let cursorManager: CursorManager | null = null;
let ctxGraphics: CanvasRenderingContext2D | null = null;
let ctxUi: CanvasRenderingContext2D | null = null;

let offsetXX = 0;  // 原点在x轴上的偏移
let offsetYY = 0;  // 原点在y轴上的偏移
let scale = 1;    // 缩放比例
let elementIdIndex = 1;

let renderElementList: Array<Element> = [];  // 要渲染的元素
let hiddenElementList: Array<Element> = [];  // 要隐藏的元素
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
////////////////////
//<--变量区
////////////////////

////////////////////
//辅助函数区-->
////////////////////

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
    UI_CANVAS.value.addEventListener('mouseleave', onWindowMouseLeave);
    UI_CANVAS.value.addEventListener('mouseenter', onWindowMouseEnter);
  }
  cursorManager = new CursorManager("canvas-cursor");
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('resize', onResizeCanvas);
  window.visualViewport?.addEventListener('resize', onResizeCanvas);
  window.addEventListener('keydown', onGlobalKeyDown); // 添加快捷键监听
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
  hiddenElementList = [];
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
  const text = 'Ctrl + S = Save    Ctrl + F = Clear';
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
const eraseElements = (screenX: number, screenY: number): boolean => {
  const threshold = 5;

  // 辅助函数：点到无限直线距离
  const pointToLineDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const cross = Math.abs((x2 - x1) * (y1 - py) - (y2 - y1) * (x1 - px));
    return cross / Math.sqrt(lenSq);
  };

  // 辅助函数：点到线段距离
  const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
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

  const elementsToDelete = new Set<number>();
  const trajectoriesToDelete = new Set<number>();

  // 检查几何元素
  renderElementList.forEach(el => {
    if (el.type === 'point') {
      const pt = el.points[0];
      const screenPt = TOcanvas2Screen(pt.x, pt.y);
      const dist = Math.hypot(screenX - screenPt.x, screenY - screenPt.y);
      if (dist <= threshold) elementsToDelete.add(el.id);
    }
    else if (el.type === 'line') {
      const p1 = el.points[0];
      const p2 = el.points[1];
      const s1 = TOcanvas2Screen(p1.x, p1.y);
      const s2 = TOcanvas2Screen(p2.x, p2.y);
      const dist = pointToLineDistance(screenX, screenY, s1.x, s1.y, s2.x, s2.y);
      if (dist <= threshold) elementsToDelete.add(el.id);
    }
    else if (el.type === 'segment') {
      let minDist = Infinity;
      for (let i = 0; i < el.points.length - 1; i++) {
        const a = el.points[i];
        const b = el.points[i + 1];
        const sa = TOcanvas2Screen(a.x, a.y);
        const sb = TOcanvas2Screen(b.x, b.y);
        const dist = pointToSegmentDistance(screenX, screenY, sa.x, sa.y, sb.x, sb.y);
        minDist = Math.min(minDist, dist);
      }
      if (minDist <= threshold) elementsToDelete.add(el.id);
    }
  });

  // 检查笔迹轨迹
  penTrajectoryList.forEach((traj, idx) => {
    if (traj.list.length < 2) return;
    let minDist = Infinity;
    for (let i = 0; i < traj.list.length - 1; i++) {
      const p1 = traj.list[i];
      const p2 = traj.list[i + 1];
      const canvas1 = { x: traj.startPoint.x + p1.x, y: traj.startPoint.y + p1.y };
      const canvas2 = { x: traj.startPoint.x + p2.x, y: traj.startPoint.y + p2.y };
      const s1 = TOcanvas2Screen(canvas1.x, canvas1.y);
      const s2 = TOcanvas2Screen(canvas2.x, canvas2.y);
      const dist = pointToSegmentDistance(screenX, screenY, s1.x, s1.y, s2.x, s2.y);
      minDist = Math.min(minDist, dist);
    }
    if (minDist <= threshold) trajectoriesToDelete.add(idx);
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

////////////////////
//<--其他函数区
////////////////////

////////////////////
//事件处理函数区-->
////////////////////
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
  // 仅当按下 Ctrl 或 Command 时才处理
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 's':
        e.preventDefault();
        localStorageSave();
        break;
      case 'f':
        e.preventDefault();
        graphicsClear();
        break;
      // 可在此扩展其他快捷键
    }
  }
};

/**
 * 进入绘制点事件
 */
const onInventPoint = () => {
  // 退出其他模式
  if (drawStatusLine) onCancelLine();
  if (drawStatusSegment) onCancelSegment();
  if (drawStatusPen) onCancelPen();
  if (drawStatusEraser) onCancelEraser();
  
  drawStatusPoint = true;
  drawTempPoints = [];
  isDrawing = false;
  
  // 改变鼠标样式
  if (UI_CANVAS.value) {
    if(cursorManager){
      cursorManager.setNowCursorType('crosshair');
    }
  }
  
  // 添加键盘监听
  window.addEventListener('keydown', onKeyDown);
  drawUI(); // 更新按钮高亮
};

/**
 * 退出绘制点事件
 */
const onCancelPoint = () => {
  drawStatusPoint = false;
  drawTempPoints = [];
  
  // 恢复鼠标样式
  if (UI_CANVAS.value) {
    if(cursorManager){
      cursorManager.setNowCursorType('default');
    }
  }
  
  // 移除键盘监听
  window.removeEventListener('keydown', onKeyDown);
  drawUI(); // 更新按钮高亮
  drawGraphics(); // 清除可能的临时点
};

/**
 * 进入绘制线事件（两点确定一条无限延伸的直线）
 */
const onInventLine = () => {
  // 退出其他模式
  if (drawStatusPoint) onCancelPoint();
  if (drawStatusSegment) onCancelSegment();
  if (drawStatusPen) onCancelPen();
  if (drawStatusEraser) onCancelEraser();
  
  drawStatusLine = true;
  drawTempPoints = [];
  drawLineStartPoint = null;
  isDrawing = true; // 线需要两个点
  
  // 改变鼠标样式
  if (UI_CANVAS.value) {
    if(cursorManager){
      cursorManager.setNowCursorType('crosshair');
    }
  }
  
  // 添加键盘监听
  window.addEventListener('keydown', onKeyDown);
  drawUI();
};

/**
 * 退出绘制线事件
 */
const onCancelLine = () => {
  drawStatusLine = false;
  drawTempPoints = [];
  drawLineStartPoint = null;
  isDrawing = false;
  
  // 恢复鼠标样式
  if (UI_CANVAS.value) {
    if(cursorManager){
      cursorManager.setNowCursorType('default');
    }
  }
  
  // 移除键盘监听
  window.removeEventListener('keydown', onKeyDown);
  drawUI();
  drawGraphics();
};

/**
 * 进入绘制线段事件（多点连续线段）
 */
const onInventSegment = () => {
  // 退出其他模式
  if (drawStatusPoint) onCancelPoint();
  if (drawStatusLine) onCancelLine();
  if (drawStatusPen) onCancelPen();
  if (drawStatusEraser) onCancelEraser();
  
  drawStatusSegment = true;
  drawTempPoints = [];
  isDrawing = true;
  
  // 改变鼠标样式
  if (UI_CANVAS.value) {
    if(cursorManager){
      cursorManager.setNowCursorType('crosshair');
    }
  }
  
  // 添加键盘监听
  window.addEventListener('keydown', onKeyDown);
  drawUI();
};

/**
 * 进入笔迹绘制事件
 */
const onInventPen = () => {
  // 退出其他模式
  if (drawStatusPoint) onCancelPoint();
  if (drawStatusLine) onCancelLine();
  if (drawStatusSegment) onCancelSegment();
  if (drawStatusEraser) onCancelEraser();
  
  drawStatusPen = true;
  drawPenTempTrajectory = null;
  isWriting = false;
  
  // 改变鼠标样式
  if (cursorManager) {
    cursorManager.setNowCursorType('pen');
  }
  
  // 添加键盘监听
  window.addEventListener('keydown', onKeyDown);
  drawUI(); // 更新按钮高亮
  drawGraphics(); // 清除可能的临时图形
};

/**
 * 退出绘制线段事件
 */
const onCancelSegment = () => {
  drawStatusSegment = false;
  drawTempPoints = [];
  isDrawing = false;
  
  // 恢复鼠标样式
  if (UI_CANVAS.value) {
    if(cursorManager){
      cursorManager.setNowCursorType('default');
    }
  }
  
  // 移除键盘监听
  window.removeEventListener('keydown', onKeyDown);
  drawUI();
  drawGraphics();
};

/**
 * 退出笔迹绘制事件
 */
const onCancelPen = () => {
  drawStatusPen = false;
  isWriting = false;
  drawPenTempTrajectory = null;
  lastPenPoint = null;
  
  // 恢复鼠标样式
  if (cursorManager) {
    cursorManager.setNowCursorType('default');
  }
  
  // 移除键盘监听
  window.removeEventListener('keydown', onKeyDown);
  drawUI();
  drawGraphics();
};

/**
 * 进入橡皮擦模式
 */
const onInventEraser = () => {
  // 退出其他模式
  if (drawStatusPoint) onCancelPoint();
  if (drawStatusLine) onCancelLine();
  if (drawStatusSegment) onCancelSegment();
  if (drawStatusPen) onCancelPen();

  drawStatusEraser = true;
  isErasing = false;

  // 改变光标
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
const onCancelEraser = () => {
  drawStatusEraser = false;
  isErasing = false;

  if (cursorManager) {
    cursorManager.setNowCursorType('default');
  }

  window.removeEventListener('keydown', onKeyDown);
  drawUI();
  drawGraphics();
};

/**
 * 键盘事件处理（ESC退出绘制）
 */
const onKeyDown = (e: KeyboardEvent) => {
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
    const deleted = eraseElements(screenX, screenY);
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

  // 原有拖动逻辑
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
    const deleted = eraseElements(mouseX, mouseY);
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
  cursorManager?.drawCursor('auto', e.clientX, e.clientY,0.2);
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
  }

  window.removeEventListener('resize', onResizeCanvas);
  window.visualViewport?.removeEventListener('resize', onResizeCanvas);
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseleave', onWindowMouseLeave);
  window.removeEventListener('mouseenter', onWindowMouseEnter);
  window.removeEventListener('keydown', onGlobalKeyDown);
  window.removeEventListener('keydown', onKeyDown);
});

////////////////////
//<--vue事件处理区
////////////////////
</script>
<template>
  <div class="view-test2d-container">
    <canvas id="canvas-graphics" ref="GRAPHICS_CANVAS"></canvas>
    <canvas id="canvas-ui" ref="UI_CANVAS"></canvas>
    <canvas id="canvas-cursor"></canvas>
  </div>
</template>
<style scoped>
.view-test2d-container{position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;cursor:none;}
#canvas-graphics{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-ui{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:auto;cursor:none;}
#canvas-cursor{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
</style>