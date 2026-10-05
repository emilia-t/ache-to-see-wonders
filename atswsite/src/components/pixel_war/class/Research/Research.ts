import type { ResearchCategory, ResearchEntry } from '@/components/pixel_war/interface/Interface';

/**
 * 专研(Research)系统 —— 面向玩家的自我提升天赋系统。
 *
 * 玩家每次升级时按概率触发专研界面,从随机三个研究项中选择一项进行研究。
 * - 普通研究项(蓝色):总体出现概率 90%,5 个子项均摊;
 * - 传说研究项(金色):总体出现概率 10%,3 个子项均摊。
 *
 * 本模块只定义"研究项本身"(标签/名称/类别/权重/上限/说明)与抽取、查询等纯函数;
 * 玩家身上的研究状态与效果结算见 PlayerDynamicEntity。
 *
 * 对应 Java 侧:java/.../game/Research.java(需保持定义与权重一致)
 */

/** 研究项标签 */
export type ResearchTagType =
  | 'move_speed'
  | 'fire_rate'
  | 'cooldown'
  | 'stamina'
  | 'health'
  | 'death_keep'
  | 'immovable_fortress'
  | 'lucky_star';

/** 研究项定义 */
export interface ResearchDefinition {
  /** 唯一标签 */
  tag: ResearchTagType;
  /** 显示名称 */
  name: string;
  /** 类别:普通(蓝) / 传说(金) */
  category: ResearchCategory;
  /**
   * 单次抽取时该研究项被选中的权重概率。
   * 普通项合计 0.9(每项 0.18),传说项合计 0.1(每项 1/30),总和为 1。
   */
  weight: number;
  /** 等级上限(null 表示无上限,可无限叠加) */
  maxLevel: number | null;
  /** 说明文本(不含具体数值,数值由 H_getResearchEffectText 生成) */
  description: string;
}

////////////////////
// 数值常量(与 Java game/Research.java 保持一致)-->
////////////////////

/** 移速:每级提升的移动速度百分比 */
export const RESEARCH_MOVE_SPEED_BONUS_PER_LEVEL = 0.06;
/** 射速:每级提升的开火速度百分比 */
export const RESEARCH_FIRE_RATE_BONUS_PER_LEVEL = 0.08;
/** 冷却:每级减少的技能冷却百分比 */
export const RESEARCH_COOLDOWN_REDUCTION_PER_LEVEL = 0.05;
/** 冷却:冷却减少的最大叠加上限(50%) */
export const RESEARCH_COOLDOWN_REDUCTION_MAX = 0.5;
/** 体力:每级提升的体力上限(具体数值) */
export const RESEARCH_STAMINA_MAX_BONUS_PER_LEVEL = 15;
/** 体力:每级降低的疾跑体力消耗(具体数值,点/秒) */
export const RESEARCH_STAMINA_DRAIN_REDUCTION_PER_LEVEL = 2;
/** 体力:疾跑体力消耗的下限(点/秒,避免归零) */
export const RESEARCH_STAMINA_DRAIN_MIN = 6;
/** 生命:每级提升的生命上限(具体数值) */
export const RESEARCH_HEALTH_MAX_BONUS_PER_LEVEL = 2;
/** 死亡不掉落:每级增加的保护概率 */
export const RESEARCH_DEATH_KEEP_CHANCE_PER_LEVEL = 0.2;
/** 不动堡垒:每级增加的最大吸收值 */
export const RESEARCH_FORTRESS_ABSORB_PER_LEVEL = 100;
/** 幸运之星:每级增加的战利品掉落概率 */
export const RESEARCH_LUCKY_STAR_BONUS_PER_LEVEL = 0.05;

/** 普通研究项颜色(蓝) */
export const RESEARCH_NORMAL_COLOR = '#4fa8ff';
/** 传说研究项颜色(金) */
export const RESEARCH_LEGENDARY_COLOR = '#ffcf4d';

////////////////////
//<--数值常量
////////////////////

/** 抽取时一次给出的研究项数量 */
export const RESEARCH_OPTION_COUNT = 3;

const NORMAL_WEIGHT = 0.9 / 5;
const LEGENDARY_WEIGHT = 0.1 / 3;

/** 全部研究项定义(顺序即展示优先级) */
const RESEARCH_DEFINITIONS: readonly ResearchDefinition[] = [
  {
    tag: 'move_speed',
    name: '移速',
    category: 'normal',
    weight: NORMAL_WEIGHT,
    maxLevel: null,
    description: '提升玩家移动速度'
  },
  {
    tag: 'fire_rate',
    name: '射速',
    category: 'normal',
    weight: NORMAL_WEIGHT,
    maxLevel: null,
    description: '提升普通子弹射速(从者子弹射速同步受玩家影响)'
  },
  {
    tag: 'cooldown',
    name: '冷却',
    category: 'normal',
    weight: NORMAL_WEIGHT,
    maxLevel: null,
    description: '减少玩家技能(含固有技能)的冷却时间,最大叠加至 50%'
  },
  {
    tag: 'stamina',
    name: '体力',
    category: 'normal',
    weight: NORMAL_WEIGHT,
    maxLevel: null,
    description: '提升体力上限并降低疾跑体力消耗速度'
  },
  {
    tag: 'health',
    name: '生命',
    category: 'normal',
    weight: NORMAL_WEIGHT,
    maxLevel: null,
    description: '提升玩家生命上限'
  },
  {
    tag: 'death_keep',
    name: '死亡不掉落',
    category: 'legendary',
    weight: LEGENDARY_WEIGHT,
    maxLevel: 5,
    description: '死亡时保护背包内的部分物品与技能不掉落,每次死亡降低 1 级'
  },
  {
    tag: 'immovable_fortress',
    name: '不动堡垒',
    category: 'legendary',
    weight: LEGENDARY_WEIGHT,
    maxLevel: 5,
    description: '保持不动时持续吸收受到的伤害,吸收耗尽后降级'
  },
  {
    tag: 'lucky_star',
    name: '幸运之星',
    category: 'legendary',
    weight: LEGENDARY_WEIGHT,
    maxLevel: 5,
    description: '提升击败敌方 NPC 时战利品的掉落概率'
  }
];

/** 按标签查询研究项定义,未登记时返回 null */
export const H_getResearchDefinition = (tag: string): ResearchDefinition | null => {
  for (const definition of RESEARCH_DEFINITIONS) {
    if (definition.tag === tag) return definition;
  }
  return null;
};

/** 获取全部研究项定义 */
export const H_getAllResearchDefinitions = (): readonly ResearchDefinition[] => RESEARCH_DEFINITIONS;

/** 查询玩家身上某个研究项的等级,未研究时返回 0 */
export const H_getResearchLevel = (entries: readonly ResearchEntry[], tag: string): number => {
  for (const entry of entries) {
    if (entry.tag === tag) return Math.max(0, Math.floor(entry.level));
  }
  return 0;
};

/** 查询玩家身上某个研究项的记录(未研究时返回 null) */
export const H_getResearchEntry = (entries: readonly ResearchEntry[], tag: string): ResearchEntry | null => {
  for (const entry of entries) {
    if (entry.tag === tag) return entry;
  }
  return null;
};

/** 是否已叠满(无上限的研究项恒为 false) */
export const H_isResearchMaxed = (entries: readonly ResearchEntry[], tag: string): boolean => {
  const definition = H_getResearchDefinition(tag);
  if (definition === null || definition.maxLevel === null) return false;
  return H_getResearchLevel(entries, tag) >= definition.maxLevel;
};

/**
 * 计算升级触发专研的概率
 * p = (64 - 等级) / 100,最低 5%
 * @param level 玩家当前(新)等级
 */
export const H_getResearchTriggerProbability = (level: number): number => {
  return Math.max(0.05, (64 - level) / 100);
};

/**
 * 随机抽取若干互不相同的可研究项。
 * - 按 weight 加权抽取(普通 90% / 传说 10%,各自子项均摊);
 * - 已叠满(等级达到上限)的研究项不再进入候选池;
 * - 候选不足时返回实际能抽到的数量。
 * @param entries 玩家已有研究记录
 * @param count 期望抽取数量(默认 3)
 */
export const H_rollResearchOptions = (
  entries: readonly ResearchEntry[],
  count: number = RESEARCH_OPTION_COUNT
): ResearchTagType[] => {
  const pool = RESEARCH_DEFINITIONS.filter((definition) => !H_isResearchMaxed(entries, definition.tag));
  const result: ResearchTagType[] = [];
  const remaining = [...pool];
  while (result.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, definition) => sum + Math.max(0, definition.weight), 0);
    if (!(totalWeight > 0)) break;
    let random = Math.random() * totalWeight;
    let pickedIndex = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      random -= Math.max(0, remaining[i].weight);
      if (random < 0) {
        pickedIndex = i;
        break;
      }
    }
    result.push(remaining[pickedIndex].tag);
    remaining.splice(pickedIndex, 1);
  }
  return result;
};

/**
 * 生成某研究项在某等级下的效果说明(用于界面"下部说明"展示)
 * @param tag 研究项标签
 * @param level 目标等级(通常为"研究后"的等级)
 */
export const H_getResearchEffectText = (tag: string, level: number): string => {
  const safeLevel = Math.max(0, level);
  switch (tag) {
    case 'move_speed':
      return `移动速度 +${Math.round(RESEARCH_MOVE_SPEED_BONUS_PER_LEVEL * safeLevel * 100)}%`;
    case 'fire_rate':
      return `射速 +${Math.round(RESEARCH_FIRE_RATE_BONUS_PER_LEVEL * safeLevel * 100)}%`;
    case 'cooldown':
      return `技能冷却 -${Math.round(
        Math.min(RESEARCH_COOLDOWN_REDUCTION_MAX, RESEARCH_COOLDOWN_REDUCTION_PER_LEVEL * safeLevel) * 100
      )}%`;
    case 'stamina':
      return `体力上限 +${RESEARCH_STAMINA_MAX_BONUS_PER_LEVEL * safeLevel} · 消耗 -${
        RESEARCH_STAMINA_DRAIN_REDUCTION_PER_LEVEL * safeLevel
      }/秒`;
    case 'health':
      return `生命上限 +${RESEARCH_HEALTH_MAX_BONUS_PER_LEVEL * safeLevel}`;
    case 'death_keep':
      return `保护概率 ${Math.round(Math.min(1, RESEARCH_DEATH_KEEP_CHANCE_PER_LEVEL * safeLevel) * 100)}%`;
    case 'immovable_fortress':
      return `吸收值 ${RESEARCH_FORTRESS_ABSORB_PER_LEVEL * safeLevel}`;
    case 'lucky_star':
      return `掉落概率 +${(RESEARCH_LUCKY_STAR_BONUS_PER_LEVEL * safeLevel).toFixed(2)}`;
    default:
      return '';
  }
};
