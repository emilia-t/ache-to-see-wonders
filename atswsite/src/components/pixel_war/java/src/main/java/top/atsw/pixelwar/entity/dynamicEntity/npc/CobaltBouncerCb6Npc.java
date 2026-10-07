package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.RicochetBulletEntity;

/**
 * 钴蓝跳弹手(由前端 TS 版 CobaltBouncerCb6Entity 迁移)。
 *
 * <p>行为:中速游走的<b>跳弹射手</b> —— 不受"移动中才能射击"限制,按固定节奏朝当前朝向
 * 发射<b>跳弹</b>;跳弹撞墙后会反弹(最多 3 次),因此在狭窄地形里常常"拐弯"命中。</p>
 *
 * <p>等级差异:生命 2 + 1 × Level(升级即回满);掉落经验 exp = 3 + 2 × Level;
 * 射击间隔随等级缩短(2.6 - 0.2 × Level 秒)。</p>
 *
 * <p>战利品:子弹球(概率 75%)。</p>
 */
public class CobaltBouncerCb6Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.11;
    /** NPC 类型显示名称 */
    public static final String NAME = "钴蓝跳弹手";

    /** 主色调(钴蓝) */
    public static final String MAIN_COLOR = "#3E6BD8";
    /** 辉光/描边色 */
    public static final String GLOW_COLOR = "#9FC0FF";

    /** 基准射击间隔(秒) */
    public static final double ACTION_INTERVAL = 2.6;
    /** 每级缩短的射击间隔(秒) */
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
    public static final double MAX_MOVE_SPEED = 105;

    /** 射击冷却剩余(秒) */
    private double actionCooldownRemaining = 0;

    public CobaltBouncerCb6Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "cobalt_bouncer_cb6");
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

    /** 当前射击间隔(秒):随等级缩短,下限 0.8 秒 */
    private double actionInterval() {
        return Math.max(0.8, ACTION_INTERVAL - ACTION_INTERVAL_PER_LEVEL * level);
    }

    /** 主循环:不依赖移动状态,按固定节奏发射跳弹 */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead) {
            return;
        }
        actionCooldownRemaining -= getActionDelta(context.deltaTime);
        while (actionCooldownRemaining <= 0 && !isDead) {
            action(context);
            actionCooldownRemaining += actionInterval();
        }
    }

    /** 朝当前朝向发射一发跳弹 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        Geometry.Vec2 direction = normalizedFacingDirection();
        double spawnDistance = width * 0.7;
        context.spawnBullet.accept(new RicochetBulletEntity(
                new Geometry.Vec2(
                        position.x + direction.x * spawnDistance,
                        position.y + direction.y * spawnDistance),
                direction,
                id,
                teamId,
                "",
                getBulletMoveSpeed()));
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
