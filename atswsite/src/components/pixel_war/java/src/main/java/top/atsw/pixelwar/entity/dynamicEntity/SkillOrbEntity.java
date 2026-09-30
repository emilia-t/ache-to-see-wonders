package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.game.Skill;

import java.util.List;

/**
 * 技能球(由前端 TS 版 SkillOrbDynamicEntity 迁移)。
 *
 * <p>击杀携带 loot 配置的 NPC 时按概率掉落;会向附近的存活玩家飘行,
 * 被玩家拾取后玩家获得对应技能;超过存在时长自动消失。</p>
 */
public final class SkillOrbEntity extends DynamicEntity {

    /** 物理碰撞体积 */
    public static final double WIDTH = 14;
    public static final double HEIGHT = 14;
    /** 吸引范围(px) */
    public static final double ATTRACT_RANGE = 200;
    /** 拾取范围(px) */
    public static final double PICKUP_RANGE = 26;
    /** 存在时长(秒) */
    public static final double LIFETIME = 45;
    /** 技能未注册时的兜底颜色 */
    public static final String FALLBACK_COLOR = "#9fe8ff";

    /** 技能标签(如 va2_shoot_skill) */
    public String skillTag;
    /** 已存活时间(秒) */
    public double age;
    /** 是否已被拾取(或超时消失) */
    public boolean isPickedUp;

    public SkillOrbEntity(Geometry.Vec2 position, String skillTag, Skill.Provider skills) {
        super(position, WIDTH, HEIGHT, "技能球", "skill_orb", "skill_orb");
        this.skillTag = skillTag;
        this.fillColor = color(skills);
        this.strokeColor = this.fillColor;
        this.speed = 0;
        this.minMoveSpeed = 0;
        this.maxMoveSpeed = 0;
    }

    /** 技能主题色(技能未注册时使用兜底色) */
    public String color(Skill.Provider skills) {
        Skill skill = skills == null ? null : skills.byTag(skillTag);
        return skill == null ? FALLBACK_COLOR : skill.color();
    }

    /** 技能球每帧更新:吸引 + 拾取(授予技能) + 超时消失 */
    public void updateOrb(double dt, List<PlayerEntity> players, Skill.Provider skills) {
        if (isPickedUp) {
            return;
        }
        age += dt;
        if (age >= LIFETIME) {
            isPickedUp = true;
            return;
        }

        PlayerEntity nearestPlayer = null;
        double nearestDist = Double.MAX_VALUE;
        for (PlayerEntity player : players) {
            if (player.isDead) {
                continue;
            }
            double d = Geometry.distance(position.x, position.y, player.position.x, player.position.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearestPlayer = player;
            }
        }

        if (nearestPlayer != null && nearestDist <= ATTRACT_RANGE && nearestDist > 0.0001) {
            double dirX = (nearestPlayer.position.x - position.x) / nearestDist;
            double dirY = (nearestPlayer.position.y - position.y) / nearestDist;
            double speed = 150 + (1 - nearestDist / ATTRACT_RANGE) * 380;
            position.x += dirX * speed * dt;
            position.y += dirY * speed * dt;
            updateCollisionBox();
        } else {
            applyAirResistance(dt);
            position.x += motionVelocity.x * dt;
            position.y += motionVelocity.y * dt;
            updateCollisionBox();
        }

        if (nearestPlayer != null) {
            double d = Geometry.distance(position.x, position.y, nearestPlayer.position.x, nearestPlayer.position.y);
            if (d <= PICKUP_RANGE) {
                nearestPlayer.acquireSkill(skillTag, skills);
                isPickedUp = true;
            }
        }
    }
}
