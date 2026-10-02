package top.atsw.pixelwar.game;

/**
 * 技能:闪现(dodge_skill)。
 *
 * <p>由击杀 GoldenDodgeXa4Npc(金色闪避者 xa4)掉落。
 * 玩家必须装备本技能后,才能使用闪现(空格)能力;
 * 未装备时,空格键不会触发任何位移。</p>
 *
 * <p>说明:玩家自身的闪现位移由 {@code PlayerEntity.dodge()} 实现,
 * 本技能的触发方式为 {@code DODGE}(由空格触发),不参与开火方式选择。
 * 闪现的冷却由本技能自带的内置CD计时器(maxCooldown)管理,不再由玩家规则维护。</p>
 */
public final class DodgeSkill extends Skill {

    /** 技能标签 */
    public static final String TAG = "dodge_skill";
    /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
    public static final String ICON = "dodge_skill.png";
    /** 闪现冷却(秒):原 PlayerRule.dodgeCooldownMax,现由技能内置CD计时器管理 */
    public static final double COOLDOWN = 5;

    public DodgeSkill() {
        super(TAG, "闪现", "闪现",
                "装备后可使用闪现能力(快捷键:空格),向朝向方向高速位移",
                "#f4dda4", COOLDOWN, ICON, Trigger.DODGE);
    }

    /** 闪现技能由空格触发,不参与开火方式选择,释放本身无额外效果 */
    @Override
    public void cast(CastContext context) {
        // 闪现位移由 PlayerEntity.dodge() 实现,并在闪避输入处校验是否已装备本技能
    }
}
