package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.AcceleratingBulletEntity;
import top.atsw.pixelwar.entity.dynamicEntity.DynamicEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;

/**
 * 中立 NPC「紫晶漂流者」(由前端 TS 版 AmethystDrifterAd5Entity 迁移)。
 *
 * <p>行为:<b>和平游荡 + 遇袭放风筝</b> —— 平时缓慢漂游;一旦受到伤害便立刻<b>受惊折跃</b>
 * (朝远离袭击者的方向瞬移一段距离,冷却 6 秒),并锁定该伤害来源进入风筝状态:</p>
 * <ul>
 *   <li>移动:与仇家保持约 {@link #KITE_DISTANCE} 的距离(过近后撤、过远逼近);</li>
 *   <li>攻击:按节奏朝仇家发射疾进弹(越飞越快);</li>
 *   <li>仇家死亡/离开世界后放弃并恢复中立。</li>
 * </ul>
 *
 * <p><b>激怒与从者状态互斥</b>:激怒期间不会被任何玩家吸附为从者;若在成为从者之后被击伤,
 * 则立即解除激怒回到中立。</p>
 *
 * <p>等级差异:生命 3 + 1 × Level(升级即回满);掉落经验 exp = 3 + 2 × Level;
 * 风筝射击间隔随等级缩短(1.4 - 0.1 × Level 秒)。</p>
 *
 * <p>战利品:子弹球(75%)。</p>
 */
public class AmethystDrifterAd5Npc extends NpcEntity {

    /** 生成权重 */
    public static final double GENERATE_WEIGHT = 0.05;
    /** NPC 类型显示名称 */
    public static final String NAME = "紫晶漂流者";

    /** 主色调(紫晶) */
    public static final String MAIN_COLOR = "#9B7BE0";
    /** 和平状态描边色 */
    public static final String GLOW_COLOR = "#DCC9FF";
    /** 受惊状态描边色(亮青警告) */
    public static final String STARTLED_COLOR = "#6FE9FF";

    /** 基准生命值 */
    public static final double HEALTH_BASE = 3;
    /** 每级增加的生命值 */
    public static final double HEALTH_PER_LEVEL = 1;
    /** 基础掉落经验值 */
    public static final double BASE_GAME_EXP = 3;
    /** 击杀获得的分数 */
    public static final int KILL_SCORE = 3;
    /** 每级移动速度增益 */
    public static final double MOVE_SPEED_BONUS_PER_LEVEL = 20;
    /** 最小移动速度(px/s) */
    public static final double MIN_MOVE_SPEED = 60;
    /** 最大移动速度(px/s) */
    public static final double MAX_MOVE_SPEED = 95;
    /** 风筝射击的基准间隔(秒) */
    public static final double KITE_INTERVAL = 1.4;
    /** 每级缩短的风筝射击间隔(秒) */
    public static final double KITE_INTERVAL_PER_LEVEL = 0.1;
    /** 与仇家保持的风筝距离(px) */
    public static final double KITE_DISTANCE = 240;
    /** 风筝距离容差(px) */
    public static final double KITE_DEADZONE = 30;
    /** 重新寻路间隔(秒) */
    public static final double RETARGET_INTERVAL = 0.2;
    /** 受惊折跃距离(px) */
    public static final double BLINK_DISTANCE = 140;
    /** 受惊折跃冷却(秒) */
    public static final double BLINK_COOLDOWN = 6;

    /** 是否已被激怒(受到过伤害) */
    public boolean enraged = false;
    /** 受惊折跃冷却剩余(秒) */
    private double blinkCooldownRemaining = 0;
    /** 是否有一帧"受惊折跃"待执行 */
    private boolean startleBlinkPending = false;
    /** 风筝射击冷却剩余(秒) */
    private double kiteCooldownRemaining = 0;
    /** 仇家实体 id */
    private Long enemyId = null;
    /** 仇家当前位置(每帧由 update 解析) */
    private Geometry.Vec2 enemyPosition = null;
    /** 重新寻路冷却剩余(秒) */
    private double retargetCooldown = 0;

    public AmethystDrifterAd5Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "neutral", 0, "amethyst_drifter_ad5");
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

    /** 激怒状态下拒绝被任何玩家吸附为从者(与象牙游荡者同规则) */
    @Override
    public boolean canBeAbsorbedAsServant() {
        return !enraged;
    }

    /** 受伤即"记仇 + 受惊":记录仇家并预约一次折跃 */
    @Override
    public void applyDamage(double amount) {
        super.applyDamage(amount);
        if (isDead || amount <= 0) {
            return;
        }
        enraged = true;
        Long attackerId = lastDamagerId;
        if (attackerId != null && attackerId != id) {
            enemyId = attackerId;
        }
        if (blinkCooldownRemaining <= 0) {
            startleBlinkPending = true;
        }
    }

    /** 风筝射击间隔(秒):随等级缩短,下限 0.6 秒 */
    private double kiteInterval() {
        return Math.max(0.6, KITE_INTERVAL - KITE_INTERVAL_PER_LEVEL * level);
    }

    /** 移动目标:激怒后改以"风筝站位点"为目标;否则走常规随机游走 */
    @Override
    public boolean setTarget(Geometry.Vec2 target, WorldView world, boolean preferStraight) {
        Geometry.Vec2 enemyPos = enemyPosition;
        if (enemyPos != null) {
            return super.setTarget(kitePoint(enemyPos), world, false);
        }
        return super.setTarget(target, world, preferStraight);
    }

    /** 风筝站位点:以仇家为圆心、沿「仇家 → 自己」方向、距离为 KITE_DISTANCE 的点 */
    private Geometry.Vec2 kitePoint(Geometry.Vec2 enemyPos) {
        double dx = position.x - enemyPos.x;
        double dy = position.y - enemyPos.y;
        double len = Math.hypot(dx, dy);
        if (len < 0.0001) {
            Geometry.Vec2 back = normalizedFacingDirection();
            return new Geometry.Vec2(enemyPos.x - back.x * KITE_DISTANCE,
                    enemyPos.y - back.y * KITE_DISTANCE);
        }
        return new Geometry.Vec2(enemyPos.x + (dx / len) * KITE_DISTANCE,
                enemyPos.y + (dy / len) * KITE_DISTANCE);
    }

    /** 每帧更新:从者跟随 / 受惊折跃 / 风筝追击 / 和平游荡 */
    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (isDead) {
            return;
        }
        blinkCooldownRemaining = Math.max(0, blinkCooldownRemaining - dt);

        if (ownerId != null) {
            // 从者由主人网格控制:与「激怒」互斥,这里恢复中立
            revertToNeutral();
            followOwner(world);
            return;
        }

        if (enraged) {
            enemyPosition = resolveEnemyPosition(world);
            if (startleBlinkPending && enemyPosition != null) {
                startleBlinkPending = false;
                if (tryBlinkAway(enemyPosition, world, config)) {
                    blinkCooldownRemaining = BLINK_COOLDOWN;
                    return;
                }
            }
            refreshRetarget(dt, world);
        } else {
            enemyPosition = null;
        }

        super.update(dt, world, config);
    }

    /** 风筝寻路:与仇家的距离偏差超出容差时,按固定间隔重新下发目标 */
    private void refreshRetarget(double dt, WorldView world) {
        Geometry.Vec2 enemyPos = enemyPosition;
        if (enemyPos == null) {
            retargetCooldown = 0;
            return;
        }
        double distance = Math.hypot(enemyPos.x - position.x, enemyPos.y - position.y);
        if (Math.abs(distance - KITE_DISTANCE) <= KITE_DEADZONE) {
            retargetCooldown = 0;
            return;
        }
        retargetCooldown -= dt;
        if (retargetCooldown > 0) {
            return;
        }
        retargetCooldown = RETARGET_INTERVAL;
        setTarget(enemyPos, world, false);
    }

    /** 解析仇家当前位置:依次在玩家 / NPC 列表中按 id 查找;仇家消失即恢复中立 */
    private Geometry.Vec2 resolveEnemyPosition(WorldView world) {
        Long targetId = enemyId;
        if (targetId == null) {
            revertToNeutral();
            return null;
        }
        for (PlayerEntity player : world.players()) {
            if (!targetId.equals(player.id)) {
                continue;
            }
            if (player.isDead) {
                break;
            }
            return new Geometry.Vec2(player.position.x, player.position.y);
        }
        for (DynamicEntity npc : world.npcEntities()) {
            if (!targetId.equals(npc.id)) {
                continue;
            }
            if (npc.isDead) {
                break;
            }
            return new Geometry.Vec2(npc.position.x, npc.position.y);
        }
        revertToNeutral();
        return null;
    }

    /** 朝远离指定点的方向瞬移一段距离(尝试多个方向,避开墙体与地图外) */
    private boolean tryBlinkAway(Geometry.Vec2 awayFrom, WorldView world, GameConfig config) {
        double dx = position.x - awayFrom.x;
        double dy = position.y - awayFrom.y;
        double len = Math.hypot(dx, dy);
        Geometry.Vec2 facing = normalizedFacingDirection();
        double baseAngle = len < 0.0001
                ? Math.atan2(facing.y, facing.x)
                : Math.atan2(dy, dx);

        double[] offsetsDeg = {0, 45, -45, 90, -90, 135, -135, 180};
        for (double offset : offsetsDeg) {
            double rad = baseAngle + Math.toRadians(offset);
            double candidateX = position.x + Math.cos(rad) * BLINK_DISTANCE;
            double candidateY = position.y + Math.sin(rad) * BLINK_DISTANCE;
            candidateX = Math.max(config.worldMinX + width / 2,
                    Math.min(config.worldMaxX - width / 2, candidateX));
            candidateY = Math.max(config.worldMinY + height / 2,
                    Math.min(config.worldMaxY - height / 2, candidateY));
            if (isBlocked(candidateX, candidateY, world)) {
                continue;
            }
            this.position.set(candidateX, candidateY);
            updateCollisionBox();
            isMoving = false;
            nextTarget = new Geometry.Vec2(candidateX, candidateY);
            targetHistory.clear();
            targetHistory.add(position.copy());
            curvePoints.clear();
            curvePoints.add(position.copy());
            currentCurveIndex = 0;
            return true;
        }
        return false;
    }

    /** 候选落点是否与任意静态实体(AABB)相交 */
    private boolean isBlocked(double candidateX, double candidateY, WorldView world) {
        double minX = candidateX - width / 2;
        double minY = candidateY - height / 2;
        double maxX = candidateX + width / 2;
        double maxY = candidateY + height / 2;
        for (StaticEntity staticEntity : world.staticEntitiesInRect(minX, minY, maxX - minX, maxY - minY)) {
            Geometry.Box box = staticEntity.collisionBox;
            boolean separated = maxX <= box.x || minX >= box.maxX() || maxY <= box.y || minY >= box.maxY();
            if (!separated) {
                return true;
            }
        }
        return false;
    }

    /** 解除激怒,回到中立漂游状态 */
    private void revertToNeutral() {
        enraged = false;
        enemyId = null;
        enemyPosition = null;
        startleBlinkPending = false;
    }

    /** 射击方向:优先瞄向仇家,无仇家时退回当前朝向 */
    private Geometry.Vec2 shotDirection() {
        Geometry.Vec2 enemyPos = enemyPosition;
        if (enemyPos == null) {
            return normalizedFacingDirection();
        }
        double dx = enemyPos.x - position.x;
        double dy = enemyPos.y - position.y;
        double len = Math.hypot(dx, dy);
        if (len < 0.0001) {
            return normalizedFacingDirection();
        }
        return new Geometry.Vec2(dx / len, dy / len);
    }

    /** 主循环:和平状态下不攻击;激怒后按节奏朝仇家发射疾进弹 */
    @Override
    public void actionLoop(ActionContext context) {
        if (isDead || !enraged || enemyPosition == null) {
            return;
        }
        kiteCooldownRemaining -= getActionDelta(context.deltaTime);
        while (kiteCooldownRemaining <= 0 && !isDead) {
            action(context);
            kiteCooldownRemaining += kiteInterval();
        }
    }

    /** 朝仇家发射一发疾进弹 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        Geometry.Vec2 direction = shotDirection();
        double spawnDistance = width * 0.7;
        context.spawnBullet.accept(new AcceleratingBulletEntity(
                new Geometry.Vec2(
                        position.x + direction.x * spawnDistance,
                        position.y + direction.y * spawnDistance),
                direction,
                id,
                teamId,
                "",
                getBulletMoveSpeed()));
    }
}
