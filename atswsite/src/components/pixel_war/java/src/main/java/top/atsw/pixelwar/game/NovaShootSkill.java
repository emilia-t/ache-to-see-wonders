package top.atsw.pixelwar.game;

import top.atsw.pixelwar.core.Geometry;

/**
 * 技能:新星环射(nova_shoot_skill)。
 *
 * <p>由击杀 SaltSentinelSs2Npc(盐白哨兵)掉落。
 * 释放效果参考哨兵的全向弹幕:以瞄准方向为起点,向四周均匀射出一圈子弹,
 * 相邻两发夹角恒为 {@link #ANGLE_STEP_DEG}(12 发恰好 360°)。</p>
 */
public final class NovaShootSkill extends Skill {

    /** 技能标签 */
    public static final String TAG = "nova_shoot_skill";
    /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
    public static final String ICON = "nova_shoot_skill.png";
    /** 一轮环射的子弹总数 */
    public static final int SHOT_COUNT = 12;
    /** 相邻两发的夹角(度):12 × 30° = 360° */
    public static final double ANGLE_STEP_DEG = 30;

    public NovaShootSkill() {
        super(TAG, "新星环射", "新星",
                "以瞄准方向为起点，向四周均分射出 12 发子弹（每 30° 一发）",
                "#ffe08a", 1.6, ICON);
    }

    @Override
    public void cast(CastContext context) {
        double len = Math.hypot(context.direction.x, context.direction.y);
        if (len < 0.0001) {
            return;
        }
        double baseAngle = Math.atan2(context.direction.y / len, context.direction.x / len);
        for (int i = 0; i < SHOT_COUNT; i++) {
            double angle = baseAngle + Math.toRadians(ANGLE_STEP_DEG * i);
            double dirX = Math.cos(angle);
            double dirY = Math.sin(angle);
            context.spawnBullet(
                    new Geometry.Vec2(
                            context.position.x + dirX * context.spawnDistance,
                            context.position.y + dirY * context.spawnDistance),
                    new Geometry.Vec2(dirX, dirY),
                    context.bulletColor);
        }
    }
}
