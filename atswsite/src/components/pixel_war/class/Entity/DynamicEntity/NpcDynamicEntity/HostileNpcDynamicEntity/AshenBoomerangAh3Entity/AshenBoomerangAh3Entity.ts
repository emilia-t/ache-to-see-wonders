import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import { BoomerangBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/BoomerangBulletDynamicEntity/BoomerangBulletDynamicEntity';
import { SpiralDanceSkill } from '@/components/pixel_war/class/Skill/Skills/SpiralDanceSkill/SpiralDanceSkill';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {
  Point,
  DynamicEntitieList,
  GameConfig,
  ActionLoopContext,
  EntityDebugFlags
} from '@/components/pixel_war/interface/Interface';

/**
 * 敌对 NPC「AshenBoomerangAh3」(灰烬回旋手 ah3)。
 *
 * <p>行为:中速游走的<b>回旋投手</b> —— 只在移动时开火,每次向前后<b>各投出一枚回旋弹</b>
 * (回旋弹飞出约 0.85 秒后会折返),因此它既压迫正面、又在身后留下一道回程威胁,
 * 逼迫玩家不能简单地"绕背"。等级越高投掷节奏越快。</p>
 *
 * <p>等级差异:生命 2 + 1 × Level(升级即回满);掉落经验 exp = 3 + 2 × Level;
 * 投掷间隔随等级缩短(2.2 - 0.2 × Level 秒)。</p>
 *
 * <p>战利品:子弹球(75%)+「螺旋舞」技能球(20%)。</p>
 */
class AshenBoomerangAh3Entity extends HostileNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.13;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '灰烬回旋手';

  /** 主色调(灰烬) */
  public static readonly MAIN_COLOR = '#B9B2A8';
  /** 辉光/描边色(暖金) */
  public static readonly GLOW_COLOR = '#FFD79A';

  /** 基准投掷间隔(秒) */
  public static readonly ACTION_INTERVAL = 2.2;
  /** 每级缩短的投掷间隔(秒) */
  public static readonly ACTION_INTERVAL_PER_LEVEL = 0.2;
  /** 基准生命值 */
  public static readonly HEALTH_BASE = 2;
  /** 每级增加的生命值 */
  public static readonly HEALTH_PER_LEVEL = 1;
  /** 基础掉落经验值 */
  public static readonly BASE_GAME_EXP = 3;
  /** 击杀获得的分数 */
  public static readonly KILL_SCORE = 3;
  /** 每级移动速度增益 */
  public static readonly MOVE_SPEED_BONUS_PER_LEVEL = 20;
  /** 最小移动速度(px/s) */
  public static readonly MIN_MOVE_SPEED = 70;
  /** 最大移动速度(px/s) */
  public static readonly MAX_MOVE_SPEED = 100;

  /** 是否处于行动循环中 */
  private isActionLoopRunning = false;
  /** 投掷冷却剩余(秒) */
  private actionCooldownRemaining = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'ashen_boomerang_ah3');
    this.fillColor = AshenBoomerangAh3Entity.MAIN_COLOR;
    this.strokeColor = AshenBoomerangAh3Entity.GLOW_COLOR;
    this.health = AshenBoomerangAh3Entity.HEALTH_BASE;
    this.healthMax = AshenBoomerangAh3Entity.HEALTH_BASE;
    this.kill_score = AshenBoomerangAh3Entity.KILL_SCORE;
    this.game_exp = AshenBoomerangAh3Entity.BASE_GAME_EXP;
    this.mapColor = AshenBoomerangAh3Entity.MAIN_COLOR;
    this.minMoveSpeed = AshenBoomerangAh3Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = AshenBoomerangAh3Entity.MAX_MOVE_SPEED;
    this.speed = AshenBoomerangAh3Entity.MIN_MOVE_SPEED;
    this.loot = [
      { type: 'skillOrb', tag: SpiralDanceSkill.TAG, odds: 0.2 },
      // 会发射子弹的 NPC 有概率掉落子弹球(概率 75%)
      { type: 'bulletOrb', tag: 'bullet_orb', odds: 0.75 }
    ];
  }

  /** 等级上限:5(与其他上限 5 的 NPC 共用 6 档等级概率表) */
  public override getMaxLevel(): number {
    return 5;
  }

  /** 每级移动速度增益(与普通 NPC 一致,显式声明以便与 Java 侧常量对齐) */
  protected override getMoveSpeedBonusPerLevel(): number {
    return AshenBoomerangAh3Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.healthMax = AshenBoomerangAh3Entity.HEALTH_BASE
      + AshenBoomerangAh3Entity.HEALTH_PER_LEVEL * this.level;
    this.health = this.healthMax;
    this.game_exp = AshenBoomerangAh3Entity.BASE_GAME_EXP + this.level * 2;
  }

  /** 当前投掷间隔(秒):随等级缩短,下限 0.8 秒 */
  private getActionInterval(): number {
    return Math.max(
      0.8,
      AshenBoomerangAh3Entity.ACTION_INTERVAL
        - AshenBoomerangAh3Entity.ACTION_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 行动开始:立即投掷一次并重置冷却 */
  public override actionBefore(context: ActionLoopContext): void {
    this.isActionLoopRunning = true;
    this.action(context);
    this.actionCooldownRemaining = this.getActionInterval();
  }

  /** 主循环:无主时只在移动中投掷;成为从者后不再受移动限制 */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.ownerId === null) {
      if (this.isDead || !this.isMoving) {
        if (this.isActionLoopRunning) this.actionAfter(context);
        return;
      }
      if (!this.isActionLoopRunning) {
        this.actionBefore(context);
        return;
      }
      this.actionCooldownRemaining -= this.getActionDelta(context.deltaTime);
      while (this.actionCooldownRemaining <= 0 && this.isMoving && !this.isDead) {
        this.action(context);
        this.actionCooldownRemaining += this.getActionInterval();
      }
      return;
    }

    if (this.isDead) {
      if (this.isActionLoopRunning) this.actionAfter(context);
      return;
    }
    if (!this.isActionLoopRunning) {
      this.actionBefore(context);
      return;
    }
    this.actionCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.actionCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.actionCooldownRemaining += this.getActionInterval();
    }
  }

  /** 向前、向后各投出一枚回旋弹 */
  public override action(context: ActionLoopContext): void {
    const direction = this.getUnitFacingDirection();
    const spawnDistance = this.width * 0.6;
    const bulletSpeed = this.getBulletMoveSpeed();

    const arms: readonly Point[] = [
      { x: direction.x, y: direction.y },
      { x: -direction.x, y: -direction.y }
    ];
    for (const arm of arms) {
      context.spawnBullet(
        new BoomerangBulletDynamicEntity(
          {
            x: this.position.x + arm.x * spawnDistance,
            y: this.position.y + arm.y * spawnDistance
          },
          arm,
          this.id,
          this.teamId,
          '',
          bulletSpeed
        )
      );
    }
  }

  /** 行动结束:清除运行标记与冷却 */
  public override actionAfter(_context: ActionLoopContext): void {
    this.isActionLoopRunning = false;
    this.actionCooldownRemaining = 0;
  }

  /** 归一化的朝向单位向量(朝向可能为零向量时回退为正东) */
  private getUnitFacingDirection(): Point {
    const fx = this.facingDirection.x;
    const fy = this.facingDirection.y;
    const len = Math.hypot(fx, fy);
    if (len < 0.0001) return { x: 1, y: 0 };
    return { x: fx / len, y: fy / len };
  }

  /** 每帧更新:被玩家吸附为从者时锁定在主人分配的格子上,否则走常规游走 */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.isDead) return;
    if (this.ownerId !== null) {
      this.followOwner(dynamicEntity);
      return;
    }
    super.update(dt, staticEntities, dynamicEntity, gameConfig);
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

  /** 绘制:灰烬主体 + 双向投掷臂纹 + 受伤闪烁 + 等级徽标 */
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
    ctx.fillStyle = this.fillColor || AshenBoomerangAh3Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = this.strokeColor || AshenBoomerangAh3Entity.GLOW_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

    // 双向投掷臂:上下各一道折角,暗示"前后同时出手"
    ctx.beginPath();
    ctx.moveTo(left + 3.5, top + h / 2);
    ctx.lineTo(screenPos.x, top + 3.5);
    ctx.lineTo(left + w - 3.5, top + h / 2);
    ctx.moveTo(left + 3.5, top + h / 2);
    ctx.lineTo(screenPos.x, top + h - 3.5);
    ctx.lineTo(left + w - 3.5, top + h / 2);
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

export { AshenBoomerangAh3Entity };
