import { FriendlyNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/FriendlyNpcDynamicEntity/FriendlyNpcDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {
  Point,
  DynamicEntitieList,
  GameConfig,
  ActionLoopContext,
  EntityDebugFlags
} from '@/components/pixel_war/interface/Interface';

/**
 * 友好 NPC「CeladonMenderCm9」(青玉再生者 cm9)。
 *
 * <p>行为:<b>和平游走 + 周期治疗</b> —— 每隔固定时间,自动为<b>范围内生命值最低的</b>玩家
 * (含主人/队友)恢复若干点生命,治疗量不会超过其生命上限。</p>
 *
 * <p>等级差异:治疗量 1 + (Level ≥ 1 ? 1 : 0)(上限 2 级 → 最高 2 点);
 * 治疗间隔随等级缩短(4.0 - 0.5 × Level 秒);治疗范围随等级略微扩大。</p>
 *
 * <p>战利品:不掉落任何战利品(友好 NPC)。</p>
 */
class CeladonMenderCm9Entity extends FriendlyNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.07;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '青玉再生者';

  /** 主色调(青瓷绿) */
  public static readonly MAIN_COLOR = '#7FD6B0';
  /** 辉光/描边色 */
  public static readonly GLOW_COLOR = '#D8FFF0';

  /** 基准治疗间隔(秒) */
  public static readonly HEAL_INTERVAL = 4;
  /** 每级缩短的治疗间隔(秒) */
  public static readonly HEAL_INTERVAL_PER_LEVEL = 0.5;
  /** 基准生命值 */
  public static readonly HEALTH_BASE = 3;
  /** 基础掉落经验值 */
  public static readonly BASE_GAME_EXP = 2;
  /** 击杀获得的分数 */
  public static readonly KILL_SCORE = 2;
  /** 每级移动速度增益 */
  public static readonly MOVE_SPEED_BONUS_PER_LEVEL = 20;
  /** 最小移动速度(px/s) */
  public static readonly MIN_MOVE_SPEED = 50;
  /** 最大移动速度(px/s) */
  public static readonly MAX_MOVE_SPEED = 75;
  /** 基准治疗范围(px) */
  public static readonly HEAL_RANGE_BASE = 140;
  /** 每级增加的治疗范围(px) */
  public static readonly HEAL_RANGE_PER_LEVEL = 30;
  /** 基准每次治疗量(点) */
  public static readonly HEAL_AMOUNT_BASE = 1;

  /** 治疗冷却剩余(秒) */
  private healCooldownRemaining = 0;
  /** 本次治疗特效剩余时长(秒,仅用于客户端绘制,随快照下发) */
  public healFlashTimer = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'celadon_mender_cm9');
    this.fillColor = CeladonMenderCm9Entity.MAIN_COLOR;
    this.strokeColor = CeladonMenderCm9Entity.GLOW_COLOR;
    this.health = CeladonMenderCm9Entity.HEALTH_BASE;
    this.healthMax = CeladonMenderCm9Entity.HEALTH_BASE;
    this.kill_score = CeladonMenderCm9Entity.KILL_SCORE;
    this.game_exp = CeladonMenderCm9Entity.BASE_GAME_EXP;
    this.mapColor = CeladonMenderCm9Entity.MAIN_COLOR;
    this.minMoveSpeed = CeladonMenderCm9Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = CeladonMenderCm9Entity.MAX_MOVE_SPEED;
    this.speed = CeladonMenderCm9Entity.MIN_MOVE_SPEED;
    this.loot = [];// 友好 NPC 不掉落任何战利品
  }

  /** 等级上限:2 */
  public override getMaxLevel(): number {
    return 2;
  }

  /** 每级移动速度增益(与普通 NPC 一致,显式声明以便与 Java 侧常量对齐) */
  protected override getMoveSpeedBonusPerLevel(): number {
    return CeladonMenderCm9Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.game_exp = CeladonMenderCm9Entity.BASE_GAME_EXP + this.level * 2;
  }

  /** 当前治疗间隔(秒):随等级缩短,下限 1.0 秒 */
  private getHealInterval(): number {
    return Math.max(
      1,
      CeladonMenderCm9Entity.HEAL_INTERVAL
        - CeladonMenderCm9Entity.HEAL_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 当前治疗范围(px):随等级略微扩大 */
  private getHealRange(): number {
    return CeladonMenderCm9Entity.HEAL_RANGE_BASE
      + CeladonMenderCm9Entity.HEAL_RANGE_PER_LEVEL * this.level;
  }

  /** 当前单次治疗量(点):1 级起 +1(最高 2 点) */
  private getHealAmount(): number {
    return CeladonMenderCm9Entity.HEAL_AMOUNT_BASE + (this.level >= 1 ? 1 : 0);
  }

  /** 行为前:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 主循环:按节奏治疗范围内生命值最低的受伤玩家 */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead) return;
    if (this.healFlashTimer > 0) {
      this.healFlashTimer = Math.max(0, this.healFlashTimer - context.deltaTime);
    }
    this.healCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.healCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.healCooldownRemaining += this.getHealInterval();
    }
  }

  /** 治疗范围内生命值最低的受伤玩家(治疗量不超过其生命上限) */
  public override action(context: ActionLoopContext): void {
    const range = this.getHealRange();
    const rangeSq = range * range;
    let target: (typeof context.playerEntities)[number] | null = null;
    let targetRatio = 1;
    let targetDistSq = Infinity;

    for (const player of context.playerEntities) {
      if (player.isDead) continue;
      if (player.health >= player.healthMax) continue;
      const dx = player.position.x - this.position.x;
      const dy = player.position.y - this.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > rangeSq) continue;
      // 优先治疗"血量比例最低"的玩家;并列时取更近的
      const ratio = player.healthMax > 0 ? player.health / player.healthMax : 1;
      if (ratio < targetRatio || (ratio === targetRatio && distSq < targetDistSq)) {
        target = player;
        targetRatio = ratio;
        targetDistSq = distSq;
      }
    }

    if (target === null) return;
    const healed = Math.min(this.getHealAmount(), target.healthMax - target.health);
    if (healed <= 0) return;
    target.health += healed;
    this.healFlashTimer = 0.35;
  }

  /** 行为后:无动作 */
  public override actionAfter(_context: ActionLoopContext): void {
    // 无动作
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

  /** 绘制:青玉主体 + 十字治疗徽记(治疗瞬间发光)+ 治疗范围脉冲环 */
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

    // 治疗范围脉冲环:治疗瞬间向外扩散,提示"刚刚生效"
    if (this.healFlashTimer > 0) {
      const t = 1 - Math.min(1, this.healFlashTimer / 0.35);
      const radius = this.getHealRange() * (0.35 + 0.65 * t);
      ctx.globalAlpha = 0.35 * (1 - t);
      ctx.strokeStyle = CeladonMenderCm9Entity.GLOW_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 主体
    ctx.fillStyle = this.fillColor || CeladonMenderCm9Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = this.strokeColor || CeladonMenderCm9Entity.GLOW_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

    // 十字治疗徽记
    ctx.fillStyle = CeladonMenderCm9Entity.GLOW_COLOR;
    ctx.fillRect(screenPos.x - 1.5, top + 4, 3, h - 8);
    ctx.fillRect(left + 4, screenPos.y - 1.5, w - 8, 3);

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

    // 调试信息:tag
    if (debugFlags) {
      if (debugFlags.showTag) {//底部的tag
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(this.tag, screenPos.x, screenPos.y + (this.renderHeight/2) + 20);
      }
    }
  }
}

export { CeladonMenderCm9Entity };
