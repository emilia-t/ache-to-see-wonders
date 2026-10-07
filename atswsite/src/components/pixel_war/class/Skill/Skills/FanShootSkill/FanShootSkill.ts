import { Skill } from '@/components/pixel_war/class/Skill/Skill';
import type { SkillCastContext } from '@/components/pixel_war/class/Skill/Skill';
import type { Point } from '@/components/pixel_war/interface/Interface';

/**
 * 技能:扇面连射(fan_shoot_skill)
 *
 * 由击杀 VerdantLancerVl4Entity(青翠枪骑兵)掉落。
 * 释放效果参考枪骑兵的齐射:以瞄准方向为对称轴,把 5 发子弹在
 * ±{@link FanShootSkill.SPREAD_HALF_ANGLE_DEG}° 内均匀铺开,形成一道扇面弹幕。
 */
class FanShootSkill extends Skill {
  /** 技能标签 */
  public static readonly TAG = 'fan_shoot_skill';
  /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
  public static readonly ICON = 'fan_shoot_skill.png';
  /** 一次齐射的子弹总数 */
  public static readonly SHOT_COUNT = 5;
  /** 扇形半张角(度):以瞄准方向为中心左右各偏转该角度 */
  public static readonly SPREAD_HALF_ANGLE_DEG = 32;

  constructor() {
    super(
      FanShootSkill.TAG,
      '扇面连射',
      '扇射',
      '以瞄准方向为对称轴，在 ±32° 内均匀射出 5 发子弹',
      '#b6e36a',
      0.9,
      FanShootSkill.ICON
    );
  }

  public override cast(context: SkillCastContext): void {
    const len = Math.hypot(context.direction.x, context.direction.y);
    if (len < 0.0001) return;
    const baseAngle = Math.atan2(context.direction.y / len, context.direction.x / len);
    const halfAngleRad = (FanShootSkill.SPREAD_HALF_ANGLE_DEG * Math.PI) / 180;
    const count: number = FanShootSkill.SHOT_COUNT;

    for (let i = 0; i < count; i++) {
      // t 从 -1 到 1,把子弹均匀铺满整个扇面(中心弹丸正对瞄准方向)
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const angle = baseAngle + t * halfAngleRad;
      const direction: Point = { x: Math.cos(angle), y: Math.sin(angle) };
      context.spawnBullet(
        {
          x: context.position.x + direction.x * context.spawnDistance,
          y: context.position.y + direction.y * context.spawnDistance
        },
        direction,
        context.bulletColor
      );
    }
  }
}

export { FanShootSkill };
