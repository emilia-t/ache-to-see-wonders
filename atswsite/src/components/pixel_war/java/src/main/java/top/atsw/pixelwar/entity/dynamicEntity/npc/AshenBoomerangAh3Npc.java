package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.BoomerangBulletEntity;

/**
 * 敌对 NPC「灰烬回旋手」(由前端 TS 版 AshenBoomerangAh3Entity 迁移)。
 *
 * <p>行为:中速游走的<b>回旋投手</b> —— 只在移动时开火,每次向前后各投出一枚回旋弹
 * (回旋弹飞出约 0.85 秒后会折返),因此它既压迫正面、又在身后留下一道回程威胁。</p>
 *
 * <p>等级差异:生命 2 + 1 × Level(升级即回满);掉落经验 exp = 3 + 2 × Level;
 * 投掷间隔随等级缩短(2.2 - 0.2 × Level 秒)。</p>
 *
 * <p>战利品:子弹球(75%)+「螺旋舞」技能球(20%)。</p>
 */
public class AshenBoomerangAh3Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.13;
    /** NPC 类型显示名称 */
    public static final String NAME = "灰烬回旋手";

    /** 主色调(灰烬) */
    public static final String MAIN_COLOR = "#B9B2A8";
    /** 辉光/描边色(暖金) */
    public static final String GLOW_COLOR = "#FFD79A";

    /** 基准投掷间隔(秒) */
    public static final double ACTION_INTERVAL = 2.2;
    /** 每级缩短的投掷间隔(秒) */
    public static final double ACTION_INTERVAL_PER_LEVEL = 0.2;
    /** 基准生命值 */
    public static final double HEALTH_BASE = 2;
    /** 每级增加的生命值 */
    public static final double HEALTH_PER_LEVEL = 1;
    /** 基础掉落经验值 */
    public static final double BASE_GAME_EXP = 3;
    /** 击杀获得的分数 */
    public static final int KILL_SCORE = 3;
    /** 每级移动速度增益 */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 20;
    /** 最小移动速度(px/s) */
    public static final double MIN_MOVE_SPEED = 70;
    /** 最大移动速度(px/s) */
    public static final double MAX_MOVE_SPEED = 100;

    /** 是否处于行动循环中 */
    private boolean actionLoopRunning = false;
    /** 投掷冷却剩余(秒) */
    private double actionCooldownRemaining = 0;

    public AshenBoomerangAh3Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "ashen_boomerang_ah3");
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
        this.loot.add(new Loot("skillOrb", "spiral_dance_skill", 0.2));
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

    /** 等级上限:5 */
    @Override
    public int maxLevel() {
        return 5;
    }

    /** 每级移动速度增益(与普通 NPC 一致) */
    @Override
    protected double moveSpeedBonusPerLevel() {
        return MOVE_SPEED_BONUS_PER_LEVEL;
    }

    /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
    @Override
    protected void onNpcLevelApplied() {
        this.healthMax = HEALTH_BASE + HEALTH_PER_LEVEL * level;
        this.health = healthMax;
        this.gameExp = BASE_GAME_EXP + level * 2;
    }

    /** 当前投掷间隔(秒):随等级缩短,下限 0.8 秒 */
    private double actionInterval() {
        return Math.max(0.8, ACTION_INTERVAL - ACTION_INTERVAL_PER_LEVEL * level);
    }

    /** 主循环:无主时只在移动中投掷;成为从者后不再受移动限制 */
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

    /** 行动开始:立即投掷一次并重置冷却 */
    private void actionBefore(ActionContext context) {
        actionLoopRunning = true;
        action(context);
        actionCooldownRemaining = actionInterval();
    }

    /** 行动结束:清除运行标记与冷却 */
    private void actionAfter(ActionContext context) {
        actionLoopRunning = false;
        actionCooldownRemaining = 0;
    }

    /** 向前、向后各投出一枚回旋弹 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        Geometry.Vec2 direction = facingUnit();
        double spawnDistance = width * 0.6;
        double bulletSpeed = getBulletMoveSpeed();

        double[][] arms = {
                {direction.x, direction.y},
                {-direction.x, -direction.y}
        };
        for (double[] arm : arms) {
            context.spawnBullet.accept(new BoomerangBulletEntity(
                    new Geometry.Vec2(
                            position.x + arm[0] * spawnDistance,
                            position.y + arm[1] * spawnDistance),
                    new Geometry.Vec2(arm[0], arm[1]),
                    id,
                    teamId,
                    "",
                    bulletSpeed));
        }
    }

    /** 归一化的朝向单位向量(朝向可能为零向量时回退为正东) */
    private Geometry.Vec2 facingUnit() {
        double len = Math.hypot(facingDirection.x, facingDirection.y);
        if (len < 0.0001) {
            return new Geometry.Vec2(1, 0);
        }
        return new Geometry.Vec2(facingDirection.x / len, facingDirection.y / len);
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
