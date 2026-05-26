import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

class BoxStaticEntity extends StaticEntity {
  public static readonly WIDTH = 50;
  public static readonly HEIGHT = 50;
  public static readonly TEXTURE_PATH = './textures/box_static_entity.png';

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

