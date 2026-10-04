package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.BulletEntity;

/**
 * 白像素(由前端 TS 版 WhitePixelEntity 迁移)。
 *
 * <p>无主时"边移动边射击"(沿当前朝向发射,每秒 1 发);成为从者后不再受移动条件限制。</p>
 */
public class WhitePixelNpc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.8;
    /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
    public static final String NAME = "白色像素";
    /** 射击间隔(秒) */
    protected static final double ACTION_INTERVAL = 1;

    private boolean actionLoopRunning;
    private double actionCooldownRemaining;

    public WhitePixelNpc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "white_pixel");
        this.fillColor = "#ffffff";
        this.strokeColor = "#bebebe";
        this.health = 1;
        this.healthMax = 1;
        this.killScore = 1;
        this.mapColor = "#ffffff";
        this.gameExp = 2;
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    @Override
    public String displayName() {
        return NAME;
    }

    @Override
    public void actionLoop(ActionContext context) {
        if (ownerId == null) {
            // 普通情况下只能在移动时射击
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
                actionCooldownRemaining += getActionInterval();
            }
        } else {
            // 被玩家吸附情况下不考虑移动的条件
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
                actionCooldownRemaining += getActionInterval();
            }
        }
    }

    /** 开始一轮行动循环:立即射击一次并重置冷却(对应 TS 版 actionBefore) */
    public void actionBefore(ActionContext context) {
        actionLoopRunning = true;
        action(context);
        actionCooldownRemaining = getActionInterval();
    }

    /** 结束行动循环:清除运行标记与冷却(对应 TS 版 actionAfter) */
    public void actionAfter(ActionContext context) {
        actionLoopRunning = false;
        actionCooldownRemaining = 0;
    }

    /** 沿当前朝向发射一颗子弹 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        Geometry.Vec2 direction = normalizedFacingDirection();
        double spawnDistance = width * 0.6;
        String bulletColor = bulletColorOf(context);
        context.spawnBullet.accept(new BulletEntity(
                new Geometry.Vec2(
                        position.x + direction.x * spawnDistance,
                        position.y + direction.y * spawnDistance),
                direction,
                id,
                teamId,
                "",
                bulletColor,
                getBulletMoveSpeed()));
    }

    /** 当前攻击间隔(秒):随等级缩短(ACTION_INTERVAL - 0.1 × Level) */
    protected double getActionInterval() {
        return Math.max(0.1, ACTION_INTERVAL - 0.1 * level);
    }

    /** 等级变化时重算等级相关属性(经验值随等级提升) */
    @Override
    protected void onNpcLevelApplied() {
        this.gameExp = 2 + level * 2;
    }

    /**
     * 白像素只沿上下左右四个正交方向随机移动(对齐 TS 版 WhitePixelEntity.setTarget)。
     *
     * <p>忽略外部传入的 target,每次由内部重新生成一段 100~200px 的正交位移,
     * 并以 preferStraight=true 走直线,避免父类的弯曲塑形导致朝向偏移。</p>
     */
    @Override
    public boolean setTarget(Geometry.Vec2 target, WorldView world, boolean preferStraight) {
        double[][] directions = {{0, -1}, {0, 1}, {-1, 0}, {1, 0}};
        double[] randomDir = directions[(int) (Math.random() * directions.length)];
        double distance = 100 + Math.random() * 200;
        Geometry.Vec2 newTarget = new Geometry.Vec2(
                position.x + randomDir[0] * distance,
                position.y + randomDir[1] * distance);
        return super.setTarget(newTarget, world, true);
    }

    /**
     * 每帧更新:有主时跟随主人,无主时在父类游走基础上缩短停留时间
     * (对齐 TS 版 WhitePixelEntity.update)。
     */
    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (ownerId != null) {
            // 被玩家吸附:直接跟随主人,不参与游走
            followOwner(world);
            return;
        }

        boolean wasMoving = isMoving;
        super.update(dt, world, config);
        if (isDead) {
            return;
        }

        // 移动完成后缩短停留时间,停留结束后自动开始下一段正交移动
        if (wasMoving && !isMoving && stayDurationRemaining > 0) {
            stayDurationRemaining = 1 + Math.random() * 2;
        }
        if (!isMoving && stayDurationRemaining <= 0) {
            setTarget(position, world, true);
        }
    }

    /** 此行为由 actionLoop 接管,不需要无位移看门狗(对齐 TS 版) */
    @Override
    public boolean updateNoMovementWatchdog(double dt) {
        return false;
    }
}
