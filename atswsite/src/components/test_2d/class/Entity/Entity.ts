import type { CollisionBox, Point, Texture } from '@/components/test_2d/interface/InterfaceTest2d';

class Entity {
  private static nextEntityId = 100;
  id: number;
  type: 'static' | 'dynamic' | 'item';
  position: Point;           // 世界坐标-画布坐标
  width: number;
  height: number;
  texturePath: string;
  texture: Texture | null;
  name: string;
  collisionBox: CollisionBox;
  fillColor?: string;
  tag?: string;              // 属性标签，如 "箱子", "猫"

  constructor(
    type: 'static' | 'dynamic' | 'item',
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag?: string
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
}

export { Entity };

