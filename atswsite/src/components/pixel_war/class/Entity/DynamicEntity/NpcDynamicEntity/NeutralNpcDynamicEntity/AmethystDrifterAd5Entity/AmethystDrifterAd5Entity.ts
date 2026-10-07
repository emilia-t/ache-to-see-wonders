import { NeutralNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NeutralNpcDynamicEntity/NeutralNpcDynamicEntity';
import { AcceleratingBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/AcceleratingBulletDynamicEntity/AcceleratingBulletDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {
  Point,
  DynamicEntitieList,
  GameConfig,
  ActionLoopContext,
  EntityDebugFlags
} from '@/components/pixel_war/interface/Interface';

/**
 * 中立 NPC「AmethystDrifterAd5」(紫晶漂流者 ad5)。
 *
 * <p>行为:<b>和平游荡 + 遇袭放风筝</b> —— 平时只是缓慢漂游,是战场上的"背景生物";
 * 一旦受到伤害便立刻<b>受惊折跃</b>(朝远离袭击者的方向瞬移一段距离,冷却 6 秒),
 * 并锁定该伤害来源,进入<b>风筝状态</b>:</p>
 * <ul>
 *   <li>移动:始终与仇家保持约 {@link AmethystDrifterAd5Entity.KITE_DISTANCE} 的距离
 *       (过近后撤、过远逼近),不和玩家拼贴身;</li>
 *   <li>攻击:按节奏朝仇家发射<b>疾进弹</b>(越飞越快),靠距离换取伤害;</li>
 *   <li>仇家死亡/离开世界后放弃并<b>恢复中立</b>,回到和平漂游。</li>
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
class AmethystDrifterAd5Entity extends NeutralNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.05;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '紫晶漂流者';

  /** 主色调(紫晶) */
  public static readonly MAIN_COLOR = '#9B7BE0';
  /** 和平状态描边色 */
  public static readonly GLOW_COLOR = '#DCC9FF';
  /** 受惊状态描边色(亮青警告) */
  public static readonly STARTLED_COLOR = '#6FE9FF';

  /** 基准生命值 */
  public static readonly HEALTH_BASE = 3;
  /** 每级增加的生命值 */
  public static readonly HEALTH_PER_LEVEL = 1;
  /** 基础掉落经验值 */
  public static readonly BASE_GAME_EXP = 3;
  /** 击杀获得的分数 */
  public static readonly KILL_SCORE = 3;
  /** 每级移动速度增益 */
  public static readonly MOVE_SPEED_BONUS_PER_LEVEL = 20;
  /** 最小移动速度(px/s) */
  public static readonly MIN_MOVE_SPEED = 60;
  /** 最大移动速度(px/s) */
  public static readonly MAX_MOVE_SPEED = 95;
  /** 风筝射击的基准间隔(秒) */
  public static readonly KITE_INTERVAL = 1.4;
  /** 每级缩短的风筝射击间隔(秒) */
  public static readonly KITE_INTERVAL_PER_LEVEL = 0.1;
  /** 与仇家保持的风筝距离(px) */
  public static readonly KITE_DISTANCE = 240;
  /** 风筝距离容差(px):偏差在容差内即原地射击 */
  public static readonly KITE_DEADZONE = 30;
  /** 追击/脱离时的重新寻路间隔(秒) */
  public static readonly RETARGET_INTERVAL = 0.2;
  /** 受惊折跃距离(px) */
  public static readonly BLINK_DISTANCE = 140;
  /** 受惊折跃冷却(秒) */
  public static readonly BLINK_COOLDOWN = 6;

  /** 是否已被激怒(受到过伤害) */
  public enraged = false;
  /** 受惊折跃冷却剩余(秒) */
  private blinkCooldownRemaining = 0;
  /** 是否有一次"受惊折跃"待执行(applyDamage 时置位,下一帧在 update 内执行) */
  private startleBlinkPending = false;
  /** 风筝射击冷却剩余(秒) */
  private kiteCooldownRemaining = 0;
  /** 仇家实体 id(激怒时锁定本次伤害来源) */
  private enemyId: number | null = null;
  /** 仇家当前位置(每帧由 update 解析) */
  private enemyPosition: Point | null = null;
  /** 重新寻路冷却剩余(秒) */
  private retargetCooldown = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'amethyst_drifter_ad5');
    this.fillColor = AmethystDrifterAd5Entity.MAIN_COLOR;
    this.strokeColor = AmethystDrifterAd5Entity.GLOW_COLOR;
    this.health = AmethystDrifterAd5Entity.HEALTH_BASE;
    this.healthMax = AmethystDrifterAd5Entity.HEALTH_BASE;
    this.kill_score = AmethystDrifterAd5Entity.KILL_SCORE;
    this.game_exp = AmethystDrifterAd5Entity.BASE_GAME_EXP;
    this.mapColor = AmethystDrifterAd5Entity.MAIN_COLOR;
    this.minMoveSpeed = AmethystDrifterAd5Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = AmethystDrifterAd5Entity.MAX_MOVE_SPEED;
    this.speed = AmethystDrifterAd5Entity.MIN_MOVE_SPEED;
    this.loot = [
      // 会发射子弹的 NPC 有概率掉落子弹球(概率 75%)
      { type: 'bulletOrb', tag: 'bullet_orb', odds: 0.75 }
    ];
  }

  /** 等级上限:2(与其他上限 2 的 NPC 共用 3 档等级概率表) */
  public override getMaxLevel(): number {
    return 2;
  }

  /** 每级移动速度增益(与普通 NPC 一致,显式声明以便与 Java 侧常量对齐) */
  protected override getMoveSpeedBonusPerLevel(): number {
    return AmethystDrifterAd5Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.healthMax = AmethystDrifterAd5Entity.HEALTH_BASE
      + AmethystDrifterAd5Entity.HEALTH_PER_LEVEL * this.level;
    this.health = this.healthMax;
    this.game_exp = AmethystDrifterAd5Entity.BASE_GAME_EXP + this.level * 2;
  }

  /** 激怒状态下拒绝被任何玩家吸附为从者(与象牙游荡者同规则) */
  public override canBeAbsorbedAsServant(): boolean {
    return !this.enraged;
  }

  /**
   * 受伤即"记仇 + 受惊":记录仇家并预约一次折跃。
   * 来源 id 由权威端在结算伤害前写入 lastDamagerId。
   */
  public override applyDamage(amount: number): void {
    super.applyDamage(amount);
    if (this.isDead || amount <= 0) return;
    this.enraged = true;
    const attackerId = this.lastDamagerId;
    if (attackerId !== null && attackerId !== this.id) {
      this.enemyId = attackerId;
    }
    if (this.blinkCooldownRemaining <= 0) {
      this.startleBlinkPending = true;
    }
  }

  /** 风筝射击间隔(秒):随等级缩短,下限 0.6 秒 */
  private getKiteInterval(): number {
    return Math.max(
      0.6,
      AmethystDrifterAd5Entity.KITE_INTERVAL
        - AmethystDrifterAd5Entity.KITE_INTERVAL_PER_LEVEL * this.level
    );
  }

  /**
   * 移动目标:受惊折跃期间忽略外部目标;激怒后改以"风筝站位点"为目标;
   * 否则走常规随机游走。
   */
  public override setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    const enemyPos = this.enemyPosition;
    if (enemyPos !== null) {
      return super.setTarget(this.getKitePoint(enemyPos), staticEntities, {
        ...options,
        preferStraight: false
      });
    }
    return super.setTarget(target, staticEntities, options);
  }

  /** 风筝站位点:以仇家为圆心、沿「仇家 → 自己」方向、距离为 KITE_DISTANCE 的点 */
  private getKitePoint(enemyPos: Point): Point {
    const distance = AmethystDrifterAd5Entity.KITE_DISTANCE;
    const dx = this.position.x - enemyPos.x;
    const dy = this.position.y - enemyPos.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.0001) {
      const back = this.getUnitFacingDirection();
      return { x: enemyPos.x - back.x * distance, y: enemyPos.y - back.y * distance };
    }
    return {
      x: enemyPos.x + (dx / len) * distance,
      y: enemyPos.y + (dy / len) * distance
    };
  }

  /** 每帧更新:从者跟随 / 受惊折跃 / 风筝追击 / 和平游荡 */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.isDead) return;

    this.blinkCooldownRemaining = Math.max(0, this.blinkCooldownRemaining - dt);

    if (this.ownerId !== null) {
      // 从者由主人网格控制:与「激怒」互斥,这里恢复中立
      this.revertToNeutral();
      this.followOwner(dynamicEntity);
      return;
    }

    if (this.enraged) {
      this.enemyPosition = this.resolveEnemyPosition(dynamicEntity);
      // 受惊折跃:朝远离仇家的方向瞬移一段距离(仅一次,受冷却限制)
      if (this.startleBlinkPending && this.enemyPosition !== null) {
        this.startleBlinkPending = false;
        if (this.tryBlinkAway(this.enemyPosition, staticEntities, gameConfig)) {
          this.blinkCooldownRemaining = AmethystDrifterAd5Entity.BLINK_COOLDOWN;
          return;
        }
      }
      this.refreshRetarget(dt, staticEntities);
    } else {
      this.enemyPosition = null;
    }

    super.update(dt, staticEntities, dynamicEntity, gameConfig);
  }

  /**
   * 风筝寻路:与仇家的距离偏差超出容差时,按固定间隔重新下发目标
   * (setTarget 覆写会把它改写为风筝站位点)。
   */
  private refreshRetarget(dt: number, staticEntities: StaticEntity[]): void {
    const enemyPos = this.enemyPosition;
    if (enemyPos === null) {
      this.retargetCooldown = 0;
      return;
    }
    const distance = Math.hypot(enemyPos.x - this.position.x, enemyPos.y - this.position.y);
    if (Math.abs(distance - AmethystDrifterAd5Entity.KITE_DISTANCE) <= AmethystDrifterAd5Entity.KITE_DEADZONE) {
      // 已在风筝区间内:原地射击,不再调整站位
      this.retargetCooldown = 0;
      return;
    }
    this.retargetCooldown -= dt;
    if (this.retargetCooldown > 0) return;
    this.retargetCooldown = AmethystDrifterAd5Entity.RETARGET_INTERVAL;
    this.setTarget(enemyPos, staticEntities, { preferStraight: false });
  }

  /**
   * 解析仇家当前位置:依次在玩家 / NPC 列表中按 id 查找;仇家消失即恢复中立。
   */
  private resolveEnemyPosition(dynamicEntity: DynamicEntitieList): Point | null {
    const enemyId = this.enemyId;
    if (enemyId === null) {
      this.revertToNeutral();
      return null;
    }
    for (const player of dynamicEntity.playerDynamicEntitys) {
      if (player.id !== enemyId) continue;
      if (player.isDead) break;
      return { x: player.position.x, y: player.position.y };
    }
    for (const npc of dynamicEntity.npcDynamicEntitys) {
      if (npc.id !== enemyId) continue;
      if (npc.isDead) break;
      return { x: npc.position.x, y: npc.position.y };
    }
    this.revertToNeutral();
    return null;
  }

  /** 朝远离指定点的方向瞬移一段距离(尝试多个方向,避开墙体与地图外) */
  private tryBlinkAway(
    awayFrom: Point,
    staticEntities: StaticEntity[],
    gameConfig: GameConfig
  ): boolean {
    const dx = this.position.x - awayFrom.x;
    const dy = this.position.y - awayFrom.y;
    const len = Math.hypot(dx, dy);
    const baseAngle = len < 0.0001
      ? Math.atan2(this.getUnitFacingDirection().y, this.getUnitFacingDirection().x)
      : Math.atan2(dy, dx);

    // 优先正后方,其次左右各 45°/90°/135°,最后兜底正前方
    const offsetsDeg = [0, 45, -45, 90, -90, 135, -135, 180];
    const distance = AmethystDrifterAd5Entity.BLINK_DISTANCE;
    for (const offset of offsetsDeg) {
      const rad = baseAngle + (offset * Math.PI) / 180;
      const candidate: Point = {
        x: this.position.x + Math.cos(rad) * distance,
        y: this.position.y + Math.sin(rad) * distance
      };
      candidate.x = Math.max(
        gameConfig.worldMinX + this.width / 2,
        Math.min(gameConfig.worldMaxX - this.width / 2, candidate.x)
      );
      candidate.y = Math.max(
        gameConfig.worldMinY + this.height / 2,
        Math.min(gameConfig.worldMaxY - this.height / 2, candidate.y)
      );
      if (this.isBlocked(candidate, staticEntities)) continue;

      this.position.x = candidate.x;
      this.position.y = candidate.y;
      this.updateCollisionBox();
      this.isMoving = false;
      this.nextTarget = { ...candidate };
      this.targetHistory = [{ ...candidate }];
      this.curvePoints = [{ ...candidate }];
      this.currentCurveIndex = 0;
      return true;
    }
    return false;
  }

  /** 候选落点是否与任意静态实体(AABB)相交 */
  private isBlocked(candidate: Point, staticEntities: StaticEntity[]): boolean {
    const box = {
      x: candidate.x - this.width / 2,
      y: candidate.y - this.height / 2,
      width: this.width,
      height: this.height
    };
    for (const staticEntity of staticEntities) {
      const other = staticEntity.collisionBox;
      const separated =
        box.x + box.width <= other.x ||
        box.x >= other.x + other.width ||
        box.y + box.height <= other.y ||
        box.y >= other.y + other.height;
      if (!separated) return true;
    }
    return false;
  }

  /** 解除激怒,回到中立漂游状态 */
  private revertToNeutral(): void {
    this.enraged = false;
    this.enemyId = null;
    this.enemyPosition = null;
    this.startleBlinkPending = false;
  }

  /** 从者跟随:瞬移到主人在从者网格中分配的格子中心 */
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

  /** 归一化的朝向单位向量(朝向可能为零向量时回退为正东) */
  private getUnitFacingDirection(): Point {
    const fx = this.facingDirection.x;
    const fy = this.facingDirection.y;
    const len = Math.hypot(fx, fy);
    if (len < 0.0001) return { x: 1, y: 0 };
    return { x: fx / len, y: fy / len };
  }

  /** 射击方向:优先瞄向仇家,无仇家时退回当前朝向 */
  private getShotDirection(): Point {
    const enemyPos = this.enemyPosition;
    if (enemyPos === null) return this.getUnitFacingDirection();
    const dx = enemyPos.x - this.position.x;
    const dy = enemyPos.y - this.position.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.0001) return this.getUnitFacingDirection();
    return { x: dx / len, y: dy / len };
  }

  /** 行为前:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 主循环:和平状态下不攻击;激怒后按节奏朝仇家发射疾进弹 */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead || !this.enraged) return;
    if (this.enemyPosition === null) return;

    this.kiteCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.kiteCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.kiteCooldownRemaining += this.getKiteInterval();
    }
  }

  /** 朝仇家发射一发疾进弹 */
  public override action(context: ActionLoopContext): void {
    const direction = this.getShotDirection();
    const spawnDistance = this.width * 0.7;
    context.spawnBullet(
      new AcceleratingBulletDynamicEntity(
        {
          x: this.position.x + direction.x * spawnDistance,
          y: this.position.y + direction.y * spawnDistance
        },
        direction,
        this.id,
        this.teamId,
        '',
        this.getBulletMoveSpeed()
      )
    );
  }

  /** 行为后:无动作 */
  public override actionAfter(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 绘制:紫晶主体 + 内嵌菱形;激怒后描边转为亮青并带脉动 */
  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const w = this.renderWidth;
    const h = this.renderHeight;
    const left = screenPos.x - w / 2;
    const top = screenPos.y - h / 2;

    ctx.save();

    // 主体
    ctx.fillStyle = this.fillColor || AmethystDrifterAd5Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);

    // 描边:和平 = 柔紫;激怒 = 亮青脉动
    if (this.enraged) {
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 220));
      ctx.strokeStyle = AmethystDrifterAd5Entity.STARTLED_COLOR;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 2;
      ctx.strokeRect(left + 1, top + 1, w - 2, h - 2);
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = this.strokeColor || AmethystDrifterAd5Entity.GLOW_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
    }

    // 内嵌菱形:紫晶质感
    ctx.beginPath();
    ctx.moveTo(screenPos.x, top + 4);
    ctx.lineTo(left + w - 4, screenPos.y);
    ctx.lineTo(screenPos.x, top + h - 4);
    ctx.lineTo(left + 4, screenPos.y);
    ctx.closePath();
    ctx.stroke();

    // 受伤闪烁
    if (this.damageFlashTimer > 0) {
      const intensity = Math.min(1, this.damageFlashTimer / 0.25);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 0, 0, ${0.45 * intensity})`;
      ctx.fillRect(left, top, w, h);
    }
    ctx.restore();

    // NPC 等级徽标(/show_level)
    this.drawNpcLevelBadge(ctx, worldToScreen, debugFlags);

    if (debugFlags) {
      if (debugFlags.showTag) {//底部的tag
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(this.tag, screenPos.x, screenPos.y + (this.renderHeight / 2) + 20);
      }
    }
  }
}

export { AmethystDrifterAd5Entity };
