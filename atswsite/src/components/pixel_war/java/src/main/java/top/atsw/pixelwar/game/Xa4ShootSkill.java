package top.atsw.pixelwar.game;

import top.atsw.pixelwar.core.Geometry;

/**
 * 技能:四向子弹(xa4_shoot_skill)。
 *
 * <p>由击杀 GoldenDodgeXa4Npc(金色闪避者 xa4)掉落。
 * 释放效果参考 xa4 的攻击方式:向上下左右四个正交方向各射出一发普通子弹。</p>
 */
public final class Xa4ShootSkill extends Skill {

    /** 技能标签 */
    public static final String TAG = "xa4_shoot_skill";
    /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
    public static final String ICON = "xa4_shoot_skill.png";

    /** 四个正交射击方向(上/下/左/右,世界坐标 y 轴向上) */
    private static final double[][] DIRECTIONS = {
            {0, 1}, {0, -1}, {-1, 0}, {1, 0}
    };

    public Xa4ShootSkill() {
        super(TAG, "四向子弹", "四向",
                "向上下左右四个方向各射出一发子弹",
                "#eaba48", 0.8, ICON);
    }

    @Override
    public void cast(CastContext context) {
        for (double[] dir : DIRECTIONS) {
            context.spawnBullet(
                    new Geometry.Vec2(
                            context.position.x + dir[0] * context.spawnDistance,
                            context.position.y + dir[1] * context.spawnDistance),
                    new Geometry.Vec2(dir[0], dir[1]),
                    context.bulletColor);
        }
    }
}
