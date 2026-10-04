import { Skill } from '@/components/pixel_war/class/Skill/Skill';
import type { SkillCastContext } from '@/components/pixel_war/class/Skill/Skill';
import type { Point } from '@/components/pixel_war/interface/Interface';

/**
 * 技能:环射烟花(oa18_shoot_skill)
 *
 * 由击杀 PurpleFireworkOa18Entity(紫色烟花)掉落。
 * 释放效果参考该 NPC 的扫射方式:以正西为起点,顺时针每 20° 射出一发普通子弹,
 * 共 18 发,恰好完成 360° 一整圈。
 */
class Oa18ShootSkill extends Skill {
  /** 技能标签 */
  public static readonly TAG = 'oa18_shoot_skill';
  /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
  public static readonly ICON = 'oa18_shoot_skill.png';

  /** 起始角度(角度制):正西(-x 方向) */
  public static readonly START_ANGLE_DEG = 180;
  /** 相邻两发子弹的夹角(角度制,顺时针方向) */
  public static readonly ANGLE_STEP_DEG = 20;
  /** 发射总发数(18 × 20° = 360°,恰好扫满一圈) */
  public static readonly SHOT_COUNT = 18;

  constructor() {
    super(
      Oa18ShootSkill.TAG,
      '环射烟花',
      '环射',
      '以正西为起点、顺时针每 20° 射出一发子弹，共 18 发扫满一圈',
      '#C6A4F2',
      1.8,
      Oa18ShootSkill.ICON
    );
  }

  /**
   * 计算 18 个均匀分布的射击方向:正西起、顺时针每 20° 一个。
   *
   * 世界坐标 y 轴向上,角度按标准数学约定(逆时针为正),
   * 因此角度递减即对应顺时针旋转;18 发覆盖 180° ~ -160°,正好一整圈。
   */
  public static getDirections(): Point[] {
    const directions: Point[] = [];
    for (let i = 0; i < Oa18ShootSkill.SHOT_COUNT; i++) {
      const angleDeg = Oa18ShootSkill.START_ANGLE_DEG - Oa18ShootSkill.ANGLE_STEP_DEG * i;
      const angleRad = (angleDeg * Math.PI) / 180;
      directions.push({ x: Math.cos(angleRad), y: Math.sin(angleRad) });
    }
    return directions;
  }

  public override cast(context: SkillCastContext): void {
    for (const dir of Oa18ShootSkill.getDirections()) {
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

export { Oa18ShootSkill };
