package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.SpiralBulletEntity;

/**
 * 钛白棱镜(由前端 TS 版 TitaniumPrismTp9Entity 迁移)。
 *
 * <p>行为:缓慢游走的<b>弹幕发生器</b> —— 每隔固定时间,以自身为中心向 8 个方向
 * 同时射出<b>螺旋弹</b>(弹道会持续弯折),形成一圈向外扩散的盘旋弹幕。</p>
 *
 * <p>等级差异:生命 3 + 1 × Level(升级即回满);掉落经验 exp = 4 + 2 × Level;
 * 弹幕间隔随等级缩短(3.0 - 0.5 × Level 秒)。</p>
 *
 * <p>战利品:子弹球(概率 75%)。</p>
 */
public class TitaniumPrismTp9Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.13;
    /** NPC 类型显示名称 */
    public static final String NAME = "钛白棱镜";

    /** 主色调(钛白) */
    public static final String MAIN_COLOR = "#DCE6F2";
    /** 辉光/描边色(青蓝) */
    public static final String GLOW_COLOR = "#7FE9FF";

    /** 基准弹幕间隔(秒) */
    public static final double BURST_INTERVAL = 3;
    /** 每级缩短的弹幕间隔(秒) */
    public static final double BURST_INTERVAL_PER_LEVEL = 0.5;
    /** 基准生命值 */
    public static final double HEALTH_BASE = 3;
    /** 每级增加的生命值 */
    public static final double HEALTH_PER_LEVEL = 1;
    /** 基础掉落经验值 */
    public static final double BASE_GAME_EXP = 4;
    /** 击杀获得的分数 */
    public static final int KILL_SCORE = 4;
    /** 每级移动速度增益 */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 20;
    /** 最小移动速度(px/s) */
    public static final double MIN_MOVE_SPEED = 45;
    /** 最大移动速度(px/s) */
    public static final double MAX_MOVE_SPEED = 65;
    /** 每次弹幕发射的螺旋弹数量(全向均分) */
    public static final int BULLETS_PER_BURST = 8;

    /** 弹幕冷却剩余(秒) */
    private double burstCooldownRemaining = 0;

    public TitaniumPrismTp9Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "titanium_prism_tp9");
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

    /** 等级上限:2 */
    @Override
    public int maxLevel() {
        return 2;
    }

    /** 每级移动速度增益(默认 +20,显式声明以便与 TS 侧常量对齐) */
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

    /** 当前弹幕间隔(秒):随等级缩短,下限 1.0 秒 */
    private double burstInterval() {
        return Math.max(1, BURST_INTERVAL - BURST_INTERVAL_PER_LEVEL * level);
    }

    /** 主循环:不依赖移动状态,按固定节奏释放全向螺旋弹幕 */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead) {
            return;
        }
        burstCooldownRemaining -= getActionDelta(context.deltaTime);
        while (burstCooldownRemaining <= 0 && !isDead) {
            action(context);
            burstCooldownRemaining += burstInterval();
        }
    }

    /** 向四周均分发射一圈螺旋弹 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        double spawnDistance = width * 0.7;
        double moveSpeed = getBulletMoveSpeed();
        for (int i = 0; i < BULLETS_PER_BURST; i++) {
            double angle = (i * Math.PI * 2) / BULLETS_PER_BURST;
            Geometry.Vec2 direction = new Geometry.Vec2(Math.cos(angle), Math.sin(angle));
            context.spawnBullet.accept(new SpiralBulletEntity(
                    new Geometry.Vec2(
                            position.x + direction.x * spawnDistance,
                            position.y + direction.y * spawnDistance),
                    direction,
                    id,
                    teamId,
                    "",
                    moveSpeed));
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
