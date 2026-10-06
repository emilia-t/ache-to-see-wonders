import { Skill } from '@/components/pixel_war/class/Skill/Skill';
import type { SkillCastContext } from '@/components/pixel_war/class/Skill/Skill';

/**
 * 技能:激光束(ls1_shoot_skill)
 *
 * 由击杀 OnahauLoneLs1Entity(幽蓝孤光)掉落。
 * 释放效果参考该 NPC 的攻击方式:沿瞄准方向发射一束激光弹——
 * 激光前端以 LASER_EXPAND_SPEED px/s 展开,命中目标立即造成伤害,持续接触每 20 刻再造成 2 点伤害。
 */
class Ls1ShootSkill extends Skill {
  /** 技能标签 */
  public static readonly TAG = 'ls1_shoot_skill';
  /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
  public static readonly ICON = 'ls1_shoot_skill.png';

  /** 激光主色 */
  public static readonly LASER_COLOR = '#C2F0FF';
  /** 激光辉光色 */
  public static readonly LASER_GLOW_COLOR = '#E6F6FA';
  /** 激光长度(px) */
  public static readonly LASER_LENGTH = 1600;
  /** 激光展开速度(px/s) */
  public static readonly LASER_EXPAND_SPEED = 20000;
  /** 激光持续发光时长(tick) */
  public static readonly LASER_DURATION_TICKS = 50;
  /** 激光基础伤害 */
  public static readonly LASER_DAMAGE = 1;

  constructor() {
    super(
      Ls1ShootSkill.TAG,
      '激光束',
      '激光',
      '沿瞄准方向发射一束激光，命中立即造成伤害，持续接触每 20 刻再造成 2 点伤害',
      Ls1ShootSkill.LASER_COLOR,
      4,
      Ls1ShootSkill.ICON
    );
  }

  public override cast(context: SkillCastContext): void {
    if (context.spawnLaserBullet) {
      context.spawnLaserBullet(
        context.position,
        context.direction,
        Ls1ShootSkill.LASER_COLOR,
        {
          length: Ls1ShootSkill.LASER_LENGTH,
          expandSpeed: Ls1ShootSkill.LASER_EXPAND_SPEED,
          durationTicks: Ls1ShootSkill.LASER_DURATION_TICKS,
          damage: Ls1ShootSkill.LASER_DAMAGE,
          glowColor: Ls1ShootSkill.LASER_GLOW_COLOR
        }
      );
      return;
    }

    // 兜底:权威端未注入激光生成回调时退化为普通子弹,保证技能仍能释放
    context.spawnBullet(
      {
        x: context.position.x + context.direction.x * context.spawnDistance,
        y: context.position.y + context.direction.y * context.spawnDistance
      },
      { x: context.direction.x, y: context.direction.y },
      context.bulletColor
    );
  }
}

export { Ls1ShootSkill };
