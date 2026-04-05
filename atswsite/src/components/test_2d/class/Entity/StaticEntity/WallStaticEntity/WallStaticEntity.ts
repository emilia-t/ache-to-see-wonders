import { StaticEntity } from '@/components/test_2d/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class WallStaticEntity extends StaticEntity {
  static readonly WIDTH = 50;
  static readonly HEIGHT = 50;
  static readonly TEXTURE_PATH = './textures/wall.png';

  constructor(
    position: Point,
    name: string = 'Stone Wall',
    tag: string = 'wall'
  ) {
    super(
      position,
      WallStaticEntity.WIDTH,
      WallStaticEntity.HEIGHT,
      WallStaticEntity.TEXTURE_PATH,
      name,
      tag
    );
  }
}

export { WallStaticEntity };

