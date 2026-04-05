import { Entity } from '../Entity';
import { StaticEntity } from '../StaticEntity/StaticEntity';
import type { CollisionBox, Point } from '../../../interface/InterfaceTest2d';
import type { DynamicEntityKind } from '../../../type/TypeTest2d';

class DynamicEntity extends Entity {
  kind: DynamicEntityKind;      // 动态实体类别
  nextTarget: Point;            // 下一刻要去的地点-世界坐标
  health: number;               // 生命值
  speed: number;                // 当前有效移动速度-单位/秒
  wanderRange: number;          // 随机游走半径（固定属性）
  perceptionRange: number;      // 感知范围（固定属性）
  minMoveSpeed: number;         // 最小运动速度（固定属性，10~200）
  maxMoveSpeed: number;         // 最大运动速度（固定属性，10~200）
  movementPassion: number;      // 运动激情值（每次换目标重置，80%~120%）
  isMoving: boolean;
  facingDirection: Point;       // 朝向矢量（单位向量，世界坐标）
  stayDurationRemaining: number; // 到点后随机驻足剩余时间（秒）
  targetHistory: Point[];       // 目标点历史记录
  curvePoints: Point[];         // 平滑路径采样点
  currentCurveIndex: number;    // 当前路径上的索引
  lastMoveDirection: Point | null; // 上一段移动的单位方向，用于路径衔接
  insideStaticDamageTimer: number; // 被挤压在静态实体内的伤害计时器
  wasInsideStaticEntity: boolean; // 上一帧是否处于静态实体内部
  insideStaticRetargetCooldown: number; // 被挤压时重新寻路冷却（秒）
  insideStaticBlockedTimer: number; // 被挤压且无法前进时的阻塞计时器
  damageFlashTimer: number; // 受伤发红特效计时器（秒）
  crowdStuckTimer: number; // 动态实体群体拥挤导致停滞的计时器
  crowdRetargetCooldown: number; // 停滞后重新寻路冷却，避免所有实体同频
  lastStuckCheckPos: Point; // 用于判断是否卡住的上一帧位置
  noMoveDuration: number; // 连续未位移时长（秒）
  noMoveLastPos: Point; // 未位移检测的上一位置
  isDead: boolean; // 是否已死亡
  deathEffectTimer: number; // 死亡特效剩余时长（秒）
  deathEffectDuration: number; // 死亡特效总时长（秒）

  constructor(
    position: Point,
    width: number,
    height: number,
    texturePath: string,
    name: string,
    kind: DynamicEntityKind,
    tag?: string
  ) {
    super('dynamic', position, width, height, texturePath, name, tag);
    this.kind = kind;
    const speedA = 10 + Math.random() * 190;
    const speedB = 10 + Math.random() * 190;
    this.minMoveSpeed = Math.min(speedA, speedB);
    this.maxMoveSpeed = Math.max(speedA, speedB);
    this.movementPassion = 1;
    this.health = 100;
    this.speed = this.minMoveSpeed;
    this.wanderRange = 30 * ((this.width / 2) + (this.height / 2));
    this.perceptionRange = 8 * ((this.width / 2) + (this.height / 2));
    this.refreshMoveSpeedForNewTarget();
    this.nextTarget = { ...position };
    this.isMoving = false;
    this.facingDirection = { x: 0, y: 1 }; // 默认朝北（向上）
    this.stayDurationRemaining = 0;
    this.targetHistory = [{ ...position }];
    this.curvePoints = [];
    this.currentCurveIndex = 0;
    this.lastMoveDirection = null;
    this.insideStaticDamageTimer = 0;
    this.wasInsideStaticEntity = false;
    this.insideStaticRetargetCooldown = 0;
    this.insideStaticBlockedTimer = 0;
    this.damageFlashTimer = 0;
    this.crowdStuckTimer = 0;
    this.crowdRetargetCooldown = 0;
    this.lastStuckCheckPos = { ...position };
    this.noMoveDuration = 0;
    this.noMoveLastPos = { ...position };
    this.isDead = false;
    this.deathEffectDuration = 0.8;
    this.deathEffectTimer = 0;
  }

  applyDamage(amount: number) {
    if (amount <= 0 || this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    // 受伤后触发短暂红色闪烁
    this.damageFlashTimer = Math.max(this.damageFlashTimer, 0.25);
    if (this.health <= 0) {
      this.triggerDeath();
    }
  }

  updateDamageEffect(dt: number) {
    if (this.damageFlashTimer <= 0) return;
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
  }

  updateDeathEffect(dt: number) {
    if (!this.isDead || this.deathEffectTimer <= 0) return;
    this.deathEffectTimer = Math.max(0, this.deathEffectTimer - dt);
  }

  isDeathEffectFinished() {
    return this.isDead && this.deathEffectTimer <= 0;
  }

  private triggerDeath() {
    this.isDead = true;
    this.isMoving = false;
    this.stayDurationRemaining = 0;
    this.insideStaticDamageTimer = 0;
    this.wasInsideStaticEntity = false;
    this.insideStaticBlockedTimer = 0;
    this.crowdStuckTimer = 0;
    this.curvePoints = [{ ...this.position }];
    this.targetHistory = [{ ...this.position }];
    this.currentCurveIndex = 0;
    this.nextTarget = { ...this.position };
    this.deathEffectTimer = this.deathEffectDuration;
  }

  // 检测群体拥挤导致的停滞，必要时打断当前运动以触发重新寻路
  updateCrowdStuckState(dt: number) {
    if (this.isDead) return;
    this.crowdRetargetCooldown = Math.max(0, this.crowdRetargetCooldown - dt);

    const moved = Math.hypot(
      this.position.x - this.lastStuckCheckPos.x,
      this.position.y - this.lastStuckCheckPos.y
    );
    this.lastStuckCheckPos = { ...this.position };

    // 已停着的不计入“拥挤停滞”
    if (!this.isMoving) {
      this.crowdStuckTimer = 0;
      return;
    }

    if (moved < 0.2) {
      this.crowdStuckTimer += dt;
    } else {
      this.crowdStuckTimer = 0;
      return;
    }

    // 长时间几乎不动，说明可能挤成平衡，强制退出当前移动状态等待重新寻路
    if (this.crowdStuckTimer >= 1.2 && this.crowdRetargetCooldown <= 0) {
      this.isMoving = false;
      this.stayDurationRemaining = 0;
      this.crowdStuckTimer = 0;
      this.crowdRetargetCooldown = 0.8 + Math.random() * 0.8;
    }
  }

  // 超过 10 秒未位移则触发重新寻路
  updateNoMovementWatchdog(dt: number): boolean {
    if (this.isDead) return false;
    const moved = Math.hypot(
      this.position.x - this.noMoveLastPos.x,
      this.position.y - this.noMoveLastPos.y
    );

    if (moved > 0.5) {
      this.noMoveDuration = 0;
      this.noMoveLastPos = { ...this.position };
      return false;
    }

    this.noMoveDuration += dt;
    if (this.noMoveDuration >= 10) {
      this.noMoveDuration = 0;
      this.noMoveLastPos = { ...this.position };
      this.isMoving = false;
      this.stayDurationRemaining = 0;
      this.insideStaticRetargetCooldown = 0;
      return true;
    }
    return false;
  }

  // 每次运动到新目标前刷新速度参数
  private refreshMoveSpeedForNewTarget() {
    this.movementPassion = 0.8 + Math.random() * 0.4; // 80%~120%
    const baseSpeed = this.minMoveSpeed + Math.random() * (this.maxMoveSpeed - this.minMoveSpeed);
    this.speed = baseSpeed * this.movementPassion;
  }

  /**
   * 根据 targetHistory 生成平滑路径点（CatmullRom 样条采样）
   */
  generateSmoothPath() {
    const points = this.targetHistory;
    if (points.length < 2) {
      // 不足两点，路径就是单点
      this.curvePoints = [this.position];
      return;
    }

    const samples: Point[] = [];
    const segmentsPerSpan = 15; // 每段曲线采样点数

    // 为生成 CatmullRom 曲线，需要前后扩展点
    const extended = [...points];
    // 首尾扩展（用于保证曲线经过首尾点）
    extended.unshift({
      x: points[0].x - (points[1].x - points[0].x),
      y: points[0].y - (points[1].y - points[0].y)
    });
    extended.push({
      x: points[points.length - 1].x + (points[points.length - 1].x - points[points.length - 2].x),
      y: points[points.length - 1].y + (points[points.length - 1].y - points[points.length - 2].y)
    });

    // 对每三个控制点之间插值（CatmullRom 曲线）
    for (let i = 1; i < extended.length - 2; i++) {
      const p0 = extended[i - 1];
      const p1 = extended[i];
      const p2 = extended[i + 1];
      const p3 = extended[i + 2];

      for (let t = 0; t <= 1; t += 1 / segmentsPerSpan) {
        const t2 = t * t;
        const t3 = t2 * t;

        // CatmullRom 公式
        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        samples.push({ x, y });
      }
    }

    // 确保最后一个点精确等于目标点
    samples.push({ ...points[points.length - 1] });
    this.curvePoints = samples;
  }

  private getInflatedStaticBoxes(staticEntities: StaticEntity[], extraPadding = 8): CollisionBox[] {
    const inflateX = this.width / 2 + extraPadding;
    const inflateY = this.height / 2 + extraPadding;
    return staticEntities.map(se => ({
      x: se.collisionBox.x - inflateX,
      y: se.collisionBox.y - inflateY,
      width: se.collisionBox.width + inflateX * 2,
      height: se.collisionBox.height + inflateY * 2,
    }));
  }

  private isPointInBox(point: Point, box: CollisionBox): boolean {
    return (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    );
  }

  private isPointBlocked(point: Point, boxes: CollisionBox[]): boolean {
    for (const box of boxes) {
      if (this.isPointInBox(point, box)) return true;
    }
    return false;
  }

  // 线段与 AABB 相交检测（Liang-Barsky）
  private isSegmentIntersectBox(a: Point, b: Point, box: CollisionBox): boolean {
    const xMin = box.x;
    const xMax = box.x + box.width;
    const yMin = box.y;
    const yMax = box.y + box.height;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const p = [-dx, dx, -dy, dy];
    const q = [a.x - xMin, xMax - a.x, a.y - yMin, yMax - a.y];

    let t0 = 0;
    let t1 = 1;
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-9) {
        if (q[i] < 0) return false;
        continue;
      }
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
    return t0 <= t1;
  }

  private isSegmentBlocked(a: Point, b: Point, boxes: CollisionBox[]): boolean {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.001) return this.isPointBlocked(a, boxes);
    for (const box of boxes) {
      if (this.isPointInBox(a, box) || this.isPointInBox(b, box) || this.isSegmentIntersectBox(a, b, box)) {
        return true;
      }
    }
    return false;
  }

  private buildAvoidancePath(target: Point, staticEntities: StaticEntity[]): Point[] | null {
    const start = { ...this.position };
    const boxes = this.getInflatedStaticBoxes(staticEntities);

    if (this.isPointBlocked(start, boxes) || this.isPointBlocked(target, boxes)) {
      return null;
    }

    if (!this.isSegmentBlocked(start, target, boxes)) {
      return [start, target];
    }

    const clearance = 18;
    const waypointCandidates: Point[] = [];
    for (const box of boxes) {
      waypointCandidates.push(
        { x: box.x - clearance, y: box.y - clearance },
        { x: box.x + box.width + clearance, y: box.y - clearance },
        { x: box.x - clearance, y: box.y + box.height + clearance },
        { x: box.x + box.width + clearance, y: box.y + box.height + clearance }
      );
    }

    const uniqueCandidates = waypointCandidates.filter((p, idx, arr) => {
      if (this.isPointBlocked(p, boxes)) return false;
      return arr.findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) < 0.001) === idx;
    });

    uniqueCandidates.sort((a, b) => {
      const sa = Math.hypot(start.x - a.x, start.y - a.y) + Math.hypot(target.x - a.x, target.y - a.y);
      const sb = Math.hypot(start.x - b.x, start.y - b.y) + Math.hypot(target.x - b.x, target.y - b.y);
      return sa - sb;
    });

    const oneHopLimit = Math.min(uniqueCandidates.length, 40);
    for (let i = 0; i < oneHopLimit; i++) {
      const wp = uniqueCandidates[i];
      if (!this.isSegmentBlocked(start, wp, boxes) && !this.isSegmentBlocked(wp, target, boxes)) {
        return [start, wp, target];
      }
    }

    const twoHopLimit = Math.min(uniqueCandidates.length, 18);
    for (let i = 0; i < twoHopLimit; i++) {
      const wp1 = uniqueCandidates[i];
      if (this.isSegmentBlocked(start, wp1, boxes)) continue;
      for (let j = 0; j < twoHopLimit; j++) {
        if (i === j) continue;
        const wp2 = uniqueCandidates[j];
        if (
          !this.isSegmentBlocked(wp1, wp2, boxes) &&
          !this.isSegmentBlocked(wp2, target, boxes)
        ) {
          return [start, wp1, wp2, target];
        }
      }
    }

    return null;
  }

  // 将折线路径采样成连续点，避免长线段下运动步进过粗
  private buildPolylineSamples(points: Point[], stepLen = 12): Point[] {
    if (points.length <= 1) return points.map(p => ({ ...p }));
    const samples: Point[] = [{ ...points[0] }];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.001) continue;
      const steps = Math.max(1, Math.ceil(dist / stepLen));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        samples.push({
          x: a.x + dx * t,
          y: a.y + dy * t,
        });
      }
    }
    return samples;
  }

  private isPathClear(points: Point[], boxes: CollisionBox[]): boolean {
    if (points.length < 2) return true;
    for (let i = 0; i < points.length - 1; i++) {
      if (this.isSegmentBlocked(points[i], points[i + 1], boxes)) return false;
    }
    return true;
  }

  // 对避障折线做圆角化，尽量保持曲线观感；若圆角后不安全则回退为原折线
  private buildRoundedAvoidanceSamples(points: Point[], boxes: CollisionBox[]): Point[] {
    if (points.length <= 2) return this.buildPolylineSamples(points);

    const rounded: Point[] = [{ ...points[0] }];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const inDx = prev.x - curr.x;
      const inDy = prev.y - curr.y;
      const outDx = next.x - curr.x;
      const outDy = next.y - curr.y;
      const inLen = Math.hypot(inDx, inDy);
      const outLen = Math.hypot(outDx, outDy);

      if (inLen < 0.001 || outLen < 0.001) {
        rounded.push({ ...curr });
        continue;
      }

      const cut = Math.min(22, inLen * 0.35, outLen * 0.35);
      if (cut < 4) {
        rounded.push({ ...curr });
        continue;
      }

      const entry = {
        x: curr.x + (inDx / inLen) * cut,
        y: curr.y + (inDy / inLen) * cut,
      };
      const exit = {
        x: curr.x + (outDx / outLen) * cut,
        y: curr.y + (outDy / outLen) * cut,
      };

      rounded.push(entry);
      const curveSteps = 6;
      for (let s = 1; s < curveSteps; s++) {
        const t = s / curveSteps;
        const omt = 1 - t;
        rounded.push({
          x: omt * omt * entry.x + 2 * omt * t * curr.x + t * t * exit.x,
          y: omt * omt * entry.y + 2 * omt * t * curr.y + t * t * exit.y,
        });
      }
      rounded.push(exit);
    }
    rounded.push({ ...points[points.length - 1] });

    // 先校验圆角路径是否仍可通行，再进行细分采样
    if (this.isPathClear(rounded, boxes)) {
      return this.buildPolylineSamples(rounded, 8);
    }
    return this.buildPolylineSamples(points, 12);
  }

  // 当常规寻路失败时的兜底：优先脱离静态实体；否则尝试近邻目标，避免长期静止
  tryFallbackTarget(staticEntities: StaticEntity[]): boolean {
    const current = { ...this.position };

    // 1) 若当前被挤在静态实体内，优先做“脱困位移”
    if (this.isInsideStaticEntity(staticEntities)) {
      let bestDir: Point | null = null;
      let bestScore = -Infinity;
      const angleStep = Math.PI / 8; // 22.5 度
      const escapeDistance = Math.max(this.width, this.height) * 1.2;
      const currentOverlap = this.getTotalStaticOverlap(current, staticEntities);

      for (let a = 0; a < Math.PI * 2; a += angleStep) {
        const dir = { x: Math.cos(a), y: Math.sin(a) };
        const probe = {
          x: current.x + dir.x * escapeDistance,
          y: current.y + dir.y * escapeDistance,
        };
        const overlap = this.getTotalStaticOverlap(probe, staticEntities);
        const score = currentOverlap - overlap;
        if (score > bestScore) {
          bestScore = score;
          bestDir = dir;
        }
      }

      // 直接做一小步脱困位移，不生成“忽略障碍”的远目标点
      if (bestDir && bestScore > 0.0001) {
        this.position = {
          x: current.x + bestDir.x * escapeDistance,
          y: current.y + bestDir.y * escapeDistance,
        };
        this.updateCollisionBox();
        this.noMoveDuration = 0;
        this.noMoveLastPos = { ...this.position };
        this.facingDirection = { ...bestDir };
        this.isMoving = false;
        this.nextTarget = { ...this.position };
        return true;
      }
    }

    // 2) 不在静态实体内（或脱困失败）时，尝试近邻随机点
    const radiusList = [80, 140, 200];
    for (const radius of radiusList) {
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const probe = {
          x: current.x + Math.cos(angle) * radius,
          y: current.y + Math.sin(angle) * radius,
        };
        if (this.setTarget(probe, staticEntities)) {
          return true;
        }
      }
    }

    // 3) 不再使用“忽略障碍”的目标，避免生成围栏外不可达点
    return false;
  }

  // 设置新的目标点
  setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    const currentPos = { ...this.position };
    const preferStraight = options.preferStraight === true;

    // 避免重复添加相同目标
    const dx = target.x - currentPos.x;
    const dy = target.y - currentPos.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.1) return false;

    const plannedPath = this.buildAvoidancePath(target, staticEntities);
    if (!plannedPath) {
      return false;
    }

    // 每次新目标都重新生成激情值并刷新有效速度
    this.refreshMoveSpeedForNewTarget();

    // 每次设新目标都从当前位置重新规划，避免沿用旧目标点
    const newHistory: Point[] = [];

    // 仅在直达且非“直线优先”时使用前导锚点，保持连续曲线
    if (plannedPath.length === 2 && !preferStraight && this.lastMoveDirection) {
      const tailLen = Math.min(Math.max(distance * 0.2, 20), 80);
      newHistory.push({
        x: currentPos.x - this.lastMoveDirection.x * tailLen,
        y: currentPos.y - this.lastMoveDirection.y * tailLen,
      });
    }
    newHistory.push(currentPos);

    const inflatedBoxes = this.getInflatedStaticBoxes(staticEntities);

    // 直达路径可加入一个弯曲控制点；避障路径则直接使用规划拐点
    if (plannedPath.length === 2 && !preferStraight && distance > 30) {
      const midX = (currentPos.x + target.x) / 2;
      const midY = (currentPos.y + target.y) / 2;
      const invLen = 1 / distance;
      const perpX = -dy * invLen;
      const perpY = dx * invLen;

      let bendSign = this.id % 2 === 0 ? 1 : -1;
      if (this.lastMoveDirection) {
        const cross = this.lastMoveDirection.x * dy - this.lastMoveDirection.y * dx;
        if (Math.abs(cross) > 0.001) {
          bendSign = cross >= 0 ? 1 : -1;
        }
      }

      const bend = Math.min(distance * 0.25, 120);
      const bendPoint = {
        x: midX + perpX * bend * bendSign,
        y: midY + perpY * bend * bendSign,
      };

      // 仅当弯曲中点及两段连接都可通行时才使用弯曲控制点
      const bendIsSafe =
        !this.isPointBlocked(bendPoint, inflatedBoxes) &&
        !this.isSegmentBlocked(currentPos, bendPoint, inflatedBoxes) &&
        !this.isSegmentBlocked(bendPoint, target, inflatedBoxes);

      if (bendIsSafe) {
        newHistory.push(bendPoint);
      }
    } else {
      for (let i = 1; i < plannedPath.length - 1; i++) {
        newHistory.push({ ...plannedPath[i] });
      }
    }

    newHistory.push({ ...target });
    this.targetHistory = newHistory;

    // 直达路径默认平滑曲线；若“直线优先”则改用折线采样（本质直线）
    if (plannedPath.length === 2 && !preferStraight) {
      this.generateSmoothPath();

      // 前导锚点仅用于塑形，不应该成为实体实际回走的路径
      if (this.curvePoints.length > 1) {
        let startIndex = 0;
        let minDist = Infinity;
        for (let i = 0; i < this.curvePoints.length; i++) {
          const p = this.curvePoints[i];
          const d = Math.hypot(p.x - currentPos.x, p.y - currentPos.y);
          if (d < minDist) {
            minDist = d;
            startIndex = i;
          }
        }

        if (startIndex >= this.curvePoints.length - 1) {
          startIndex = this.curvePoints.length - 2;
        }
        if (startIndex > 0) {
          this.curvePoints = this.curvePoints.slice(startIndex);
        }
        this.curvePoints[0] = { ...currentPos };
      }
    } else {
      this.curvePoints = this.buildRoundedAvoidanceSamples(newHistory, inflatedBoxes);
      if (this.curvePoints.length === 0) {
        this.curvePoints = [{ ...currentPos }];
      } else {
        this.curvePoints[0] = { ...currentPos };
      }
    }

    // 重置路径索引
    this.currentCurveIndex = 0;
    this.isMoving = true;
    this.stayDurationRemaining = 0;
    this.insideStaticBlockedTimer = 0;
    this.crowdStuckTimer = 0;
    this.noMoveDuration = 0;
    this.noMoveLastPos = { ...this.position };
    this.nextTarget = target;
    return true;
  }

  // 到点后随机驻足 0~5 秒
  private enterStayStateAfterArrival() {
    this.stop();
    this.stayDurationRemaining = Math.random() * 5;
  }

  // 更新驻足计时
  updateStayDuration(dt: number) {
    if (this.isDead) return;
    if (this.isMoving || this.stayDurationRemaining <= 0) return;
    this.stayDurationRemaining = Math.max(0, this.stayDurationRemaining - dt);
  }

  // 当前是否在任一静态实体内部
  isInsideStaticEntity(staticEntities: StaticEntity[]) {
    return this.getTotalStaticOverlap(this.position, staticEntities) > 0.0001;
  }

  // 被挤压在静态实体中时：每 1 秒扣 2 点血
  updateStaticCompressionEffects(dt: number, staticEntities: StaticEntity[]) {
    if (this.isDead) return;
    const insideNow = this.isInsideStaticEntity(staticEntities);

    if (!insideNow) {
      this.insideStaticDamageTimer = 0;
      this.wasInsideStaticEntity = false;
      return;
    }

    // 首次被挤入静态实体时立刻受伤
    if (!this.wasInsideStaticEntity) {
      this.applyDamage(2);
      this.insideStaticDamageTimer = 0;
      this.wasInsideStaticEntity = true;
    }

    this.insideStaticDamageTimer += dt;
    while (this.insideStaticDamageTimer >= 1) {
      this.insideStaticDamageTimer -= 1;
      this.applyDamage(2);
    }
  }

  // 当前是否可分配新的游走目标（被挤压时做 1 秒节流，避免疯狂重算）
  canGetNewWanderTarget(dt: number, staticEntities: StaticEntity[]) {
    if (this.isDead) return false;
    if (this.isMoving || this.stayDurationRemaining > 0) return false;

    if (!this.isInsideStaticEntity(staticEntities)) {
      this.insideStaticRetargetCooldown = 0;
      return true;
    }

    this.insideStaticRetargetCooldown = Math.max(0, this.insideStaticRetargetCooldown - dt);
    if (this.insideStaticRetargetCooldown <= 0) {
      this.insideStaticRetargetCooldown = 1;
      return true;
    }
    return false;
  }

  // 停止移动
  stop() {
    this.isMoving = false;
    this.nextTarget = { ...this.position };
    this.targetHistory = [{ ...this.position }];
    this.curvePoints = [{ ...this.position }];
    this.currentCurveIndex = 0;
    this.insideStaticBlockedTimer = 0;
    this.crowdStuckTimer = 0;
    this.noMoveLastPos = { ...this.position };
  }

  // 更新位置-基于时间差 dt 秒
  update(dt: number, staticEntities: StaticEntity[]) {
    if (this.isDead) return;
    if (!this.isMoving) return;
    if (this.curvePoints.length === 0) return;
    const oldPos = { ...this.position };

    // 若已到达曲线终点
    if (this.currentCurveIndex >= this.curvePoints.length - 1) {
      this.enterStayStateAfterArrival();
      return;
    }

    const step = this.speed * dt;
    let remaining = step;
    let newPos = { ...this.position };

    while (remaining > 0 && this.currentCurveIndex < this.curvePoints.length - 1) {
      const end = this.curvePoints[this.currentCurveIndex + 1];
      const dx = end.x - newPos.x;
      const dy = end.y - newPos.y;
      const distanceToEnd = Math.hypot(dx, dy);

      if (distanceToEnd <= remaining) {
        // 可以到达终点
        newPos = end;
        remaining -= distanceToEnd;
        this.currentCurveIndex++;
      } else {
        // 只能走部分距离
        const ratio = remaining / distanceToEnd;
        newPos = {
          x: newPos.x + dx * ratio,
          y: newPos.y + dy * ratio
        };
        remaining = 0;
      }
    }

    // 碰撞检测：如果当前已挤在静态实体内，允许“减少重叠”的位移，以便脱困
    const oldOverlap = this.getTotalStaticOverlap(this.position, staticEntities);
    const newOverlap = this.getTotalStaticOverlap(newPos, staticEntities);
    const collided = newOverlap > 0.0001 && newOverlap + 0.0001 >= oldOverlap;

    if (!collided) {
      this.insideStaticBlockedTimer = 0;
      this.position = newPos;
      this.updateCollisionBox();
      const moveDx = this.position.x - oldPos.x;
      const moveDy = this.position.y - oldPos.y;
      const moveDistance = Math.hypot(moveDx, moveDy);
      if (moveDistance > 0.0001) {
        const moveDirection = {
          x: moveDx / moveDistance,
          y: moveDy / moveDistance,
        };
        this.lastMoveDirection = moveDirection;
        this.facingDirection = moveDirection;
      }

      // 本帧抵达终点后进入驻足状态
      if (this.currentCurveIndex >= this.curvePoints.length - 1) {
        this.enterStayStateAfterArrival();
      }
    } else {
      // 在静态实体外碰撞仍停止；若已在静态实体内，保留移动状态以便后续脱困
      if (oldOverlap <= 0.0001) {
        this.stop();
        this.curvePoints = [this.position];
        this.currentCurveIndex = 0;
        this.lastMoveDirection = null;
      } else {
        // 长时间无法前进则进入待重算状态，交给 1 秒节流的重算逻辑处理
        this.insideStaticBlockedTimer += dt;
        if (this.insideStaticBlockedTimer >= 0.4) {
          this.isMoving = false;
          this.insideStaticBlockedTimer = 0;
        }
      }
    }
  }

  private getTotalStaticOverlap(pos: Point, staticEntities: StaticEntity[]): number {
    let total = 0;
    for (const se of staticEntities) {
      total += this.getOverlapArea(pos, se);
    }
    return total;
  }

  private getOverlapArea(pos: Point, staticEntity: StaticEntity): number {
    const myBox = {
      x: pos.x - this.width / 2,
      y: pos.y - this.height / 2,
      width: this.width,
      height: this.height,
    };
    const otherBox = staticEntity.collisionBox;

    const overlapX = Math.min(myBox.x + myBox.width, otherBox.x + otherBox.width) - Math.max(myBox.x, otherBox.x);
    const overlapY = Math.min(myBox.y + myBox.height, otherBox.y + otherBox.height) - Math.max(myBox.y, otherBox.y);
    if (overlapX <= 0 || overlapY <= 0) return 0;
    return overlapX * overlapY;
  }

  // 检测与静态实体的碰撞
  private checkCollision(newPos: Point, staticEntity: StaticEntity): boolean {
    const myBox = {
      x: newPos.x - this.width / 2,
      y: newPos.y - this.height / 2,
      width: this.width,
      height: this.height,
    };
    const otherBox = staticEntity.collisionBox;
    return !(
      myBox.x + myBox.width <= otherBox.x ||
      myBox.x >= otherBox.x + otherBox.width ||
      myBox.y + myBox.height <= otherBox.y ||
      myBox.y >= otherBox.y + otherBox.height
    );
  }
}

export { DynamicEntity };

