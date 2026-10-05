import { Skill } from '@/components/pixel_war/class/Skill/Skill';
import type { SkillCastContext } from '@/components/pixel_war/class/Skill/Skill';
import type { Point } from '@/components/pixel_war/interface/Interface';

/** 一轮逐发扫射的推进状态(按持有者分别记录) */
interface Oa18SweepState {
  /** 释放时捕获的施法上下文(位置/配色/生成子弹回调) */
  context: SkillCastContext;
  /** 已发射的发数 */
  firedCount: number;
  /** 距下一发子弹的累计时间(秒) */
  timer: number;
}

/**
 * 技能:环射烟花(oa18_shoot_skill)
 *
 * 由击杀 PurpleFireworkOa18Entity(紫色烟花)掉落。
 * 释放效果与紫色烟花的扫射一致:以正西为起点,顺时针每 20° 射出一发普通子弹,
 * 共 18 发扫满 360° 一整圈;且不是一次性射出,而是每隔 10 游戏刻发射一发。
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
  /** 相邻两发子弹之间的游戏刻间隔 */
  public static readonly SHOT_TICK_INTERVAL = 5;
  /** 单个游戏刻时长(秒),与权威模拟的 TICK_TIMER 一致(20ms) */
  private static readonly TICK_SECONDS = 0.02;
  /** 相邻两发子弹之间的秒数间隔 */
  private static readonly SHOT_INTERVAL_SECONDS =
    Oa18ShootSkill.SHOT_TICK_INTERVAL * Oa18ShootSkill.TICK_SECONDS;
  /** 浮点累加容差:0.02 连加 10 次略小于 0.2,加容差避免首发晚 1 刻 */
  private static readonly INTERVAL_EPSILON = 1e-9;

  /**
   * 各持有者正在进行的逐发扫射状态。
   * 技能实例在注册表中共享,因此必须按 ownerId 分别记录(否则多人下会互相干扰)。
   */
  private readonly activeSweeps = new Map<number, Oa18SweepState>();

  constructor() {
    super(
      Oa18ShootSkill.TAG,
      '环射烟花',
      '环射',
      '以正西为起点、顺时针每 20° 射出一发子弹，共 18 发扫满一圈（每 10 刻一发）',
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
    const ownerId = context.ownerId;
    if (ownerId === null) {
      // 异常情况(无持有者):退化为一次性发射全部子弹,保证技能仍有输出
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
      return;
    }
    // 登记一轮逐发扫射,由 tickCast 每隔 10 游戏刻推进一发
    this.activeSweeps.set(ownerId, { context, firedCount: 0, timer: 0 });
  }

  /** 持续施法总时长:一轮 18 发、每 10 刻一发,共 3.6 秒 */
  public override getCastDuration(): number {
    return Oa18ShootSkill.SHOT_COUNT * Oa18ShootSkill.SHOT_INTERVAL_SECONDS;
  }

  /** 推进逐发扫射:每满 10 游戏刻发射一发,共 18 发 */
  public override tickCast(ownerId: number, dt: number): void {
    const sweep = this.activeSweeps.get(ownerId);
    if (!sweep || dt <= 0) return;

    sweep.timer += dt;
    while (
      sweep.timer + Oa18ShootSkill.INTERVAL_EPSILON >= Oa18ShootSkill.SHOT_INTERVAL_SECONDS &&
      sweep.firedCount < Oa18ShootSkill.SHOT_COUNT
    ) {
      sweep.timer -= Oa18ShootSkill.SHOT_INTERVAL_SECONDS;
      this.fireSweepBullet(sweep.context, sweep.firedCount);
      sweep.firedCount += 1;
    }

    // 一轮发射完毕:仅当状态未被新的施法替换时才清理
    if (
      sweep.firedCount >= Oa18ShootSkill.SHOT_COUNT &&
      this.activeSweeps.get(ownerId) === sweep
    ) {
      this.activeSweeps.delete(ownerId);
    }
  }

  /** 清除某个持有者尚未完成的扫射(重生等场合调用) */
  public override clearCast(ownerId: number): void {
    this.activeSweeps.delete(ownerId);
  }

  /** 发射扫射中的第 index 发子弹(角度自正西起顺时针依次递减) */
  private fireSweepBullet(context: SkillCastContext, index: number): void {
    const angleDeg = Oa18ShootSkill.START_ANGLE_DEG - Oa18ShootSkill.ANGLE_STEP_DEG * index;
    const angleRad = (angleDeg * Math.PI) / 180;
    const direction: Point = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
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

export { Oa18ShootSkill };
