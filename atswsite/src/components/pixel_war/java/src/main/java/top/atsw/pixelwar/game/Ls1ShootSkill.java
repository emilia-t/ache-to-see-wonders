package top.atsw.pixelwar.game;

import top.atsw.pixelwar.core.Geometry;

/**
 * 技能:激光束(ls1_shoot_skill)。
 *
 * <p>由击杀 OnahauLoneLs1Npc(幽蓝孤光 ls1)掉落。
 * 释放效果参考该 NPC 的攻击方式:沿瞄准方向发射一束激光弹——
 * 激光前端以 LASER_EXPAND_SPEED px/s 展开,命中目标立即造成伤害,持续接触每 20 刻再造成 2 点伤害。</p>
 */
public final class Ls1ShootSkill extends Skill {

    /** 技能标签 */
    public static final String TAG = "ls1_shoot_skill";
    /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
    public static final String ICON = "ls1_shoot_skill.png";

    /** 激光主色 */
    public static final String LASER_COLOR = "#C2F0FF";
    /** 激光辉光色 */
    public static final String LASER_GLOW_COLOR = "#E6F6FA";
    /** 激光长度(px) */
    public static final double LASER_LENGTH = 1600;
    /** 激光展开速度(px/s) */
    public static final double LASER_EXPAND_SPEED = 20000;
    /** 激光持续发光时长(tick) */
    public static final int LASER_DURATION_TICKS = 50;
    /** 激光基础伤害 */
    public static final double LASER_DAMAGE = 1;

    public Ls1ShootSkill() {
        super(TAG, "激光束", "激光",
                "沿瞄准方向发射一束激光，命中立即造成伤害，持续接触每 20 刻再造成 2 点伤害",
                LASER_COLOR, 4, ICON);
    }

    @Override
    public void cast(CastContext context) {
        if (context.laserSpawner != null) {
            context.spawnLaser(
                    context.position,
                    context.direction,
                    LASER_COLOR,
                    LASER_LENGTH,
                    LASER_EXPAND_SPEED,
                    LASER_DURATION_TICKS,
                    LASER_DAMAGE,
                    LASER_GLOW_COLOR);
            return;
        }

        // 兜底:服务端未注入激光生成回调时退化为普通子弹,保证技能仍能释放
        Geometry.Vec2 dir = context.direction;
        context.spawnBullet(
                new Geometry.Vec2(
                        context.position.x + dir.x * context.spawnDistance,
                        context.position.y + dir.y * context.spawnDistance),
                dir,
                context.bulletColor);
    }
}
