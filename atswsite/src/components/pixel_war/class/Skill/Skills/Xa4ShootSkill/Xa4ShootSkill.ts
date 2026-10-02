import { Skill } from '@/components/pixel_war/class/Skill/Skill';
import type { SkillCastContext } from '@/components/pixel_war/class/Skill/Skill';
import type { Point } from '@/components/pixel_war/interface/Interface';

/**
 * 技能:四向子弹(xa4_shoot_skill)
 *
 * 由击杀 GoldenDodgeXa4Entity(金色闪避者 xa4)掉落。
 * 释放效果参考 xa4 的攻击方式:向上下左右四个正交方向各射出一发普通子弹。
 */
class Xa4ShootSkill extends Skill {
  /** 技能标签 */
  public static readonly TAG = 'xa4_shoot_skill';
  /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
  public static readonly ICON = 'xa4_shoot_skill.png';

  /** 四个正交射击方向(上/下/左/右,世界坐标 y 轴向上) */
  public static readonly DIRECTIONS: readonly Point[] = [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
  ];

  constructor() {
    super(
      Xa4ShootSkill.TAG,
      '四向子弹',
      '四向',
      '向上下左右四个方向各射出一发子弹',
      '#eaba48',
      0.8,
      Xa4ShootSkill.ICON
    );
  }

  public override cast(context: SkillCastContext): void {
    for (const dir of Xa4ShootSkill.DIRECTIONS) {
      context.spawnBullet(
        {
          x: context.position.x + dir.x * context.spawnDistance,
          y: context.position.y + dir.y * context.spawnDistance
        },
        { x: dir.x, y: dir.y },
        context.bulletColor
      );
    }
  }
}

export { Xa4ShootSkill };
