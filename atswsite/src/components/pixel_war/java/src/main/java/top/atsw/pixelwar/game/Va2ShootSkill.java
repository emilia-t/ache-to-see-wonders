package top.atsw.pixelwar.game;

import top.atsw.pixelwar.core.Geometry;

/**
 * 技能:斜向双弹(va2_shoot_skill)。
 *
 * <p>由击杀 WhitePixelVa2Entity(白像素变种体 va2)掉落。
 * 释放效果参考 va2 的攻击方式:以瞄准方向为基准,向上下各偏转 45° 射出两发子弹。</p>
 */
public final class Va2ShootSkill extends Skill {

    /** 技能标签 */
    public static final String TAG = "va2_shoot_skill";
    /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
    public static final String ICON = "va2_shoot_skill.png";
    /** 双弹相对瞄准方向的偏转角度(弧度,±45°) */
    public static final double SPREAD_ANGLE = Math.PI / 4;

    public Va2ShootSkill() {
        super(TAG, "斜向双弹", "双弹",
                "以瞄准方向为中心,向上下各偏转 45° 射出两发子弹",
                "#9fe8ff", 0.6, ICON);
    }

    /** 将单位方向向量绕原点旋转指定弧度 */
    private static Geometry.Vec2 rotate(double x, double y, double radians) {
        double cos = Math.cos(radians);
        double sin = Math.sin(radians);
        return new Geometry.Vec2(x * cos - y * sin, x * sin + y * cos);
    }

    @Override
    public void cast(CastContext context) {
        double len = Math.hypot(context.direction.x, context.direction.y);
        if (len < 0.0001) {
            return;
        }
        double baseX = context.direction.x / len;
        double baseY = context.direction.y / len;

        // 逆时针 +45° 与顺时针 -45° 两个方向
        for (double offset : new double[]{SPREAD_ANGLE, -SPREAD_ANGLE}) {
            Geometry.Vec2 dir = rotate(baseX, baseY, offset);
            context.spawnBullet(
                    new Geometry.Vec2(
                            context.position.x + dir.x * context.spawnDistance,
                            context.position.y + dir.y * context.spawnDistance),
                    dir,
                    context.bulletColor);
        }
    }
}
