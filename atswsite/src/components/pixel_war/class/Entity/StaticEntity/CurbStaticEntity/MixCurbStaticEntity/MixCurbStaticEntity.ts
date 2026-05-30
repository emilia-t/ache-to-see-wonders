// MixCurbStaticEntity.ts
import { CurbStaticEntity } from '@/components/pixel_war/class';
import type { Point, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

class MixCurbStaticEntity extends CurbStaticEntity {
  constructor(position: Point, width: number, height: number, name: string = '', tag: string = 'mix_curb') {
    super(position, name, tag);
    this.width = width;
    this.height = height;
    this.collisionBox.x = this.position.x - this.width / 2;
    this.collisionBox.y = this.position.y - this.height / 2;
  }

  /**
   * next_ 
   * 1.MixCurb渲染卡顿(效果差)
   * 2.MixCurb碰撞盒子异常
   * 3.red pixel 触发爆炸后存在无法击杀的问题?
   */

  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const left = screenPos.x - this.width / 2;
    const top = screenPos.y - this.height / 2;

    ctx.save();

    if (this.texture && this.texture.loaded) {
      const img = this.texture.img;
      const tileW = img.width;
      const tileH = img.height;

      // 世界坐标中矩形的左上角
      const worldLeft = this.position.x - this.width / 2;
      const worldTop = this.position.y - this.height / 2;

      // 计算纹理偏移量，使纹理在世界坐标网格中对齐（类似多个独立 curb 并排）
      const offsetX = ((worldLeft % tileW) + tileW) % tileW;
      const offsetY = ((worldTop % tileH) + tileH) % tileH;

      const pattern = ctx.createPattern(img, 'repeat');
      if (pattern) {
        ctx.save();
        // 平移画布，使图案原点对齐到世界坐标的网格点
        ctx.translate(left - offsetX, top - offsetY);
        ctx.fillStyle = pattern;
        // 绘制矩形，用偏移量调整起始位置
        ctx.fillRect(offsetX, offsetY, this.width, this.height);
        ctx.restore();
      } else {
        // 降级：拉伸
        ctx.drawImage(img, left, top, this.width, this.height);
      }
    } else {
      ctx.fillStyle = this.fillColor || '#aaaaaa';
      ctx.fillRect(left, top, this.width, this.height);
      ctx.strokeStyle = this.strokeColor || '#000';
      ctx.strokeRect(left, top, this.width, this.height);
    }

    ctx.restore();

    // 调试信息
    if (debugFlags) {
      if (debugFlags.showTag) {
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(this.tag, screenPos.x, screenPos.y + this.height / 2 + 20);
      }
      if (debugFlags.showCollisionBoxes) {
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const box = this.collisionBox;
        const topLeft = worldToScreen(box.x, box.y + box.height);
        ctx.strokeRect(topLeft.x, topLeft.y, box.width, box.height);
        ctx.restore();
      }
    }
  }

  static fromRectangle(from: Point, to: Point, tag: string = 'mix_curb'): MixCurbStaticEntity {
    const centerX = (from.x + to.x) / 2;
    const centerY = (from.y + to.y) / 2;
    const width = Math.abs(to.x - from.x);
    const height = Math.abs(to.y - from.y);
    return new MixCurbStaticEntity({ x: centerX, y: centerY }, width, height, '', tag);
  }
}

export { MixCurbStaticEntity };