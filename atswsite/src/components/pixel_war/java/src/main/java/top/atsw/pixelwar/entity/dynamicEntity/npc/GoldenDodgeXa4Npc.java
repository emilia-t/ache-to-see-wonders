package top.atsw.pixelwar.entity.dynamicEntity.npc;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.dynamicEntity.BulletEntity;
import top.atsw.pixelwar.entity.dynamicEntity.DynamicEntity;
import top.atsw.pixelwar.entity.dynamicEntity.PlayerEntity;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;
import top.atsw.pixelwar.game.DodgeSkill;
import top.atsw.pixelwar.game.Xa4ShootSkill;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 敌对 NPC「GoldenDodgeXa4」(金色闪避者 xa4,由前端 TS 版 GoldenDodgeXa4Entity 迁移)。
 *
 * <p>行为:</p>
 * <ul>
 *   <li>偏好直线移动</li>
 *   <li>即将碰到玩家 / 其他 NPC,或即将被玩家(含从者)子弹命中时,触发闪现高速逃离</li>
 *   <li>闪现本质为超高速移动(非瞬移),冷却 5 秒、每个实体独立计算</li>
 *   <li>移动过程中向上下左右四个方向射击普通子弹,每 2 秒一次、每次 4 颗</li>
 *   <li>击杀后概率掉落「四向子弹」与「闪现」技能球</li>
 * </ul>
 */
public class GoldenDodgeXa4Npc extends NpcEntity {

    /** 生成权重(测试阶段可临时改为 0.99) */
    public static final double GENERATE_WEIGHT = 0.11;

    /** 主色调 */
    public static final String MAIN_COLOR = "#eaba48";
    /** 描边色 */
    public static final String STROKE_COLOR = "#a8842c";

    /** 攻击间隔(秒) */
    private static final double ACTION_INTERVAL = 2;
    /** 闪现冷却(秒) */
    private static final double BLINK_COOLDOWN = 5;
    /** 单次闪现距离(px) */
    private static final double BLINK_DISTANCE = 260;
    /** 闪现持续时间(秒),配合距离形成超高速移动 */
    private static final double BLINK_DURATION = 0.18;
    /** 判定"即将碰到"的距离(px) */
    private static final double THREAT_RANGE = 62;
    /** 子弹来袭预判距离(px) */
    private static final double BULLET_LOOKAHEAD = 130;
    /** 子弹弹道威胁半径(px) */
    private static final double BULLET_THREAT_RANGE = 46;

    /** 四个正交射击方向(上/下/左/右) */
    private static final double[][] SHOOT_DIRECTIONS = {
            {0, 1}, {0, -1}, {-1, 0}, {1, 0}
    };

    private boolean actionLoopRunning;
    private double actionCooldownRemaining;

    /** 当前闪现状态 */
    private BlinkState blinkState;
    /** 闪现冷却剩余(秒) */
    private double blinkCooldownRemaining;

    /** 闪现状态 */
    private static final class BlinkState {
        final Geometry.Vec2 start;
        final Geometry.Vec2 target;
        final Geometry.Vec2 direction;
        double elapsed;
        final double duration;

        BlinkState(Geometry.Vec2 start, Geometry.Vec2 target, Geometry.Vec2 direction, double duration) {
            this.start = start;
            this.target = target;
            this.direction = direction;
            this.duration = duration;
        }
    }

    public GoldenDodgeXa4Npc(Geometry.Vec2 position, Long ownerId, Long teamId) {
        super(position, ownerId, teamId, "", "hostile", 0, "golden_dodge_xa4");
        this.fillColor = MAIN_COLOR;
        this.strokeColor = STROKE_COLOR;
        this.health = 1;
        this.healthMax = 1;
        this.killScore = 4;
        this.gameExp = 3;
        this.mapColor = MAIN_COLOR;
        // 击杀后概率掉落四向子弹技能与闪现技能
        this.loot.add(new Loot("skillOrb", Xa4ShootSkill.TAG, 0.4));
        this.loot.add(new Loot("skillOrb", DodgeSkill.TAG, 0.4));
    }

    @Override
    public double generateWeight() {
        return GENERATE_WEIGHT;
    }

    /** 偏好直线移动:强制以直线路径前往目标 */
    @Override
    public boolean setTarget(Geometry.Vec2 target, WorldView world, boolean preferStraight) {
        return super.setTarget(target, world, true);
    }

    /**
     * 每帧更新:有主时跟随主人;无主时做威胁检测与闪现,否则走常规游走。
     */
    @Override
    public void update(double dt, WorldView world, GameConfig config) {
        if (isDead) {
            return;
        }

        blinkCooldownRemaining = Math.max(0, blinkCooldownRemaining - dt);

        if (ownerId != null) {
            this.blinkState = null;
            followOwner(world);
            return;
        }

        // 闪现中:由闪现逻辑接管位置,不走常规寻路
        if (blinkState != null) {
            updateBlink(dt);
            return;
        }

        // 威胁检测:即将碰到玩家/其他 NPC,或迎面而来的玩家(含从者)子弹
        Geometry.Vec2 fleeDirection = detectThreat(world);
        if (fleeDirection != null && blinkCooldownRemaining <= 0) {
            startBlink(fleeDirection, world, config);
            if (blinkState != null) {
                return;
            }
        }

        super.update(dt, world, config);
    }

    /** 此行为由 actionLoop 接管,不需要无位移看门狗(对齐 TS 版) */
    @Override
    public boolean updateNoMovementWatchdog(double dt) {
        return false;
    }

    // ==================================================================
    // 攻击
    // ==================================================================

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

    /** 开始一轮行动循环:立即射击一次并重置冷却 */
    public void actionBefore(ActionContext context) {
        actionLoopRunning = true;
        action(context);
        actionCooldownRemaining = getActionInterval();
    }

    /** 当前攻击间隔(秒):随等级缩短(ACTION_INTERVAL - 0.2 × Level) */
    private double getActionInterval() {
        return Math.max(0.1, ACTION_INTERVAL - 0.2 * level);
    }

    /** 当前闪现冷却(秒):随等级缩短(BLINK_COOLDOWN - 0.4 × Level) */
    private double getBlinkCooldown() {
        return Math.max(0.1, BLINK_COOLDOWN - 0.4 * level);
    }

    /** 等级变化时重算等级相关属性(经验值随等级提升) */
    @Override
    protected void onNpcLevelApplied() {
        this.gameExp = 3 + level * 3;
    }

    /** 结束行动循环:清除运行标记与冷却 */
    public void actionAfter(ActionContext context) {
        actionLoopRunning = false;
        actionCooldownRemaining = 0;
    }

    /** 向上下左右四个方向各射出一发普通子弹 */
    public void action(ActionContext context) {
        if (context.spawnBullet == null) {
            return;
        }
        double spawnDistance = width * 0.6;
        String bulletColor = bulletColorOf(context);
        for (double[] dir : SHOOT_DIRECTIONS) {
            if (isDead) {
                return;
            }
            context.spawnBullet.accept(new BulletEntity(
                    new Geometry.Vec2(
                            position.x + dir[0] * spawnDistance,
                            position.y + dir[1] * spawnDistance),
                    new Geometry.Vec2(dir[0], dir[1]),
                    id,
                    teamId,
                    "",
                    bulletColor,
                    getBulletMoveSpeed()));
        }
    }

    // ==================================================================
    // 闪现
    // ==================================================================

    /**
     * 威胁检测:返回逃离方向(单位向量),无威胁时返回 null。
     * 覆盖"即将碰到玩家"、"即将碰到其他 NPC"与"即将被玩家/从者子弹命中"三种情况。
     */
    private Geometry.Vec2 detectThreat(WorldView world) {
        // 1. 玩家
        for (PlayerEntity player : world.players()) {
            if (player.isDead) {
                continue;
            }
            Geometry.Vec2 flee = fleeDirectionFrom(player.position.x, player.position.y);
            if (flee != null) {
                return flee;
            }
        }
        // 2. 其他 NPC
        for (DynamicEntity entity : world.npcEntities()) {
            if (entity.id == this.id || entity.isDead) {
                continue;
            }
            Geometry.Vec2 flee = fleeDirectionFrom(entity.position.x, entity.position.y);
            if (flee != null) {
                return flee;
            }
        }
        // 3. 玩家或玩家从者发射的子弹
        return detectBulletThreat(world);
    }

    /** 计算从 (ox, oy) 逃离的方向;距离超出威胁范围时返回 null */
    private Geometry.Vec2 fleeDirectionFrom(double ox, double oy) {
        double dx = position.x - ox;
        double dy = position.y - oy;
        double dist = Math.hypot(dx, dy);
        if (dist > THREAT_RANGE) {
            return null;
        }
        if (dist < 0.0001) {
            return new Geometry.Vec2(1, 0);
        }
        return new Geometry.Vec2(dx / dist, dy / dist);
    }

    /** 检测迎面而来的玩家(含从者)子弹,返回垂直于弹道的逃离方向 */
    private Geometry.Vec2 detectBulletThreat(WorldView world) {
        List<BulletEntity> bullets = world.bullets();
        if (bullets.isEmpty()) {
            return null;
        }

        // 预先收集玩家与从者的 id,避免逐颗子弹重复遍历
        Set<Long> playerIds = new HashSet<>();
        for (PlayerEntity player : world.players()) {
            playerIds.add(player.id);
        }
        Set<Long> servantIds = new HashSet<>();
        for (DynamicEntity entity : world.npcEntities()) {
            if (entity instanceof NpcEntity npc && npc.ownerId != null) {
                servantIds.add(npc.id);
            }
        }

        for (BulletEntity bullet : bullets) {
            Long ownerId = bullet.ownerId;
            if (ownerId == null) {
                continue;
            }
            if (!playerIds.contains(ownerId) && !servantIds.contains(ownerId)) {
                continue;
            }

            double dirLen = Math.hypot(bullet.facingDirection.x, bullet.facingDirection.y);
            if (dirLen < 0.0001) {
                continue;
            }
            double ux = bullet.facingDirection.x / dirLen;
            double uy = bullet.facingDirection.y / dirLen;

            double dx = position.x - bullet.position.x;
            double dy = position.y - bullet.position.y;
            double along = dx * ux + dy * uy;                 // 沿弹道方向的距离
            if (along <= 0) {
                continue;                                     // 已经飞过
            }
            if (along > BULLET_LOOKAHEAD) {
                continue;
            }
            double perp = Math.abs(dx * uy - dy * ux);        // 到弹道的垂直距离
            if (perp > BULLET_THREAT_RANGE) {
                continue;
            }

            // 朝远离弹道的垂直方向闪避
            double ox = dx - ux * along;
            double oy = dy - uy * along;
            double olen = Math.hypot(ox, oy);
            if (olen < 0.0001) {
                return new Geometry.Vec2(-uy, ux);
            }
            return new Geometry.Vec2(ox / olen, oy / olen);
        }
        return null;
    }

    /** 触发闪现:朝指定方向做一次超高速位移 */
    private void startBlink(Geometry.Vec2 direction, WorldView world, GameConfig config) {
        double len = Math.hypot(direction.x, direction.y);
        if (len < 0.0001) {
            return;
        }
        Geometry.Vec2 dir = new Geometry.Vec2(direction.x / len, direction.y / len);
        Geometry.Vec2 target = findBlinkTarget(dir, world, config);
        if (target == null) {
            return;
        }

        this.blinkState = new BlinkState(position.copy(), target, dir, BLINK_DURATION);
        // 闪现一触发即进入冷却,避免连续闪现
        this.blinkCooldownRemaining = getBlinkCooldown();

        // 清空常规寻路状态,避免与闪现位移冲突
        this.isMoving = false;
        this.stayDurationRemaining = 0;
        this.nextTarget = position.copy();
        this.targetHistory = new ArrayList<>(List.of(position.copy()));
        this.curvePoints = new ArrayList<>(List.of(position.copy()));
        this.currentCurveIndex = 0;
        clearMotionVelocity();
    }

    /** 沿闪现方向寻找一个不与静态实体/世界边界冲突的落点 */
    private Geometry.Vec2 findBlinkTarget(Geometry.Vec2 dir, WorldView world, GameConfig config) {
        int stepCount = 10;
        for (int i = stepCount; i >= 3; i--) {
            double distance = BLINK_DISTANCE * ((double) i / stepCount);
            Geometry.Vec2 target = new Geometry.Vec2(
                    position.x + dir.x * distance,
                    position.y + dir.y * distance);
            if (target.x < config.worldMinX || target.x > config.worldMaxX) {
                continue;
            }
            if (target.y < config.worldMinY || target.y > config.worldMaxY) {
                continue;
            }
            if (isPositionFree(target, world)) {
                return target;
            }
        }
        return null;
    }

    /** 位置是否不与任一静态实体重叠 */
    private boolean isPositionFree(Geometry.Vec2 pos, WorldView world) {
        double halfW = width / 2;
        double halfH = height / 2;
        List<StaticEntity> nearby = world.staticEntitiesInRect(
                pos.x - halfW, pos.y - halfH, width, height);
        for (StaticEntity se : nearby) {
            Geometry.Box box = se.collisionBox;
            boolean separated = (pos.x + halfW <= box.x) || (pos.x - halfW >= box.maxX())
                    || (pos.y + halfH <= box.y) || (pos.y - halfH >= box.maxY());
            if (!separated) {
                return false;
            }
        }
        return true;
    }

    /** 闪现位移推进:超高速移动(先快后慢),结束后恢复正常游走 */
    private void updateBlink(double dt) {
        BlinkState state = this.blinkState;
        if (state == null) {
            return;
        }
        state.elapsed = Math.min(state.duration, state.elapsed + dt);
        double t = state.duration > 0 ? state.elapsed / state.duration : 1;
        double eased = 1 - Math.pow(1 - t, 3);

        position.set(
                state.start.x + (state.target.x - state.start.x) * eased,
                state.start.y + (state.target.y - state.start.y) * eased);
        updateCollisionBox();
        facingDirection = state.direction.copy();
        lastMoveDirection = facingDirection.copy();
        isMoving = true;
        nextTarget = position.copy();
        targetHistory = new ArrayList<>(List.of(position.copy()));
        curvePoints = new ArrayList<>(List.of(position.copy()));
        currentCurveIndex = 0;
        noMoveDuration = 0;
        noMoveLastPos = position.copy();

        if (state.elapsed >= state.duration) {
            this.blinkState = null;
            this.isMoving = false;
            this.stayDurationRemaining = 0;
        }
    }
}
