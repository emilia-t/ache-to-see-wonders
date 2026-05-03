import { StaticEntity } from '@/components/test_2d/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/test_2d/interface/InterfaceTest2d';

class CurbStaticEntity extends StaticEntity {
  static readonly WIDTH = 50;
  static readonly HEIGHT = 50;
  static readonly TEXTURE_PATH = './textures/curb_static_entity.png';

  constructor(
    position: Point,
    name: string = 'Curb',
    tag: string = 'curb'
  ) {
    super(
      position,
      CurbStaticEntity.WIDTH,
      CurbStaticEntity.HEIGHT,
      CurbStaticEntity.TEXTURE_PATH,
      name,
      tag
    );
  }
}

export { CurbStaticEntity };

