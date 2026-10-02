import { Skill } from '@/components/pixel_war/class/Skill/Skill';
import type { SkillCastContext } from '@/components/pixel_war/class/Skill/Skill';

/**
 * 技能:闪现(dodge_skill)
 *
 * 由击杀 GoldenDodgeXa4Entity(金色闪避者 xa4)掉落。
 * 玩家必须装备本技能后,才能使用闪现(空格)能力。
 * 未装备时,空格键不会触发任何位移。
 */
class DodgeSkill extends Skill {
  /** 技能标签 */
  public static readonly TAG = 'dodge_skill';
  /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
  public static readonly ICON = 'dodge_skill.png';

  constructor() {
    super(
      DodgeSkill.TAG,
      '闪现',
      '闪现',
      '装备后可使用闪现能力(快捷键:空格),向朝向方向高速位移',
      '#f4dda4',
      0,
      DodgeSkill.ICON,
      'dodge'
    );
  }

  /** 闪现技能由空格触发,不参与开火方式选择,释放本身无额外效果 */
  public override cast(_context: SkillCastContext): void {
    // 闪现位移由 PlayerDynamicEntity.dodge() 实现,并在闪避输入处校验是否已装备本技能
  }
}

export { DodgeSkill };
