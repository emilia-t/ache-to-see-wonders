interface FloatingNumber {
  text: string;
  worldX: number;
  worldY: number;
  color: string;
  life: number;        // 1 → 0
  yOffset: number;     // 向上飘移偏移量(px)
  velocityY: number;   // 每秒上浮速度(px)
}

class NumericalManager {
  private numbers: FloatingNumber[] = [];
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private worldToScreen: ((x: number, y: number) => { x: number; y: number }) | null = null;

  bindCanvas(canvas: HTMLCanvasElement | null) {
    if (!canvas) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  setWorldToScreen(fn: (x: number, y: number) => { x: number; y: number }) {
    this.worldToScreen = fn;
  }

  addNumber(text: string, worldX: number, worldY: number, color: string) {
    this.numbers.push({
      text,
      worldX,
      worldY,
      color,
      life: 1.0,
      yOffset: 0,
      velocityY: 48, // 每秒向上移动48px
    });
  }

  update(deltaTime: number) {
    for (let i = this.numbers.length-1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= deltaTime;
      n.yOffset += n.velocityY * deltaTime;
      if (n.life <= 0) {
        this.numbers.splice(i,1);
      }
    }
  }

  draw() {
    if (!this.ctx || !this.canvas || !this.worldToScreen) return;
    const { width, height } = this.getCanvasSize();
    this.ctx.clearRect(0, 0, width, height);
    if (this.numbers.length === 0) return;

    this.ctx.save();
    this.ctx.font = 'bold 16px "Microsoft YaHei", Arial, sans-serif';
    this.ctx.shadowBlur = 2;
    this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (const n of this.numbers) {
      const screen = this.worldToScreen(n.worldX, n.worldY);
      const alpha = Math.min(1, n.life * 1.2);
      this.ctx.fillStyle = n.color;
      this.ctx.globalAlpha = alpha;
      // 向上飘移: 实际Y坐标减yOffset
      this.ctx.fillText(n.text, screen.x, screen.y - n.yOffset);
    }
    this.ctx.restore();
  }

  private getCanvasSize() {
    if (!this.canvas) return { width: 0, height: 0 };
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    return { width, height };
  }

  reset() {
    this.numbers = [];
  }
}

export { NumericalManager };