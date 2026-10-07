import type { Point } from '@/components/pixel_war/interface/Interface';
import type { LaserBulletOptions } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/LaserBulletDynamicEntity/LaserBulletDynamicEntity';

/**
 * 技能标签
 * 新增技能时需在此登记,并在 class/Skill/index.ts 的技能注册表中实例化
 */
export type SkillTagType = 'va2_shoot_skill' | 'xa4_shoot_skill' | 'oa18_shoot_skill' | 'ls1_shoot_skill' | 'dodge_skill' | 'nova_shoot_skill' | 'fan_shoot_skill' | 'spiral_dance_skill';

/**
 * 技能触发方式
 * - 'fire' :由开火(左键)触发,装配后决定玩家的开火方式
 * - 'dodge':由闪现(空格)触发,提供位移能力
 */
export type SkillTrigger = 'fire' | 'dodge';

/**
 * 技能释放上下文
 * 由施法方(服务端 Service 或本地模拟)提供战场信息与弹体生成回调,
 * 技能自身只负责"如何释放",不关心子弹如何被管理。
 */
export interface SkillCastContext {
  /** 施法者位置(世界坐标) */
  position: Point;
  /** 施法方向(世界坐标单位向量,y 轴向上) */
  direction: Point;
  /** 施法者实体 id */
  ownerId: number | null;
  /** 施法者队伍 id */
  teamId: number | null;
  /** 子弹颜色(继承施法者的子弹配色) */
  bulletColor: string;
  /** 子弹生成距离:距离施法者中心多远生成(px) */
  spawnDistance: number;
  /** 生成一颗子弹的回调 */
  spawnBullet: (position: Point, direction: Point, bulletColor: string) => void;
  /**
   * 生成一束激光弹的回调(可选,由权威端注入注入)。
   *
   * 未注入时技能应退化为发射普通子弹,保证单机/多人两种路径都能释放技能。
   * @param position 激光起点(世界坐标)
   * @param direction 射击方向(单位向量)
   * @param bulletColor 激光主色
   * @param options 激光参数(长度/展开速度/持续刻数/辉光色/基础伤害)
   */
  spawnLaserBullet?: (
    position: Point,
    direction: Point,
    bulletColor: string,
    options?: LaserBulletOptions
  ) => void;
}

/**
 * 技能基类
 * 技能以"技能球(SkillOrbDynamicEntity)"的形式掉落,被玩家拾取后进入背包并可装配到技能槽。
 * - 技能不可堆叠(stackable 恒为 false)
 * - 技能通过 cast() 描述自己的释放方式
 */
abstract class Skill {
  /** 技能标签(唯一标识,对应战利品配置中的 tag) */
  public readonly tag: string;
  /** 技能名称 */
  public readonly name: string;
  /** 技能短名(用于技能槽等空间有限的场景) */
  public readonly shortName: string;
  /** 技能说明 */
  public readonly description: string;
  /** 技能主题色(技能球、背包、技能槽统一使用) */
  public readonly color: string;
  /**
   * 技能图标贴图文件名(含扩展名)
   * 指向 src/components/pixel_war/resource/skill_icon/ 下的 100px × 100px PNG,
   * 由 class/Skill/SkillIconTexture.ts 负责加载与绘制。
   */
  public readonly icon: string;
  /**
   * 冷却时长上限(秒),即构造参数 cooldown。
   * 0 表示该技能没有冷却;开火技能的释放冷却取"施法者基础开火冷却"与该值的较大者。
   */
  public readonly maxCooldown: number;
  /** 是否拥有冷却(由 maxCooldown 决定) */
  public readonly hasCooldown: boolean;
  /**
   * 各持有者的冷却剩余(秒)。
   *
   * 技能实例在技能注册表中是**共享**的(每个 tag 只有一个实例),所以冷却不能存成全局单值,
   * 否则多人模式下某个玩家的冷却会影响到其他玩家。需要读取"当前冷却时长"时请使用
   * getCurrentCooldown(ownerId) / getCooldownRatio(ownerId) 等方法(ownerId 即持有者实体 id)。
   */
  private readonly cooldownRemaining: Map<number, number> = new Map();
  /** 是否可以堆叠(技能恒为 false) */
  public readonly stackable: boolean = false;
  /** 技能触发方式:决定该技能由哪个输入(开火/闪现)触发 */
  public readonly trigger: SkillTrigger;

  constructor(
    tag: string,
    name: string,
    shortName: string,
    description: string,
    color: string,
    cooldown: number,
    icon: string,
    trigger: SkillTrigger = 'fire'
  ) {
    this.tag = tag;
    this.name = name;
    this.shortName = shortName;
    this.description = description;
    this.color = color;
    this.maxCooldown = Math.max(0, cooldown);
    this.hasCooldown = this.maxCooldown > 0;
    this.icon = icon;
    this.trigger = trigger;
  }

  /** 冷却时长上限(秒):maxCooldown 的别名(兼容既有读取处) */
  public get cooldown(): number {
    return this.maxCooldown;
  }

  /**
   * 释放技能
   * @param context 技能释放上下文
   */
  public abstract cast(context: SkillCastContext): void;

  /**
   * 持续施法总时长(秒),0 表示瞬时释放(默认)。
   *
   * 权威端在释放技能后会把施法者的开火冷却至少延长到该时长,
   * 避免一次持续施法尚未结束就被下一次开火打断(如「环射烟花」的逐发扫射)。
   */
  public getCastDuration(): number {
    return 0;
  }

  /**
   * 推进持续施法(默认无实现)。
   *
   * 由权威端每帧对玩家装配区中的技能调用;持续型技能(如「环射烟花」的逐发扫射)
   * 在此按 dt 生成子弹。技能实例在注册表中共享,因此实现方必须按 ownerId 分别记录状态。
   */
  public tickCast(_ownerId: number, _dt: number): void {
    // 默认无持续施法
  }

  /** 清除某个持有者的持续施法状态(重生等场合调用,默认无实现) */
  public clearCast(_ownerId: number): void {
    // 默认无持续施法
  }

  /**
   * 当前冷却剩余(秒)
   * @param ownerId 持有者(实体 id)
   */
  public getCurrentCooldown(ownerId: number): number {
    return this.cooldownRemaining.get(ownerId) ?? 0;
  }

  
  /**
   * 设置指定持有者的冷却剩余(秒),不大于 0 视为冷却结束
   */
  public setCurrentCooldown(ownerId: number, seconds: number): void {
    if (seconds > 0) {
      this.cooldownRemaining.set(ownerId, seconds);
    } else {
      this.cooldownRemaining.delete(ownerId);
    }
  }

  /**
   * 按 dt 递减指定持有者的冷却并返回剩余(秒)
   * 冷却结束后直接移除记录,避免长期运行下残留无用条目。
   */
  public tickCooldown(ownerId: number, dt: number): number {
    const remaining = this.getCurrentCooldown(ownerId);
    if (remaining <= 0 || dt <= 0) return remaining;
    const next = Math.max(0, remaining - dt);
    this.setCurrentCooldown(ownerId, next);
    return next;
  }

  /** 指定持有者是否处于冷却中 */
  public isOnCooldown(ownerId: number): boolean {
    return this.getCurrentCooldown(ownerId) > 0;
  }

  /** 让指定持有者进入满冷却(技能释放成功后调用) */
  public startCooldown(ownerId: number): void {
    this.setCurrentCooldown(ownerId, this.maxCooldown);
  }

  /** 清空指定持有者的冷却(立即就绪) */
  public clearCooldown(ownerId: number): void {
    this.cooldownRemaining.delete(ownerId);
  }

  /** 冷却进度(0~1,1 表示刚进入冷却;无冷却的技能恒为 0) */
  public getCooldownRatio(ownerId: number): number {
    if (!this.hasCooldown) return 0;
    return Math.min(1, Math.max(0, this.getCurrentCooldown(ownerId) / this.maxCooldown));
  }
}

export { Skill };
