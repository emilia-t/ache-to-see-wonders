package top.atsw.pixelwar.game;

import top.atsw.pixelwar.core.Geometry;

/**
 * 技能:扇面连射(fan_shoot_skill)。
 *
 * <p>由击杀 VerdantLancerVl4Npc(青翠枪骑兵)掉落。
 * 释放效果参考枪骑兵的齐射:以瞄准方向为对称轴,把 5 发子弹在
 * ±{@link #SPREAD_HALF_ANGLE_DEG}° 内均匀铺开,形成一道扇面弹幕。</p>
 */
public final class FanShootSkill extends Skill {

    /** 技能标签 */
    public static final String TAG = "fan_shoot_skill";
    /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
    public static final String ICON = "fan_shoot_skill.png";
    /** 一次齐射的子弹总数 */
    public static final int SHOT_COUNT = 5;
    /** 扇形半张角(度):以瞄准方向为中心左右各偏转该角度 */
    public static final double SPREAD_HALF_ANGLE_DEG = 32;

    public FanShootSkill() {
        super(TAG, "扇面连射", "扇射",
                "以瞄准方向为对称轴，在 ±32° 内均匀射出 5 发子弹",
                "#b6e36a", 0.9, ICON);
    }

    @Override
    public void cast(CastContext context) {
        double len = Math.hypot(context.direction.x, context.direction.y);
        if (len < 0.0001) {
            return;
        }
        double baseAngle = Math.atan2(context.direction.y / len, context.direction.x / len);
        double halfAngleRad = Math.toRadians(SPREAD_HALF_ANGLE_DEG);
        for (int i = 0; i < SHOT_COUNT; i++) {
            // t 从 -1 到 1,把子弹均匀铺满整个扇面(中心弹丸正对瞄准方向)
            double t = SHOT_COUNT == 1 ? 0 : (i / (double) (SHOT_COUNT - 1)) * 2 - 1;
            double angle = baseAngle + t * halfAngleRad;
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
