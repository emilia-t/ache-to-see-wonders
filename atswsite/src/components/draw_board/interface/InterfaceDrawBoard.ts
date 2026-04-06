import type { TypeCursorName } from '@/components/draw_board/type/TypeDrawBoard';
export interface CachedImage {
  img: HTMLImageElement;
  offsetX: number;
  offsetY: number;
}
export interface RGB { r: number; g: number; b: number }
export interface Point { x: number; y: number }
export interface InherentProp {
  name: string;
  color: RGB;
  opacity: number;
}

export interface PenPoint { x: number; y: number; g: number }
export interface PenTrajectory {
  id: number;
  color: RGB;
  thickness: number;
  startPoint: Point;
  endPoint: Point;
  list: PenPoint[];
}
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