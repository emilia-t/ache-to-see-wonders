import type { TypeCursorName } from '../type/TypeTest2d';

export interface Resolution { width: number; height: number }
export interface PenPoint {x: number; y: number; g: number};//g是压力值，0-1通过鼠标移动速度模拟
export interface PenTrajectory {
  id: number;//轨迹ID
  color: RGB;//笔迹颜色
  thickness: number;//笔迹粗细
  resolution: Resolution;//分辨率
  startPoint: Point;//参照点
  endPoint: Point;//终结点
  list: Array<PenPoint>;//笔迹点以startPoint为起点的偏移坐标值和压力值
}
export interface RGB { r: number; g: number; b: number; }
export interface Point { x: number; y: number };
export interface EventArea {
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

export interface InherentProp {
  name: string;
  color: RGB;
  opacity: 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1;
};
export interface Element {
  id: number;
  type: "point" | "line" | "segment";
  points: Array<Point>;
  inherentProp: InherentProp;
  customProp: Object;
};
export interface PointElement extends Element {
  type: "point"
};
export interface LineElement extends Element {
  type: "line"
};
export interface SegmentElement extends Element {
  type: "segment"
};
export interface CachedImage {
  img: HTMLImageElement;
  offsetX: number;
  offsetY: number;
}
export interface CollisionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Texture {
  img: HTMLImageElement;
  loaded: boolean;
  path: string;
}

