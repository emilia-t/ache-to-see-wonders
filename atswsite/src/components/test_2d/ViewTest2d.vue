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
const graphicsCanvas = ref<HTMLCanvasElement | null>(null);
const uiCanvas = ref<HTMLCanvasElement | null>(null);
let graphicsCtx: CanvasRenderingContext2D | null = null;
let uiCtx: CanvasRenderingContext2D | null = null;

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
    y: bt1Padding + (bt1Height + bt1Spacing),
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
    y: bt1Padding + (bt1Height + bt1Spacing) * 2,
    onClick: () => {
      if(drawStatusSegment){
        onCancelSegment();
      }else{
        onInventSegment();
      }
      drawUI();
    }
  }
];
const STORAGE_KEY = 'viewTest2dState';
////////////////////
//<--常量区
////////////////////

////////////////////
//变量区-->
////////////////////
let isDragging = false;
let lastX = 0;
let lastY = 0;
let offsetXX = 0;  // 原点在x轴上的偏移
let offsetYY = 0;  // 原点在y轴上的偏移
let scale = 1;    // 缩放比例
let elementIdIndex = 1;
let renderElementList: Array<Element> = [];  // 
let hiddenElementList: Array<Element> = [];  // 
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
  if (graphicsCanvas.value) {
    offsetXX = graphicsCanvas.value.width / 2;
    offsetYY = graphicsCanvas.value.height / 2;
  }

  // 测试元素
  const pointProp: InherentProp = { name: 'P1', color: { r: 0, g: 100, b: 255 }, opacity: 1 };
  createPoint({ x: 100, y: 50 }, pointProp, {});

  const lineProp: InherentProp = { name: 'L1', color: { r: 0, g: 255, b: 0 }, opacity: 0.8 };
  createLine([{ x: -100, y: -100 }, { x: 100, y: 100 }], lineProp, {});

  const segmentProp: InherentProp = { name: 'S1', color: { r: 0, g: 0, b: 255 }, opacity: 0.6 };
  createSegment([{ x: -50, y: 50 }, { x: 50, y: 50 }, { x: 50, y: -50 }, { x: -50, y: -50 }, { x: -50, y: 50 }], segmentProp, {});
  // 渲染元素
  drawGraphics();
};
////////////////////
//<--初始化函数区
////////////////////

////////////////////
//各种创建函数区-->
////////////////////

/**
 * 绘制图形添加按钮（UI层）
 */
const drawUIButtons = () => {
  if (!uiCtx || !uiCanvas.value) return;

  const startX = bt1Padding;
  const startY = bt1Padding;

  uiCtx.save();

  // 绘制面板背景
  const panelWidth = bt1Width + 40;
  const panelHeight = buttons.length * (bt1Height + bt1Spacing) + 40 - bt1Spacing;
  uiCtx.beginPath();
  roundRect(uiCtx, startX - 15, startY - 15, panelWidth, panelHeight, 12);
  uiCtx.fillStyle = 'rgba(255,255,255,0.8)';
  uiCtx.fill();
  uiCtx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  uiCtx.shadowBlur = 5;
  uiCtx.shadowOffsetX = 1;
  uiCtx.shadowOffsetY = 1;

  // 重置阴影（避免影响后续绘制）
  uiCtx.shadowColor = 'transparent';

  // 绘制每个按钮
  buttons.forEach((button) => {
    if(uiCtx===null)return;
    const x = button.x;
    const y = button.y;

    // 根据当前模式决定按钮背景色强度
    let isActive = false;
    if (button.type === 'point' && drawStatusPoint) isActive = true;
    if (button.type === 'line' && drawStatusLine) isActive = true;
    if (button.type === 'segment' && drawStatusSegment) isActive = true;

    const bgOpacity = isActive ? 0.3 : 0.1;
    uiCtx.fillStyle = `rgba(${button.color.r}, ${button.color.g}, ${button.color.b}, ${bgOpacity})`;
    uiCtx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    uiCtx.shadowBlur = 5;
    uiCtx.shadowOffsetX = 1;
    uiCtx.shadowOffsetY = 1;
    uiCtx.beginPath();
    roundRect(uiCtx, x, y, bt1Width, bt1Height, 8);
    uiCtx.fill();

    // 绘制按钮边框
    uiCtx.strokeStyle = `rgb(${button.color.r}, ${button.color.g}, ${button.color.b})`;
    uiCtx.lineWidth = 2;
    uiCtx.shadowBlur = 0;
    uiCtx.stroke();

    // 绘制图标（大圆点）
    uiCtx.font = '30px "Segoe UI", Arial, sans-serif';
    uiCtx.fillStyle = `rgb(${button.color.r}, ${button.color.g}, ${button.color.b})`;
    uiCtx.textAlign = 'center';
    uiCtx.textBaseline = 'middle';
    uiCtx.fillText(button.icon, x + 25, y + bt1Height / 2);

    // 绘制按钮文字
    uiCtx.font = 'bold ' + button.size + 'px "Microsoft YaHei", Arial, sans-serif';
    uiCtx.fillStyle = '#333';
    uiCtx.textAlign = 'left';
    uiCtx.fillText(button.label, x + 45, y + bt1Height / 2);
  });

  // 绘制分隔线
  uiCtx.beginPath();
  uiCtx.strokeStyle = '#ddd';
  uiCtx.lineWidth = 1;
  uiCtx.setLineDash([5, 3]);
  uiCtx.moveTo(startX - 5, startY + buttons.length * (bt1Height + bt1Spacing) + 5);
  uiCtx.lineTo(startX + bt1Width + 5, startY + buttons.length * (bt1Height + bt1Spacing) + 5);
  uiCtx.stroke();

  // 重置虚线设置
  uiCtx.setLineDash([]);

  uiCtx.restore();
};

/**
 * 绘制顶部提示信息（UI层）
 */
const drawInstructions = () => {
  if (!uiCtx || !uiCanvas.value) return;
  const width = uiCanvas.value.width;
  const text = 'Ctrl + S = Save    Ctrl + F = Clear';
  uiCtx.save();
  uiCtx.font = '14px "Microsoft YaHei", Arial, sans-serif';
  uiCtx.fillStyle = 'rgba(78,78,78,0.9)';
  uiCtx.textAlign = 'center';
  uiCtx.textBaseline = 'top';
  const textWidth = uiCtx.measureText(text).width;
  const padding = 10;
  const boxWidth = textWidth + padding * 2;
  const boxHeight = 30;
  const x = (width - boxWidth) / 2;
  const y = 0;
  // 半透明背景
  uiCtx.fillStyle = 'rgba(208,208,208,0.7)';
  roundRect(uiCtx, x, y, boxWidth, boxHeight, 5);
  uiCtx.fill();
  uiCtx.fillStyle = 'rgb(78,78,78)';
  uiCtx.fillText(text, width / 2, y + 8);
  uiCtx.restore();
};

/**
 * 绘制比例尺（UI层）
 */
const drawUIRuler = () => {
  if (!uiCtx || !uiCanvas.value) return;

  const padding = 20;
  const ruleWidth = 90;
  const ruleHeight = 40;

  const x = padding;
  const y = uiCanvas.value.height - padding - ruleHeight;

  uiCtx.save();

  // 半透明背景
  uiCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  uiCtx.fillRect(x, y, ruleWidth, ruleHeight);

  // 边框
  uiCtx.strokeStyle = '#ccc';
  uiCtx.lineWidth = 1;
  uiCtx.strokeRect(x, y, ruleWidth, ruleHeight);

  // 每格实际代表的单位
  const gridUnit = 50; // 每格代表50单位

  // 比例尺显示
  uiCtx.font = '12px Arial';
  uiCtx.fillStyle = '#333';
  uiCtx.textAlign = 'center';

  // 绘制比例尺条
  uiCtx.beginPath();
  uiCtx.strokeStyle = '#333';
  uiCtx.lineWidth = 2;
  uiCtx.moveTo(x + 20, y + 25);
  uiCtx.lineTo(x + ruleWidth - 20, y + 25);
  uiCtx.stroke();

  // 刻度
  uiCtx.beginPath();
  uiCtx.moveTo(x + 20, y + 20);
  uiCtx.lineTo(x + 20, y + 30);
  uiCtx.stroke();

  uiCtx.beginPath();
  uiCtx.moveTo(x + ruleWidth - 20, y + 20);
  uiCtx.lineTo(x + ruleWidth - 20, y + 30);
  uiCtx.stroke();

  // 数值
  uiCtx.fillText('0', x + 20, y + 15);
  uiCtx.fillText(`${gridUnit}`, x + ruleWidth - 20, y + 15);

  uiCtx.restore();
};

/**
 * 绘制圆角矩形辅助函数
 */
const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
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
        if (isHovering) {
          uiCanvas.value!.style.cursor = 'pointer';
        } else {
          uiCanvas.value!.style.cursor = 'default';
        }
      }
    });
  });
}

/**
 * 创建坐标轴刻度标记（图形层）
 */
const createAxisMark = () => {
  if (!graphicsCtx || !graphicsCanvas.value) return;

  const width = graphicsCanvas.value.width;
  const height = graphicsCanvas.value.height;
  const gridSize = 50 * scale; // 网格大小
  const tickSize = 6; // 刻度线长度

  graphicsCtx.save();
  graphicsCtx.font = '12px Arial';
  graphicsCtx.fillStyle = '#333';
  graphicsCtx.textAlign = 'center';
  graphicsCtx.textBaseline = 'middle';

  // 计算画布可见区域对应的坐标范围
  const canvasLeftTop = screenToCanvas(0, 0);
  const canvasRightBottom = screenToCanvas(width, height);

  // X轴刻度（在X轴上绘制）
  if (offsetYY >= 0 && offsetYY <= height) {
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
        graphicsCtx.beginPath();
        graphicsCtx.moveTo(screenPos.x, offsetYY - tickSize / 2);
        graphicsCtx.lineTo(screenPos.x, offsetYY + tickSize / 2);
        graphicsCtx.strokeStyle = '#666';
        graphicsCtx.lineWidth = 1;
        graphicsCtx.stroke();

        // 绘制刻度数值
        graphicsCtx.fillText(x.toString(), screenPos.x, offsetYY + 15);
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
      const screenPos = canvasToScreen(0, y);

      // 确保刻度在画布范围内
      if (screenPos.y >= 0 && screenPos.y <= height) {
        // 绘制刻度线
        graphicsCtx.beginPath();
        graphicsCtx.moveTo(offsetXX - tickSize / 2, screenPos.y);
        graphicsCtx.lineTo(offsetXX + tickSize / 2, screenPos.y);
        graphicsCtx.strokeStyle = '#666';
        graphicsCtx.lineWidth = 1;
        graphicsCtx.stroke();

        // 绘制刻度数值
        graphicsCtx.fillText(y.toString(), offsetXX - 20, screenPos.y);
      }
    }
  }

  graphicsCtx.restore();
};

/**
 * 创建坐标辅助轴（带刻度）（图形层）
 * @param xColor X轴颜色
 * @param yColor Y轴颜色
 */
const createAxis = (xColor: RGB, yColor: RGB) => {
  if (!graphicsCtx || !graphicsCanvas.value) return;

  const width = graphicsCanvas.value.width;
  const height = graphicsCanvas.value.height;
  const gridSize = 50 * scale; // 网格大小（像素）
  const tickSize = 6; // 刻度线长度

  // 保存当前上下文状态
  graphicsCtx.save();

  // 绘制X轴（红色）
  graphicsCtx.beginPath();
  graphicsCtx.strokeStyle = `rgb(${xColor.r}, ${xColor.g}, ${xColor.b})`;
  graphicsCtx.lineWidth = 2;
  graphicsCtx.moveTo(0, offsetYY);
  graphicsCtx.lineTo(width, offsetYY);
  graphicsCtx.stroke();

  // 绘制Y轴（绿色）
  graphicsCtx.beginPath();
  graphicsCtx.strokeStyle = `rgb(${yColor.r}, ${yColor.g}, ${yColor.b})`;
  graphicsCtx.lineWidth = 2;
  graphicsCtx.moveTo(offsetXX, 0);
  graphicsCtx.lineTo(offsetXX, height);
  graphicsCtx.stroke();

  // 绘制箭头（X轴箭头）
  graphicsCtx.beginPath();
  graphicsCtx.fillStyle = `rgb(${xColor.r}, ${xColor.g}, ${xColor.b})`;
  // 右箭头
  graphicsCtx.moveTo(width - 10, offsetYY - 5);
  graphicsCtx.lineTo(width, offsetYY);
  graphicsCtx.lineTo(width - 10, offsetYY + 5);
  graphicsCtx.fill();

  // 左箭头
  graphicsCtx.beginPath();
  graphicsCtx.moveTo(10, offsetYY - 5);
  graphicsCtx.lineTo(0, offsetYY);
  graphicsCtx.lineTo(10, offsetYY + 5);
  graphicsCtx.fill();

  // 绘制箭头（Y轴箭头）
  graphicsCtx.beginPath();
  graphicsCtx.fillStyle = `rgb(${yColor.r}, ${yColor.g}, ${yColor.b})`;
  // 上箭头
  graphicsCtx.moveTo(offsetXX - 5, 10);
  graphicsCtx.lineTo(offsetXX, 0);
  graphicsCtx.lineTo(offsetXX + 5, 10);
  graphicsCtx.fill();

  // 下箭头
  graphicsCtx.beginPath();
  graphicsCtx.moveTo(offsetXX - 5, height - 10);
  graphicsCtx.lineTo(offsetXX, height);
  graphicsCtx.lineTo(offsetXX + 5, height - 10);
  graphicsCtx.fill();

  // 标注坐标轴文字
  graphicsCtx.font = "14px Arial";
  graphicsCtx.fillStyle = "#000";
  graphicsCtx.fillText("X", width - 20, offsetYY - 10);
  graphicsCtx.fillText("Y", offsetXX + 10, 20);

  // 原点标注
  graphicsCtx.beginPath();
  graphicsCtx.arc(offsetXX, offsetYY, 4, 0, Math.PI * 2);
  graphicsCtx.fillStyle = '#333';
  graphicsCtx.fill();
  graphicsCtx.fillStyle = '#000';
  graphicsCtx.font = 'bold 12px Arial';
  graphicsCtx.fillText("O", offsetXX + 8, offsetYY - 8);

  // 恢复上下文状态
  graphicsCtx.restore();
};

/**
 * 绘制网格辅助线（图形层）
 */
const createGrid = () => {
  if (!graphicsCtx || !graphicsCanvas.value) return;

  const width = graphicsCanvas.value.width;
  const height = graphicsCanvas.value.height;
  const gridSize = 50 * scale; // 网格大小，随缩放比例变化

  graphicsCtx.save();
  graphicsCtx.strokeStyle = "#e0e0e0";
  graphicsCtx.lineWidth = 0.5;

  // 绘制垂直网格线
  for (let x = offsetXX % gridSize; x < width; x += gridSize) {
    graphicsCtx.beginPath();
    graphicsCtx.moveTo(x, 0);
    graphicsCtx.lineTo(x, height);
    graphicsCtx.stroke();
  }

  // 绘制水平网格线
  for (let y = offsetYY % gridSize; y < height; y += gridSize) {
    graphicsCtx.beginPath();
    graphicsCtx.moveTo(0, y);
    graphicsCtx.lineTo(width, y);
    graphicsCtx.stroke();
  }

  graphicsCtx.restore();
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
const clearCanvas = () => {
  // 清空元素列表
  renderElementList = [];
  hiddenElementList = [];

  // 重置绘制状态
  drawStatusPoint = false;
  drawStatusLine = false;
  drawStatusSegment = false;
  drawTempPoints = [];
  drawStartPoint = null;
  isDrawing = false;

  // 恢复鼠标样式
  if (uiCanvas.value) {
    uiCanvas.value.style.cursor = 'default';
  }

  // 重绘
  drawGraphics();
  drawUI();
};

/**
 * 保存数据到本地存储
 */
const saveToLocalStorage = () => {
  const state = {
    offsetXX,
    offsetYY,
    renderElementList,
    elementIdIndex,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('状态已保存');
  } catch (e) {
    console.error('保存失败', e);
  }
};

/**
 * 加载本地存储到数据
 */
const loadFromLocalStorage = (): boolean => {
  const saved = localStorage.getItem(STORAGE_KEY);
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
const screenToCanvas = (screenX: number, screenY: number) => {
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
const canvasToScreen = (canvasX: number, canvasY: number) => {
  return {
    x: canvasX + offsetXX,
    y: offsetYY - canvasY
  };
};

/**
 * 绘制元素（图形层）
 */
const drawElement = () => {
  if (!graphicsCtx || !graphicsCanvas.value) return;

  // 遍历渲染列表中的所有元素
  renderElementList.forEach(element => {
    if (graphicsCtx === null) return;
    // 保存当前上下文状态
    graphicsCtx.save();

    // 设置通用属性
    if (element.inherentProp.color) {
      graphicsCtx.strokeStyle = `rgb(${element.inherentProp.color.r}, ${element.inherentProp.color.g}, ${element.inherentProp.color.b})`;
      graphicsCtx.fillStyle = `rgb(${element.inherentProp.color.r}, ${element.inherentProp.color.g}, ${element.inherentProp.color.b})`;
    }

    // 设置透明度
    if (element.inherentProp.opacity) {
      graphicsCtx.globalAlpha = element.inherentProp.opacity;
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
    graphicsCtx.restore();
  });
};

/**
 * 绘制点元素（图形层）
 */
const drawPointElement = (element: PointElement) => {
  if (!graphicsCtx || !graphicsCanvas.value || element.points.length === 0) return;

  const point = element.points[0];

  // 将画布坐标转换为屏幕坐标
  const screenPos = canvasToScreen(point.x, point.y);

  graphicsCtx.beginPath();

  // 绘制点（半径为5的圆）
  graphicsCtx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
  graphicsCtx.fill();

  // 绘制点的边框
  graphicsCtx.strokeStyle = '#000';
  graphicsCtx.lineWidth = 1;
  graphicsCtx.stroke();

  // 绘制点的名称（如果有）
  if (element.inherentProp.name) {
    graphicsCtx.font = '12px Arial';
    graphicsCtx.fillStyle = '#000';
    graphicsCtx.globalAlpha = 1; // 文字不透明
    graphicsCtx.fillText(element.inherentProp.name, screenPos.x + 10, screenPos.y - 10);
  }
};

/**
 * 绘制直线元素（图形层）
 */
const drawLineElement = (element: LineElement) => {
  if (!graphicsCtx || !graphicsCanvas.value || element.points.length < 2) return;

  const startPoint = element.points[0];
  const endPoint = element.points[1];

  // 将画布坐标转换为屏幕坐标
  const startScreen = canvasToScreen(startPoint.x, startPoint.y);
  const endScreen = canvasToScreen(endPoint.x, endPoint.y);

  graphicsCtx.beginPath();
  graphicsCtx.moveTo(startScreen.x, startScreen.y);
  graphicsCtx.lineTo(endScreen.x, endScreen.y);

  // 设置线宽
  graphicsCtx.lineWidth = 2;
  graphicsCtx.stroke();

  // 绘制直线上的两个端点标记
  graphicsCtx.beginPath();
  graphicsCtx.arc(startScreen.x, startScreen.y, 3, 0, Math.PI * 2);
  graphicsCtx.fillStyle = '#00f';
  graphicsCtx.fill();

  graphicsCtx.beginPath();
  graphicsCtx.arc(endScreen.x, endScreen.y, 3, 0, Math.PI * 2);
  graphicsCtx.fill();

  // 绘制直线名称
  if (element.inherentProp.name) {
    // 计算中点位置
    const midX = (startScreen.x + endScreen.x) / 2;
    const midY = (startScreen.y + endScreen.y) / 2;

    graphicsCtx.font = '12px Arial';
    graphicsCtx.fillStyle = '#000';
    graphicsCtx.globalAlpha = 1;
    graphicsCtx.fillText(element.inherentProp.name, midX + 10, midY - 10);
  }
  // 绘制每个顶点的标记
  element.points.forEach((point, index) => {
    if (graphicsCtx === null) return;
    const screenPos = canvasToScreen(point.x, point.y);

    graphicsCtx.beginPath();
    graphicsCtx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
    graphicsCtx.fillStyle = '#f00';
    graphicsCtx.fill();
    graphicsCtx.strokeStyle = '#000';
    graphicsCtx.lineWidth = 1;
    graphicsCtx.stroke();

    // 绘制顶点编号
    graphicsCtx.font = '10px Arial';
    graphicsCtx.fillStyle = '#000';
    graphicsCtx.globalAlpha = 1;
    graphicsCtx.fillText(index.toString(), screenPos.x + 8, screenPos.y - 8);
  });
};

/**
 * 绘制线段元素（图形层）
 */
const drawSegmentElement = (element: SegmentElement) => {
  if (!graphicsCtx || !graphicsCanvas.value || element.points.length < 2) return;
  let ptLength = element.points.length - 1;
  graphicsCtx.beginPath();

  // 将第一个点转换为屏幕坐标并移动到该点
  const firstScreen = canvasToScreen(element.points[0].x, element.points[0].y);
  graphicsCtx.moveTo(firstScreen.x, firstScreen.y);

  // 依次连接各个点
  for (let i = 1; i < element.points.length; i++) {
    const screenPos = canvasToScreen(element.points[i].x, element.points[i].y);
    graphicsCtx.lineTo(screenPos.x, screenPos.y);
  }

  // 如果是闭合线段（首尾相连），可以填充
  const isClosed =
    element.points[0].x === element.points[element.points.length - 1].x &&
    element.points[0].y === element.points[element.points.length - 1].y;

  if (isClosed) {
    // 闭合路径
    graphicsCtx.closePath();
    // 填充
    graphicsCtx.globalAlpha = element.inherentProp.opacity * 0.3; // 填充透明度更低
    graphicsCtx.fill();
    // 描边
    graphicsCtx.globalAlpha = element.inherentProp.opacity;
    graphicsCtx.stroke();
  } else {
    // 只描边
    graphicsCtx.stroke();
  }

  // 绘制每个顶点的标记
  element.points.forEach((point, index) => {
    if (graphicsCtx === null) return;
    if (isClosed) { if (index === ptLength) { return; } }
    const screenPos = canvasToScreen(point.x, point.y);

    graphicsCtx.beginPath();
    graphicsCtx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
    graphicsCtx.fillStyle = '#f00';
    graphicsCtx.fill();
    graphicsCtx.strokeStyle = '#000';
    graphicsCtx.lineWidth = 1;
    graphicsCtx.stroke();

    // 绘制顶点编号
    graphicsCtx.font = '10px Arial';
    graphicsCtx.fillStyle = '#000';
    graphicsCtx.globalAlpha = 1;
    graphicsCtx.fillText(index.toString(), screenPos.x + 8, screenPos.y - 8);
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

    graphicsCtx.font = '12px Arial';
    graphicsCtx.fillStyle = '#000';
    graphicsCtx.globalAlpha = 1;
    graphicsCtx.fillText(element.inherentProp.name, screenCenter.x + 10, screenCenter.y - 10);
  }
};

/**
 * 清空渲染列表
 */
const clearRenderList = () => {
  renderElementList = [];
  drawGraphics();
};

/**
 * 从渲染列表中移除元素
 */
const removeFromRenderList = (id: number) => {
  renderElementList = renderElementList.filter(element => element.id !== id);
  drawGraphics();
};

/**
 * 更新元素属性
 */
const updateElementProperty = (id: number, newProps: Partial<InherentProp>) => {
  const element = renderElementList.find(e => e.id === id);
  if (element) {
    element.inherentProp = { ...element.inherentProp, ...newProps };
    drawGraphics();
  }
};

/**
 * 绘制图形层（网格、轴、元素、临时预览）
 */
const drawGraphics = () => {
  if (!graphicsCtx || !graphicsCanvas.value) return;

  // 清空画布
  graphicsCtx.clearRect(0, 0, graphicsCanvas.value.width, graphicsCanvas.value.height);

  // 设置背景色
  graphicsCtx.fillStyle = '#f0f0f0';
  graphicsCtx.fillRect(0, 0, graphicsCanvas.value.width, graphicsCanvas.value.height);

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
      graphicsCtx.save();
      graphicsCtx.beginPath();
      const startScreen = canvasToScreen(drawStartPoint.x, drawStartPoint.y);
      graphicsCtx.moveTo(startScreen.x, startScreen.y);
      graphicsCtx.lineTo(mouseX, mouseY);
      graphicsCtx.strokeStyle = 'rgba(52, 168, 83, 0.5)';
      graphicsCtx.lineWidth = 2;
      graphicsCtx.setLineDash([5, 3]);
      graphicsCtx.stroke();
      graphicsCtx.restore();
    }
  }
};

/**
 * 绘制UI层（按钮、标尺、提示）
 */
const drawUI = () => {
  if (!uiCtx || !uiCanvas.value) return;
  uiCtx.clearRect(0, 0, uiCanvas.value.width, uiCanvas.value.height);
  drawUIButtons();
  drawUIRuler();
  drawInstructions();
};

/**
 * 显示临时点（用于绘制中的预览，图形层）
 */
const showTempPoint = (point: Point) => {
  if (!graphicsCtx || !graphicsCanvas.value) return;
  
  const screenPos = canvasToScreen(point.x, point.y);
  
  graphicsCtx.save();
  graphicsCtx.beginPath();
  graphicsCtx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
  graphicsCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  graphicsCtx.fill();
  graphicsCtx.strokeStyle = '#ff9900';
  graphicsCtx.lineWidth = 2;
  graphicsCtx.stroke();
  graphicsCtx.restore();
};

/**
 * 绘制临时线段（预览，图形层）
 */
const drawTempSegment = () => {
  if (!graphicsCtx || !graphicsCanvas.value || drawTempPoints.length < 2) return;
  
  graphicsCtx.save();
  graphicsCtx.beginPath();
  
  const firstScreen = canvasToScreen(drawTempPoints[0].x, drawTempPoints[0].y);
  graphicsCtx.moveTo(firstScreen.x, firstScreen.y);
  
  for (let i = 1; i < drawTempPoints.length; i++) {
    const screenPos = canvasToScreen(drawTempPoints[i].x, drawTempPoints[i].y);
    graphicsCtx.lineTo(screenPos.x, screenPos.y);
  }
  
  graphicsCtx.strokeStyle = '#ff9900';
  graphicsCtx.lineWidth = 2;
  graphicsCtx.setLineDash([5, 3]); // 虚线表示预览
  graphicsCtx.stroke();
  
  // 绘制临时点
  drawTempPoints.forEach(point => {
    showTempPoint(point);
  });
  
  graphicsCtx.restore();
};

/**
 * 显示点击效果（图形层）
 */
const showClickEffect = (x: number, y: number) => {
  if (!graphicsCtx || !graphicsCanvas.value) return;

  // 保存当前上下文状态
  graphicsCtx.save();

  // 绘制点击波纹效果
  let radius = 0;
  const maxRadius = 20;
  const startTime = performance.now();

  const animateRipple = () => {
    const currentTime = performance.now();
    const progress = (currentTime - startTime) / 300; // 300ms动画
    if (graphicsCtx === null) return;
    if (progress < 1) {
      radius = maxRadius * progress;

      // 重绘整个画布（需要触发完整重绘）
      drawGraphics();

      // 在顶部绘制点击效果
      graphicsCtx.beginPath();
      graphicsCtx.arc(x, y, radius, 0, Math.PI * 2);
      graphicsCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      graphicsCtx.lineWidth = 2;
      graphicsCtx.stroke();

      graphicsCtx.beginPath();
      graphicsCtx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
      graphicsCtx.strokeStyle = 'rgba(100, 100, 255, 0.6)';
      graphicsCtx.lineWidth = 1.5;
      graphicsCtx.stroke();

      requestAnimationFrame(animateRipple);
    } else {
      // 动画结束，重绘清除效果
      drawGraphics();
    }
  };

  requestAnimationFrame(animateRipple);
};

////////////////////
//<--其他函数区
////////////////////

////////////////////
//事件处理函数区-->
////////////////////

/**
 * 全局键盘快捷键处理
 * Ctrl+S 保存；Ctrl+S 清空画布
 */
const onGlobalKeyDown = (e: KeyboardEvent) => {
  // 仅当按下 Ctrl 或 Command 时才处理
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 's':
        e.preventDefault();
        saveToLocalStorage();
        break;
      case 'f':
        e.preventDefault();
        clearCanvas();
        break;
      // 可在此扩展其他快捷键
    }
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
  showClickEffect(canvasToScreen(canvasPos.x, canvasPos.y).x, canvasToScreen(canvasPos.x, canvasPos.y).y);
  
  // 点创建后不退出绘制状态，可以继续创建点
  drawGraphics();
};

/**
 * 处理绘制线
 */
const handleDrawLine = (canvasPos: Point) => {
  if (!drawStartPoint) {
    // 第一个点
    drawStartPoint = canvasPos;
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
    
    createLine([drawStartPoint, canvasPos], lineProp, {});
    
    // 显示创建动画
    showClickEffect(canvasToScreen(canvasPos.x, canvasPos.y).x, canvasToScreen(canvasPos.x, canvasPos.y).y);
    
    // 重置状态，准备画下一条线
    drawStartPoint = null;
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
      drawTempPoints.pop(); // 移除当前点（因为我们要用第一个点闭合）
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
 * 进入绘制点事件
 */
const onInventPoint = () => {
  // 如果正在绘制其他图形，先退出
  if (drawStatusLine || drawStatusSegment) {
    onCancelLine();
    onCancelSegment();
  }
  
  drawStatusPoint = true;
  drawTempPoints = [];
  isDrawing = false;
  
  // 改变鼠标样式
  if (uiCanvas.value) {
    uiCanvas.value.style.cursor = 'crosshair';
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
  if (uiCanvas.value) {
    uiCanvas.value.style.cursor = 'default';
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
  // 如果正在绘制其他图形，先退出
  if (drawStatusPoint || drawStatusSegment) {
    onCancelPoint();
    onCancelSegment();
  }
  
  drawStatusLine = true;
  drawTempPoints = [];
  drawStartPoint = null;
  isDrawing = true; // 线需要两个点
  
  // 改变鼠标样式
  if (uiCanvas.value) {
    uiCanvas.value.style.cursor = 'crosshair';
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
  drawStartPoint = null;
  isDrawing = false;
  
  // 恢复鼠标样式
  if (uiCanvas.value) {
    uiCanvas.value.style.cursor = 'default';
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
  // 如果正在绘制其他图形，先退出
  if (drawStatusPoint || drawStatusLine) {
    onCancelPoint();
    onCancelLine();
  }
  
  drawStatusSegment = true;
  drawTempPoints = [];
  isDrawing = true;
  
  // 改变鼠标样式
  if (uiCanvas.value) {
    uiCanvas.value.style.cursor = 'crosshair';
  }
  
  // 添加键盘监听
  window.addEventListener('keydown', onKeyDown);
  drawUI();
};

/**
 * 退出绘制线段事件
 */
const onCancelSegment = () => {
  drawStatusSegment = false;
  drawTempPoints = [];
  isDrawing = false;
  
  // 恢复鼠标样式
  if (uiCanvas.value) {
    uiCanvas.value.style.cursor = 'default';
  }
  
  // 移除键盘监听
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
    }
  }
};

/**
 * 画布点击事件处理（绑定到UI Canvas）
 */
const onCanvasClick = (e: MouseEvent) => {
  if (!uiCanvas.value || !graphicsCtx) return;

  // 获取点击位置的屏幕坐标
  const screenX = e.offsetX;
  const screenY = e.offsetY;
  
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
        // 在UI层显示点击效果？这里简单重绘UI
        drawUI();
      }
      e.stopPropagation();
      flagA = true;
      break;
    }
  }

  // 如果点击了按钮区域，不处理图形绘制
  if (flagA) return;

  // 转换为画布坐标
  const canvasPos = screenToCanvas(screenX, screenY);

  // 处理绘制状态
  if (drawStatusPoint) {
    handleDrawPoint(canvasPos);
  } else if (drawStatusLine) {
    handleDrawLine(canvasPos);
  } else if (drawStatusSegment) {
    handleDrawSegment(canvasPos);
  }
};

const onCanvasDoubleClick = (e: MouseEvent) => {
  if (!uiCanvas.value) return;
  // 只处理图形区域双击
  const screenX = e.offsetX;
  const screenY = e.offsetY;
  // 检查是否点击按钮区域，如果是则忽略
  for (let area of eventArea) {
    if (screenX >= area.rect.x && screenX <= area.rect.x + area.rect.width &&
        screenY >= area.rect.y && screenY <= area.rect.y + area.rect.height) {
      return;
    }
  }

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
  if (!graphicsCanvas.value || !uiCanvas.value) return;

  graphicsCanvas.value.width = window.innerWidth;
  graphicsCanvas.value.height = window.innerHeight;
  uiCanvas.value.width = window.innerWidth;
  uiCanvas.value.height = window.innerHeight;

  // 重新获取上下文
  graphicsCtx = graphicsCanvas.value.getContext('2d');
  uiCtx = uiCanvas.value.getContext('2d');

  if (graphicsCtx && uiCtx) {
    // 如果还没有设置偏移量，初始化为画布中心
    if (offsetXX === 0 && offsetYY === 0) {
      offsetXX = graphicsCanvas.value.width / 2;
      offsetYY = graphicsCanvas.value.height / 2;
    }

    // 重新绘制所有内容
    drawGraphics();
    drawUI();
  }
};

/**
 * 鼠标按下事件（绑定到UI Canvas）
 */
const onMousedown = (e: MouseEvent) => {
  const screenX = e.offsetX;
  const screenY = e.offsetY;

  // 如果按在按钮区域，不触发拖动
  for (let area of eventArea) {
    if (screenX >= area.rect.x && screenX <= area.rect.x + area.rect.width &&
        screenY >= area.rect.y && screenY <= area.rect.y + area.rect.height) {
      return;
    }
  }

  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;

  // 改变鼠标样式
  if (uiCanvas.value) {
    if(drawStatusPoint || drawStatusLine || drawStatusSegment){
      return;
    }
    uiCanvas.value.style.cursor = 'grabbing';
  }
};

/**
 * 鼠标移动事件（绑定到UI Canvas）
 */
const onMouseMove = (e: MouseEvent) => {
  // 更新鼠标位置
  mouseX = e.offsetX;
  mouseY = e.offsetY;
  
  // 悬停检测（简单实现：改变光标）
  let hovered = false;
  for (let area of eventArea) {
    if (mouseX >= area.rect.x && mouseX <= area.rect.x + area.rect.width &&
        mouseY >= area.rect.y && mouseY <= area.rect.y + area.rect.height) {
      uiCanvas.value!.style.cursor = area.cursor || 'pointer';
      hovered = true;
      break;
    }
  }
  if (!hovered && !isDragging && !(drawStatusPoint || drawStatusLine || drawStatusSegment)) {
    uiCanvas.value!.style.cursor = 'default';
  }

  if (!isDragging || !uiCanvas.value) {
    // 如果正在绘制状态，实时更新预览（重绘图形）
    if (drawStatusLine || drawStatusSegment) {
      drawGraphics();
    }
    return;
  }

  // 计算鼠标移动距离
  const deltaX = e.clientX - lastX;
  const deltaY = e.clientY - lastY;

  // 更新偏移量（实现画布拖动）
  offsetXX += deltaX;
  offsetYY += deltaY;

  // 更新最后位置
  lastX = e.clientX;
  lastY = e.clientY;

  // 重绘图形
  drawGraphics();
};

/**
 * 鼠标释放事件（绑定到UI Canvas）
 */
const onMouseUp = () => {
  isDragging = false;

  // 恢复鼠标样式
  if (uiCanvas.value) {
    if(drawStatusPoint || drawStatusLine || drawStatusSegment){
      return;
    }
    uiCanvas.value.style.cursor = 'default';
  }
};

/**
 * 清空事件
 */
const onClearAll = () => {
  clearCanvas();  
};

////////////////////
//<--事件处理函数区
////////////////////

////////////////////
//vue事件处理区-->
////////////////////

onMounted(() => {
  onResizeCanvas();
  createEventArea();
  const loaded = loadFromLocalStorage();
  if (!loaded) {
    if (graphicsCanvas.value) {
      offsetXX = graphicsCanvas.value.width / 2;
      offsetYY = graphicsCanvas.value.height / 2;
    }
    startSetting();
  }
  drawGraphics();
  drawUI();
  // 添加事件监听（全部绑定到UI Canvas）
  if (uiCanvas.value) {
    uiCanvas.value.addEventListener('mousedown', onMousedown);
    uiCanvas.value.addEventListener('mousemove', onMouseMove);
    uiCanvas.value.addEventListener('mouseup', onMouseUp);
    uiCanvas.value.addEventListener('mouseleave', onMouseUp); // 鼠标离开画布时取消拖动
    uiCanvas.value.addEventListener('click', onCanvasClick);
    uiCanvas.value.addEventListener('dblclick', onCanvasDoubleClick);
  }

  window.addEventListener('resize', onResizeCanvas);
  window.addEventListener('keydown', onGlobalKeyDown); // 添加快捷键监听
});

onUnmounted(() => {
  // 移除事件监听
  if (uiCanvas.value) {
    uiCanvas.value.removeEventListener('mousedown', onMousedown);
    uiCanvas.value.removeEventListener('mousemove', onMouseMove);
    uiCanvas.value.removeEventListener('mouseup', onMouseUp);
    uiCanvas.value.removeEventListener('mouseleave', onMouseUp);
    uiCanvas.value.removeEventListener('click', onCanvasClick);
    uiCanvas.value.removeEventListener('dblclick', onCanvasDoubleClick);
  }

  window.removeEventListener('resize', onResizeCanvas);
  window.removeEventListener('keydown', onGlobalKeyDown); // 移除快捷键监听
});

////////////////////
//<--vue事件处理区
////////////////////

</script>

<template>
  <div class="view-test2d-container">
    <canvas id="canvas-graphics" ref="graphicsCanvas"></canvas>
    <canvas id="canvas-ui" ref="uiCanvas"></canvas>
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

#canvas-graphics {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none; /* 图形层不接收事件，由UI层转发 */
}

#canvas-ui {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: auto; /* UI层接收所有鼠标事件 */
  cursor: default;
}
</style>