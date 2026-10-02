package top.atsw.pixelwar.game;

import top.atsw.pixelwar.core.Geometry;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 技能定义(由前端 TS 版 class/Skill/Skill.ts 迁移)。
 *
 * <p>技能由"技能球"授予玩家,装配到装配区后决定玩家的开火方式。
 * 服务端只负责技能效果(生成子弹等),图标/贴图等纯展示信息随技能标签下发给客户端。</p>
 */
public abstract class Skill {

    /** 技能查找接口,避免技能表与背包模块相互直接依赖 */
    public interface Provider {
        Skill byTag(String tag);
    }

    /** 技能生成子弹的回调,由服务端注入(避免技能直接依赖实体模块) */
    public interface BulletSpawner {
        void spawn(Geometry.Vec2 position, Geometry.Vec2 direction, String bulletColor);
    }

    /** 技能释放上下文(对应 TS 版 SkillCastContext) */
    public static final class CastContext {
        public Geometry.Vec2 position;
        public Geometry.Vec2 direction;
        public long ownerId;
        public Long teamId;
        public String bulletColor = "";
        public double spawnDistance = 10;
        public BulletSpawner bulletSpawner;

        public void spawnBullet(Geometry.Vec2 position, Geometry.Vec2 direction, String bulletColor) {
            if (bulletSpawner != null) {
                bulletSpawner.spawn(position, direction, bulletColor);
            }
        }
    }

    /**
     * 技能触发方式(对应 TS 版 SkillTrigger)。
     */
    public enum Trigger {
        /** 由开火(左键)触发,装配后决定玩家的开火方式 */
        FIRE,
        /** 由闪现(空格)触发,提供位移能力 */
        DODGE
    }

    private final String tag;
    private final String name;
    private final String shortName;
    private final String description;
    private final String color;
    private final double cooldown;
    private final String icon;
    /** 技能触发方式 */
    private final Trigger trigger;

    /**
     * 各持有者(实体 id)的冷却剩余(秒)。
     *
     * <p>技能实例在技能注册表中是共享的(每个 tag 只有一个实例),所以冷却不能存成全局单值,
     * 否则某个玩家的冷却会影响到其他玩家;这里按持有者分别记录,并用 ConcurrentHashMap
     * 保证多房间并发推进时的安全(读改写用 compute 保证原子性)。</p>
     */
    private final Map<Long, Double> cooldownRemaining = new ConcurrentHashMap<>();

    protected Skill(String tag, String name, String shortName, String description,
                    String color, double cooldown, String icon) {
        this(tag, name, shortName, description, color, cooldown, icon, Trigger.FIRE);
    }

    protected Skill(String tag, String name, String shortName, String description,
                    String color, double cooldown, String icon, Trigger trigger) {
        this.tag = tag;
        this.name = name;
        this.shortName = shortName;
        this.description = description;
        this.color = color;
        this.cooldown = cooldown;
        this.icon = icon;
        this.trigger = trigger;
    }

    public String tag() {
        return tag;
    }

    public String name() {
        return name;
    }

    public String shortName() {
        return shortName;
    }

    public String description() {
        return description;
    }

    public String color() {
        return color;
    }

    /** 释放后的开火冷却(秒),对应 TS 版 Skill.cooldown(即冷却时长上限) */
    public double cooldown() {
        return cooldown;
    }

    /** 冷却时长上限(秒),0 表示该技能没有冷却(对应 TS 版 Skill.maxCooldown) */
    public double maxCooldown() {
        return Math.max(0, cooldown);
    }

    /** 是否拥有冷却(由最大冷却时长决定,对应 TS 版 Skill.hasCooldown) */
    public boolean hasCooldown() {
        return maxCooldown() > 0;
    }

    public String icon() {
        return icon;
    }

    /**
     * 技能触发方式:决定该技能由哪个输入(开火/闪现)触发。
     */
    public Trigger trigger() {
        return trigger;
    }

    /** 释放技能 */
    public abstract void cast(CastContext context);

    /** 当前冷却剩余(秒),对应 TS 版 Skill.getCurrentCooldown */
    public double currentCooldown(long ownerId) {
        Double value = cooldownRemaining.get(ownerId);
        return value == null ? 0 : Math.max(0, value);
    }

    /** 设置指定持有者的冷却剩余(秒),不大于 0 视为冷却结束 */
    public void setCurrentCooldown(long ownerId, double seconds) {
        if (seconds > 0) {
            cooldownRemaining.put(ownerId, seconds);
        } else {
            cooldownRemaining.remove(ownerId);
        }
    }

    /**
     * 按 dt 递减指定持有者的冷却并返回剩余(秒)。
     * 冷却结束后直接移除记录,避免长期运行下残留无用条目。
     */
    public double tickCooldown(long ownerId, double dt) {
        double remaining = currentCooldown(ownerId);
        if (remaining <= 0 || dt <= 0) {
            return remaining;
        }
        double[] result = { 0 };
        cooldownRemaining.compute(ownerId, (key, value) -> {
            double next = (value == null ? 0 : value) - dt;
            if (next <= 0) {
                result[0] = 0;
                return null;
            }
            result[0] = next;
            return next;
        });
        return result[0];
    }

    /** 指定持有者是否处于冷却中 */
    public boolean isOnCooldown(long ownerId) {
        return currentCooldown(ownerId) > 0;
    }

    /** 让指定持有者进入满冷却(技能释放成功后调用) */
    public void startCooldown(long ownerId) {
        setCurrentCooldown(ownerId, maxCooldown());
    }

    /** 清空指定持有者的冷却(立即就绪) */
    public void clearCooldown(long ownerId) {
        cooldownRemaining.remove(ownerId);
    }

    /** 冷却进度(0~1,1 表示刚进入冷却;无冷却的技能恒为 0) */
    public double cooldownRatio(long ownerId) {
        double max = maxCooldown();
        if (max <= 0) {
            return 0;
        }
        return Math.min(1, Math.max(0, currentCooldown(ownerId) / max));
    }

    /**
     * 技能注册表:技能 tag -> 技能实例(对应 TS 版 class/Skill/index.ts)。
     */
    public static final class Registry implements Provider {
        private static final Map<String, Skill> SKILLS = new LinkedHashMap<>();
        /** 共享实例(技能表为静态数据,可安全复用) */
        public static final Registry INSTANCE = new Registry();

        static {
            register(new Va2ShootSkill());
            register(new Xa4ShootSkill());
            register(new DodgeSkill());
        }

        public Registry() {
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
}
