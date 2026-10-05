/**
 * 技能模块统一出口(纯桶文件,不含实现)。
 *
 * 技能注册表已迁至 registry/SkillRegistry.ts;新增技能时请在该文件登记。
 */
export { Skill } from '@/components/pixel_war/class/Skill/Skill';
export type { SkillTagType, SkillCastContext, SkillTrigger } from '@/components/pixel_war/class/Skill/Skill';
export { Va2ShootSkill } from '@/components/pixel_war/class/Skill/Skills/Va2ShootSkill/Va2ShootSkill';
export { Xa4ShootSkill } from '@/components/pixel_war/class/Skill/Skills/Xa4ShootSkill/Xa4ShootSkill';
export { Oa18ShootSkill } from '@/components/pixel_war/class/Skill/Skills/Oa18ShootSkill/Oa18ShootSkill';
export { Ls1ShootSkill } from '@/components/pixel_war/class/Skill/Skills/Ls1ShootSkill/Ls1ShootSkill';
export { DodgeSkill } from '@/components/pixel_war/class/Skill/Skills/DodgeSkill/DodgeSkill';
// 技能图标贴图(resource/skill_icon 下的 100px × 100px PNG)
export {
  H_getSkillIconTexture,
  H_preloadSkillIconTextures,
  H_isSkillIconTextureReady,
  H_drawSkillIconTexture
} from '@/components/pixel_war/class/Skill/SkillIconTexture';
