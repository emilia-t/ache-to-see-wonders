import type { CollisionBox, Point, Texture , EntityDebugFlags} from '@/components/pixel_war/interface/Interface';

abstract class Entity {
  private static nextEntityId = 100;
  id: number;
  type: 'static' | 'dynamic' | 'item' | 'empty';
  position: Point;           // 世界坐标-画布坐标
  width: number;
  height: number;
  texturePath: string;
  texture: Texture | null;
  name: string;
  collisionBox: CollisionBox;
  fillColor?: string;    // 填充颜色
  strokeColor?: string;  // 描边颜色
  tag: string;              // 属性标签，如 "箱子", "猫"

  constructor(
    type: 'static' | 'dynamic' | 'item' | 'empty',
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag: string
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
    if (!this.texturePath) {
      this.texture = null;
      return;
    }
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

  // 视口裁剪检测
  isInViewport(
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
    margin = 0
  ): boolean {
    const { x, y } = worldToScreen(this.position.x, this.position.y);
    const halfW = this.width / 2 + margin;
    const halfH = this.height / 2 + margin;
    return (
      !(x + halfW < 0 || x - halfW > canvasSize.width ||
        y + halfH < 0 || y - halfH > canvasSize.height)
    );
  }

  // 绘制实体的抽象方法
  abstract draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void;

}

export { Entity };

