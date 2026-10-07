package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.BuckshotBulletEntity;

/**
 * 品红蜂群(由前端 TS 版 MagentaSwarmSw5Entity 迁移)。
 *
 * <p>行为:高速游走、血量极低的"蜂群"型敌人 —— 只有<b>移动时</b>才会开火,
 * 每次向前方射出一束 3 发扇形霰弹(±12°),逼迫玩家在近距离开火前拉开距离。</p>
 *
 * <p>等级差异:掉落经验 exp = 2 + 2 × Level;射击间隔随等级缩短(1.2 - 0.1 × Level 秒);
 * 每级移动速度 +25(高于普通 NPC 的 +20)。</p>
 *
 * <p>战利品:子弹球(概率 75%)。</p>
 */
public class MagentaSwarmSw5Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.17;
    /** NPC 类型显示名称 */
    public static final String NAME = "品红蜂群";

    /** 主色调(品红) */
    public static final String MAIN_COLOR = "#E0479E";
    /** 辉光/描边色 */
    public static final String GLOW_COLOR = "#FFB3DE";

    /** 基准射击间隔(秒) */
    public static final double ACTION_INTERVAL = 1.2;
    /** 每级缩短的射击间隔(秒) */
    public static final double ACTION_INTERVAL_PER_LEVEL = 0.1;
    /** 基准生命值 */
    public static final double HEALTH_BASE = 1;
    /** 基础掉落经验值 */
    public static final double BASE_GAME_EXP = 2;
    /** 击杀获得的分数 */
    public static final int KILL_SCORE = 2;
    /** 每级移动速度增益(高于普通 NPC) */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 25;
    /** 最小移动速度(px/s) */
    public static final double MIN_MOVE_SPEED = 120;
    /** 最大移动速度(px/s) */
    public static final double MAX_MOVE_SPEED = 170;
    /** 每次齐射的弹丸数量 */
    public static final int PELLETS_PER_VOLLEY = 3;
    /** 扇形半张角(度):弹丸以该角度均匀铺开 */
    public static final double SPREAD_HALF_ANGLE_DEG = 12;

    private boolean actionLoopRunning;
    private double actionCooldownRemaining;

    public MagentaSwarmSw5Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "magenta_swarm_sw5");
        this.fillColor = MAIN_COLOR;
        this.strokeColor = GLOW_COLOR;
        this.health = HEALTH_BASE;
        this.healthMax = HEALTH_BASE;
        this.killScore = KILL_SCORE;
        this.gameExp = BASE_GAME_EXP;
        this.mapColor = MAIN_COLOR;
        this.minMoveSpeed = MIN_MOVE_SPEED;
        this.maxMoveSpeed = MAX_MOVE_SPEED;
        this.speed = MIN_MOVE_SPEED;
        // 会发射子弹的 NPC 有概率掉落子弹球(概率 75%)
        this.loot.add(new Loot("bulletOrb", "bullet_orb", 0.75));
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    @Override
    public String displayName() {
        return NAME;
    }

    /** 等级上限:5(与其他上限 5 的 NPC 共用 6 档等级概率表) */
    @Override
    public int maxLevel() {
        return 5;
    }

    /** 每级移动速度增益:蜂群 +25,略高于普通 NPC */
    @Override
    protected double moveSpeedBonusPerLevel() {
        return MOVE_SPEED_BONUS_PER_LEVEL;
    }

    /** 等级变化时重算掉落经验 */
    @Override
    protected void onNpcLevelApplied() {
        this.gameExp = BASE_GAME_EXP + level * 2;
    }

    /** 当前射击间隔(秒):随等级缩短,下限 0.3 秒 */
    private double actionInterval() {
        return Math.max(0.3, ACTION_INTERVAL - ACTION_INTERVAL_PER_LEVEL * level);
    }

    /** 主循环:无主时只在移动中开火(与白像素同款节奏);成为从者后不再受移动限制 */
    @Override
    public void actionLoop(ActionContext context) {
        if (ownerId == null) {
            if (isDead || !isMoving) {
                if (actionLoopRunning) {
                    actionAfter(context);
                }
                return;
            }
            if (!actionLoopRunning) {
                actionBefore(context);
                return;
            }
            actionCooldownRemaining -= getActionDelta(context.deltaTime);
            while (actionCooldownRemaining <= 0 && isMoving && !isDead) {
                action(context);
                actionCooldownRemaining += actionInterval();
            }
            return;
        }

        if (isDead) {
            if (actionLoopRunning) {
                actionAfter(context);
            }
            return;
        }
        if (!actionLoopRunning) {
            actionBefore(context);
            return;
        }
        actionCooldownRemaining -= getActionDelta(context.deltaTime);
        while (actionCooldownRemaining <= 0 && !isDead) {
            action(context);
            actionCooldownRemaining += actionInterval();
        }
    }

    /** 开始一轮行动循环:立即齐射一次并重置冷却 */
    public void actionBefore(ActionContext context) {
        actionLoopRunning = true;
        action(context);
        actionCooldownRemaining = actionInterval();
    }

    /** 结束行动循环:清除运行标记与冷却 */
    public void actionAfter(ActionContext context) {
        actionLoopRunning = false;
        actionCooldownRemaining = 0;
    }

    /** 向前方射出一束 3 发扇形霰弹 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        double baseAngle = Math.atan2(facingDirection.y, facingDirection.x);
        double spawnDistance = width * 0.6;
        for (int i = 0; i < PELLETS_PER_VOLLEY; i++) {
            // 以中心弹丸为对称轴,把弹丸均匀铺成扇形(-1 .. 1)
            double t = PELLETS_PER_VOLLEY == 1 ? 0 : (i / (double) (PELLETS_PER_VOLLEY - 1)) * 2 - 1;
            double angle = baseAngle + t * Math.toRadians(SPREAD_HALF_ANGLE_DEG);
            Geometry.Vec2 direction = new Geometry.Vec2(Math.cos(angle), Math.sin(angle));
            context.spawnBullet.accept(new BuckshotBulletEntity(
                    new Geometry.Vec2(
                            position.x + direction.x * spawnDistance,
                            position.y + direction.y * spawnDistance),
                    direction,
                    id,
                    teamId,
                    ""));
        }
    }

    /** 每帧更新:被玩家吸附为从者时锁定在主人分配的格子上,否则走常规游走 */
    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (isDead) {
            return;
        }
        if (ownerId != null) {
            followOwner(world);
            return;
        }
        super.update(dt, world, config);
    }
}
