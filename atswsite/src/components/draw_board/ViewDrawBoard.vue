<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { CursorManager } from '@/components/draw_board/class';
import {
    type Element,
    type EventArea,
    type InherentProp,
    type PenTrajectory,
    type Point,
    type RGB,
    type PointElement,
    type LineElement,
    type SegmentElement
}from '@/components/draw_board/interface/InterfaceDrawBoard';


const GRAPHICS_CANVAS = ref<HTMLCanvasElement | null>(null);
const UI_CANVAS = ref<HTMLCanvasElement | null>(null);

const LOCAL_STORAGE_KEY = 'viewDrawBoardState';
const BT1_PADDING = 30;
const BT1_HEIGHT = 50;
const BT1_WIDTH = 105;
const BT1_SPACING = 20;

let ctxGraphics: CanvasRenderingContext2D | null = null;
let ctxUi: CanvasRenderingContext2D | null = null;
let cursorManager: CursorManager | null = null;

let offsetXX = 0;
let offsetYY = 0;
let scale = 1;
let elementIdIndex = 1;

let renderElementList: Array<Element> = [];
let penTrajectoryList: PenTrajectory[] = [];
let eventArea: EventArea[] = [];

let drawStatusPoint = false;
let drawStatusLine = false;
let drawStatusSegment = false;
let drawStatusPen = false;
let drawStatusEraser = false;

let mouseX = 0;
let mouseY = 0;
let hasMousePosition = false;
let mouseLeftButtonDown = false;
let isDragging = false;
let isMoveCanvas = false;
let isWriting = false;
let isErasing = false;

let drawLineStartPoint: Point | null = null;
let drawTempPoints: Point[] = [];
let drawPenTempTrajectory: PenTrajectory | null = null;
let lastPenPoint: Point | null = null;
let lastPenTime = 0;
let eraserRadius = 8;

let dragTotalX = 0;
let dragTotalY = 0;
let lastDragX = 0;
let lastDragY = 0;

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

const H_getCanvasCssSize = (canvas: HTMLCanvasElement) => ({ width: canvas.clientWidth, height: canvas.clientHeight });
const H_applyDprToCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = H_getCanvasCssSize(canvas);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};
const TOscreen2Canvas = (screenX: number, screenY: number): Point => ({ x: (screenX - offsetXX) / scale, y: (offsetYY - screenY) / scale });
const TOcanvas2Screen = (canvasX: number, canvasY: number): Point => ({ x: canvasX * scale + offsetXX, y: offsetYY - canvasY * scale });

const setOnlyMode = (mode: 'point' | 'line' | 'segment' | 'pen' | 'eraser' | null) => {
  drawStatusPoint = mode === 'point';
  drawStatusLine = mode === 'line';
  drawStatusSegment = mode === 'segment';
  drawStatusPen = mode === 'pen';
  drawStatusEraser = mode === 'eraser';
  drawLineStartPoint = null;
  drawTempPoints = [];
};

const onInventPoint = () => { setOnlyMode('point'); drawUI();drawGraphics(); };
const onInventLine = () => { setOnlyMode('line'); drawUI();drawGraphics(); };
const onInventSegment = () => { setOnlyMode('segment'); drawUI();drawGraphics(); };
const onInventPen = () => { setOnlyMode('pen'); drawUI();drawGraphics(); };
const onInventEraser = () => { setOnlyMode('eraser'); drawUI();drawGraphics(); };
const onCancelPoint = () => { setOnlyMode(null); drawUI();drawGraphics(); };
const onCancelLine = () => { setOnlyMode(null); drawUI();drawGraphics(); };
const onCancelSegment = () => { setOnlyMode(null); drawUI();drawGraphics(); };
const onCancelPen = () => { setOnlyMode(null); drawUI();drawGraphics(); };
const onCancelEraser = () => { setOnlyMode(null); drawUI();drawGraphics(); };

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

const H_getHitEventArea = (x: number, y: number): EventArea | null => {
  for (const area of eventArea) {
    const { rect } = area;
    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return area;
  }
  return null;
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

const drawGrid = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;
  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  const spacing = 40 * scale;
  if (spacing < 12) return;
  ctxGraphics.save();
  ctxGraphics.strokeStyle = '#d9d9d9';
  ctxGraphics.lineWidth = 1;
  for (let x = offsetXX % spacing; x <= width; x += spacing) {
    ctxGraphics.beginPath();
    ctxGraphics.moveTo(x, 0);
    ctxGraphics.lineTo(x, height);
    ctxGraphics.stroke();
  }
  for (let y = offsetYY % spacing; y <= height; y += spacing) {
    ctxGraphics.beginPath();
    ctxGraphics.moveTo(0, y);
    ctxGraphics.lineTo(width, y);
    ctxGraphics.stroke();
  }
  ctxGraphics.restore();
};

/**
 * 创建坐标辅助轴（带刻度）（图形层）
 * @param xColor X轴颜色
 * @param yColor Y轴颜色
 */
const drawAxis = (xColor: RGB, yColor: RGB) => {
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
 * 创建坐标轴刻度标记（图形层）
 */
const drawAxisMark = () => {
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

  // 如果是闭合线段（首尾相连）,可以填充
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
    if (index === element.points.length - 1){
      if(element.points[index].x === element.points[0].x && element.points[index].y === element.points[0].y){
        // 闭合线段最后一个点与第一个点重合,不重复绘制
        return;
      }
    }
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
 * 绘制临时线段（预览,图形层）
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
 * 显示临时点（用于绘制中的预览,图形层）
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

const drawEraserPreview = () => {
  if (!ctxUi || !drawStatusEraser || !hasMousePosition || !mouseLeftButtonDown) return;
  ctxUi.save();
  ctxUi.beginPath();
  ctxUi.arc(mouseX, mouseY, eraserRadius, 0, Math.PI * 2);
  ctxUi.strokeStyle = 'rgba(128,128,128,0.6)';
  ctxUi.setLineDash([3, 3]);
  ctxUi.stroke();
  ctxUi.restore();
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
  const text = `Ctrl + S = Save    Ctrl + F = Clear   Esc = Cancel drawing`;
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

const drawGraphics = () => {
  if (!ctxGraphics || !GRAPHICS_CANVAS.value) return;
  const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
  // 清空画布
  ctxGraphics.clearRect(0, 0, width, height);
  // 设置背景色
  ctxGraphics.fillStyle = '#f0f0f0';
  ctxGraphics.fillRect(0, 0, width, height);
  // 绘制网格
  drawGrid();
  // 绘制坐标轴
  drawAxis({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 });
  // 绘制刻度与刻度数值
  drawAxisMark();
  // 渲染元素
  drawElement();
  // 渲染笔迹
  drawPenTrajectory();
  // 绘制正在绘制中的笔迹
  drawPenTrajectoryIng();
  // 绘制临时线段预览（如果正在绘制线段）
  if (drawStatusSegment && drawTempPoints.length >= 1) drawTempSegment();
  // 绘制临时点预览（如果正在绘制线且已有第一个点）
  if (drawStatusLine && drawLineStartPoint) {
      showTempPoint(drawLineStartPoint);
      
      // 如果有鼠标位置,可以显示从起点到鼠标的预览线
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

const drawUI = () => {
  if (!ctxUi || !UI_CANVAS.value) return;
  const { width, height } = H_getCanvasCssSize(UI_CANVAS.value);
  ctxUi.clearRect(0, 0, width, height);
  drawUIButtons(ctxUi);
  drawInstructions(ctxUi, UI_CANVAS.value);
  drawEraserPreview();
};

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

const graphicsClear = () => {
  renderElementList = [];
  penTrajectoryList = [];
  drawTempPoints = [];
  drawLineStartPoint = null;
  drawPenTempTrajectory = null;
  drawGraphics();
};

const localStorageSave = () => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ offsetXX, offsetYY, scale, elementIdIndex, renderElementList, penTrajectoryList }));
};
const localStorageLoad = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    offsetXX = parsed.offsetXX ?? offsetXX;
    offsetYY = parsed.offsetYY ?? offsetYY;
    scale = parsed.scale ?? scale;
    elementIdIndex = parsed.elementIdIndex ?? elementIdIndex;
    renderElementList = parsed.renderElementList ?? renderElementList;
    penTrajectoryList = parsed.penTrajectoryList ?? penTrajectoryList;
  } catch {
    // ignore invalid storage
  }
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
      return; // 完全不相交,跳过
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
      // 动画结束,重绘清除效果
      drawGraphics();
    }
  };

  requestAnimationFrame(animateRipple);
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
    // 第二个点,创建直线
    const lineProp: InherentProp = { 
      name: `L${renderElementList.filter(e => e.type === 'line').length + 1}`, 
      color: { r: 52, g: 168, b: 83 }, 
      opacity: 0.8 
    };
    
    createLine([drawLineStartPoint, canvasPos], lineProp, {});
    
    // 显示创建动画
    showClickEffect(TOcanvas2Screen(canvasPos.x, canvasPos.y).x, TOcanvas2Screen(canvasPos.x, canvasPos.y).y);
    
    // 重置状态,准备画下一条线
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
  
  // 如果已经有至少两个点,重绘图形以显示临时线段
  drawGraphics();
  
  // 如果点击了第一个点附近（闭合线段）,自动完成
  if (drawTempPoints.length >= 3) {
    const firstPoint = drawTempPoints[0];
    const distance = Math.sqrt(
      Math.pow(canvasPos.x - firstPoint.x, 2) + 
      Math.pow(canvasPos.y - firstPoint.y, 2)
    );
    
    // 如果距离<=3单位,认为是闭合操作
    if (distance <= 3) {
      drawTempPoints.pop(); // 移除当前点（用第一个点闭合）
      // 闭合线段,将第一个点作为最后一个点
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

const onCanvasDoubleClick = () => {
  if (drawStatusSegment && drawTempPoints.length >= 2) {
    drawTempPoints.pop(); // 移除最后一个点,避免双击导致的重复
    createSegment([...drawTempPoints], { name: 'Segment', color: { r: 251, g: 188, b: 5 }, opacity: 0.8 },{});
    drawTempPoints = [];
    drawGraphics();
  }
};

const onMousedown = (e: MouseEvent) => {
  mouseLeftButtonDown = true;
  const screenX = e.offsetX;
  const screenY = e.offsetY;
  if (H_getHitEventArea(screenX, screenY)) return;

  if (drawStatusEraser) {
    isErasing = true;
    const deleted = eraserElements(screenX, screenY);
    if (deleted) drawGraphics();
    drawUI();
    return;
  }

  if (drawStatusPen) {
    const p = TOscreen2Canvas(screenX, screenY);
    drawPenTempTrajectory = { id: Date.now(), color: { r: 0, g: 0, b: 0 }, thickness: 2, startPoint: p, endPoint: p, list: [{ x: 0, y: 0, g: 1 }] };
    isWriting = true;
    lastPenPoint = p;
    lastPenTime = performance.now();
    return;
  }

  lastDragX = e.clientX;
  lastDragY = e.clientY;
  isDragging = true;
  isMoveCanvas = true;
};

const onMouseMove = (e: MouseEvent) => {
  mouseX = e.offsetX;
  mouseY = e.offsetY;
  hasMousePosition = true;

  if (isErasing) {
    const deleted = eraserElements(mouseX, mouseY);
    if (deleted) drawGraphics();
    drawUI();
  }

  if (isWriting && drawPenTempTrajectory) {
    const p = TOscreen2Canvas(mouseX, mouseY);
    const now = performance.now();
    let pressure = 0.5;
    if (lastPenPoint) {
      const distance = Math.hypot(p.x - lastPenPoint.x, p.y - lastPenPoint.y);
      const dt = now - lastPenTime;
      if (dt > 0) pressure = Math.max(0, Math.min(1, 1 - (distance / dt) / 10));
    }
    drawPenTempTrajectory.list.push({ x: p.x - drawPenTempTrajectory.startPoint.x, y: p.y - drawPenTempTrajectory.startPoint.y, g: pressure });
    drawPenTempTrajectory.endPoint = p;
    lastPenPoint = p;
    lastPenTime = now;
    drawGraphics();
    return;
  }

  const hitArea = H_getHitEventArea(mouseX, mouseY);
  if (hitArea) cursorManager?.setNowCursorType('pointer');
  else if (isMoveCanvas) cursorManager?.setNowCursorType('move');
  else if (drawStatusEraser) cursorManager?.setNowCursorType('eraser');
  else if (drawStatusPen) cursorManager?.setNowCursorType('pen');
  else if (drawStatusPoint || drawStatusLine || drawStatusSegment) cursorManager?.setNowCursorType('crosshair');
  else cursorManager?.setNowCursorType('default');

  if (!isDragging) {
    if (drawStatusLine || drawStatusSegment) drawGraphics();
    return;
  }

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

const onMouseUp = () => {
  mouseLeftButtonDown = false;
  if (isWriting && drawPenTempTrajectory) {
    penTrajectoryList.push(drawPenTempTrajectory);
    drawPenTempTrajectory = null;
    isWriting = false;
    drawGraphics();
    return;
  }
  if (isErasing) {
    isErasing = false;
    drawGraphics();
    drawUI();
    return;
  }
  isDragging = false;
  isMoveCanvas = false;
  if (!(drawStatusPoint || drawStatusLine || drawStatusSegment || drawStatusPen || drawStatusEraser)) {
    cursorManager?.setNowCursorType('default');
  }
};

const onResizeCanvas = () => {
  if (!GRAPHICS_CANVAS.value || !UI_CANVAS.value) return;
  ctxGraphics = GRAPHICS_CANVAS.value.getContext('2d');
  ctxUi = UI_CANVAS.value.getContext('2d');
  if (!ctxGraphics || !ctxUi) return;
  H_applyDprToCanvas(GRAPHICS_CANVAS.value, ctxGraphics);
  H_applyDprToCanvas(UI_CANVAS.value, ctxUi);
  if (offsetXX === 0 && offsetYY === 0) {
    const { width, height } = H_getCanvasCssSize(GRAPHICS_CANVAS.value);
    offsetXX = width / 2;
    offsetYY = height / 2;
  }
  drawGraphics();
  drawUI();
};

const onWindowMouseMove = (e: MouseEvent) => {
  cursorManager?.drawCursor('auto', e.clientX, e.clientY, 0.2);
};
const onWindowMouseLeave = () => cursorManager?.setFocused(false);
const onWindowMouseEnter = () => cursorManager?.setFocused(true);

const onGlobalKeyDown = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 's') {
      e.preventDefault();
      localStorageSave();
    }
    if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      graphicsClear();
    }
  }
};

const startSetting = () => {
  onResizeCanvas();
  createEventArea();
  localStorageLoad();
  if (UI_CANVAS.value) {
    UI_CANVAS.value.addEventListener('mousedown', onMousedown);
    UI_CANVAS.value.addEventListener('mousemove', onMouseMove);
    UI_CANVAS.value.addEventListener('mouseup', onMouseUp);
    UI_CANVAS.value.addEventListener('mouseleave', onMouseUp);
    UI_CANVAS.value.addEventListener('click', onCanvasClick);
    UI_CANVAS.value.addEventListener('dblclick', onCanvasDoubleClick);
  }
  cursorManager = new CursorManager('canvas-cursor');
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('mouseleave', onWindowMouseLeave);
  window.addEventListener('mouseenter', onWindowMouseEnter);
  window.addEventListener('resize', onResizeCanvas);
  window.visualViewport?.addEventListener('resize', onResizeCanvas);
  window.addEventListener('keydown', onGlobalKeyDown);
  drawGraphics();
  drawUI();
  window.addEventListener('keydown', onKeyDown);
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
onMounted(() => startSetting());
onUnmounted(() => {
  if (UI_CANVAS.value) {
    UI_CANVAS.value.removeEventListener('mousedown', onMousedown);
    UI_CANVAS.value.removeEventListener('mousemove', onMouseMove);
    UI_CANVAS.value.removeEventListener('mouseup', onMouseUp);
    UI_CANVAS.value.removeEventListener('mouseleave', onMouseUp);
    UI_CANVAS.value.removeEventListener('click', onCanvasClick);
    UI_CANVAS.value.removeEventListener('dblclick', onCanvasDoubleClick);
  }
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseleave', onWindowMouseLeave);
  window.removeEventListener('mouseenter', onWindowMouseEnter);
  window.removeEventListener('resize', onResizeCanvas);
  window.visualViewport?.removeEventListener('resize', onResizeCanvas);
  window.removeEventListener('keydown', onGlobalKeyDown);
});
</script>

<template>
  <div class="view-draw-board-container">
    <canvas id="canvas-graphics" ref="GRAPHICS_CANVAS"></canvas>
    <canvas id="canvas-ui" ref="UI_CANVAS"></canvas>
    <canvas id="canvas-cursor"></canvas>
  </div>
</template>

<style scoped>
.view-draw-board-container{position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;cursor:none;}
#canvas-graphics{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
#canvas-ui{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:auto;cursor:none;}
#canvas-cursor{position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;cursor:none;}
</style>
