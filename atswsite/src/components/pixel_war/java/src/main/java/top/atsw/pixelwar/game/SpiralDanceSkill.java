package top.atsw.pixelwar.game;

import top.atsw.pixelwar.core.Geometry;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 技能:螺旋舞(spiral_dance_skill)。
 *
 * <p>由击杀 AshenBoomerangAh3Npc(灰烬回旋手)掉落。
 * 释放效果:持续施法,每 {@link #TICK_INTERVAL} 游戏刻同时射出一对反向子弹(相差 180°),
 * 整对子弹的朝向逐轮旋转 {@link #ANGLE_STEP_DEG}°,共 {@link #SHOT_COUNT} 轮,
 * 于是两组弹丸在战场上交织成一对反向旋转的螺旋。</p>
 *
 * <p>每次重新释放时起始角会再推进 {@link #CAST_OFFSET_STEP_DEG}°,使连续多次施法的弹幕
 * 不会完全重合。</p>
 */
public final class SpiralDanceSkill extends Skill {

    /** 技能标签 */
    public static final String TAG = "spiral_dance_skill";
    /** 技能图标贴图文件名(resource/skill_icon 下的 100px × 100px PNG) */
    public static final String ICON = "spiral_dance_skill.png";
    /** 一轮螺旋的发射轮数 */
    public static final int SHOT_COUNT = 12;
    /** 相邻两轮之间的游戏刻间隔 */
    public static final int TICK_INTERVAL = 8;
    /** 每轮旋转的角度(度) */
    public static final double ANGLE_STEP_DEG = 17;
    /** 同时射出的对称弹臂数量(2 = 一对反向子弹) */
    public static final int ARMS = 2;
    /** 每次重新释放时起始角的额外推进量(度) */
    public static final double CAST_OFFSET_STEP_DEG = 37;

    /** 单个游戏刻时长(秒),与服务端 tick 一致(20ms) */
    private static final double TICK_SECONDS = 0.02;
    /** 相邻两轮之间的秒数间隔 */
    private static final double INTERVAL_SECONDS = TICK_INTERVAL * TICK_SECONDS;
    /** 浮点累加容差:避免因浮点误差晚 1 刻 */
    private static final double INTERVAL_EPSILON = 1e-9;

    /** 一轮螺旋舞的推进状态(按持有者分别记录) */
    private static final class DanceState {
        /** 释放时捕获的施法上下文(位置/配色/生成子弹回调) */
        final CastContext context;
        /** 本轮已发射的轮数 */
        int firedCount;
        /** 距下一轮子弹的累计时间(秒) */
        double timer;
        /** 本轮螺旋的起始角(度) */
        final double startAngleDeg;

        DanceState(CastContext context, double startAngleDeg) {
            this.context = context;
            this.startAngleDeg = startAngleDeg;
        }
    }

    /** 各持有者正在进行的螺旋舞状态(技能实例在注册表中共享,必须按 ownerId 分别记录) */
    private final Map<Long, DanceState> activeDances = new ConcurrentHashMap<>();
    /** 各持有者已释放次数(用于推进起始角,让连续施法错开) */
    private final Map<Long, Integer> castCountByOwner = new ConcurrentHashMap<>();

    public SpiralDanceSkill() {
        super(TAG, "螺旋舞", "螺旋",
                "持续施法：每 8 游戏刻射出一对反向子弹，逐轮旋转 17°，共 12 轮交织成双螺旋",
                "#f5a6ff", 2.4, ICON);
    }

    @Override
    public void cast(CastContext context) {
        double len = Math.hypot(context.direction.x, context.direction.y);
        double aimDeg = len < 0.0001
                ? 0
                : Math.toDegrees(Math.atan2(context.direction.y / len, context.direction.x / len));

        int castIndex = castCountByOwner.merge(context.ownerId, 1, Integer::sum) - 1;
        double startAngleDeg = aimDeg + castIndex * CAST_OFFSET_STEP_DEG;
        // 登记一轮螺旋,由 tickCast 每隔 8 游戏刻推进一轮
        activeDances.put(context.ownerId, new DanceState(context, startAngleDeg));
    }

    /** 持续施法总时长:12 轮、每轮 8 刻,共 1.92 秒 */
    @Override
    public double getCastDuration() {
        return SHOT_COUNT * INTERVAL_SECONDS;
    }

    /** 推进螺旋:每满 8 游戏刻发射一对反向子弹,共 12 轮 */
    @Override
    public void tickCast(long ownerId, double dt) {
        DanceState dance = activeDances.get(ownerId);
        if (dance == null || dt <= 0) {
            return;
        }
        dance.timer += dt;
        while (dance.timer + INTERVAL_EPSILON >= INTERVAL_SECONDS && dance.firedCount < SHOT_COUNT) {
            dance.timer -= INTERVAL_SECONDS;
            double angleDeg = dance.startAngleDeg + ANGLE_STEP_DEG * dance.firedCount;
            fireArm(dance.context, angleDeg);
            dance.firedCount++;
        }
        // 一轮发射完毕:仅当状态未被新的施法替换时才清理
        if (dance.firedCount >= SHOT_COUNT) {
            activeDances.remove(ownerId, dance);
        }
    }

    /** 清除某个持有者尚未完成的螺旋(重生等场合调用) */
    @Override
    public void clearCast(long ownerId) {
        activeDances.remove(ownerId);
    }

    /** 在指定朝向的两端(相差 180°)各射出一发子弹 */
    private void fireArm(CastContext context, double angleDeg) {
        for (int arm = 0; arm < ARMS; arm++) {
            double rad = Math.toRadians(angleDeg + (360.0 / ARMS) * arm);
            double dirX = Math.cos(rad);
            double dirY = Math.sin(rad);
            context.spawnBullet(
                    new Geometry.Vec2(
                            context.position.x + dirX * context.spawnDistance,
                            context.position.y + dirY * context.spawnDistance),
                    new Geometry.Vec2(dirX, dirY),
                    context.bulletColor);
        }
    }
}
