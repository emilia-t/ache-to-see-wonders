import { Skill } from '@/components/pixel_war/class/Skill/Skill';
import type { SkillCastContext } from '@/components/pixel_war/class/Skill/Skill';
import type { Point } from '@/components/pixel_war/interface/Interface';

/**
 * 技能:新星环射(nova_shoot_skill)
 *
 * 由击杀 SaltSentinelSs2Entity(盐白哨兵)掉落。
 * 释放效果参考哨兵的全向弹幕:以瞄准方向为起点,向四周均匀射出一圈子弹,
 * 相邻两发夹角恒为 {@link NovaShootSkill.ANGLE_STEP_DEG}(12 发恰好 360°),
 * 形成一朵以玩家为中心的"新星"。
 */
class NovaShootSkill extends Skill {
  /** 技能标签 */
  public static readonly TAG = 'nova_shoot_skill';
  /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
  public static readonly ICON = 'nova_shoot_skill.png';
  /** 一轮环射的子弹总数 */
  public static readonly SHOT_COUNT = 12;
  /** 相邻两发的夹角(度):12 × 30° = 360° */
  public static readonly ANGLE_STEP_DEG = 30;

  constructor() {
    super(
      NovaShootSkill.TAG,
      '新星环射',
      '新星',
      '以瞄准方向为起点，向四周均分射出 12 发子弹（每 30° 一发）',
      '#ffe08a',
      1.6,
      NovaShootSkill.ICON
    );
  }

  public override cast(context: SkillCastContext): void {
    const len = Math.hypot(context.direction.x, context.direction.y);
    if (len < 0.0001) return;
    const baseAngle = Math.atan2(context.direction.y / len, context.direction.x / len);

    for (let i = 0; i < NovaShootSkill.SHOT_COUNT; i++) {
      const angle = baseAngle + (NovaShootSkill.ANGLE_STEP_DEG * i * Math.PI) / 180;
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

export { NovaShootSkill };
