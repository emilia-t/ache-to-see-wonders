import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';
// 贴图资源已由 public/textures 迁移至 pixel_war/resource/textures,通过 Vite 资源导入解析为可用 URL
import boxStaticEntityTextureUrl from '@/components/pixel_war/resource/textures/box_static_entity.png?url';

class BoxStaticEntity extends StaticEntity {
  public static readonly WIDTH = 50;
  public static readonly HEIGHT = 50;
  public static readonly TEXTURE_PATH = boxStaticEntityTextureUrl;

  constructor(
    position: Point,
    name: string = '',
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
    this.mapColor = '#8B4513'; // 地图上的颜色表示
  }
}

export { BoxStaticEntity };

