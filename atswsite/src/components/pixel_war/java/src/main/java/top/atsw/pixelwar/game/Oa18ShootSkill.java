package top.atsw.pixelwar.game;

import top.atsw.pixelwar.core.Geometry;

/**
 * 技能:环射烟花(oa18_shoot_skill)。
 *
 * <p>由击杀 PurpleFireworkOa18Npc(紫色烟花)掉落。
 * 释放效果参考该 NPC 的扫射方式:以正西为起点,顺时针每 20° 射出一发普通子弹,
 * 共 18 发,恰好完成 360° 一整圈。</p>
 */
public final class Oa18ShootSkill extends Skill {

    /** 技能标签 */
    public static final String TAG = "oa18_shoot_skill";
    /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
    public static final String ICON = "oa18_shoot_skill.png";

    /** 起始角度(角度制):正西(-x 方向) */
    public static final double START_ANGLE_DEG = 180;
    /** 相邻两发子弹的夹角(角度制,顺时针方向) */
    public static final double ANGLE_STEP_DEG = 20;
    /** 发射总发数(18 × 20° = 360°,恰好扫满一圈) */
    public static final int SHOT_COUNT = 18;

    public Oa18ShootSkill() {
        super(TAG, "环射烟花", "环射",
                "以正西为起点、顺时针每 20° 射出一发子弹，共 18 发扫满一圈",
                "#C6A4F2", 1.8, ICON);
    }

    /**
     * 计算 18 个均匀分布的射击方向:正西起、顺时针每 20° 一个。
     *
     * <p>世界坐标 y 轴向上,角度按标准数学约定(逆时针为正),
     * 因此角度递减即对应顺时针旋转;18 发覆盖 180° ~ -160°,正好一整圈。</p>
     */
    public static double[][] directions() {
        double[][] result = new double[SHOT_COUNT][];
        for (int i = 0; i < SHOT_COUNT; i++) {
            double angleDeg = START_ANGLE_DEG - ANGLE_STEP_DEG * i;
            double angleRad = Math.toRadians(angleDeg);
            result[i] = new double[]{Math.cos(angleRad), Math.sin(angleRad)};
        }
        return result;
    }

    @Override
    public void cast(CastContext context) {
        for (double[] dir : directions()) {
            context.spawnBullet(
                    new Geometry.Vec2(
                            context.position.x + dir[0] * context.spawnDistance,
                            context.position.y + dir[1] * context.spawnDistance),
                    new Geometry.Vec2(dir[0], dir[1]),
                    context.bulletColor);
        }
    }
}
