import { Skill } from '@/components/pixel_war/class/Skill/Skill';
import type { SkillCastContext } from '@/components/pixel_war/class/Skill/Skill';
import type { Point } from '@/components/pixel_war/interface/Interface';

/**
 * 技能球:斜向双弹(va2_shoot_skill)
 *
 * 由击杀 WhitePixelVa2Entity(白像素变种体 va2)掉落。
 * 释放效果参考 va2 的攻击方式:以瞄准方向为基准,向上下各偏转 45° 射出两发子弹。
 */
class Va2ShootSkill extends Skill {
  /** 技能标签 */
  public static readonly TAG = 'va2_shoot_skill';
  /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
  public static readonly ICON = 'va2_shoot_skill.png';
  /** 双弹相对瞄准方向的偏转角度(弧度,±45°) */
  public static readonly SPREAD_ANGLE = Math.PI / 4;

  constructor() {
    super(
      Va2ShootSkill.TAG,
      '斜向双弹',
      '双弹',
      '以瞄准方向为中心,向上下各偏转 45° 射出两发子弹',
      '#9fe8ff',
      0.6,
      Va2ShootSkill.ICON
    );
  }

  /**
   * 将单位方向向量绕原点旋转指定弧度
   * @param direction 单位方向向量
   * @param radians 旋转弧度(逆时针为正)
   */
  private static H_rotate(direction: Point, radians: number): Point {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x: direction.x * cos - direction.y * sin,
      y: direction.x * sin + direction.y * cos
    };
  }

  public override cast(context: SkillCastContext): void {
    const len = Math.hypot(context.direction.x, context.direction.y);
    if (len < 0.0001) return;
    const base: Point = {
      x: context.direction.x / len,
      y: context.direction.y / len
    };

    // 逆时针 +45° 与顺时针 -45° 两个方向
    for (const offset of [Va2ShootSkill.SPREAD_ANGLE, -Va2ShootSkill.SPREAD_ANGLE]) {
      const dir = Va2ShootSkill.H_rotate(base, offset);
      context.spawnBullet(
        {
          x: context.position.x + dir.x * context.spawnDistance,
          y: context.position.y + dir.y * context.spawnDistance
        },
        dir,
        context.bulletColor
      );
    }
  }
}

export { Va2ShootSkill };
