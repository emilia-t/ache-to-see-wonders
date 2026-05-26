import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

class CurbStaticEntity extends StaticEntity {
  public static readonly WIDTH = 50;
  public static readonly HEIGHT = 50;
  public static readonly TEXTURE_PATH = './textures/curb_static_entity.png';

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

