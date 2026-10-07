import { Skill } from '@/components/pixel_war/class/Skill/Skill';
import type { SkillCastContext } from '@/components/pixel_war/class/Skill/Skill';
import type { Point } from '@/components/pixel_war/interface/Interface';

/** 一轮螺旋舞的推进状态(按持有者分别记录) */
interface SpiralDanceState {
  /** 释放时捕获的施法上下文(位置/配色/生成子弹回调) */
  context: SkillCastContext;
  /** 本轮已发射的轮数 */
  firedCount: number;
  /** 距下一轮子弹的累计时间(秒) */
  timer: number;
  /** 本轮螺旋的起始角(度):每轮发射相对它逐轮递增 */
  startAngleDeg: number;
}

/**
 * 技能:螺旋舞(spiral_dance_skill)
 *
 * 由击杀 AshenBoomerangAh3Entity(灰烬回旋手)掉落。
 * 释放效果:持续施法,每 {@link SpiralDanceSkill.TICK_INTERVAL} 游戏刻同时射出
 * <b>一对反向子弹</b>(相差 180°),整对子弹的朝向逐轮旋转
 * {@link SpiralDanceSkill.ANGLE_STEP_DEG}°,共 {@link SpiralDanceSkill.SHOT_COUNT} 轮,
 * 于是两组弹丸在战场上交织成一对反向旋转的螺旋。
 *
 * 每次重新释放时起始角会再推进 {@link SpiralDanceSkill.CAST_OFFSET_STEP_DEG}°,
 * 使连续多次施法的弹幕不会完全重合。
 */
class SpiralDanceSkill extends Skill {
  /** 技能标签 */
  public static readonly TAG = 'spiral_dance_skill';
  /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
  public static readonly ICON = 'spiral_dance_skill.png';
  /** 一轮螺旋的发射轮数 */
  public static readonly SHOT_COUNT = 12;
  /** 相邻两轮之间的游戏刻间隔 */
  public static readonly TICK_INTERVAL = 8;
  /** 单个游戏刻时长(秒),与权威模拟的 TICK_TIMER 一致(20ms) */
  private static readonly TICK_SECONDS = 0.02;
  /** 相邻两轮之间的秒数间隔 */
  private static readonly INTERVAL_SECONDS =
    SpiralDanceSkill.TICK_INTERVAL * SpiralDanceSkill.TICK_SECONDS;
  /** 浮点累加容差:0.16 连加时避免因浮点误差晚 1 刻 */
  private static readonly INTERVAL_EPSILON = 1e-9;
  /** 每轮旋转的角度(度) */
  public static readonly ANGLE_STEP_DEG = 17;
  /** 同时射出的对称弹臂数量(2 = 一对反向子弹) */
  public static readonly ARMS = 2;
  /** 每次重新释放时起始角的额外推进量(度) */
  public static readonly CAST_OFFSET_STEP_DEG = 37;

  /** 各持有者正在进行的螺旋舞状态(技能实例在注册表中共享,必须按 ownerId 分别记录) */
  private readonly activeDances = new Map<number, SpiralDanceState>();
  /** 各持有者已释放次数(用于推进起始角,让连续施法错开) */
  private readonly castCountByOwner = new Map<number, number>();

  constructor() {
    super(
      SpiralDanceSkill.TAG,
      '螺旋舞',
      '螺旋',
      '持续施法：每 8 游戏刻射出一对反向子弹，逐轮旋转 17°，共 12 轮交织成双螺旋',
      '#f5a6ff',
      2.4,
      SpiralDanceSkill.ICON
    );
  }

  public override cast(context: SkillCastContext): void {
    const ownerId = context.ownerId;
    const len = Math.hypot(context.direction.x, context.direction.y);
    const aimDeg = len < 0.0001
      ? 0
      : Math.atan2(context.direction.y / len, context.direction.x / len) * 180 / Math.PI;

    if (ownerId === null) {
      // 异常情况(无持有者):退化为一次性发射全部轮次,保证技能仍有输出
      const startAngleDeg = aimDeg;
      for (let i = 0; i < SpiralDanceSkill.SHOT_COUNT; i++) {
        this.fireArm(context, startAngleDeg + SpiralDanceSkill.ANGLE_STEP_DEG * i);
      }
      return;
    }

    const castIndex = this.castCountByOwner.get(ownerId) ?? 0;
    this.castCountByOwner.set(ownerId, castIndex + 1);
    const startAngleDeg = aimDeg + castIndex * SpiralDanceSkill.CAST_OFFSET_STEP_DEG;

    // 登记一轮螺旋,由 tickCast 每隔 8 游戏刻推进一轮
    this.activeDances.set(ownerId, { context, firedCount: 0, timer: 0, startAngleDeg });
  }

  /** 持续施法总时长:12 轮、每轮 8 刻,共 1.92 秒 */
  public override getCastDuration(): number {
    return SpiralDanceSkill.SHOT_COUNT * SpiralDanceSkill.INTERVAL_SECONDS;
  }

  /** 推进螺旋:每满 8 游戏刻发射一对反向子弹,共 12 轮 */
  public override tickCast(ownerId: number, dt: number): void {
    const dance = this.activeDances.get(ownerId);
    if (!dance || dt <= 0) return;

    dance.timer += dt;
    while (
      dance.timer + SpiralDanceSkill.INTERVAL_EPSILON >= SpiralDanceSkill.INTERVAL_SECONDS &&
      dance.firedCount < SpiralDanceSkill.SHOT_COUNT
    ) {
      dance.timer -= SpiralDanceSkill.INTERVAL_SECONDS;
      const angleDeg = dance.startAngleDeg + SpiralDanceSkill.ANGLE_STEP_DEG * dance.firedCount;
      this.fireArm(dance.context, angleDeg);
      dance.firedCount += 1;
    }

    // 一轮发射完毕:仅当状态未被新的施法替换时才清理
    if (
      dance.firedCount >= SpiralDanceSkill.SHOT_COUNT &&
      this.activeDances.get(ownerId) === dance
    ) {
      this.activeDances.delete(ownerId);
    }
  }

  /** 清除某个持有者尚未完成的螺旋(重生等场合调用) */
  public override clearCast(ownerId: number): void {
    this.activeDances.delete(ownerId);
  }

  /** 在指定朝向的两端(相差 180°)各射出一发子弹 */
  private fireArm(context: SkillCastContext, angleDeg: number): void {
    for (let arm = 0; arm < SpiralDanceSkill.ARMS; arm++) {
      const rad = ((angleDeg + (360 / SpiralDanceSkill.ARMS) * arm) * Math.PI) / 180;
      const direction: Point = { x: Math.cos(rad), y: Math.sin(rad) };
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

export { SpiralDanceSkill };
