import { StaticEntity } from '@/components/test_2d/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class BoxStaticEntity extends StaticEntity {
  static readonly WIDTH = 50;
  static readonly HEIGHT = 50;
  static readonly TEXTURE_PATH = './textures/box.png';

  constructor(
    position: Point,
    name: string = 'Wooden Box',
    tag: string = 'box'
  ) {
    super(
      position,
      BoxStaticEntity.WIDTH,
      BoxStaticEntity.HEIGHT,
      BoxStaticEntity.TEXTURE_PATH,
      name,
      tag
    );
  }
}

export { BoxStaticEntity };

