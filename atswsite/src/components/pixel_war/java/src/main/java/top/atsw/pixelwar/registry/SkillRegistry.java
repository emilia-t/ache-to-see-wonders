package top.atsw.pixelwar.registry;

import top.atsw.pixelwar.game.DodgeSkill;
import top.atsw.pixelwar.game.Oa18ShootSkill;
import top.atsw.pixelwar.game.Skill;
import top.atsw.pixelwar.game.Va2ShootSkill;
import top.atsw.pixelwar.game.Xa4ShootSkill;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 技能注册表:技能 tag -> 技能实例(对应 TS 版 registry/SkillRegistry.ts)。
 *
 * <p>实现 {@link Skill.Provider},供 World / PlayerEntity / Inventory 等按 tag 查询技能。
 * 技能实例是共享单例,冷却按持有者实体 id 分别记录(见 {@link Skill})。</p>
 *
 * <p>新增技能时只需在此登记,战利品掉落、背包显示、技能释放会统一按 tag 查找。</p>
 */
public final class SkillRegistry implements Skill.Provider {
    private static final Map<String, Skill> SKILLS = new LinkedHashMap<>();

    /** 共享实例(技能表为静态数据,可安全复用) */
    public static final SkillRegistry INSTANCE = new SkillRegistry();

    static {
        register(new Va2ShootSkill());
        register(new Xa4ShootSkill());
        register(new Oa18ShootSkill());
        register(new DodgeSkill());
    }

    public SkillRegistry() {
    }

    private static void register(Skill skill) {
        SKILLS.put(skill.tag(), skill);
    }

    @Override
    public Skill byTag(String tag) {
        if (tag == null) {
            return null;
        }
        return SKILLS.get(tag);
    }

    public boolean isValid(String tag) {
        return tag != null && SKILLS.containsKey(tag);
    }

    public List<Skill> all() {
        return new ArrayList<>(SKILLS.values());
    }
}
