import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import type { GrenadePurpose } from '@/components/pixel_war/type/Type';
import type { DynamicEntitieList, GameConfig, Point } from '@/components/pixel_war/interface/Interface';
import type { StaticEntity } from '../../StaticEntity/StaticEntity';

abstract class GrenadeDynamicEntity extends DynamicEntity {
  public purpose: GrenadePurpose;// 投掷物类型
  public ownerId: number | null;

  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    purpose: GrenadePurpose,
    tag: string
  ) {
    super(position, width, height, texturePath, name, 'grenade', tag);
    this.purpose = purpose;
    this.health = 1;
    this.healthMax = 1;
    this.ownerId = null;
  }
}

export { GrenadeDynamicEntity };

