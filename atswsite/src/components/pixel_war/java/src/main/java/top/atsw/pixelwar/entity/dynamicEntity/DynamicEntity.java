package top.atsw.pixelwar.entity.dynamicEntity;

import top.atsw.pixelwar.core.GameConfig;
import top.atsw.pixelwar.core.Geometry;
import top.atsw.pixelwar.entity.Entity;
import top.atsw.pixelwar.entity.WorldView;
import top.atsw.pixelwar.entity.staticEntity.StaticEntity;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 动态实体基类(由前端 TS 版 class/Entity/DynamicEntity/DynamicEntity.ts 迁移)。
 *
 * <p>涵盖运动学(加速度/空气阻力/转向响应)、路径规划(CatmullRom 平滑曲线 +
 * 静态实体绕行)、到点驻足、被静态实体挤压受伤、卡住重寻路等通用逻辑。</p>
 */
public abstract class DynamicEntity extends Entity {

    /** 死亡特效总时长(秒) */
    public static final double DEATH_EFFECT_DURATION = 0.8;

    /** 实体细分类型:'player' | 'npc' | 'bullet' | 'grenade' | 'exp_orb' | 'skill_orb' */
    public String kind;

    public double health = 1;
    public double healthMax = 1;
    /**
     * 最近一次对本实体造成伤害的来源实体 id(子弹/炸弹/触手的 ownerId)。
     * 由权威端在结算伤害前写入,供 NPC(如象牙游荡者)实现「记仇追击」。
     */
    public Long lastDamagerId = null;
    public double speed;
    public double minMoveSpeed;
    public double maxMoveSpeed;
    public double movementPassion = 1;
    public double wanderRange;
    public double perceptionRange;

    public Geometry.Vec2 motionVelocity = new Geometry.Vec2(0, 0);
    public Geometry.Vec2 facingDirection = new Geometry.Vec2(0, 1);
    public Geometry.Vec2 lastMoveDirection;
    public boolean isMoving;
    public Geometry.Vec2 nextTarget;
    public List<Geometry.Vec2> targetHistory = new ArrayList<>();
    public List<Geometry.Vec2> curvePoints = new ArrayList<>();
    public int currentCurveIndex;
    public double stayDurationRemaining;

    public boolean isDead;
    public double deathEffectTimer;
    public double damageFlashTimer;
    /** 游戏经验值(死亡时按比例掉落为经验球) */
    public double gameExp;
    /** 死亡经验是否已结算(防止重复掉落经验球) */
    public boolean deathExpProcessed;
    /** 死亡战利品是否已结算(NPC 使用) */
    public boolean deathLootProcessed;

    public double insideStaticDamageTimer;
    public boolean wasInsideStaticEntity;
    public double insideStaticRetargetCD;
    public double insideStaticBlockedTimer;

    public double crowdStuckTimer;
    public double crowdRetargetCooldown;
    public Geometry.Vec2 lastStuckCheckPos;
    public Geometry.Vec2 noMoveLastPos;
    public double noMoveDuration;

    protected double motionAccelerationRate = 7.2;
    protected double motionAirDrag = 7.6;
    protected double motionStopSpeed = 8;
    protected double motionTurnResponsiveness = 1.8;

    protected DynamicEntity(Geometry.Vec2 position, double width, double height, String name,
                            String kind, String tag) {
        super("dynamic", position, width, height, name, tag);
        this.kind = kind;
        double speedA = 10 + Math.random() * 190;
        double speedB = 10 + Math.random() * 190;
        this.minMoveSpeed = Math.min(speedA, speedB);
        this.maxMoveSpeed = Math.max(speedA, speedB);
        this.speed = this.minMoveSpeed;
        this.wanderRange = 30 * ((width / 2) + (height / 2));
        this.perceptionRange = 8 * ((width / 2) + (height / 2));
        this.refreshMoveSpeedForNewTarget();
        this.nextTarget = position.copy();
        this.targetHistory = new ArrayList<>(List.of(position.copy()));
        this.curvePoints = new ArrayList<>();
        this.lastMoveDirection = null;
        this.lastStuckCheckPos = position.copy();
        this.noMoveLastPos = position.copy();
    }

    // ==================================================================
    // 生命值与死亡
    // ==================================================================

    /** 受到伤害(生命值归零时触发死亡) */
    public void applyDamage(double amount) {
        if (amount <= 0 || isDead) {
            return;
        }
        health = Math.max(0, health - amount);
        damageFlashTimer = Math.max(damageFlashTimer, 0.25);
        if (health <= 0) {
            triggerDeath();
        }
    }

    public void updateDamageEffect(double dt) {
        if (damageFlashTimer <= 0) {
            return;
        }
        damageFlashTimer = Math.max(0, damageFlashTimer - dt);
    }

    public void updateDeathEffect(double dt) {
        if (!isDead || deathEffectTimer <= 0) {
            return;
        }
        deathEffectTimer = Math.max(0, deathEffectTimer - dt);
    }

    public boolean isDeathEffectFinished() {
        return isDead && deathEffectTimer <= 0;
    }

    /** 触发死亡并重置死亡结算标记 */
    public void triggerDeath() {
        this.isDead = true;
        this.isMoving = false;
        this.stayDurationRemaining = 0;
        this.insideStaticDamageTimer = 0;
        this.wasInsideStaticEntity = false;
        this.insideStaticBlockedTimer = 0;
        this.crowdStuckTimer = 0;
        this.curvePoints = new ArrayList<>(List.of(position.copy()));
        this.targetHistory = new ArrayList<>(List.of(position.copy()));
        this.currentCurveIndex = 0;
        this.nextTarget = position.copy();
        clearMotionVelocity();
        this.deathEffectTimer = DEATH_EFFECT_DURATION;
        // 标记本次死亡的经验/战利品尚未结算,等待服务端掉落
        this.deathExpProcessed = false;
        this.deathLootProcessed = false;
    }

    // ==================================================================
    // 运动学
    // ==================================================================

    /** 每次运动到新目标前刷新速度参数 */
    protected void refreshMoveSpeedForNewTarget() {
        this.movementPassion = 0.8 + Math.random() * 0.4;
        double baseSpeed = minMoveSpeed + Math.random() * (maxMoveSpeed - minMoveSpeed);
        this.speed = baseSpeed * movementPassion;
    }

    protected void clearMotionVelocity() {
        motionVelocity.x = 0;
        motionVelocity.y = 0;
    }

    protected boolean hasMotionVelocity() {
        return Math.hypot(motionVelocity.x, motionVelocity.y) > motionStopSpeed;
    }

    protected double easeMotionRatio(double ratio) {
        double t = Geometry.clamp(ratio, 0, 1);
        return t * t * (3 - 2 * t);
    }

    /** 按目标方向加速(带转向增益与加速度曲线) */
    protected void updateMotionVelocity(Geometry.Vec2 direction, double maxSpeed, double dt) {
        double safeDt = Geometry.clamp(dt, 0, 0.05);
        double safeMaxSpeed = Math.max(0, maxSpeed);
        if (safeDt <= 0 || safeMaxSpeed <= 0) {
            clearMotionVelocity();
            return;
        }

        double dirLen = direction == null ? 0 : Math.hypot(direction.x, direction.y);
        if (direction == null || dirLen < 0.0001) {
            applyAirResistance(safeDt);
            return;
        }

        double dirX = direction.x / dirLen;
        double dirY = direction.y / dirLen;
        double targetVelocityX = dirX * safeMaxSpeed;
        double targetVelocityY = dirY * safeMaxSpeed;

        double currentSpeed = Math.hypot(motionVelocity.x, motionVelocity.y);
        double speedRatio = Geometry.clamp(currentSpeed / safeMaxSpeed, 0, 1);
        double accelerationCurve = 1 - easeMotionRatio(speedRatio);
        double acceleration = safeMaxSpeed * motionAccelerationRate * Math.max(0.16, accelerationCurve);

        double currentDirX = currentSpeed > 0.0001 ? motionVelocity.x / currentSpeed : dirX;
        double currentDirY = currentSpeed > 0.0001 ? motionVelocity.y / currentSpeed : dirY;
        double directionDot = Geometry.clamp(currentDirX * dirX + currentDirY * dirY, -1, 1);
        double turnBoost = 1 + (1 - directionDot) * motionTurnResponsiveness;
        double maxDelta = acceleration * safeDt * turnBoost;

        double diffX = targetVelocityX - motionVelocity.x;
        double diffY = targetVelocityY - motionVelocity.y;
        double diffLen = Math.hypot(diffX, diffY);

        if (diffLen <= maxDelta) {
            motionVelocity.set(targetVelocityX, targetVelocityY);
            return;
        }

        motionVelocity.x += diffX / diffLen * maxDelta;
        motionVelocity.y += diffY / diffLen * maxDelta;
    }

    protected void applyAirResistance(double dt) {
        double damping = Math.exp(-motionAirDrag * Geometry.clamp(dt, 0, 0.05));
        motionVelocity.x *= damping;
        motionVelocity.y *= damping;
        if (!hasMotionVelocity()) {
            clearMotionVelocity();
        }
    }

    protected Geometry.Vec2 getMotionDisplacement(double dt) {
        return new Geometry.Vec2(motionVelocity.x * dt, motionVelocity.y * dt);
    }

    // ==================================================================
    // 路径规划
    // ==================================================================

    /** 根据 targetHistory 生成平滑路径点(CatmullRom 样条采样) */
    public void generateSmoothPath() {
        List<Geometry.Vec2> points = targetHistory;
        if (points.size() < 2) {
            curvePoints = new ArrayList<>(List.of(position.copy()));
            return;
        }

        int segmentsPerSpan = 15;
        List<Geometry.Vec2> extended = new ArrayList<>(points);
        extended.add(0, new Geometry.Vec2(
                points.get(0).x - (points.get(1).x - points.get(0).x),
                points.get(0).y - (points.get(1).y - points.get(0).y)));
        int last = points.size() - 1;
        extended.add(new Geometry.Vec2(
                points.get(last).x + (points.get(last).x - points.get(last - 1).x),
                points.get(last).y + (points.get(last).y - points.get(last - 1).y)));

        List<Geometry.Vec2> samples = new ArrayList<>();
        for (int i = 1; i < extended.size() - 2; i++) {
            Geometry.Vec2 p0 = extended.get(i - 1);
            Geometry.Vec2 p1 = extended.get(i);
            Geometry.Vec2 p2 = extended.get(i + 1);
            Geometry.Vec2 p3 = extended.get(i + 2);
            for (int s = 0; s <= segmentsPerSpan; s++) {
                double t = (double) s / segmentsPerSpan;
                double t2 = t * t;
                double t3 = t2 * t;
                double x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t
                        + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
                        + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
                double y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t
                        + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
                        + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
                samples.add(new Geometry.Vec2(x, y));
            }
        }
        samples.add(points.get(last).copy());
        this.curvePoints = samples;
    }

    /** 把静态实体按实体半径外扩,便于判定避障 */
    private List<Geometry.Box> getInflatedStaticBoxes(List<StaticEntity> nearby, double extraPadding) {
        double inflateX = width / 2 + extraPadding;
        double inflateY = height / 2 + extraPadding;
        List<Geometry.Box> boxes = new ArrayList<>(nearby.size());
        for (StaticEntity se : nearby) {
            boxes.add(new Geometry.Box(
                    se.collisionBox.x - inflateX,
                    se.collisionBox.y - inflateY,
                    se.collisionBox.width + inflateX * 2,
                    se.collisionBox.height + inflateY * 2));
        }
        return boxes;
    }

    private boolean isPointBlocked(Geometry.Vec2 point, List<Geometry.Box> boxes) {
        for (Geometry.Box box : boxes) {
            if (box.contains(point.x, point.y)) {
                return true;
            }
        }
        return false;
    }

    /** 线段与 AABB 相交检测(Liang-Barsky) */
    private boolean isSegmentIntersectBox(Geometry.Vec2 a, Geometry.Vec2 b, Geometry.Box box) {
        double xMin = box.x;
        double xMax = box.maxX();
        double yMin = box.y;
        double yMax = box.maxY();

        double dx = b.x - a.x;
        double dy = b.y - a.y;
        double[] p = {-dx, dx, -dy, dy};
        double[] q = {a.x - xMin, xMax - a.x, a.y - yMin, yMax - a.y};

        double t0 = 0;
        double t1 = 1;
        for (int i = 0; i < 4; i++) {
            if (Math.abs(p[i]) < 1e-9) {
                if (q[i] < 0) {
                    return false;
                }
                continue;
            }
            double r = q[i] / p[i];
            if (p[i] < 0) {
                if (r > t1) {
                    return false;
                }
                if (r > t0) {
                    t0 = r;
                }
            } else {
                if (r < t0) {
                    return false;
                }
                if (r < t1) {
                    t1 = r;
                }
            }
        }
        return t0 <= t1;
    }

    private boolean isSegmentBlocked(Geometry.Vec2 a, Geometry.Vec2 b, List<Geometry.Box> boxes) {
        if (Math.hypot(b.x - a.x, b.y - a.y) < 0.001) {
            return isPointBlocked(a, boxes);
        }
        for (Geometry.Box box : boxes) {
            if (box.contains(a.x, a.y) || box.contains(b.x, b.y) || isSegmentIntersectBox(a, b, box)) {
                return true;
            }
        }
        return false;
    }

    /** 静态实体绕行路径规划:直达 -> 单拐点 -> 双拐点 */
    private List<Geometry.Vec2> buildAvoidancePath(Geometry.Vec2 target, WorldView world) {
        Geometry.Vec2 start = position.copy();
        List<StaticEntity> nearby = world.staticEntitiesInRect(
                Math.min(start.x, target.x) - wanderRange,
                Math.min(start.y, target.y) - wanderRange,
                Math.abs(target.x - start.x) + wanderRange * 2,
                Math.abs(target.y - start.y) + wanderRange * 2);
        List<Geometry.Box> boxes = getInflatedStaticBoxes(nearby, 8);

        if (isPointBlocked(start, boxes) || isPointBlocked(target, boxes)) {
            return null;
        }
        if (!isSegmentBlocked(start, target, boxes)) {
            return new ArrayList<>(List.of(start, target));
        }

        double clearance = 18;
        List<Geometry.Vec2> candidates = new ArrayList<>();
        for (Geometry.Box box : boxes) {
            candidates.add(new Geometry.Vec2(box.x - clearance, box.y - clearance));
            candidates.add(new Geometry.Vec2(box.maxX() + clearance, box.y - clearance));
            candidates.add(new Geometry.Vec2(box.x - clearance, box.maxY() + clearance));
            candidates.add(new Geometry.Vec2(box.maxX() + clearance, box.maxY() + clearance));
        }
        candidates.removeIf(p -> isPointBlocked(p, boxes));
        candidates.sort((a, b) -> Double.compare(
                Math.hypot(start.x - a.x, start.y - a.y) + Math.hypot(target.x - a.x, target.y - a.y),
                Math.hypot(start.x - b.x, start.y - b.y) + Math.hypot(target.x - b.x, target.y - b.y)));

        int oneHopLimit = Math.min(candidates.size(), 40);
        for (int i = 0; i < oneHopLimit; i++) {
            Geometry.Vec2 wp = candidates.get(i);
            if (!isSegmentBlocked(start, wp, boxes) && !isSegmentBlocked(wp, target, boxes)) {
                return new ArrayList<>(List.of(start, wp, target));
            }
        }

        int twoHopLimit = Math.min(candidates.size(), 18);
        for (int i = 0; i < twoHopLimit; i++) {
            Geometry.Vec2 wp1 = candidates.get(i);
            if (isSegmentBlocked(start, wp1, boxes)) {
                continue;
            }
            for (int j = 0; j < twoHopLimit; j++) {
                if (i == j) {
                    continue;
                }
                Geometry.Vec2 wp2 = candidates.get(j);
                if (!isSegmentBlocked(wp1, wp2, boxes) && !isSegmentBlocked(wp2, target, boxes)) {
                    return new ArrayList<>(List.of(start, wp1, wp2, target));
                }
            }
        }
        return null;
    }

    /** 把折线路径采样成连续点,避免长线段下运动步进过粗 */
    private List<Geometry.Vec2> buildPolylineSamples(List<Geometry.Vec2> points, double stepLen) {
        List<Geometry.Vec2> samples = new ArrayList<>();
        if (points.size() <= 1) {
            for (Geometry.Vec2 p : points) {
                samples.add(p.copy());
            }
            return samples;
        }
        samples.add(points.get(0).copy());
        for (int i = 0; i < points.size() - 1; i++) {
            Geometry.Vec2 a = points.get(i);
            Geometry.Vec2 b = points.get(i + 1);
            double dx = b.x - a.x;
            double dy = b.y - a.y;
            double dist = Math.hypot(dx, dy);
            if (dist < 0.001) {
                continue;
            }
            int steps = Math.max(1, (int) Math.ceil(dist / stepLen));
            for (int s = 1; s <= steps; s++) {
                double t = (double) s / steps;
                samples.add(new Geometry.Vec2(a.x + dx * t, a.y + dy * t));
            }
        }
        return samples;
    }

    private boolean isPathClear(List<Geometry.Vec2> points, List<Geometry.Box> boxes) {
        if (points.size() < 2) {
            return true;
        }
        for (int i = 0; i < points.size() - 1; i++) {
            if (isSegmentBlocked(points.get(i), points.get(i + 1), boxes)) {
                return false;
            }
        }
        return true;
    }

    /** 对避障折线做圆角化,尽量保持曲线观感;若圆角后不安全则回退为原折线 */
    private List<Geometry.Vec2> buildRoundedAvoidanceSamples(List<Geometry.Vec2> points, List<Geometry.Box> boxes) {
        if (points.size() <= 2) {
            return buildPolylineSamples(points, 12);
        }
        List<Geometry.Vec2> rounded = new ArrayList<>();
        rounded.add(points.get(0).copy());
        for (int i = 1; i < points.size() - 1; i++) {
            Geometry.Vec2 prev = points.get(i - 1);
            Geometry.Vec2 curr = points.get(i);
            Geometry.Vec2 next = points.get(i + 1);

            double inDx = prev.x - curr.x;
            double inDy = prev.y - curr.y;
            double outDx = next.x - curr.x;
            double outDy = next.y - curr.y;
            double inLen = Math.hypot(inDx, inDy);
            double outLen = Math.hypot(outDx, outDy);
            if (inLen < 0.001 || outLen < 0.001) {
                rounded.add(curr.copy());
                continue;
            }
            double cut = Math.min(22, Math.min(inLen * 0.35, outLen * 0.35));
            if (cut < 4) {
                rounded.add(curr.copy());
                continue;
            }
            Geometry.Vec2 entry = new Geometry.Vec2(curr.x + (inDx / inLen) * cut, curr.y + (inDy / inLen) * cut);
            Geometry.Vec2 exit = new Geometry.Vec2(curr.x + (outDx / outLen) * cut, curr.y + (outDy / outLen) * cut);
            rounded.add(entry);
            int curveSteps = 6;
            for (int s = 1; s < curveSteps; s++) {
                double t = (double) s / curveSteps;
                double omt = 1 - t;
                rounded.add(new Geometry.Vec2(
                        omt * omt * entry.x + 2 * omt * t * curr.x + t * t * exit.x,
                        omt * omt * entry.y + 2 * omt * t * curr.y + t * t * exit.y));
            }
            rounded.add(exit);
        }
        rounded.add(points.get(points.size() - 1).copy());

        if (isPathClear(rounded, boxes)) {
            return buildPolylineSamples(rounded, 8);
        }
        return buildPolylineSamples(points, 12);
    }

    /**
     * 设置新的目标点(自动绕开静态实体)。
     *
     * @param preferStraight 为 true 时不做弯曲塑形,直接走折线(用于需要精确靠近的场景)
     * @return 是否成功规划出路径
     */
    public boolean setTarget(Geometry.Vec2 target, WorldView world, boolean preferStraight) {
        Geometry.Vec2 currentPos = position.copy();
        double dx = target.x - currentPos.x;
        double dy = target.y - currentPos.y;
        double distance = Math.hypot(dx, dy);
        if (distance < 0.1) {
            return false;
        }

        List<Geometry.Vec2> plannedPath = buildAvoidancePath(target, world);
        if (plannedPath == null) {
            return false;
        }

        refreshMoveSpeedForNewTarget();

        List<Geometry.Vec2> newHistory = new ArrayList<>();
        if (plannedPath.size() == 2 && !preferStraight && lastMoveDirection != null) {
            double tailLen = Math.min(Math.max(distance * 0.2, 20), 80);
            newHistory.add(new Geometry.Vec2(
                    currentPos.x - lastMoveDirection.x * tailLen,
                    currentPos.y - lastMoveDirection.y * tailLen));
        }
        newHistory.add(currentPos);

        List<StaticEntity> nearby = world.staticEntitiesInRect(
                Math.min(currentPos.x, target.x) - wanderRange, Math.min(currentPos.y, target.y) - wanderRange,
                Math.abs(target.x - currentPos.x) + wanderRange * 2, Math.abs(target.y - currentPos.y) + wanderRange * 2);
        List<Geometry.Box> inflatedBoxes = getInflatedStaticBoxes(nearby, 8);

        if (plannedPath.size() == 2 && !preferStraight && distance > 30) {
            double midX = (currentPos.x + target.x) / 2;
            double midY = (currentPos.y + target.y) / 2;
            double invLen = 1 / distance;
            double perpX = -dy * invLen;
            double perpY = dx * invLen;

            double bendSign = (id % 2 == 0) ? 1 : -1;
            if (lastMoveDirection != null) {
                double cross = lastMoveDirection.x * dy - lastMoveDirection.y * dx;
                if (Math.abs(cross) > 0.001) {
                    bendSign = cross >= 0 ? 1 : -1;
                }
            }
            double bend = Math.min(distance * 0.25, 120);
            Geometry.Vec2 bendPoint = new Geometry.Vec2(
                    midX + perpX * bend * bendSign,
                    midY + perpY * bend * bendSign);
            boolean bendIsSafe = !isPointBlocked(bendPoint, inflatedBoxes)
                    && !isSegmentBlocked(currentPos, bendPoint, inflatedBoxes)
                    && !isSegmentBlocked(bendPoint, target, inflatedBoxes);
            if (bendIsSafe) {
                newHistory.add(bendPoint);
            }
        } else {
            for (int i = 1; i < plannedPath.size() - 1; i++) {
                newHistory.add(plannedPath.get(i).copy());
            }
        }
        newHistory.add(target.copy());
        this.targetHistory = newHistory;

        if (plannedPath.size() == 2 && !preferStraight) {
            generateSmoothPath();
            if (curvePoints.size() > 1) {
                int startIndex = 0;
                double minDist = Double.MAX_VALUE;
                for (int i = 0; i < curvePoints.size(); i++) {
                    Geometry.Vec2 p = curvePoints.get(i);
                    double d = Math.hypot(p.x - currentPos.x, p.y - currentPos.y);
                    if (d < minDist) {
                        minDist = d;
                        startIndex = i;
                    }
                }
                if (startIndex >= curvePoints.size() - 1) {
                    startIndex = curvePoints.size() - 2;
                }
                if (startIndex > 0) {
                    curvePoints = new ArrayList<>(curvePoints.subList(startIndex, curvePoints.size()));
                }
                curvePoints.set(0, currentPos.copy());
            }
        } else {
            List<Geometry.Vec2> samples = buildRoundedAvoidanceSamples(newHistory, inflatedBoxes);
            if (samples.isEmpty()) {
                samples = new ArrayList<>(List.of(currentPos.copy()));
            } else {
                samples.set(0, currentPos.copy());
            }
            this.curvePoints = samples;
        }

        currentCurveIndex = 0;
        isMoving = true;
        stayDurationRemaining = 0;
        insideStaticBlockedTimer = 0;
        crowdStuckTimer = 0;
        noMoveDuration = 0;
        noMoveLastPos = position.copy();
        nextTarget = target;
        return true;
    }

    /** 常规寻路失败时的兜底:优先脱离静态实体,否则尝试近邻随机点 */
    public boolean tryFallbackTarget(WorldView world) {
        Geometry.Vec2 current = position.copy();

        if (isInsideStaticEntity(world)) {
            double bestScore = Double.NEGATIVE_INFINITY;
            Geometry.Vec2 bestDir = null;
            double angleStep = Math.PI / 8;
            double escapeDistance = Math.max(width, height) * 1.2;
            double currentOverlap = getTotalStaticOverlap(current, world);
            for (double a = 0; a < Math.PI * 2; a += angleStep) {
                Geometry.Vec2 dir = Geometry.fromAngle(a);
                Geometry.Vec2 probe = new Geometry.Vec2(
                        current.x + dir.x * escapeDistance,
                        current.y + dir.y * escapeDistance);
                double overlap = getTotalStaticOverlap(probe, world);
                double score = currentOverlap - overlap;
                if (score > bestScore) {
                    bestScore = score;
                    bestDir = dir;
                }
            }
            if (bestDir != null && bestScore > 0.0001) {
                position.set(current.x + bestDir.x * escapeDistance, current.y + bestDir.y * escapeDistance);
                updateCollisionBox();
                noMoveDuration = 0;
                noMoveLastPos = position.copy();
                facingDirection = bestDir.copy();
                isMoving = false;
                nextTarget = position.copy();
                return true;
            }
        }

        double[] radiusList = {80, 140, 200};
        for (double radius : radiusList) {
            for (int i = 0; i < 12; i++) {
                double angle = Math.random() * Math.PI * 2;
                Geometry.Vec2 probe = new Geometry.Vec2(
                        current.x + Math.cos(angle) * radius,
                        current.y + Math.sin(angle) * radius);
                if (setTarget(probe, world, false)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** 到点后随机驻足 0~5 秒 */
    private void enterStayStateAfterArrival() {
        isMoving = false;
        nextTarget = position.copy();
        targetHistory = new ArrayList<>(List.of(position.copy()));
        curvePoints = new ArrayList<>(List.of(position.copy()));
        currentCurveIndex = 0;
        insideStaticBlockedTimer = 0;
        crowdStuckTimer = 0;
        noMoveLastPos = position.copy();
        stayDurationRemaining = Math.random() * 5;
    }

    public void updateStayDuration(double dt) {
        if (isDead || isMoving || stayDurationRemaining <= 0) {
            return;
        }
        stayDurationRemaining = Math.max(0, stayDurationRemaining - dt);
    }

    /** 停止移动 */
    public void stop() {
        isMoving = false;
        nextTarget = position.copy();
        targetHistory = new ArrayList<>(List.of(position.copy()));
        curvePoints = new ArrayList<>(List.of(position.copy()));
        currentCurveIndex = 0;
        insideStaticBlockedTimer = 0;
        crowdStuckTimer = 0;
        noMoveLastPos = position.copy();
        clearMotionVelocity();
    }

    // ==================================================================
    // 每帧更新
    // ==================================================================

    /** 位置更新(基于 dt 秒):沿平滑路径推进并做静态碰撞判定 */
    public void update(double dt, WorldView world, GameConfig config) {
        if (isDead) {
            return;
        }
        boolean hasPathIntent = isMoving && !curvePoints.isEmpty();
        if (!hasPathIntent && !hasMotionVelocity()) {
            return;
        }
        Geometry.Vec2 oldPos = position.copy();
        Geometry.Vec2 newPos = position.copy();

        if (hasPathIntent && currentCurveIndex >= curvePoints.size() - 1) {
            enterStayStateAfterArrival();
        }

        if (isMoving && currentCurveIndex < curvePoints.size() - 1) {
            Geometry.Vec2 end = curvePoints.get(currentCurveIndex + 1);
            double dx = end.x - newPos.x;
            double dy = end.y - newPos.y;
            double distanceToEnd = Math.hypot(dx, dy);
            if (distanceToEnd > 0.0001) {
                updateMotionVelocity(new Geometry.Vec2(dx / distanceToEnd, dy / distanceToEnd), speed, dt);
            } else {
                currentCurveIndex++;
            }
        } else {
            updateMotionVelocity(null, speed, dt);
        }

        double remaining = Math.hypot(motionVelocity.x, motionVelocity.y) * dt;
        while (remaining > 0 && isMoving && currentCurveIndex < curvePoints.size() - 1) {
            Geometry.Vec2 end = curvePoints.get(currentCurveIndex + 1);
            double dx = end.x - newPos.x;
            double dy = end.y - newPos.y;
            double distanceToEnd = Math.hypot(dx, dy);
            if (distanceToEnd <= remaining) {
                newPos.set(end);
                remaining -= distanceToEnd;
                currentCurveIndex++;
            } else {
                double ratio = remaining / distanceToEnd;
                newPos.set(newPos.x + dx * ratio, newPos.y + dy * ratio);
                remaining = 0;
            }
        }

        if (!isMoving && hasMotionVelocity()) {
            Geometry.Vec2 displacement = getMotionDisplacement(dt);
            newPos.set(newPos.x + displacement.x, newPos.y + displacement.y);
        }

        if (Math.hypot(newPos.x - oldPos.x, newPos.y - oldPos.y) <= 0.0001) {
            return;
        }

        // 碰撞检测:若已挤在静态实体内,允许"减少重叠"的位移以便脱困
        double oldOverlap = getTotalStaticOverlap(position, world);
        double newOverlap = getTotalStaticOverlap(newPos, world);
        boolean collided = newOverlap > 0.0001 && newOverlap + 0.0001 >= oldOverlap;

        if (!collided) {
            insideStaticBlockedTimer = 0;
            position.set(newPos);
            updateCollisionBox();
            double moveDx = position.x - oldPos.x;
            double moveDy = position.y - oldPos.y;
            double moveDistance = Math.hypot(moveDx, moveDy);
            if (moveDistance > 0.0001) {
                Geometry.Vec2 moveDirection = new Geometry.Vec2(moveDx / moveDistance, moveDy / moveDistance);
                lastMoveDirection = moveDirection;
                facingDirection = moveDirection.copy();
            }
            if (isMoving && currentCurveIndex >= curvePoints.size() - 1) {
                enterStayStateAfterArrival();
            }
        } else if (oldOverlap <= 0.0001) {
            stop();
            curvePoints = new ArrayList<>(List.of(position.copy()));
            currentCurveIndex = 0;
            lastMoveDirection = null;
        } else {
            insideStaticBlockedTimer += dt;
            if (insideStaticBlockedTimer >= 0.4) {
                isMoving = false;
                insideStaticBlockedTimer = 0;
            }
        }
    }

    /** 群体拥挤导致的停滞检测:长时间几乎不动时打断运动以触发重寻路 */
    public void updateCrowdStuckState(double dt) {
        if (isDead) {
            return;
        }
        crowdRetargetCooldown = Math.max(0, crowdRetargetCooldown - dt);
        double moved = Math.hypot(position.x - lastStuckCheckPos.x, position.y - lastStuckCheckPos.y);
        lastStuckCheckPos = position.copy();
        if (!isMoving) {
            crowdStuckTimer = 0;
            return;
        }
        if (moved < 0.2) {
            crowdStuckTimer += dt;
        } else {
            crowdStuckTimer = 0;
            return;
        }
        if (crowdStuckTimer >= 1.2 && crowdRetargetCooldown <= 0) {
            isMoving = false;
            stayDurationRemaining = 0;
            crowdStuckTimer = 0;
            crowdRetargetCooldown = 0.8 + Math.random() * 0.8;
        }
    }

    /** 超过 10 秒未位移则触发重新寻路 */
    public boolean updateNoMovementWatchdog(double dt) {
        if (isDead) {
            return false;
        }
        double moved = Math.hypot(position.x - noMoveLastPos.x, position.y - noMoveLastPos.y);
        if (moved > 0.5) {
            noMoveDuration = 0;
            noMoveLastPos = position.copy();
            return false;
        }
        noMoveDuration += dt;
        if (noMoveDuration >= 10) {
            noMoveDuration = 0;
            noMoveLastPos = position.copy();
            isMoving = false;
            stayDurationRemaining = 0;
            insideStaticRetargetCD = 0;
            return true;
        }
        return false;
    }

    // ==================================================================
    // 静态实体挤压
    // ==================================================================

    /** 当前是否在任一静态实体内部 */
    public boolean isInsideStaticEntity(WorldView world) {
        double range = Math.max(width, height);
        List<StaticEntity> nearby = world.staticEntitiesInRect(
                position.x - range, position.y - range, range * 2, range * 2);
        return getTotalStaticOverlap(position, nearby) > 0.0001;
    }

    /** 实体碰撞盒与静态实体的重叠面积(传附近实体列表以走空间索引) */
    public double getTotalStaticOverlap(Geometry.Vec2 pos, WorldView world) {
        double range = Math.max(width, height) * 2;
        List<StaticEntity> nearby = world.staticEntitiesInRect(
                pos.x - range, pos.y - range, range * 2, range * 2);
        return getTotalStaticOverlap(pos, nearby);
    }

    private double getTotalStaticOverlap(Geometry.Vec2 pos, List<StaticEntity> statics) {
        Geometry.Box box = new Geometry.Box(pos.x - width / 2, pos.y - height / 2, width, height);
        double total = 0;
        for (StaticEntity se : statics) {
            total += box.overlapArea(se.collisionBox);
        }
        return total;
    }

    /** 被挤压在静态实体中时:首次立即受伤,之后每 1 秒扣 2 点血 */
    public void updateStaticCompressionEffects(double dt, WorldView world) {
        if (isDead) {
            return;
        }
        double range = Math.max(width, height) * 2;
        List<StaticEntity> nearby = world.staticEntitiesInRect(
                position.x - range, position.y - range, range * 2, range * 2);
        boolean insideNow = getTotalStaticOverlap(position, nearby) > 0.0001;

        if (!insideNow) {
            insideStaticDamageTimer = 0;
            wasInsideStaticEntity = false;
            return;
        }
        if (!wasInsideStaticEntity) {
            applyDamage(2);
            insideStaticDamageTimer = 0;
            wasInsideStaticEntity = true;
        }
        insideStaticDamageTimer += dt;
        while (insideStaticDamageTimer >= 1) {
            insideStaticDamageTimer -= 1;
            applyDamage(2);
        }
    }

    /** 当前是否可分配新的游走目标(被挤压时做 1 秒节流,避免疯狂重算) */
    public boolean canGetNewWanderTarget(double dt, WorldView world) {
        if (isDead || isMoving || stayDurationRemaining > 0) {
            return false;
        }
        if (!isInsideStaticEntity(world)) {
            insideStaticRetargetCD = 0;
            return true;
        }
        insideStaticRetargetCD = Math.max(0, insideStaticRetargetCD - dt);
        if (insideStaticRetargetCD <= 0) {
            insideStaticRetargetCD = 1;
            return true;
        }
        return false;
    }

    /** 供子类使用的不可变视图(调试/快照) */
    public List<Geometry.Vec2> curvePointsView() {
        return Collections.unmodifiableList(curvePoints);
    }
}
