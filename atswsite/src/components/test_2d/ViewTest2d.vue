<script setup lang="ts">
// The relative position of this file: src/components/test_2d/ViewTest2d.vue
import { ref } from 'vue';
import { computed } from 'vue';
import { onMounted } from 'vue';
import { onUnmounted } from 'vue';

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
  cursor?: string;                 // 鼠标样式
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
////////////////////
//常量区-->
////////////////////
const canvas = ref<HTMLCanvasElement | null>(null);
const bt1Padding = 30;//bt1是左侧元素添加按钮的
const bt1Height = 50;
const bt1Width = 105;
const bt1Spacing = 20;
// 按钮配置
const buttons = [
  {
    id: 'btn_point',
    label: 'Point',
    type: 'point',
    icon: '●',
    size: 16,
    color: { r: 66, g: 133, b: 244 },
    x: 30,
    y: bt1Padding,
    onClick: () => {
      if(drawStatusPoint){
        onCancelPoint();
      }else{
        onInventPoint();
      }
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
    y: bt1Padding + (bt1Height + bt1Spacing),
    onClick: () => {
      if(drawStatusLine){
        onCancelLine();
      }else{
        onInventLine();
      }
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
    y: bt1Padding + (bt1Height + bt1Spacing) * 2,
    onClick: () => {
      if(drawStatusSegment){
        onCancelSegment();
      }else{
        onInventSegment();
      }
    }
  }
];
////////////////////
//<--常量区
////////////////////

////////////////////
//变量区-->
////////////////////
let ctx: CanvasRenderingContext2D | null = null;
let isDragging = false;
let lastX = 0;
let lastY = 0;
let offsetX = 0;  // 原点在x轴上的偏移
let offsetY = 0;  // 原点在y轴上的偏移
let scale = 1;    // 缩放比例
let elementIdIndex = 1;
let renderList: Array<Element> = [];  // 
let hiddenList: Array<Element> = [];  // 
let eventArea: Array<EventArea> = []; // 事件触发区域列表
let mouseX = 0;
let mouseY = 0;
let hoveredArea: EventArea | null = null;
let drawStatusPoint = false;
let drawStatusLine = false;
let drawStatusSegment = false;
let drawTempPoints: Array<Point> = []; // 临时存储绘制中的点
let isDrawing = false; // 是否正在绘制中（用于线和线段）
let drawStartPoint: Point | null = null; // 绘制起点（用于线）
////////////////////
//<--变量区
////////////////////

////////////////////
//computed-->
////////////////////
const emptyComputed = computed(() => {
  return;
});
////////////////////
//<--computed
////////////////////

////////////////////
//初始化函数区-->
////////////////////
const startSetting = () => {
  // 初始化原点偏移量为画布中心
  if (canvas.value) {
    offsetX = canvas.value.width / 2;
    offsetY = canvas.value.height / 2;
  }

  // 测试元素
  const pointProp: InherentProp = { name: 'P1', color: { r: 0, g: 100, b: 255 }, opacity: 1 };
  createPoint({ x: 100, y: 50 }, pointProp, {});

  const lineProp: InherentProp = { name: 'L1', color: { r: 0, g: 255, b: 0 }, opacity: 0.8 };
  createLine([{ x: -100, y: -100 }, { x: 100, y: 100 }], lineProp, {});

  const segmentProp: InherentProp = { name: 'S1', color: { r: 0, g: 0, b: 255 }, opacity: 0.6 };
  createSegment([{ x: -50, y: 50 }, { x: 50, y: 50 }, { x: 50, y: -50 }, { x: -50, y: -50 }, { x: -50, y: 50 }], segmentProp, {});
  createEventArea()
  // 渲染元素
  drawElement();
};
////////////////////
//<--初始化函数区
////////////////////

////////////////////
//各种创建函数区-->
////////////////////

/**
 * 创建图形添加按钮
 */
const createAddBt = () => {
  if (!ctx || !canvas.value) return;

  const startX = bt1Padding;
  const startY = bt1Padding;


  ctx.save();

  // 绘制面板背景
  const panelWidth = bt1Width + 40;
  const panelHeight = buttons.length * (bt1Height + bt1Spacing) + 40 - bt1Spacing;
  ctx.beginPath();
  ctx.roundRect(startX - 15, startY - 15, panelWidth, panelHeight, 12);
  ctx.fill();

  // 重置阴影（避免影响后续绘制）
  ctx.shadowColor = 'transparent';

  // 绘制每个按钮
  buttons.forEach((button, index) => {
    if (ctx === null) return;
    const x = startX;
    const y = button.y;

    // 绘制按钮背景
    ctx.fillStyle = `rgba(${button.color.r}, ${button.color.g}, ${button.color.b}, 0.1)`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, bt1Width, bt1Height, 8);
    ctx.fill();

    // 绘制按钮边框
    ctx.strokeStyle = `rgb(${button.color.r}, ${button.color.g}, ${button.color.b})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // 绘制图标（大圆点）
    ctx.font = '30px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = `rgb(${button.color.r}, ${button.color.g}, ${button.color.b})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(button.icon, x + 25, y + bt1Height / 2);

    // 绘制按钮文字
    ctx.font = 'bold ' + button.size + 'px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.fillText(button.label, x + 45, y + bt1Height / 2);

  });

  // 绘制分隔线
  ctx.beginPath();
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 3]);
  ctx.moveTo(startX - 5, startY + buttons.length * (bt1Height + bt1Spacing) + 5);
  ctx.lineTo(startX + bt1Width + 5, startY + buttons.length * (bt1Height + bt1Spacing) + 5);
  ctx.stroke();

  // 重置虚线设置
  ctx.setLineDash([]);

  ctx.restore();
};

const createEventArea = () => {
  // 为每个按钮创建事件区域
  buttons.forEach(button => {
    eventArea.push({
      id: button.id,
      rect: {
        x: button.x,
        y: button.y,
        width: bt1Width,
        height: bt1Height
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
        // 可以在这里处理悬停效果，比如改变按钮颜色
        if (isHovering) {
          canvas.value!.style.cursor = 'pointer';
        }
      }
    });
  });
}

/**
 * 创建坐标轴刻度标记
 */
const createAxisMark = () => {
  if (!ctx || !canvas.value) return;

  const width = canvas.value.width;
  const height = canvas.value.height;
  const gridSize = 50 * scale; // 网格大小
  const tickSize = 6; // 刻度线长度

  ctx.save();
  ctx.font = '12px Arial';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 计算画布可见区域对应的坐标范围
  const canvasLeftTop = screenToCanvas(0, 0);
  const canvasRightBottom = screenToCanvas(width, height);

  // X轴刻度（在X轴上绘制）
  if (offsetY >= 0 && offsetY <= height) {
    // 计算X轴可见区域的坐标范围
    const minX = Math.min(canvasLeftTop.x, canvasRightBottom.x);
    const maxX = Math.max(canvasLeftTop.x, canvasRightBottom.x);

    // 计算第一个刻度的坐标（按gridSize取整）
    let firstTickX = Math.ceil(minX / 50) * 50;

    // 绘制X轴刻度
    for (let x = firstTickX; x <= maxX; x += 50) {
      const screenPos = canvasToScreen(x, 0);

      // 确保刻度在画布范围内
      if (screenPos.x >= 0 && screenPos.x <= width) {
        // 绘制刻度线
        ctx.beginPath();
        ctx.moveTo(screenPos.x, offsetY - tickSize / 2);
        ctx.lineTo(screenPos.x, offsetY + tickSize / 2);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 绘制刻度数值
        ctx.fillText(x.toString(), screenPos.x, offsetY + 15);
      }
    }
  }

  // Y轴刻度（在Y轴上绘制）
  if (offsetX >= 0 && offsetX <= width) {
    // 计算Y轴可见区域的坐标范围
    const minY = Math.min(canvasLeftTop.y, canvasRightBottom.y);
    const maxY = Math.max(canvasLeftTop.y, canvasRightBottom.y);

    // 计算第一个刻度的坐标（按gridSize取整）
    let firstTickY = Math.ceil(minY / 50) * 50;

    // 绘制Y轴刻度
    for (let y = firstTickY; y <= maxY; y += 50) {
      const screenPos = canvasToScreen(0, y);

      // 确保刻度在画布范围内
      if (screenPos.y >= 0 && screenPos.y <= height) {
        // 绘制刻度线
        ctx.beginPath();
        ctx.moveTo(offsetX - tickSize / 2, screenPos.y);
        ctx.lineTo(offsetX + tickSize / 2, screenPos.y);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 绘制刻度数值
        ctx.fillText(y.toString(), offsetX - 20, screenPos.y);
      }
    }
  }

  ctx.restore();
};

/**
 * 创建坐标辅助轴（带刻度）
 * @param xColor X轴颜色
 * @param yColor Y轴颜色
 */
const createAxis = (xColor: RGB, yColor: RGB) => {
  if (!ctx || !canvas.value) return;

  const width = canvas.value.width;
  const height = canvas.value.height;
  const gridSize = 50 * scale; // 网格大小（像素）
  const tickSize = 6; // 刻度线长度

  // 保存当前上下文状态
  ctx.save();

  // 绘制X轴（红色）
  ctx.beginPath();
  ctx.strokeStyle = `rgb(${xColor.r}, ${xColor.g}, ${xColor.b})`;
  ctx.lineWidth = 2;
  ctx.moveTo(0, offsetY);
  ctx.lineTo(width, offsetY);
  ctx.stroke();

  // 绘制Y轴（绿色）
  ctx.beginPath();
  ctx.strokeStyle = `rgb(${yColor.r}, ${yColor.g}, ${yColor.b})`;
  ctx.lineWidth = 2;
  ctx.moveTo(offsetX, 0);
  ctx.lineTo(offsetX, height);
  ctx.stroke();

  // 绘制箭头（X轴箭头）
  ctx.beginPath();
  ctx.fillStyle = `rgb(${xColor.r}, ${xColor.g}, ${xColor.b})`;
  // 右箭头
  ctx.moveTo(width - 10, offsetY - 5);
  ctx.lineTo(width, offsetY);
  ctx.lineTo(width - 10, offsetY + 5);
  ctx.fill();

  // 左箭头
  ctx.beginPath();
  ctx.moveTo(10, offsetY - 5);
  ctx.lineTo(0, offsetY);
  ctx.lineTo(10, offsetY + 5);
  ctx.fill();

  // 绘制箭头（Y轴箭头）
  ctx.beginPath();
  ctx.fillStyle = `rgb(${yColor.r}, ${yColor.g}, ${yColor.b})`;
  // 上箭头
  ctx.moveTo(offsetX - 5, 10);
  ctx.lineTo(offsetX, 0);
  ctx.lineTo(offsetX + 5, 10);
  ctx.fill();

  // 下箭头
  ctx.beginPath();
  ctx.moveTo(offsetX - 5, height - 10);
  ctx.lineTo(offsetX, height);
  ctx.lineTo(offsetX + 5, height - 10);
  ctx.fill();

  // 标注坐标轴文字
  ctx.font = "14px Arial";
  ctx.fillStyle = "#000";
  ctx.fillText("X", width - 20, offsetY - 10);
  ctx.fillText("Y", offsetX + 10, 20);

  // 原点标注
  ctx.beginPath();
  ctx.arc(offsetX, offsetY, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#333';
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px Arial';
  ctx.fillText("O", offsetX + 8, offsetY - 8);

  // 恢复上下文状态
  ctx.restore();
};

/**
 * 创建比例尺
 */
const creatComparingRule = () => {
  if (!ctx || !canvas.value) return;

  const padding = 20;
  const ruleWidth = 90;
  const ruleHeight = 40;

  const x = padding;
  const y = canvas.value.height - padding - ruleHeight;

  ctx.save();

  // 半透明背景
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(x, y, ruleWidth, ruleHeight);

  // 边框
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, ruleWidth, ruleHeight);

  // 每格实际代表的单位
  const gridUnit = 50; // 每格代表50单位

  // 比例尺显示
  ctx.font = '12px Arial';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';

  // 绘制比例尺条
  ctx.beginPath();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.moveTo(x + 20, y + 25);
  ctx.lineTo(x + ruleWidth - 20, y + 25);
  ctx.stroke();

  // 刻度
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 20);
  ctx.lineTo(x + 20, y + 30);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + ruleWidth - 20, y + 20);
  ctx.lineTo(x + ruleWidth - 20, y + 30);
  ctx.stroke();

  // 数值
  ctx.fillText('0', x + 20, y + 15);
  ctx.fillText(`${gridUnit}`, x + ruleWidth - 20, y + 15);

  ctx.restore();
};

/**
 * 绘制网格辅助线
 */
const createGrid = () => {
  if (!ctx || !canvas.value) return;

  const width = canvas.value.width;
  const height = canvas.value.height;
  const gridSize = 50 * scale; // 网格大小，随缩放比例变化

  ctx.save();
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 0.5;

  // 绘制垂直网格线
  for (let x = offsetX % gridSize; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // 绘制水平网格线
  for (let y = offsetY % gridSize; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
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

  renderList.push(element);

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

  renderList.push(element);

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

  renderList.push(element);

  return element;
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
const screenToCanvas = (screenX: number, screenY: number) => {
  return {
    x: screenX - offsetX,
    y: offsetY - screenY  // 因为屏幕Y轴向下，画布Y轴向上
  };
};

/**
 * 将画布坐标转换为屏幕坐标
 * @param canvasX 画布X坐标
 * @param canvasY 画布Y坐标
 * @returns 屏幕坐标对象
 */
const canvasToScreen = (canvasX: number, canvasY: number) => {
  return {
    x: canvasX + offsetX,
    y: offsetY - canvasY
  };
};

/**
 * 绘制元素
 */
const drawElement = () => {
  if (!ctx || !canvas.value) return;

  // 遍历渲染列表中的所有元素
  renderList.forEach(element => {
    if (ctx === null) return;
    // 保存当前上下文状态
    ctx.save();

    // 设置通用属性
    if (element.inherentProp.color) {
      ctx.strokeStyle = `rgb(${element.inherentProp.color.r}, ${element.inherentProp.color.g}, ${element.inherentProp.color.b})`;
      ctx.fillStyle = `rgb(${element.inherentProp.color.r}, ${element.inherentProp.color.g}, ${element.inherentProp.color.b})`;
    }

    // 设置透明度
    if (element.inherentProp.opacity) {
      ctx.globalAlpha = element.inherentProp.opacity;
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
    ctx.restore();
  });
};

/**
 * 绘制点元素
 */
const drawPointElement = (element: PointElement) => {
  if (!ctx || !canvas.value || element.points.length === 0) return;

  const point = element.points[0];

  // 将画布坐标转换为屏幕坐标
  const screenPos = canvasToScreen(point.x, point.y);

  ctx.beginPath();

  // 绘制点（半径为5的圆）
  ctx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
  ctx.fill();

  // 绘制点的边框
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 绘制点的名称（如果有）
  if (element.inherentProp.name) {
    ctx.font = '12px Arial';
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1; // 文字不透明
    ctx.fillText(element.inherentProp.name, screenPos.x + 10, screenPos.y - 10);
  }
};

/**
 * 绘制直线元素
 */
const drawLineElement = (element: LineElement) => {
  if (!ctx || !canvas.value || element.points.length < 2) return;

  const startPoint = element.points[0];
  const endPoint = element.points[1];

  // 将画布坐标转换为屏幕坐标
  const startScreen = canvasToScreen(startPoint.x, startPoint.y);
  const endScreen = canvasToScreen(endPoint.x, endPoint.y);

  ctx.beginPath();
  ctx.moveTo(startScreen.x, startScreen.y);
  ctx.lineTo(endScreen.x, endScreen.y);

  // 设置线宽
  ctx.lineWidth = 2;
  ctx.stroke();

  // 绘制直线上的两个端点标记
  ctx.beginPath();
  ctx.arc(startScreen.x, startScreen.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#00f';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(endScreen.x, endScreen.y, 3, 0, Math.PI * 2);
  ctx.fill();

  // 绘制直线名称
  if (element.inherentProp.name) {
    // 计算中点位置
    const midX = (startScreen.x + endScreen.x) / 2;
    const midY = (startScreen.y + endScreen.y) / 2;

    ctx.font = '12px Arial';
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1;
    ctx.fillText(element.inherentProp.name, midX + 10, midY - 10);
  }
  // 绘制每个顶点的标记
  element.points.forEach((point, index) => {
    if (ctx === null) return;
    const screenPos = canvasToScreen(point.x, point.y);

    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f00';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 绘制顶点编号
    ctx.font = '10px Arial';
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1;
    ctx.fillText(index.toString(), screenPos.x + 8, screenPos.y - 8);
  });
};

/**
 * 绘制线段元素
 */
const drawSegmentElement = (element: SegmentElement) => {
  if (!ctx || !canvas.value || element.points.length < 2) return;
  let ptLength = element.points.length - 1;
  ctx.beginPath();

  // 将第一个点转换为屏幕坐标并移动到该点
  const firstScreen = canvasToScreen(element.points[0].x, element.points[0].y);
  ctx.moveTo(firstScreen.x, firstScreen.y);

  // 依次连接各个点
  for (let i = 1; i < element.points.length; i++) {
    const screenPos = canvasToScreen(element.points[i].x, element.points[i].y);
    ctx.lineTo(screenPos.x, screenPos.y);
  }

  // 如果是闭合线段（首尾相连），可以填充
  const isClosed =
    element.points[0].x === element.points[element.points.length - 1].x &&
    element.points[0].y === element.points[element.points.length - 1].y;

  if (isClosed) {
    // 闭合路径
    ctx.closePath();
    // 填充
    ctx.globalAlpha = element.inherentProp.opacity * 0.3; // 填充透明度更低
    ctx.fill();
    // 描边
    ctx.globalAlpha = element.inherentProp.opacity;
    ctx.stroke();
  } else {
    // 只描边
    ctx.stroke();
  }

  // 绘制每个顶点的标记
  element.points.forEach((point, index) => {
    if (ctx === null) return;
    if (isClosed) { if (index === ptLength) { return; } }
    const screenPos = canvasToScreen(point.x, point.y);

    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f00';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 绘制顶点编号
    ctx.font = '10px Arial';
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1;
    ctx.fillText(index.toString(), screenPos.x + 8, screenPos.y - 8);
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
    const screenCenter = canvasToScreen(centerX, centerY);

    ctx.font = '12px Arial';
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1;
    ctx.fillText(element.inherentProp.name, screenCenter.x + 10, screenCenter.y - 10);
  }
};

/**
 * 清空渲染列表
 */
const clearRenderList = () => {
  renderList = [];
  redraw();
};

/**
 * 从渲染列表中移除元素
 */
const removeFromRenderList = (id: number) => {
  renderList = renderList.filter(element => element.id !== id);
  redraw();
};

/**
 * 更新元素属性
 */
const updateElementProperty = (id: number, newProps: Partial<InherentProp>) => {
  const element = renderList.find(e => e.id === id);
  if (element) {
    element.inherentProp = { ...element.inherentProp, ...newProps };
    redraw();
  }
};

/**
 * 重绘画布
 */
const redraw = () => {
  if (!ctx || !canvas.value) return;

  // 清空画布
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);

  // 设置背景色
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);

  // 绘制网格
  createGrid();

  // 绘制坐标轴
  createAxis({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 });

  // 绘制刻度与刻度数值
  createAxisMark();

  // 渲染元素
  drawElement();

  // 绘制临时线段预览（如果正在绘制线段）
  if (drawStatusSegment && drawTempPoints.length >= 1) {
    drawTempSegment();
  }
  
  // 绘制临时点预览（如果正在绘制线且已有第一个点）
  if (drawStatusLine && drawStartPoint) {
    showTempPoint(drawStartPoint);
    
    // 如果有鼠标位置，可以显示从起点到鼠标的预览线
    if (mouseX && mouseY) {
      const mouseCanvasPos = screenToCanvas(mouseX, mouseY);
      ctx.save();
      ctx.beginPath();
      const startScreen = canvasToScreen(drawStartPoint.x, drawStartPoint.y);
      ctx.moveTo(startScreen.x, startScreen.y);
      ctx.lineTo(mouseX, mouseY);
      ctx.strokeStyle = 'rgba(52, 168, 83, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 绘制单位标尺
  creatComparingRule();

  // 绘制交互按钮
  createAddBt();
};
////////////////////
//<--其他函数区
////////////////////

////////////////////
//事件处理函数区-->
////////////////////

/**
 * 进入绘制点事件
 */
const onInventPoint = () => {
  // 如果正在绘制其他图形，先退出
  if (drawStatusLine || drawStatusSegment) {
    onCancelLine();
    onCancelSegment();
  }
  
  console.log("触发进入创建点状态");
  drawStatusPoint = true;
  drawTempPoints = [];
  isDrawing = false;
  
  // 改变鼠标样式
  if (canvas.value) {
    canvas.value.style.cursor = 'crosshair';
  }
  
  // 添加键盘监听
  window.addEventListener('keydown', onKeyDown);
};

/**
 * 退出绘制点事件
 */
const onCancelPoint = () => {
  console.log("触发退出创建点状态");
  drawStatusPoint = false;
  drawTempPoints = [];
  
  // 恢复鼠标样式
  if (canvas.value) {
    canvas.value.style.cursor = 'default';
  }
  
  // 移除键盘监听
  window.removeEventListener('keydown', onKeyDown);
};

/**
 * 进入绘制线事件（两点确定一条无限延伸的直线）
 */
const onInventLine = () => {
  // 如果正在绘制其他图形，先退出
  if (drawStatusPoint || drawStatusSegment) {
    onCancelPoint();
    onCancelSegment();
  }
  
  console.log("触发进入创建线状态");
  drawStatusLine = true;
  drawTempPoints = [];
  drawStartPoint = null;
  isDrawing = true; // 线需要两个点
  
  // 改变鼠标样式
  if (canvas.value) {
    canvas.value.style.cursor = 'crosshair';
  }
  
  // 添加键盘监听
  window.addEventListener('keydown', onKeyDown);
};

/**
 * 退出绘制线事件
 */
const onCancelLine = () => {
  console.log("触发退出创建线状态");
  drawStatusLine = false;
  drawTempPoints = [];
  drawStartPoint = null;
  isDrawing = false;
  
  // 恢复鼠标样式
  if (canvas.value) {
    canvas.value.style.cursor = 'default';
  }
  
  // 移除键盘监听
  window.removeEventListener('keydown', onKeyDown);
};

/**
 * 进入绘制线段事件（多点连续线段）
 */
const onInventSegment = () => {
  // 如果正在绘制其他图形，先退出
  if (drawStatusPoint || drawStatusLine) {
    onCancelPoint();
    onCancelLine();
  }
  
  console.log("触发进入创建线段状态");
  drawStatusSegment = true;
  drawTempPoints = [];
  isDrawing = true;
  
  // 改变鼠标样式
  if (canvas.value) {
    canvas.value.style.cursor = 'crosshair';
  }
  
  // 添加键盘监听
  window.addEventListener('keydown', onKeyDown);
};

/**
 * 退出绘制线段事件
 */
const onCancelSegment = () => {
  console.log("触发退出创建线段状态");
  drawStatusSegment = false;
  drawTempPoints = [];
  isDrawing = false;
  
  // 恢复鼠标样式
  if (canvas.value) {
    canvas.value.style.cursor = 'default';
  }
  
  // 移除键盘监听
  window.removeEventListener('keydown', onKeyDown);
};

/**
 * 键盘事件处理（ESC退出绘制）
 */
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    console.log("ESC pressed, exiting draw mode");
    
    if (drawStatusPoint) {
      onCancelPoint();
    } else if (drawStatusLine) {
      onCancelLine();
    } else if (drawStatusSegment) {
      onCancelSegment();
    }
  }
};

/**
 * 画布点击事件处理
 */
const onCanvasClick = (e: MouseEvent) => {
  if (!canvas.value || !ctx) return;

  // 获取点击位置的屏幕坐标并转换为画布坐标
  const screenX = e.offsetX;
  const screenY = e.offsetY;
  const canvasPos = screenToCanvas(screenX, screenY);
  
  // 首先检查是否点击了按钮区域
  let flagA = false;
  for (let i = eventArea.length - 1; i >= 0; i--) {
    const area = eventArea[i];
    if (screenX >= area.rect.x &&
      screenX <= area.rect.x + area.rect.width &&
      screenY >= area.rect.y &&
      screenY <= area.rect.y + area.rect.height) {

      if (area.onClick) {
        area.onClick(e, area);
        showClickEffect(area.rect.x + area.rect.width / 2, area.rect.y + area.rect.height / 2);
      }
      e.stopPropagation();
      flagA = true;
      break;
    }
  }

  // 如果点击了按钮区域，不处理图形绘制
  if (flagA) return;

  // 处理绘制状态
  if (drawStatusPoint) {
    // 绘制点：直接创建
    handleDrawPoint(canvasPos);
  } else if (drawStatusLine) {
    // 绘制线：需要两个点
    handleDrawLine(canvasPos);
  } else if (drawStatusSegment) {
    // 绘制线段：多点连续
    handleDrawSegment(canvasPos);
  }
};

/**
 * 处理绘制点
 */
const handleDrawPoint = (canvasPos: Point) => {
  const pointProp: InherentProp = { 
    name: `P${renderList.filter(e => e.type === 'point').length + 1}`, 
    color: { r: 66, g: 133, b: 244 }, 
    opacity: 1 
  };
  
  createPoint(canvasPos, pointProp, {});
  showClickEffect(canvasToScreen(canvasPos.x, canvasPos.y).x, canvasToScreen(canvasPos.x, canvasPos.y).y);
  
  // 点创建后不退出绘制状态，可以继续创建点
  redraw();
};

/**
 * 处理绘制线
 */
const handleDrawLine = (canvasPos: Point) => {
  if (!drawStartPoint) {
    // 第一个点
    drawStartPoint = canvasPos;
    drawTempPoints = [canvasPos];
    
    // 在点击位置显示临时标记
    showTempPoint(canvasPos);
    console.log("Line: first point selected", canvasPos);
  } else {
    // 第二个点，创建直线
    const lineProp: InherentProp = { 
      name: `L${renderList.filter(e => e.type === 'line').length + 1}`, 
      color: { r: 52, g: 168, b: 83 }, 
      opacity: 0.8 
    };
    
    createLine([drawStartPoint, canvasPos], lineProp, {});
    
    // 显示创建动画
    showClickEffect(canvasToScreen(canvasPos.x, canvasPos.y).x, canvasToScreen(canvasPos.x, canvasPos.y).y);
    
    // 重置状态，准备画下一条线
    drawStartPoint = null;
    drawTempPoints = [];
    
    redraw();
    console.log("Line created");
  }
};

/**
 * 处理绘制线段
 */
const handleDrawSegment = (canvasPos: Point) => {
  // 添加点到临时数组
  drawTempPoints.push(canvasPos);
  
  // 显示临时点
  showTempPoint(canvasPos);
  
  console.log(`Segment: point ${drawTempPoints.length} added`, canvasPos);
  
  // 如果已经有至少两个点，显示临时线段
  if (drawTempPoints.length >= 2) {
    drawTempSegment();
  }
  
  // 如果点击了第一个点附近（闭合线段），自动完成
  if (drawTempPoints.length >= 3) {
    const firstPoint = drawTempPoints[0];
    const distance = Math.sqrt(
      Math.pow(canvasPos.x - firstPoint.x, 2) + 
      Math.pow(canvasPos.y - firstPoint.y, 2)
    );
    
    // 如果距离小于20单位，认为是闭合操作
    if (distance < 20) {
      // 闭合线段，将第一个点作为最后一个点
      drawTempPoints.push(firstPoint);
      
      // 创建线段
      const segmentProp: InherentProp = { 
        name: `S${renderList.filter(e => e.type === 'segment').length + 1}`, 
        color: { r: 251, g: 188, b: 5 }, 
        opacity: 0.6 
      };
      
      createSegment(drawTempPoints, segmentProp, {});
      
      // 重置状态
      drawTempPoints = [];
      redraw();
      console.log("Segment created (closed)");
    }
  }
};

/**
 * 显示临时点（用于绘制中的预览）
 */
const showTempPoint = (point: Point) => {
  if (!ctx || !canvas.value) return;
  
  const screenPos = canvasToScreen(point.x, point.y);
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fill();
  ctx.strokeStyle = '#ff9900';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
};

/**
 * 绘制临时线段（预览）
 */
const drawTempSegment = () => {
  if (!ctx || !canvas.value || drawTempPoints.length < 2) return;
  
  ctx.save();
  ctx.beginPath();
  
  const firstScreen = canvasToScreen(drawTempPoints[0].x, drawTempPoints[0].y);
  ctx.moveTo(firstScreen.x, firstScreen.y);
  
  for (let i = 1; i < drawTempPoints.length; i++) {
    const screenPos = canvasToScreen(drawTempPoints[i].x, drawTempPoints[i].y);
    ctx.lineTo(screenPos.x, screenPos.y);
  }
  
  ctx.strokeStyle = '#ff9900';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]); // 虚线表示预览
  ctx.stroke();
  
  // 绘制临时点
  drawTempPoints.forEach(point => {
    showTempPoint(point);
  });
  
  ctx.restore();
};

/**
 * 显示点击效果（可选）
 */
const showClickEffect = (x: number, y: number) => {
  if (!ctx || !canvas.value) return;

  // 保存当前上下文状态
  ctx.save();

  // 绘制点击波纹效果
  let radius = 0;
  const maxRadius = 20;
  const startTime = performance.now();

  const animateRipple = () => {
    const currentTime = performance.now();
    const progress = (currentTime - startTime) / 300; // 300ms动画
    if (ctx === null) return;
    if (progress < 1) {
      radius = maxRadius * progress;

      // 重绘整个画布（需要触发完整重绘）
      redraw();

      // 在顶部绘制点击效果
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 100, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      requestAnimationFrame(animateRipple);
    } else {
      // 动画结束，重绘清除效果
      redraw();
    }
  };

  requestAnimationFrame(animateRipple);
};


/**
 * 调整画布大小以适应窗口
 */
const onResizeCanvas = () => {
  if (!canvas.value) return;

  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;

  // 重新获取上下文并进行初始化绘制
  ctx = canvas.value.getContext('2d');
  if (ctx) {
    // 如果还没有设置偏移量，初始化为画布中心
    if (offsetX === 0 && offsetY === 0) {
      offsetX = canvas.value.width / 2;
      offsetY = canvas.value.height / 2;
    }

    // 重新绘制所有内容
    redraw();
  }
};

/**
 * 鼠标按下事件
 */
const onMousedown = (e: MouseEvent) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;

  // 改变鼠标样式
  if (canvas.value) {
    canvas.value.style.cursor = 'grabbing';
  }
};

/**
 * 鼠标移动事件
 */
const onMouseMove = (e: MouseEvent) => {
  // 更新鼠标位置
  mouseX = e.offsetX;
  mouseY = e.offsetY;
  
  if (!isDragging || !canvas.value) {
    // 如果正在绘制状态，实时更新预览
    if (drawStatusLine || drawStatusSegment) {
      redraw();
    }
    return;
  }

  // 计算鼠标移动距离
  const deltaX = e.clientX - lastX;
  const deltaY = e.clientY - lastY;

  // 更新偏移量（实现画布拖动）
  offsetX += deltaX;
  offsetY += deltaY;

  // 更新最后位置
  lastX = e.clientX;
  lastY = e.clientY;

  // 重绘画布
  redraw();
};

/**
 * 鼠标释放事件
 */
const onMouseUp = () => {
  isDragging = false;

  // 恢复鼠标样式
  if (canvas.value) {
    canvas.value.style.cursor = 'default';
  }
};

////////////////////
//<--事件处理函数区
////////////////////

////////////////////
//vue事件处理区-->
////////////////////

onMounted(() => {
  onResizeCanvas();
  startSetting();

  // 添加事件监听
  if (canvas.value) {
    canvas.value.addEventListener('mousedown', onMousedown);
    canvas.value.addEventListener('mousemove', onMouseMove);
    canvas.value.addEventListener('mouseup', onMouseUp);
    canvas.value.addEventListener('mouseleave', onMouseUp); // 鼠标离开画布时取消拖动
    canvas.value.addEventListener('click', onCanvasClick);
  }

  window.addEventListener('resize', onResizeCanvas);
});

onUnmounted(() => {
  // 移除事件监听
  if (canvas.value) {
    canvas.value.removeEventListener('mousedown', onMousedown);
    canvas.value.removeEventListener('mousemove', onMouseMove);
    canvas.value.removeEventListener('mouseup', onMouseUp);
    canvas.value.removeEventListener('mouseleave', onMouseUp);
  }

  window.removeEventListener('resize', onResizeCanvas);
});

////////////////////
//<--vue事件处理区
////////////////////

</script>

<template>
  <div class="view-test2d-container">
    <canvas id="canvas" ref="canvas"></canvas>
  </div>
</template>

<style scoped>
.view-test2d-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: default;
}
</style>