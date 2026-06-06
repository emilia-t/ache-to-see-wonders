import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

class WallStaticEntity extends StaticEntity {
  public static readonly WIDTH = 50;
  public static readonly HEIGHT = 50;
  public static readonly TEXTURE_PATH = './textures/wall_static_entity.png';

  constructor(
    position: Point,
    name: string = '',
    tag: string = 'wall',
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

