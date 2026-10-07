package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;
import top.atsw.pixelwar.entity.dynamicEntity.WaveBulletEntity;

/**
 * 敌对 NPC「盐白哨兵」(由前端 TS 版 SaltSentinelSs2Entity 迁移)。
 *
 * <p>行为:几乎不动的<b>扫描哨塔</b> —— 按固定节奏朝最近的玩家方向释放一道 3 发扇面波弹(±20°),
 * 且每释放一次,整道扇面的朝向就顺时针偏转 {@link #SWEEP_DEG_PER_BURST}°,
 * 于是弹幕像雷达扫描一样绕着哨塔转圈。</p>
 *
 * <p>等级差异:生命 5 + 1 × Level(升级即回满);掉落经验 exp = 5 + 2 × Level;
 * 弹幕间隔随等级缩短(2.6 - 0.3 × Level 秒);每级移动速度仅 +5。</p>
 *
 * <p>战利品:子弹球(75%)+「新星环射」技能球(25%)。</p>
 */
public class SaltSentinelSs2Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.12;
    /** NPC 类型显示名称 */
    public static final String NAME = "盐白哨兵";

    /** 主色调(盐白) */
    public static final String MAIN_COLOR = "#EDF3F7";
    /** 辉光/描边色(浅青) */
    public static final String GLOW_COLOR = "#7FD3E8";
    /** 炮口颜色 */
    public static final String BARREL_COLOR = "#3C6E7A";

    /** 基准弹幕间隔(秒) */
    public static final double BURST_INTERVAL = 2.6;
    /** 每级缩短的弹幕间隔(秒) */
    public static final double BURST_INTERVAL_PER_LEVEL = 0.3;
    /** 基准生命值 */
    public static final double HEALTH_BASE = 5;
    /** 每级增加的生命值 */
    public static final double HEALTH_PER_LEVEL = 1;
    /** 基础掉落经验值 */
    public static final double BASE_GAME_EXP = 5;
    /** 击杀获得的分数 */
    public static final int KILL_SCORE = 5;
    /** 每级移动速度增益(远低于普通 NPC) */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 5;
    /** 最小移动速度(px/s) */
    public static final double MIN_MOVE_SPEED = 30;
    /** 最大移动速度(px/s) */
    public static final double MAX_MOVE_SPEED = 42;
    /** 每次弹幕的子弹数量(扇形均分) */
    public static final int BULLETS_PER_BURST = 3;
    /** 扇形半张角(度) */
    public static final double SPREAD_HALF_ANGLE_DEG = 20;
    /** 每次弹幕结束后扫掠角的推进量(度,顺时针) */
    public static final double SWEEP_DEG_PER_BURST = 25;

    /** 弹幕冷却剩余(秒) */
    private double burstCooldownRemaining = 0;
    /** 当前扫掠角(度):在瞄准方向的基础上叠加的偏转量 */
    private double sweepDeg = 0;

    public SaltSentinelSs2Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "salt_sentinel_ss2");
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
        this.loot.add(new Loot("skillOrb", "nova_shoot_skill", 0.25));
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

    /** 每级移动速度增益:哨塔只有 +5 */
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

    /** 主循环:按固定节奏释放扫描扇面弹幕 */
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

    /** 朝最近玩家方向释放一道 3 发扇面波弹,并把扫掠角顺时针推进 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        Geometry.Vec2 aim = aimDirection(context);
        double centerDeg = Math.toDegrees(Math.atan2(aim.y, aim.x)) + sweepDeg;

        double spawnDistance = width * 0.75;
        double bulletSpeed = getBulletMoveSpeed();
        for (int i = 0; i < BULLETS_PER_BURST; i++) {
            double t = BULLETS_PER_BURST == 1 ? 0 : (i / (double) (BULLETS_PER_BURST - 1)) * 2 - 1;
            double rad = Math.toRadians(centerDeg + t * SPREAD_HALF_ANGLE_DEG);
            double dirX = Math.cos(rad);
            double dirY = Math.sin(rad);
            context.spawnBullet.accept(new WaveBulletEntity(
                    new Geometry.Vec2(
                            position.x + dirX * spawnDistance,
                            position.y + dirY * spawnDistance),
                    new Geometry.Vec2(dirX, dirY),
                    id,
                    teamId,
                    "",
                    bulletSpeed));
        }

        // 炮口朝向锁定为本次扇面中心方向(随快照下发,客户端据此绘制炮口)
        double centerRad = Math.toRadians(centerDeg);
        this.facingDirection = new Geometry.Vec2(Math.cos(centerRad), Math.sin(centerRad));
        // 扫掠角顺时针推进,形成"雷达扫描"效果
        sweepDeg += SWEEP_DEG_PER_BURST;
        if (sweepDeg >= 360) {
            sweepDeg -= 360;
        }
    }

    /** 瞄准方向:优先指向最近的存活玩家,无玩家时退回当前朝向 */
    private Geometry.Vec2 aimDirection(ActionContext context) {
        PlayerEntity nearest = null;
        double nearestDist = Double.MAX_VALUE;
        for (PlayerEntity player : context.players) {
            if (player.isDead) {
                continue;
            }
            double dist = Geometry.distance(position.x, position.y, player.position.x, player.position.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = player;
            }
        }
        if (nearest != null && nearestDist > 0.0001) {
            return new Geometry.Vec2(
                    (nearest.position.x - position.x) / nearestDist,
                    (nearest.position.y - position.y) / nearestDist);
        }
        return normalizedFacingDirection();
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
