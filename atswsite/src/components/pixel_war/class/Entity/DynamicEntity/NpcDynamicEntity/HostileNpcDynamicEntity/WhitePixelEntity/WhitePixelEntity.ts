import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import type { Point } from '@/components/pixel_war/interface/Interface';
import type { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';

class WhitePixelEntity extends HostileNpcDynamicEntity {
  static readonly WIDTH = 25;
  static readonly HEIGHT = 25;

  constructor(position: Point) {
    super(position, WhitePixelEntity.WIDTH, WhitePixelEntity.HEIGHT, '', '', 0, 'white_pixel');
    this.fillColor = '#ffffff';
    this.strokeColor = '#bebebe';
    this.health = 100;
  }

  tryPickupItem(item: ItemEntity): boolean {
    return false;
  }

  pickupItem(item: ItemEntity): void {
    // 白色像素不拾取任何物品
  }


  /**
   * 重写寻路逻辑：随机选择一个正交方向（上下左右），并在该方向上随机移动一定距离（100~300像素）
   * @param target 忽略，实际目标由内部生成
   * @param staticEntities 静态实体列表，用于避障
   * @param options 忽略
   */
  override setTarget(target: Point,staticEntities: StaticEntity[] = [],options: { preferStraight?: boolean } = {}): boolean {
    // 四个正交方向
    const directions = [
      { x: 0, y: -1 }, // 上
      { x: 0, y: 1 },  // 下
      { x: -1, y: 0 }, // 左
      { x: 1, y: 0 }   // 右
    ];

    // 随机选择方向
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    // 随机距离 100～300 像素
    const distance = 100 + Math.random() * 200;
    // 计算目标点（世界坐标）
    const newTarget: Point = {
      x: this.position.x + randomDir.x * distance,
      y: this.position.y + randomDir.y * distance
    };

    // 调用父类的 setTarget 完成路径规划与移动，优先走直线（preferStraight 可帮助减少不必要的弯曲）
    return super.setTarget(newTarget, staticEntities, { preferStraight: true });
  }

  /**
   * 重写更新逻辑：
   * 1. 调用父类处理移动和默认停留
   * 2. 将父类默认的停留时长（0~5秒）修改为 1~3 秒
   * 3. 当移动结束且停留结束时，自动生成下一个随机目标
   */
  override update(dt: number, staticEntities: StaticEntity[]): void {
    const wasMoving = this.isMoving;   // 记录移动前的状态
    const wasStaying = !this.isMoving && this.stayDurationRemaining > 0;

    // 先让父类处理移动、碰撞、默认停留逻辑
    super.update(dt, staticEntities);

    // 死亡后不再进行额外处理
    if (this.isDead) return;

    // 当移动刚刚结束（由移动变为静止）且停留剩余时间大于0时，
    // 说明父类已经调用了 enterStayStateAfterArrival，将停留时长覆盖为 1~3 秒
    if (wasMoving && !this.isMoving && this.stayDurationRemaining > 0) {
      // 父类原本的停留时长为 0~5 秒，这里改为 1~3 秒
      this.stayDurationRemaining = 1 + Math.random() * 2;
    }

    // 当处于空闲状态（未移动 && 停留时间耗尽）时，自动生成下一个随机移动目标
    if (!this.isMoving && this.stayDurationRemaining <= 0 && !this.isDead) {
      // 调用重写后的 setTarget，传入当前的静态实体列表，自动开始新一轮移动
      this.setTarget(this.position, staticEntities, { preferStraight: true });
    }
  }
}

export { WhitePixelEntity };