import type { Point } from '@/components/pixel_war/interface/Interface';

/**
 * 技能标签
 * 新增技能时需在此登记,并在 class/Skill/index.ts 的技能注册表中实例化
 */
export type SkillTagType = 'va2_shoot_skill';

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
  /** 技能释放冷却(秒),实际冷却取施法者开火冷却与该值的较大者 */
  public readonly cooldown: number;
  /** 是否可以堆叠(技能恒为 false) */
  public readonly stackable: boolean = false;

  constructor(
    tag: string,
    name: string,
    shortName: string,
    description: string,
    color: string,
    cooldown: number
  ) {
    this.tag = tag;
    this.name = name;
    this.shortName = shortName;
    this.description = description;
    this.color = color;
    this.cooldown = cooldown;
  }

  /**
   * 释放技能
   * @param context 技能释放上下文
   */
  public abstract cast(context: SkillCastContext): void;
}

export { Skill };
