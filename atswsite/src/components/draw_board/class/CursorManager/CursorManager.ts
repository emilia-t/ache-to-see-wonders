import type { CachedImage } from '@/components/draw_board/interface/InterfaceDrawBoard';
import type { TypeCursorName, TypeEffectName } from '@/components/draw_board/type/TypeDrawBoard';

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

export { CursorManager };

