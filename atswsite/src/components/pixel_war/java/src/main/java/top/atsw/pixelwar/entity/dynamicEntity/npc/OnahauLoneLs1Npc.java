package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.LaserBulletEntity;
import top.atsw.pixelwar.game.Ls1ShootSkill;

/**
 * 敌对 NPC「OnahauLoneLs1」(幽蓝孤光 ls1,由 TS 版 OnahauLoneLs1Entity 迁移)。
 *
 * <p>行为循环:直线移动 → 停住并朝固定方向发射一束激光 → 激光消失(攻击结束)→ 继续移动。</p>
 * <ul>
 *   <li>攻击方向在出生时从八方向中随机选定一次,此后固定不变,不随移动方向改变;</li>
 *   <li>激光长度随等级成长:length = 1200 + Level × 200(px);</li>
 *   <li>激光持续发光时长随等级成长:duration_tick = 75 + Level × 20(tick);</li>
 *   <li>激光展开速度固定 LASER_EXPAND_SPEED px/s,不随等级变化;</li>
 *   <li>掉落经验值 exp = 3 + Level;移动速度增益与其他敌对 NPC 相同(每级 +20);</li>
 *   <li>被击杀后概率掉落「激光束」技能球。</li>
 * </ul>
 */
public class OnahauLoneLs1Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.14;
    /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
    public static final String NAME = "幽蓝孤光";

    /** 主色调 */
    public static final String MAIN_COLOR = "#91e4ff";
    /** 辉光色调(同时作为描边色) */
    public static final String GLOW_COLOR = "#e1f8ff";
    /** 激光主色 */
    public static final String LASER_COLOR = "#C2F0FF";
    /** 激光辉光色 */
    public static final String LASER_GLOW_COLOR = "#E6F6FA";

    /** 激光展开速度(px/s):不随等级变化 */
    public static final double LASER_EXPAND_SPEED = 20000;
    /** 激光基础伤害(固定 1 点) */
    private static final double LASER_DAMAGE = 1;
    /** 激光长度基准(px,等级 0) */
    private static final double LASER_LENGTH_BASE = 1200;
    /** 每级增加的激光长度(px) */
    private static final double LASER_LENGTH_PER_LEVEL = 200;
    /** 激光持续发光时长基准(tick,等级 0) */
    private static final int LASER_DURATION_TICKS_BASE = 75;
    /** 每级增加的激光持续发光时长(tick) */
    private static final int LASER_DURATION_TICKS_PER_LEVEL = 20;
    /** 基础掉落经验值 */
    private static final double BASE_GAME_EXP = 3;
    /** 击杀获得的分数 */
    private static final int KILL_SCORE = 3;
    /** 掉落技能球的概率 */
    private static final double LOOT_ODDS = 0.2;
    /** idle 阶段的安全超时(游戏刻) */
    private static final int IDLE_TIMEOUT_TICKS = 100;
    /** 从者攻击间隔基准(秒)*/
    private static final double SERVANT_ATTACK_INTERVAL_BASE = 6;
    /** 每提高 1 级缩短的从者攻击间隔(秒) */
    private static final double SERVANT_ATTACK_INTERVAL_PER_LEVEL = 0.4;
    /** 从者攻击间隔下限(秒):n 至少为 4 */
    private static final double SERVANT_ATTACK_INTERVAL_MIN = 4;

    /**
     * 八方向攻击方向(世界坐标 y 轴向上):
     * 东 / 南 / 西 / 北 / 东南 / 西南 / 东北 / 西北。
     */
    private static final double[][] EIGHT_DIRECTIONS = {
            {1, 0},                                 // 东
            {0, -1},                                // 南
            {-1, 0},                                // 西
            {0, 1},                                 // 北
            {Math.sqrt(0.5), -Math.sqrt(0.5)},      // 东南
            {-Math.sqrt(0.5), -Math.sqrt(0.5)},     // 西南
            {Math.sqrt(0.5), Math.sqrt(0.5)},       // 东北
            {-Math.sqrt(0.5), Math.sqrt(0.5)}       // 西北
    };

    /** 行为阶段:wander(游走) / attacking(发射激光并等待其消失) / idle(等待新目标) */
    private enum Phase {
        WANDER,
        ATTACKING,
        IDLE
    }

    /** 固定攻击方向(出生时随机选定八方向之一,此后不变) */
    private final Geometry.Vec2 attackDirection;
    private Phase phase = Phase.WANDER;
    /** 本次攻击剩余时长(秒):从发射激光到激光完全消失 */
    private double attackRemaining;
    /** 本次攻击是否已发射激光 */
    private boolean laserFired;
    /** idle 阶段已等待的游戏刻数 */
    private int idleTickCounter;
    /** 从者:距下一轮激光攻击的剩余秒数(<= 0 时发射一束激光) */
    private double servantAttackCooldown;

    public OnahauLoneLs1Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "onahau_lone_ls1");
        this.fillColor = MAIN_COLOR;
        this.strokeColor = GLOW_COLOR;
        this.health = 1;
        this.healthMax = 1;
        this.killScore = KILL_SCORE;
        this.gameExp = BASE_GAME_EXP;
        this.mapColor = MAIN_COLOR;
        // 出生时随机选定一个八方向作为固定攻击方向
        double[] direction = EIGHT_DIRECTIONS[(int) Math.floor(Math.random() * EIGHT_DIRECTIONS.length)];
        this.attackDirection = new Geometry.Vec2(direction[0], direction[1]);
        // 战利品:击杀后概率掉落其持有的「激光束」技能球
        this.loot.add(new Loot("skillOrb", Ls1ShootSkill.TAG, LOOT_ODDS));
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

    /** 等级变化时重算等级相关属性:经验值随等级提升 */
    @Override
    protected void onNpcLevelApplied() {
        this.gameExp = BASE_GAME_EXP + level;
    }

    /** 当前等级的激光长度(px):length = 1200 + Level × 200 */
    private double laserLength() {
        return LASER_LENGTH_BASE + LASER_LENGTH_PER_LEVEL * level;
    }

    /** 当前等级的激光持续发光时长(tick):duration_tick = 75 + Level × 20 */
    private int laserDurationTicks() {
        return LASER_DURATION_TICKS_BASE + LASER_DURATION_TICKS_PER_LEVEL * level;
    }

    /** 一次攻击的总时长(秒) = 激光展开 + 渐亮 + 持续发光 + 渐暗 */
    private double attackDurationSeconds() {
        double expandSeconds = laserLength() / LASER_EXPAND_SPEED;
        double holdSeconds = laserDurationTicks() * LaserBulletEntity.TICK_SECONDS;
        return expandSeconds
                + LaserBulletEntity.FADE_IN_SECONDS
                + holdSeconds
                + LaserBulletEntity.FADE_OUT_SECONDS;
    }

    /** 直线行走:强制以直线路径前往目标 */
    @Override
    public boolean setTarget(Geometry.Vec2 target, WorldView world, boolean preferStraight) {
        return super.setTarget(target, world, true);
    }

    /**
     * 每帧更新:
     * 1. 被玩家吸附时锁定在主人的从者网格格子上;
     * 2. 无主时走常规游走逻辑,到达目标停住后由 updateStayDuration 切换到攻击阶段。
     */
    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (isDead) {
            return;
        }

        if (ownerId != null) {
            // 从者:瞬移到主人分配的格子中心,不自行游走也不发动激光。
            // 同时重置行为阶段:从者可能因网格断连而被释放回野生状态(不会被杀死),
            // 若不重置会永久卡在"攻击中"(既不移动也不开火)。
            resetToWander();
            followOwner(world);
            return;
        }

        super.update(dt, world, config);

        // 朝向始终锁定为固定攻击方向:语义上"炮口一直指着攻击方向",
        // 且朝向会随快照下发给客户端,使多人模式下客户端也能画出正确的炮口标记
        this.facingDirection = attackDirection.copy();
    }

    /**
     * 到达游走目标停住后进入攻击阶段;攻击结束(激光消失)后等待新的游走目标。
     */
    @Override
    public void updateStayDuration(double dt) {
        if (isDead || ownerId != null) {
            return;
        }

        if (phase == Phase.WANDER) {
            if (!isMoving) {
                startAttacking();
            }
            return;
        }

        if (phase == Phase.ATTACKING) {
            // 保持驻足,等待激光走完整个生命周期(展开 → 渐亮 → 持续发光 → 渐暗)
            attackRemaining -= dt;
            if (attackRemaining <= 0) {
                phase = Phase.IDLE;
                idleTickCounter = 0;
            }
            return;
        }

        // idle:已获得新的游走目标 → 回到游走阶段;超时保护避免永久停摆
        idleTickCounter++;
        if (isMoving || idleTickCounter >= IDLE_TIMEOUT_TICKS) {
            phase = Phase.WANDER;
            idleTickCounter = 0;
        }
    }

    /** 攻击期间不重新分配游走目标,保证激光完整走完生命周期;从者同样不参与游走 */
    @Override
    public boolean canGetNewWanderTarget(double dt, WorldView world) {
        if (ownerId != null || phase != Phase.WANDER) {
            return false;
        }
        return super.canGetNewWanderTarget(dt, world);
    }

    /** 攻击期间停住是"有意为之"而非卡住,不触发长时间未位移的重新寻路;从者同样不参与 */
    @Override
    public boolean updateNoMovementWatchdog(double dt) {
        if (ownerId != null || phase != Phase.WANDER) {
            return false;
        }
        return super.updateNoMovementWatchdog(dt);
    }

    /** 进入攻击阶段:停止移动并重置攻击状态(激光在紧随其后的 actionLoop 中发射) */
    private void startAttacking() {
        phase = Phase.ATTACKING;
        laserFired = false;
        attackRemaining = attackDurationSeconds();
        idleTickCounter = 0;
        stayDurationRemaining = 0;
        stop();
    }

    /** 回到游走阶段并清空攻击/等待状态 */
    private void resetToWander() {
        phase = Phase.WANDER;
        laserFired = false;
        attackRemaining = 0;
        idleTickCounter = 0;
    }

    // ==================================================================
    // 攻击
    // ==================================================================

    /**
     * 行为循环:
     * <ul>
     *   <li>无主时进入攻击阶段后朝固定攻击方向发射一束激光(一次攻击只发射一束);</li>
     * </ul>
     */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead) {
            return;
        }
        // 从者:不再自行游走,改为按固定时间间隔发射激光
        if (ownerId != null) {
            servantActionLoop(context);
            return;
        }
        if (phase != Phase.ATTACKING || laserFired) {
            return;
        }
        laserFired = true;
        spawnLaser(context);
    }

    /**
     * 从者攻击:朝固定攻击方向发射一束激光。
     *
     * <p>从者被锁定在主人的从者网格上,因此其激光总是从当前格子中心射出;
     * 一旦从者随玩家移动而瞬移,先前发射的激光会因"失去源头"被世界移除
     * (见 {@code World.updateBullets}),不会留在原地。</p>
     *
     * <p>攻击节奏按主人的射速倍率缩放(getActionDelta),与其它从者一致。</p>
     */
    private void servantActionLoop(ActionContext context) {
        if (context == null) {
            return;
        }
        servantAttackCooldown -= getActionDelta(context.deltaTime);
        if (servantAttackCooldown > 0) {
            return;
        }
        servantAttackCooldown = servantAttackIntervalSeconds();
        spawnLaser(context);
    }

    /** 从者攻击间隔(秒)*/
    private double servantAttackIntervalSeconds() {
        return Math.max(SERVANT_ATTACK_INTERVAL_MIN,
                SERVANT_ATTACK_INTERVAL_BASE - SERVANT_ATTACK_INTERVAL_PER_LEVEL * level);
    }

    /** 朝固定攻击方向发射一束激光弹 */
    private void spawnLaser(ActionContext context) {
        if (isDead || context == null || context.spawnBullet == null) {
            return;
        }
        double spawnDistance = width * 0.6;
        LaserBulletEntity laser = new LaserBulletEntity(
                new Geometry.Vec2(
                        position.x + attackDirection.x * spawnDistance,
                        position.y + attackDirection.y * spawnDistance),
                new Geometry.Vec2(attackDirection.x, attackDirection.y),
                id,
                teamId,
                "",
                LASER_COLOR,
                laserLength(),
                LASER_EXPAND_SPEED,
                laserDurationTicks(),
                LASER_DAMAGE,
                LASER_GLOW_COLOR);
        // 记录发射位置:世界据此判断发射者是否已经移动(被推动/瞬移/重新游走),
        // 从而移除失去源头的激光
        laser.laserAnchor = new Geometry.Vec2(position.x, position.y);
        context.spawnBullet.accept(laser);
    }
}
