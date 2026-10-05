package top.atsw.pixelwar.game;

import top.atsw.pixelwar.core.Geometry;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 技能:环射烟花(oa18_shoot_skill)。
 *
 * <p>由击杀 PurpleFireworkOa18Npc(紫色烟花)掉落。
 * 释放效果与紫色烟花的扫射一致:以正西为起点,顺时针每 20° 射出一发普通子弹,
 * 共 18 发扫满 360° 一整圈;且不是一次性射出,而是每隔 10 游戏刻发射一发。</p>
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
    /** 相邻两发子弹之间的游戏刻间隔*/
    public static final int SHOT_TICK_INTERVAL = 5;
    /** 单个游戏刻时长(秒),与服务端 tick 一致(20ms) */
    private static final double TICK_SECONDS = 0.02;
    /** 相邻两发子弹之间的秒数间隔 */
    private static final double SHOT_INTERVAL_SECONDS = SHOT_TICK_INTERVAL * TICK_SECONDS;
    /** 浮点累加容差:0.02 连加 10 次略小于 0.2,加容差避免首发晚 1 刻 */
    private static final double INTERVAL_EPSILON = 1e-9;

    /** 一轮逐发扫射的推进状态(按持有者分别记录) */
    private static final class SweepState {
        /** 释放时捕获的施法上下文(位置/配色/生成子弹回调) */
        final CastContext context;
        /** 已发射的发数 */
        int firedCount;
        /** 距下一发子弹的累计时间(秒) */
        double timer;

        SweepState(CastContext context) {
            this.context = context;
        }
    }

    /**
     * 各持有者正在进行的逐发扫射状态。
     * 技能实例在注册表中共享,因此必须按 ownerId 分别记录(否则多人下会互相干扰)。
     */
    private final Map<Long, SweepState> activeSweeps = new ConcurrentHashMap<>();

    public Oa18ShootSkill() {
        super(TAG, "环射烟花", "环射",
                "以正西为起点、顺时针每 20° 射出一发子弹，共 18 发扫满一圈（每 10 刻一发）",
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
        // 登记一轮逐发扫射,由 tickCast 每隔 10 游戏刻推进一发
        activeSweeps.put(context.ownerId, new SweepState(context));
    }

    /** 持续施法总时长:一轮 18 发、每 10 刻一发,共 3.6 秒 */
    @Override
    public double getCastDuration() {
        return SHOT_COUNT * SHOT_INTERVAL_SECONDS;
    }

    /** 推进逐发扫射:每满 10 游戏刻发射一发,共 18 发 */
    @Override
    public void tickCast(long ownerId, double dt) {
        SweepState sweep = activeSweeps.get(ownerId);
        if (sweep == null || dt <= 0) {
            return;
        }
        sweep.timer += dt;
        while (sweep.timer + INTERVAL_EPSILON >= SHOT_INTERVAL_SECONDS && sweep.firedCount < SHOT_COUNT) {
            sweep.timer -= SHOT_INTERVAL_SECONDS;
            spawnSweepBullet(sweep.context, sweep.firedCount);
            sweep.firedCount++;
        }
        // 一轮发射完毕:仅当状态未被新的施法替换时才清理
        if (sweep.firedCount >= SHOT_COUNT) {
            activeSweeps.remove(ownerId, sweep);
        }
    }

    /** 清除某个持有者尚未完成的扫射(重生等场合调用) */
    @Override
    public void clearCast(long ownerId) {
        activeSweeps.remove(ownerId);
    }

    /** 发射扫射中的第 index 发子弹(角度自正西起顺时针依次递减) */
    private void spawnSweepBullet(CastContext context, int index) {
        double angleDeg = START_ANGLE_DEG - ANGLE_STEP_DEG * index;
        double angleRad = Math.toRadians(angleDeg);
        double dirX = Math.cos(angleRad);
        double dirY = Math.sin(angleRad);
        context.spawnBullet(
                new Geometry.Vec2(
                        context.position.x + dirX * context.spawnDistance,
                        context.position.y + dirY * context.spawnDistance),
                new Geometry.Vec2(dirX, dirY),
                context.bulletColor);
    }
}
