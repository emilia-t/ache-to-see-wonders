package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.BulletEntity;
import top.atsw.pixelwar.game.Oa18ShootSkill;

/**
 * 敌对 NPC「PurpleFireworkOa18」(紫色烟花 oa18,由前端 TS 版 PurpleFireworkOa18Entity 迁移)。
 *
 * <p>行为循环:随机游走 → 停住并放射子弹 → 随机游走(循环)。</p>
 * <ul>
 *   <li>停住后以正西为起点、顺时针每 20° 射出一发普通子弹,每 5 游戏刻一发,共 18 发
 *       (恰好扫满 360° 一圈);</li>
 *   <li>等级越高:环射节奏越快(每发间隔 5 - Level 刻)、移动速度越快(每级 +20);</li>
 *   <li>无拖尾;子弹颜色固定为自身的 #E6D7FF;</li>
 *   <li>被击杀后概率掉落「环射烟花」技能球;</li>
 *   <li>被玩家吸附为从者后不再游走,改为每 n 秒(n = 5 - Level,最小 3 秒)发动一轮同样的逐发环射。</li>
 * </ul>
 */
public class PurpleFireworkOa18Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.21;
    /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
    public static final String NAME = "紫色烟花";

    /** 主色调 */
    public static final String MAIN_COLOR = "#C6A4F2";
    /** 辉光色调(同时作为描边色) */
    public static final String GLOW_COLOR = "#D6B5FF";
    /** 子弹颜色 */
    public static final String BULLET_COLOR = "#E6D7FF";

    /** 每发子弹之间的游戏刻间隔(等级 0 的基准值) */
    private static final int SHOT_TICK_INTERVAL = 5;
    /** 每提高 1 级缩短的刻间隔(射速随等级提升) */
    private static final int SHOT_TICK_INTERVAL_PER_LEVEL = 1;
    /** 刻间隔下限(避免高等级下瞬发) */
    private static final int SHOT_TICK_INTERVAL_MIN = 2;
    /** 一轮扫射的子弹总数(18 × 20° = 360°) */
    private static final int SHOT_COUNT = Oa18ShootSkill.SHOT_COUNT;
    /** 起始角度(角度制):正西 */
    private static final double START_ANGLE_DEG = Oa18ShootSkill.START_ANGLE_DEG;
    /** 相邻两发的夹角(角度制,顺时针) */
    private static final double ANGLE_STEP_DEG = Oa18ShootSkill.ANGLE_STEP_DEG;
    /** 每级移动速度增益(px/s) */
    private static final double MOVE_SPEED_BONUS_PER_LEVEL = 20;
    /** 基础掉落经验值(等级不改变该值) */
    private static final double BASE_GAME_EXP = 6;
    /** 击杀获得的分数 */
    private static final int KILL_SCORE = 2;
    /** 掉落技能球的概率 */
    private static final double LOOT_ODDS = 0.05;
    /** idle 阶段的安全超时(游戏刻):长时间未获得新目标时允许再次扫射,避免永久停摆 */
    private static final int IDLE_TIMEOUT_TICKS = 100;
    /** 从者攻击间隔基准(秒):n = 5 - Level */
    private static final double SERVANT_ATTACK_INTERVAL_BASE = 5;
    /** 从者攻击间隔下限(秒):n 至少为 3 */
    private static final double SERVANT_ATTACK_INTERVAL_MIN = 3;

    /** 行为阶段:wander(游走) / shooting(环射) / idle(等待新目标) */
    private enum Phase {
        WANDER,
        SHOOTING,
        IDLE
    }

    private Phase phase = Phase.WANDER;
    /** 当前扫射已发射的子弹数 */
    private int shotsFired;
    /** 距下一发子弹还需等待的游戏刻数 */
    private int shotTickCounter;
    /** 当前瞄准角度(角度制,每发递减 ANGLE_STEP_DEG 实现顺时针旋转) */
    private double currentAngleDeg = START_ANGLE_DEG;
    /** idle 阶段已等待的游戏刻数 */
    private int idleTickCounter;

    /** 从者:距下一轮环射的剩余秒数(<= 0 时发动新一轮) */
    private double servantAttackCooldown;
    /** 从者:当前是否处于一轮环射中 */
    private boolean servantSweeping;
    /** 从者:本轮环射已发射的发数 */
    private int servantShotsFired;
    /** 从者:距下一发子弹的刻计数 */
    private int servantShotTickCounter;
    /** 从者:本轮环射的当前瞄准角度(角度制) */
    private double servantAngleDeg = START_ANGLE_DEG;

    public PurpleFireworkOa18Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "purple_firework_oa18");
        this.fillColor = MAIN_COLOR;
        this.strokeColor = GLOW_COLOR;
        this.health = 1;
        this.healthMax = 1;
        this.killScore = KILL_SCORE;
        this.gameExp = BASE_GAME_EXP;
        this.mapColor = MAIN_COLOR;
        // 战利品:击杀后概率掉落其持有的「环射烟花」技能球
        this.loot.add(new Loot("skillOrb", Oa18ShootSkill.TAG, LOOT_ODDS));
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    @Override
    public String displayName() {
        return NAME;
    }

    /** 等级上限:2(与其他上限 2 的 NPC 共用 3 档等级概率表) */
    @Override
    public int maxLevel() {
        return 2;
    }

    /** 每级移动速度增益:20(移动速度随等级提升) */
    @Override
    protected double moveSpeedBonusPerLevel() {
        return MOVE_SPEED_BONUS_PER_LEVEL;
    }

    /** 等级变化时重算等级相关属性:经验值固定为基础值,仅射速/移速随等级变化 */
    @Override
    protected void onNpcLevelApplied() {
        this.gameExp = BASE_GAME_EXP;
    }

    /** 当前每发子弹的刻间隔:等级越高越短(射速越快) */
    private int shotTickInterval() {
        return Math.max(SHOT_TICK_INTERVAL_MIN, SHOT_TICK_INTERVAL - SHOT_TICK_INTERVAL_PER_LEVEL * level);
    }

    /**
     * 每帧更新:
     * 1. 被玩家吸附时锁定在主人的从者网格格子上;
     * 2. 无主时走常规游走逻辑,到达目标停住后由 updateStayDuration 切换到环形扫射。
     */
    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (ownerId != null) {
            // 从者:瞬移到主人分配的格子中心,不自行游走。
            // 攻击由 actionLoop 的从者分支处理(每隔 n 秒发动一轮环射)。
            // 同时重置行为阶段:从者可能因网格断连而被释放回野生状态(不会被杀死),
            // 若不重置会永久卡在"扫射中"(既不移动也不开火)。
            resetToWander();
            followOwner(world);
            return;
        }
        super.update(dt, world, config);
    }

    /**
     * 到达游走目标停住后进入环形扫射阶段;扫射结束后等待新的游走目标。
     * (在世界每帧的 updateStayDuration 时机被调用,因此可直接观察 isMoving)
     */
    @Override
    public void updateStayDuration(double dt) {
        if (isDead || ownerId != null) {
            return;
        }

        if (phase == Phase.WANDER) {
            if (!isMoving) {
                startShooting();
            }
            return;
        }

        if (phase == Phase.IDLE) {
            // 已获得新的游走目标 → 回到游走阶段;超时保护避免永久停摆
            idleTickCounter++;
            if (isMoving || idleTickCounter >= IDLE_TIMEOUT_TICKS) {
                phase = Phase.WANDER;
                idleTickCounter = 0;
            }
            return;
        }

        // 扫射阶段:保持驻足(不参与随机驻足计时)
    }

    /** 扫射期间不重新分配游走目标,保证一轮 18 发完整打出。 */
    @Override
    public boolean canGetNewWanderTarget(double dt, WorldView world) {
        if (phase == Phase.SHOOTING) {
            return false;
        }
        return super.canGetNewWanderTarget(dt, world);
    }

    /** 扫射期间停住是"有意为之"而非卡住,不触发长时间未位移的重新寻路。 */
    @Override
    public boolean updateNoMovementWatchdog(double dt) {
        if (phase == Phase.SHOOTING) {
            return false;
        }
        return super.updateNoMovementWatchdog(dt);
    }

    /** 进入环形扫射阶段:停止移动并重置扫射状态 */
    private void startShooting() {
        phase = Phase.SHOOTING;
        shotsFired = 0;
        shotTickCounter = 0;
        currentAngleDeg = START_ANGLE_DEG;
        stayDurationRemaining = 0;
        idleTickCounter = 0;
        stop();
    }

    /** 结束一轮扫射:转入 idle,等待世界分配新的游走目标 */
    private void finishShooting() {
        phase = Phase.IDLE;
        shotsFired = 0;
        shotTickCounter = 0;
        currentAngleDeg = START_ANGLE_DEG;
        idleTickCounter = 0;
        stayDurationRemaining = 0;
    }

    /** 回到游走阶段并清空扫射/等待状态 */
    private void resetToWander() {
        phase = Phase.WANDER;
        shotsFired = 0;
        shotTickCounter = 0;
        currentAngleDeg = START_ANGLE_DEG;
        idleTickCounter = 0;
    }

    /**
     * 行为循环:
     * <ul>
     *   <li>无主时按刻节奏推进环形扫射(每 shotTickInterval() 刻一发);</li>
     *   <li>从者(被玩家吸附)每 n 秒(5 - Level,最小 3 秒)发动一轮同样的逐发扫射。</li>
     * </ul>
     */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead) {
            return;
        }
        // 从者:不再自行游走,改为按固定时间间隔发动环射
        if (ownerId != null) {
            servantActionLoop(context);
            return;
        }
        if (phase != Phase.SHOOTING) {
            return;
        }
        if (context.spawnBullet == null) {
            return;
        }

        shotTickCounter++;
        if (shotTickCounter < shotTickInterval()) {
            return;
        }

        shotTickCounter = 0;
        action(context);
        shotsFired++;
        if (shotsFired >= SHOT_COUNT) {
            finishShooting();
        }
    }

    /**
     * 从者环射:每隔 n 秒(5 - Level,最小 3 秒)发动一轮逐发扫射。
     *
     * <p>攻击计时在扫射过程中持续递减,因此两轮扫射的"开始时刻"严格相隔 n 秒
     * (而不是"扫射结束后再等 n 秒");扫射节奏与无主时一致(每 shotTickInterval() 刻一发),
     * 并按主人的射速倍率缩放(getActionDelta)。</p>
     */
    private void servantActionLoop(ActionContext context) {
        if (context == null || context.spawnBullet == null) {
            return;
        }

        servantAttackCooldown -= getActionDelta(context.deltaTime);
        if (!servantSweeping && servantAttackCooldown <= 0) {
            // 计时到点:开始新一轮环射(首次吸附后立即开始)
            servantSweeping = true;
            servantShotsFired = 0;
            servantShotTickCounter = 0;
            servantAngleDeg = START_ANGLE_DEG;
            servantAttackCooldown = servantAttackIntervalSeconds();
        }

        if (!servantSweeping) {
            return;
        }

        servantShotTickCounter++;
        if (servantShotTickCounter < shotTickInterval()) {
            return;
        }

        servantShotTickCounter = 0;
        spawnSweepBullet(context, servantAngleDeg);
        servantAngleDeg -= ANGLE_STEP_DEG;
        servantShotsFired++;
        if (servantShotsFired >= SHOT_COUNT) {
            servantSweeping = false;
            servantShotsFired = 0;
            servantShotTickCounter = 0;
            servantAngleDeg = START_ANGLE_DEG;
        }
    }

    /** 从者攻击间隔(秒):n = 5 - Level,且不小于 3 秒 */
    private double servantAttackIntervalSeconds() {
        return Math.max(SERVANT_ATTACK_INTERVAL_MIN, SERVANT_ATTACK_INTERVAL_BASE - level);
    }

    /**
     * 发射一发普通子弹,并把瞄准角度顺时针旋转 20°。
     * 初始角度为正西(180°),18 发后恰好回到起点。
     */
    private void action(ActionContext context) {
        spawnSweepBullet(context, currentAngleDeg);

        // 顺时针旋转(世界坐标 y 轴向上,角度递减即顺时针)
        currentAngleDeg -= ANGLE_STEP_DEG;
    }

    /** 按指定角度发射一发普通子弹(无主扫射与从者扫射共用) */
    private void spawnSweepBullet(ActionContext context, double angleDeg) {
        if (isDead || context.spawnBullet == null) {
            return;
        }
        double angleRad = Math.toRadians(angleDeg);
        double dirX = Math.cos(angleRad);
        double dirY = Math.sin(angleRad);
        double spawnDistance = width * 0.6;
        context.spawnBullet.accept(new BulletEntity(
                new Geometry.Vec2(
                        position.x + dirX * spawnDistance,
                        position.y + dirY * spawnDistance),
                new Geometry.Vec2(dirX, dirY),
                id,
                teamId,
                "",
                BULLET_COLOR,
                getBulletMoveSpeed()));
    }
}
