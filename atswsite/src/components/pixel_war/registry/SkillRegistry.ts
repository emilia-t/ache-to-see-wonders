import { Va2ShootSkill } from '@/components/pixel_war/class/Skill/Skills/Va2ShootSkill/Va2ShootSkill';
import { Xa4ShootSkill } from '@/components/pixel_war/class/Skill/Skills/Xa4ShootSkill/Xa4ShootSkill';
import { Oa18ShootSkill } from '@/components/pixel_war/class/Skill/Skills/Oa18ShootSkill/Oa18ShootSkill';
import { DodgeSkill } from '@/components/pixel_war/class/Skill/Skills/DodgeSkill/DodgeSkill';
import type { Skill } from '@/components/pixel_war/class/Skill/Skill';

/**
 * 技能注册表:技能 tag -> 技能单例。
 *
 * 新增技能时只需在此登记;战利品掉落、背包显示、技能释放会统一按 tag 查找。
 * 说明:技能实例是**共享单例**,冷却按持有者实体 id 分别记录(见 class/Skill/Skill.ts)。
 *
 * 对应 Java 侧:java/.../registry/SkillRegistry.java
 */
const SKILL_REGISTRY: ReadonlyMap<string, Skill> = new Map<string, Skill>([
  [Va2ShootSkill.TAG, new Va2ShootSkill()],
  [Xa4ShootSkill.TAG, new Xa4ShootSkill()],
  [Oa18ShootSkill.TAG, new Oa18ShootSkill()],
  [DodgeSkill.TAG, new DodgeSkill()]
]);

/**
 * 按技能标签获取技能单例
 * @param tag 技能标签
 * @returns 技能实例,未注册时返回 null
 */
const H_getSkillByTag = (tag: string): Skill | null => {
  return SKILL_REGISTRY.get(tag) ?? null;
};

/**
 * 获取全部已注册技能
 */
const H_getAllSkills = (): Skill[] => {
  return Array.from(SKILL_REGISTRY.values());
};

/**
 * 判断技能标签是否已注册
 */
const H_isSkillTagValid = (tag: string): boolean => {
  return SKILL_REGISTRY.has(tag);
};

export { SKILL_REGISTRY, H_getSkillByTag, H_getAllSkills, H_isSkillTagValid };
