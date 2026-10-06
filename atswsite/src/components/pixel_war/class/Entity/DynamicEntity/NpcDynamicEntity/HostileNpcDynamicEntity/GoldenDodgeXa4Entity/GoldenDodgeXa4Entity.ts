import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import { OrdinaryBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/OrdinaryBulletDynamicEntity/OrdinaryBulletDynamicEntity';
import { Xa4ShootSkill } from '@/components/pixel_war/class/Skill/Skills/Xa4ShootSkill/Xa4ShootSkill';
import { DodgeSkill } from '@/components/pixel_war/class/Skill/Skills/DodgeSkill/DodgeSkill';
import type { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {
  Point,
  DynamicEntitieList,
  GameConfig,
  ActionLoopContext,
  EntityDebugFlags
} from '@/components/pixel_war/interface/Interface';

/**
 * 拖尾渲染状态。
 *
 * 存在模块级 WeakMap 而不是实体自身字段上:单机(Worker)模式下,Worker 把整个
 * 实体对象结构化克隆后由 `H_hydrateEntitySnapshot` 逐字段水合到客户端实体上,
 * 会连同这些"只属于客户端"的字段一起覆盖(且 `performance.now()` 在 Worker 与
 * 主线程不同源,时间戳会变成垃圾值),导致拖尾判定永远不成立。
 * 多人(Java)下发的快照是白名单字段,不存在该问题——这正是"单人无拖尾、
 * 多人一直拖尾"两种相反症状的根源。
 */
type BlinkTrailState = {
  /** 拖尾残留计时(秒) */
  timer: number;
  /** 拖尾线段起点/终点(世界坐标) */
  from: Point | null;
  to: Point | null;
  /** 上一次拖尾衰减时刻 */
  lastTickTime: number;
  /** 速度采样窗口:起点位置与起点时刻 */
  windowStart: Point | null;
  windowStartTime: number;
};

/** 每个实体实例的拖尾渲染状态(WeakMap:实体销毁时自动回收) */
const BLINK_TRAIL_STATES = new WeakMap<object, BlinkTrailState>();

const H_getBlinkTrailState = (owner: object): BlinkTrailState => {
  let state = BLINK_TRAIL_STATES.get(owner);
  if (!state) {
    state = { timer: 0, from: null, to: null, lastTickTime: 0, windowStart: null, windowStartTime: 0 };
    BLINK_TRAIL_STATES.set(owner, state);
  }
  return state;
};

/**
 * 敌对 NPC「GoldenDodgeXa4」(金色闪避者 xa4)
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
class GoldenDodgeXa4Entity extends HostileNpcDynamicEntity {
  /** 生成权重(测试阶段可临时改为 0.99) */
  public static GENERATE_WEIGHT = 0.11;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '金色闪避者';

  /** 主色调 */
  public static readonly MAIN_COLOR = '#eaba48';
  /** 辉光内层色 */
  public static readonly GLOW_INNER_COLOR = '#f4dda4';
  /** 辉光外层色 */
  public static readonly GLOW_OUTER_COLOR = '#faeed1';
  /** 描边色 */
  public static readonly STROKE_COLOR = '#a8842c';

  /** 攻击间隔(秒) */
  private static readonly ACTION_INTERVAL = 2;
  /** 闪现冷却(秒) */
  private static readonly BLINK_COOLDOWN = 5;
  /** 单次闪现距离(px) */
  private static readonly BLINK_DISTANCE = 260;
  /** 闪现持续时间(秒),配合距离形成超高速移动 */
  private static readonly BLINK_DURATION = 0.18;
  /** 判定"即将碰到"的距离(px) */
  private static readonly THREAT_RANGE = 62;
  /** 子弹来袭预判距离(px) */
  private static readonly BULLET_LOOKAHEAD = 130;
  /** 子弹弹道威胁半径(px) */
  private static readonly BULLET_THREAT_RANGE = 46;

  /** 拖尾触发速度阈值(px/s) */
  private static readonly TRAIL_SPEED_THRESHOLD = 600;
  /** 速度采样窗口(秒):按窗口内的平均位移计算速度,与绘制频率/额外重绘无关 */
  private static readonly TRAIL_SAMPLE_WINDOW = 0.05;
  /** 窗口内触发拖尾所需的最小位移(px),用于滤除静止抖动 */
  private static readonly TRAIL_MIN_DISTANCE = 20;
  /** 拖尾最短长度(px) */
  private static readonly TRAIL_MIN_LENGTH = 46;
  /** 拖尾相对单帧位移的拉伸倍率 */
  private static readonly TRAIL_STRETCH = 3.2;
  /** 拖尾最长长度(px) */
  private static readonly TRAIL_MAX_LENGTH = 190;
  /** 拖尾残留时间(秒) */
  private static readonly TRAIL_LIFE = 0.22;

  /** 四个正交射击方向(上/下/左/右) */
  private static readonly SHOOT_DIRECTIONS: readonly Point[] = [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
  ];

  private actionLoopRunning = false;
  private actionCooldownRemaining = 0;

  /** 当前闪现状态(仅模拟端使用:Worker 内或服务端) */
  private blinkState: {
    start: Point;
    target: Point;
    direction: Point;
    elapsed: number;
    duration: number;
  } | null = null;
  /** 闪现冷却剩余(秒) */
  private blinkCooldownRemaining = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'golden_dodge_xa4');
    this.fillColor = GoldenDodgeXa4Entity.MAIN_COLOR;
    this.strokeColor = GoldenDodgeXa4Entity.STROKE_COLOR;
    this.health = 1;
    this.healthMax = 1;
    this.kill_score = 4;
    this.game_exp = 3;
    this.mapColor = GoldenDodgeXa4Entity.MAIN_COLOR;
    // 击杀后概率掉落四向子弹技能与闪现技能
    this.loot = [
      { type: 'skillOrb', tag: Xa4ShootSkill.TAG, odds: 0.4 },
      { type: 'skillOrb', tag: DodgeSkill.TAG, odds: 0.4 },
      // 子弹球:会发射普通子弹的 NPC 均有概率掉落(概率 75%)
      { type: 'bulletOrb', tag: 'bullet_orb', odds: 0.75 }
    ];
  }

  public tryPickupItem(_item: ItemEntity): boolean {
    return false;
  }

  public pickupItem(_item: ItemEntity): void {
    // 闪避者不拾取任何物品
  }

  /** 当前攻击间隔(秒):随等级缩短(ACTION_INTERVAL - 0.2 × Level) */
  private getActionInterval(): number {
    return Math.max(0.1, GoldenDodgeXa4Entity.ACTION_INTERVAL - 0.2 * this.level);
  }

  /** 当前闪现冷却(秒):随等级缩短(BLINK_COOLDOWN - 0.4 × Level) */
  private getBlinkCooldown(): number {
    return Math.max(0.1, GoldenDodgeXa4Entity.BLINK_COOLDOWN - 0.4 * this.level);
  }

  /** 等级变化时重算等级相关属性(经验值随等级提升) */
  protected override onNpcLevelApplied(): void {
    this.game_exp = 3 + this.level * 3;
  }

  /** 偏好直线移动:强制以直线路径前往目标 */
  public override setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    return super.setTarget(target, staticEntities, { preferStraight: true });
  }

  /**
   * 每帧更新:有主时跟随主人;无主时做威胁检测与闪现,否则走常规游走。
   */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.isDead) return;

    this.blinkCooldownRemaining = Math.max(0, this.blinkCooldownRemaining - dt);

    if (this.ownerId !== null) {
      this.blinkState = null;
      this.followOwner(dynamicEntity);
      return;
    }

    // 闪现中:由闪现逻辑接管位置,不走常规寻路
    if (this.blinkState !== null) {
      this.updateBlink(dt);
      return;
    }

    // 威胁检测:即将碰到玩家/其他 NPC,或迎面而来的玩家(含从者)子弹
    const fleeDirection = this.detectThreat(dynamicEntity);
    if (fleeDirection !== null && this.blinkCooldownRemaining <= 0) {
      this.startBlink(fleeDirection, staticEntities, gameConfig);
      if (this.blinkState !== null) return;
    }

    super.update(dt, staticEntities, dynamicEntity, gameConfig);
  }

  ////////////////////
  // 攻击 -->
  ////////////////////

  public override actionLoop(context: ActionLoopContext): void {
    if (this.ownerId === null) {
      // 普通情况下只能在移动时射击
      if (this.isDead || !this.isMoving) {
        if (this.actionLoopRunning) {
          this.actionAfter(context);
        }
        return;
      }
      if (!this.actionLoopRunning) {
        this.actionBefore(context);
        return;
      }
      this.actionCooldownRemaining -= this.getActionDelta(context.deltaTime);
      while (this.actionCooldownRemaining <= 0 && this.isMoving && !this.isDead) {
        this.action(context);
        this.actionCooldownRemaining += this.getActionInterval();
      }
    } else {
      // 被玩家吸附情况下不考虑移动的条件
      if (this.isDead) {
        if (this.actionLoopRunning) {
          this.actionAfter(context);
        }
        return;
      }
      if (!this.actionLoopRunning) {
        this.actionBefore(context);
        return;
      }
      this.actionCooldownRemaining -= this.getActionDelta(context.deltaTime);
      while (this.actionCooldownRemaining <= 0 && !this.isDead) {
        this.action(context);
        this.actionCooldownRemaining += this.getActionInterval();
      }
    }
  }

  public override actionBefore(context: ActionLoopContext): void {
    this.actionLoopRunning = true;
    this.action(context);
    this.actionCooldownRemaining = this.getActionInterval();
  }

  public override actionAfter(_context: ActionLoopContext): void {
    this.actionLoopRunning = false;
    this.actionCooldownRemaining = 0;
  }

  /** 向上下左右四个方向各射出一发普通子弹 */
  public override action(context: ActionLoopContext): void {
    const spawnDistance = this.width * 0.6;
    const bulletColor = this.determineBulletColor(context);
    for (const dir of GoldenDodgeXa4Entity.SHOOT_DIRECTIONS) {
      if (this.isDead) return;
      context.spawnBullet(
        new OrdinaryBulletDynamicEntity(
          {
            x: this.position.x + dir.x * spawnDistance,
            y: this.position.y + dir.y * spawnDistance
          },
          { x: dir.x, y: dir.y },
          this.id,
          this.teamId,
          '',
          bulletColor,
          this.getBulletMoveSpeed()
        )
      );
    }
  }

  /** 有主时使用主人的子弹配色,否则使用默认色 */
  private determineBulletColor(context: ActionLoopContext): string {
    if (this.ownerId === null) return '';
    for (const player of context.playerEntities) {
      if (player.playerRule.bulletColor !== '') return player.playerRule.bulletColor;
    }
    return '';
  }

  ////////////////////
  // 闪现 -->
  ////////////////////

  /**
   * 威胁检测:返回逃离方向(单位向量),无威胁时返回 null。
   * 覆盖"即将碰到玩家"、"即将碰到其他 NPC"与"即将被玩家/从者子弹命中"三种情况。
   */
  private detectThreat(dynamicEntity: DynamicEntitieList): Point | null {
    const consider = (ox: number, oy: number): Point | null => {
      const dx = this.position.x - ox;
      const dy = this.position.y - oy;
      const dist = Math.hypot(dx, dy);
      if (dist > GoldenDodgeXa4Entity.THREAT_RANGE) return null;
      if (dist < 0.0001) return { x: 1, y: 0 };
      return { x: dx / dist, y: dy / dist };
    };

    // 1. 玩家
    for (const player of dynamicEntity.playerDynamicEntitys) {
      if (player.isDead) continue;
      const flee = consider(player.position.x, player.position.y);
      if (flee !== null) return flee;
    }
    // 2. 其他 NPC
    for (const npc of dynamicEntity.npcDynamicEntitys) {
      if (npc === this || npc.isDead) continue;
      const flee = consider(npc.position.x, npc.position.y);
      if (flee !== null) return flee;
    }

    // 3. 玩家或玩家从者发射的子弹
    return this.detectBulletThreat(dynamicEntity);
  }

  /** 检测迎面而来的玩家(含从者)子弹,返回垂直于弹道的逃离方向 */
  private detectBulletThreat(dynamicEntity: DynamicEntitieList): Point | null {
    const playerIds = new Set(dynamicEntity.playerDynamicEntitys.map(player => player.id));
    const servantIds = new Set(
      dynamicEntity.npcDynamicEntitys
        .filter(npc => npc.ownerId !== null)
        .map(npc => npc.id)
    );

    for (const bullet of dynamicEntity.bulletDynamicEntitys) {
      const ownerId = bullet.ownerId;
      if (ownerId === null) continue;
      if (!playerIds.has(ownerId) && !servantIds.has(ownerId)) continue;

      const dir = bullet.facingDirection;
      const len = Math.hypot(dir.x, dir.y);
      if (len < 0.0001) continue;
      const ux = dir.x / len;
      const uy = dir.y / len;

      const dx = this.position.x - bullet.position.x;
      const dy = this.position.y - bullet.position.y;
      const along = dx * ux + dy * uy;              // 沿弹道方向的距离
      if (along <= 0) continue;                     // 已经飞过
      if (along > GoldenDodgeXa4Entity.BULLET_LOOKAHEAD) continue;
      const perp = Math.abs(dx * uy - dy * ux);     // 到弹道的垂直距离
      if (perp > GoldenDodgeXa4Entity.BULLET_THREAT_RANGE) continue;

      // 朝远离弹道的垂直方向闪避
      let ox = dx - ux * along;
      let oy = dy - uy * along;
      const olen = Math.hypot(ox, oy);
      if (olen < 0.0001) {
        ox = -uy;
        oy = ux;
        return { x: ox, y: oy };
      }
      return { x: ox / olen, y: oy / olen };
    }
    return null;
  }

  /** 触发闪现:朝指定方向做一次超高速位移 */
  private startBlink(direction: Point, staticEntities: StaticEntity[], gameConfig: GameConfig): void {
    const len = Math.hypot(direction.x, direction.y);
    if (len < 0.0001) return;
    const dir = { x: direction.x / len, y: direction.y / len };
    const target = this.findBlinkTarget(dir, staticEntities, gameConfig);
    if (target === null) return;

    this.blinkState = {
      start: { x: this.position.x, y: this.position.y },
      target,
      direction: dir,
      elapsed: 0,
      duration: GoldenDodgeXa4Entity.BLINK_DURATION
    };
    // 闪现一触发即进入冷却,避免连续闪现(冷却时长随等级缩短)
    this.blinkCooldownRemaining = this.getBlinkCooldown();

    // 清空常规寻路状态,避免与闪现位移冲突
    this.isMoving = false;
    this.stayDurationRemaining = 0;
    this.nextTarget = { x: this.position.x, y: this.position.y };
    this.targetHistory = [{ x: this.position.x, y: this.position.y }];
    this.curvePoints = [{ x: this.position.x, y: this.position.y }];
    this.currentCurveIndex = 0;
    this.clearMotionVelocity();
  }

  /** 沿闪现方向寻找一个不与静态实体/世界边界冲突的落点 */
  private findBlinkTarget(
    dir: Point,
    staticEntities: StaticEntity[],
    gameConfig: GameConfig
  ): Point | null {
    const stepCount = 10;
    for (let i = stepCount; i >= 3; i--) {
      const distance = GoldenDodgeXa4Entity.BLINK_DISTANCE * (i / stepCount);
      const target = {
        x: this.position.x + dir.x * distance,
        y: this.position.y + dir.y * distance
      };
      if (target.x < gameConfig.worldMinX || target.x > gameConfig.worldMaxX) continue;
      if (target.y < gameConfig.worldMinY || target.y > gameConfig.worldMaxY) continue;
      if (this.isPositionFree(target, staticEntities)) return target;
    }
    return null;
  }

  /** 位置是否不与任一静态实体重叠 */
  private isPositionFree(pos: Point, staticEntities: StaticEntity[]): boolean {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const left = pos.x - halfW;
    const right = pos.x + halfW;
    const top = pos.y - halfH;
    const bottom = pos.y + halfH;
    for (const se of staticEntities) {
      const box = se.collisionBox;
      if (left < box.x + box.width && right > box.x && top < box.y + box.height && bottom > box.y) {
        return false;
      }
    }
    return true;
  }

  /** 闪现位移推进:超高速移动(先快后慢),结束后恢复正常游走 */
  private updateBlink(dt: number): void {
    const state = this.blinkState;
    if (state === null) return;
    state.elapsed = Math.min(state.duration, state.elapsed + dt);
    const t = state.duration > 0 ? state.elapsed / state.duration : 1;
    const eased = 1 - Math.pow(1 - t, 3);

    this.position.x = state.start.x + (state.target.x - state.start.x) * eased;
    this.position.y = state.start.y + (state.target.y - state.start.y) * eased;
    this.updateCollisionBox();
    this.facingDirection = { x: state.direction.x, y: state.direction.y };
    this.lastMoveDirection = { x: state.direction.x, y: state.direction.y };
    this.isMoving = true;
    this.nextTarget = { x: this.position.x, y: this.position.y };
    this.targetHistory = [{ x: this.position.x, y: this.position.y }];
    this.curvePoints = [{ x: this.position.x, y: this.position.y }];
    this.currentCurveIndex = 0;
    this.noMoveDuration = 0;
    this.noMoveLastPos = { x: this.position.x, y: this.position.y };

    if (state.elapsed >= state.duration) {
      this.blinkState = null;
      this.isMoving = false;
      this.stayDurationRemaining = 0;
    }
  }

  /** 跟随主人(成为从者时) */
  private followOwner(dynamicEntity: DynamicEntitieList): void {
    for (const player of dynamicEntity.playerDynamicEntitys) {
      if (player.id !== this.ownerId) continue;
      const servant = player.selectServantByID(this.id);
      if (servant === null) return;
      const newPosition = player.rowColToWorldPosition(servant.row, servant.col);
      if (newPosition === null) return;
      this.position.x = newPosition.x;
      this.position.y = newPosition.y;
      this.updateCollisionBox();
      this.isMoving = false;
      this.nextTarget = { ...newPosition };
      this.targetHistory = [{ ...newPosition }];
      this.curvePoints = [{ ...newPosition }];
      this.currentCurveIndex = 0;
      return;
    }
  }

  ////////////////////
  // 渲染 -->
  ////////////////////

  public draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const drawW = this.renderWidth;
    const drawH = this.renderHeight;

    // 1. 运动拖尾:快速位移(闪现)时留下明显的辉光拖尾,避免"瞬移"观感
    const trail = H_getBlinkTrailState(this);
    this.updateTrailState(trail);
    if (trail.timer > 0 && trail.from !== null && trail.to !== null) {
      this.drawBlinkTrail(ctx, worldToScreen, trail);
    }

    // 2. 辉光光晕(与主色/辉光色统一)
    const glowRadius = Math.max(drawW, drawH) * 1.35;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(
      screenPos.x, screenPos.y, 1,
      screenPos.x, screenPos.y, glowRadius
    );
    glow.addColorStop(0, 'rgba(244, 221, 164, 0.55)');
    glow.addColorStop(0.55, 'rgba(250, 238, 209, 0.20)');
    glow.addColorStop(1, 'rgba(250, 238, 209, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. 本体
    const left = screenPos.x - drawW / 2;
    const top = screenPos.y - drawH / 2;
    ctx.fillStyle = this.fillColor || GoldenDodgeXa4Entity.MAIN_COLOR;
    ctx.fillRect(left, top, drawW, drawH);
    ctx.strokeStyle = this.strokeColor || GoldenDodgeXa4Entity.STROKE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left, top, drawW, drawH);

    // 4. 四向炮口标记(提示会向四个方向射击)
    ctx.fillStyle = GoldenDodgeXa4Entity.GLOW_OUTER_COLOR;
    const markOffset = drawW * 0.32;
    const markSize = Math.max(2, drawW * 0.12);
    const marks: Point[] = [
      { x: 0, y: markOffset },
      { x: 0, y: -markOffset },
      { x: -markOffset, y: 0 },
      { x: markOffset, y: 0 }
    ];
    for (const mark of marks) {
      ctx.fillRect(
        screenPos.x + mark.x - markSize / 2,
        screenPos.y + mark.y - markSize / 2,
        markSize,
        markSize
      );
    }

    // 5. 受伤闪烁
    if (this.damageFlashTimer > 0) {
      const intensity = Math.min(1, this.damageFlashTimer / 0.25);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 0, 0, ${0.45 * intensity})`;
      ctx.fillRect(left, top, drawW, drawH);
      ctx.restore();
    }

    // 6. 调试信息
    if (debugFlags) {
      if (debugFlags.showHealth) {
        ctx.font = '10px Consolas, "Courier New", monospace';
        ctx.fillStyle = '#ffff00';
        ctx.textAlign = 'center';
        ctx.fillText(`hp:${this.health.toFixed(0)}`, screenPos.x, screenPos.y - drawH / 2 - 6);
        ctx.textAlign = 'start';
      }
      if (debugFlags.showCollisionBoxes) {
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const box = this.collisionBox;
        const topLeft = worldToScreen(box.x, box.y + box.height);
        ctx.strokeRect(topLeft.x, topLeft.y, box.width, box.height);
        ctx.restore();
      }
    }

    // NPC 等级徽标(/show_level)
    this.drawNpcLevelBadge(ctx, worldToScreen, debugFlags);
  }

  /**
   * 维护辉光拖尾状态。
   *
   * 速度按「固定时间窗口内的平均位移」计算,而不是「相邻两次绘制的位移」——
   * 后者的时间差会随绘制频率变化(同一帧内的额外重绘、不同模式的快照节奏、
   * 低帧率等),导致速度被高估或低估:多人下普通移动被误判为闪现(一直拖尾),
   * 单人下闪现又可能被漏判。改为固定窗口后,测得速度即真实速度,与绘制频率无关。
   */
  private updateTrailState(trail: BlinkTrailState): void {
    const now = performance.now();
    const pos = this.position;

    // 拖尾按真实时间衰减(同一帧内的额外重绘 dt≈0,不会加速衰减)
    if (trail.timer > 0 && trail.lastTickTime > 0) {
      trail.timer = Math.max(0, trail.timer - (now - trail.lastTickTime) / 1000);
    }
    trail.lastTickTime = now;

    if (trail.windowStart === null) {
      trail.windowStart = { x: pos.x, y: pos.y };
      trail.windowStartTime = now;
      return;
    }

    const elapsed = (now - trail.windowStartTime) / 1000;
    if (elapsed < GoldenDodgeXa4Entity.TRAIL_SAMPLE_WINDOW) return;

    const from = trail.windowStart;
    const moved = Math.hypot(pos.x - from.x, pos.y - from.y);
    // 结算本窗口,并以当前位置开启下一个窗口
    trail.windowStart = { x: pos.x, y: pos.y };
    trail.windowStartTime = now;

    if (moved < GoldenDodgeXa4Entity.TRAIL_MIN_DISTANCE) return;
    if (elapsed <= 0) return;
    if (moved / elapsed < GoldenDodgeXa4Entity.TRAIL_SPEED_THRESHOLD) return;

    // 高速位移(闪现):刷新拖尾线段与残留时间
    trail.from = { x: from.x, y: from.y };
    trail.to = { x: pos.x, y: pos.y };
    trail.timer = GoldenDodgeXa4Entity.TRAIL_LIFE;
  }

  /** 绘制闪现辉光拖尾(主色 + 辉光色渐变,叠加混合) */
  private drawBlinkTrail(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    trail: BlinkTrailState
  ): void {
    const from = trail.from;
    const to = trail.to;
    if (from === null || to === null) return;

    const s0 = worldToScreen(from.x, from.y);
    const s1 = worldToScreen(to.x, to.y);
    const dx = s1.x - s0.x;
    const dy = s1.y - s0.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;
    const ux = dx / dist;
    const uy = dy / dist;
    const length = Math.min(
      GoldenDodgeXa4Entity.TRAIL_MAX_LENGTH,
      Math.max(GoldenDodgeXa4Entity.TRAIL_MIN_LENGTH, dist * GoldenDodgeXa4Entity.TRAIL_STRETCH)
    );
    const alpha = Math.min(1, trail.timer / GoldenDodgeXa4Entity.TRAIL_LIFE);
    const tailX = s1.x - ux * length;
    const tailY = s1.y - uy * length;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // 外层辉光
    const glowGrad = ctx.createLinearGradient(tailX, tailY, s1.x, s1.y);
    glowGrad.addColorStop(0, 'rgba(250, 238, 209, 0)');
    glowGrad.addColorStop(1, `rgba(244, 221, 164, ${0.35 * alpha})`);
    ctx.strokeStyle = glowGrad;
    ctx.lineWidth = Math.max(12, this.renderWidth * 1.3);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(s1.x, s1.y);
    ctx.stroke();

    // 内层主拖尾
    const coreGrad = ctx.createLinearGradient(tailX, tailY, s1.x, s1.y);
    coreGrad.addColorStop(0, 'rgba(250, 238, 209, 0)');
    coreGrad.addColorStop(0.55, `rgba(244, 221, 164, ${0.30 * alpha})`);
    coreGrad.addColorStop(1, `rgba(250, 238, 209, ${0.85 * alpha})`);
    ctx.strokeStyle = coreGrad;
    ctx.lineWidth = Math.max(6, this.renderWidth * 0.7);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(s1.x, s1.y);
    ctx.stroke();

    // 残影方块
    const ghostCount = 4;
    for (let i = 1; i <= ghostCount; i++) {
      const t = i / (ghostCount + 1);
      const gx = s1.x - ux * length * t;
      const gy = s1.y - uy * length * t;
      ctx.globalAlpha = alpha * (1 - t) * 0.5;
      ctx.fillStyle = GoldenDodgeXa4Entity.MAIN_COLOR;
      ctx.fillRect(
        gx - this.renderWidth / 2,
        gy - this.renderHeight / 2,
        this.renderWidth,
        this.renderHeight
      );
    }
    ctx.restore();
  }

  /** 拖尾会掩盖正常绘制,故位移过快时不参与"无位移看门狗" */
  public override updateNoMovementWatchdog(_dt: number): boolean {
    return false;
  }
}

export { GoldenDodgeXa4Entity };
