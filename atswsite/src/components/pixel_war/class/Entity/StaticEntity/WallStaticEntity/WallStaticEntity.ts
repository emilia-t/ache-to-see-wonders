import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';
// 贴图资源已由 public/textures 迁移至 pixel_war/resource/textures,通过 Vite 资源导入解析为可用 URL
import wallStaticEntityTextureUrl from '@/components/pixel_war/resource/textures/wall_static_entity.png?url';

class WallStaticEntity extends StaticEntity {
  public static readonly WIDTH = 50;
  public static readonly HEIGHT = 50;
  public static readonly TEXTURE_PATH = wallStaticEntityTextureUrl;

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
    this.mapColor = '#8eaff0'; // 地图上的颜色表示
  }
}

export { WallStaticEntity };

