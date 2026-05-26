import { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';

abstract class FoodItemEntity extends ItemEntity {
  public hungerMeterIncrease: number;// 食物增加的饥饿值
  public currentHealthIncrease: number;// 食物直接恢复的生命值
  
  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    tag: string,
    hungerMeterIncrease: number,
    currentHealthIncrease: number
  ) {
    super(
      position,
      width,
      height,
      texturePath,
      name,
      tag,
      60
    );
    this.hungerMeterIncrease = hungerMeterIncrease;
    this.currentHealthIncrease = currentHealthIncrease;
  }
}

export { FoodItemEntity };

