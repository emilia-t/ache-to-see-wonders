import { CurbStaticEntity } from '@/components/pixel_war/class';
import type { Point } from '@/components/pixel_war/interface/Interface';

type Direction = 'up' | 'down' | 'left' | 'right';

class CurbStaticEntity8Length extends CurbStaticEntity {
  public static readonly TILE = 50;
  public static readonly LENGTH = 8;
  public direction: Direction;

  constructor(position: Point, direction: Direction = 'up', name: string = '', tag: string = 'curb8') {
    super(position, name, tag);
    this.direction = direction;

    // 修正方向映射：上下边界为水平长条，左右边界为垂直长条
    if (direction === 'up' || direction === 'down') {
      // 水平方向：宽度大，高度小
      this.width = CurbStaticEntity8Length.TILE * CurbStaticEntity8Length.LENGTH; // 400
      this.height = CurbStaticEntity8Length.TILE;                                   // 50
    } else {
      // 垂直方向：宽度小，高度大
      this.width = CurbStaticEntity8Length.TILE;                                   // 50
      this.height = CurbStaticEntity8Length.TILE * CurbStaticEntity8Length.LENGTH; // 400
    }

    // 更新碰撞盒的完整属性（包括宽高）
    this.collisionBox.x = this.position.x - this.width / 2;
    this.collisionBox.y = this.position.y - this.height / 2;
    this.collisionBox.width = this.width;
    this.collisionBox.height = this.height;
  }
}

export { CurbStaticEntity8Length };