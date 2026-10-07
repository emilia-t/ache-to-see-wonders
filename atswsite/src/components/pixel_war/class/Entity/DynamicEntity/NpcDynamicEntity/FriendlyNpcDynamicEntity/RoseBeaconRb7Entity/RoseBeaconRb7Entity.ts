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
 * 友好 NPC「RoseBeaconRb7」(蔷薇信标 rb7)。
 *
 * <p>行为:<b>和平游走 + 周期群体治疗</b> —— 每隔固定时间向外扩散一圈治疗脉冲,
 * 一次性为范围内<b>所有</b>受伤的玩家(含主人/队友)各恢复若干点生命,
 * 治疗量不会超过各自的生命上限。</p>
 *
 * <p>与「青玉再生者 cm9」的区别:cm9 是"单体、慢速、大治疗量"(只治血量比例最低的一人),
 * rb7 是"群体、快速、小治疗量"(范围内所有受伤玩家一起回血),二者定位互补。</p>
 *
 * <p>等级差异:治疗间隔随等级缩短(3.0 - 0.3 × Level 秒);治疗范围随等级扩大
 * (160 + 20 × Level px);每次治疗量 1 + (Level ≥ 1 ? 1 : 0)(最高 2 点)。</p>
 *
 * <p>战利品:不掉落任何战利品(友好 NPC)。</p>
 */
class RoseBeaconRb7Entity extends FriendlyNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.06;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '蔷薇信标';

  /** 主色调(蔷薇粉) */
  public static readonly MAIN_COLOR = '#E86A9B';
  /** 辉光/描边色 */
  public static readonly GLOW_COLOR = '#FFD3E4';

  /** 基准治疗间隔(秒) */
  public static readonly HEAL_INTERVAL = 3;
  /** 每级缩短的治疗间隔(秒) */
  public static readonly HEAL_INTERVAL_PER_LEVEL = 0.3;
  /** 基准生命值 */
  public static readonly HEALTH_BASE = 4;
  /** 每级增加的生命值 */
  public static readonly HEALTH_PER_LEVEL = 1;
  /** 基础掉落经验值 */
  public static readonly BASE_GAME_EXP = 2;
  /** 击杀获得的分数 */
  public static readonly KILL_SCORE = 2;
  /** 每级移动速度增益 */
  public static readonly MOVE_SPEED_BONUS_PER_LEVEL = 20;
  /** 最小移动速度(px/s) */
  public static readonly MIN_MOVE_SPEED = 45;
  /** 最大移动速度(px/s) */
  public static readonly MAX_MOVE_SPEED = 70;
  /** 基准治疗范围(px) */
  public static readonly HEAL_RANGE_BASE = 160;
  /** 每级增加的治疗范围(px) */
  public static readonly HEAL_RANGE_PER_LEVEL = 20;
  /** 基准每次治疗量(点) */
  public static readonly HEAL_AMOUNT_BASE = 1;

  /** 治疗冷却剩余(秒) */
  private healCooldownRemaining = 0;
  /** 本次治疗特效剩余时长(秒,仅用于客户端绘制;随快照下发) */
  public healPulseTimer = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'rose_beacon_rb7');
    this.fillColor = RoseBeaconRb7Entity.MAIN_COLOR;
    this.strokeColor = RoseBeaconRb7Entity.GLOW_COLOR;
    this.health = RoseBeaconRb7Entity.HEALTH_BASE;
    this.healthMax = RoseBeaconRb7Entity.HEALTH_BASE;
    this.kill_score = RoseBeaconRb7Entity.KILL_SCORE;
    this.game_exp = RoseBeaconRb7Entity.BASE_GAME_EXP;
    this.mapColor = RoseBeaconRb7Entity.MAIN_COLOR;
    this.minMoveSpeed = RoseBeaconRb7Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = RoseBeaconRb7Entity.MAX_MOVE_SPEED;
    this.speed = RoseBeaconRb7Entity.MIN_MOVE_SPEED;
    this.loot = [];// 友好 NPC 不掉落任何战利品
  }

  /** 等级上限:2 */
  public override getMaxLevel(): number {
    return 2;
  }

  /** 每级移动速度增益(与普通 NPC 一致,显式声明以便与 Java 侧常量对齐) */
  protected override getMoveSpeedBonusPerLevel(): number {
    return RoseBeaconRb7Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.healthMax = RoseBeaconRb7Entity.HEALTH_BASE
      + RoseBeaconRb7Entity.HEALTH_PER_LEVEL * this.level;
    this.health = this.healthMax;
    this.game_exp = RoseBeaconRb7Entity.BASE_GAME_EXP + this.level * 2;
  }

  /** 当前治疗间隔(秒):随等级缩短,下限 1.0 秒 */
  private getHealInterval(): number {
    return Math.max(
      1,
      RoseBeaconRb7Entity.HEAL_INTERVAL
        - RoseBeaconRb7Entity.HEAL_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 当前治疗范围(px):随等级扩大 */
  public getHealRange(): number {
    return RoseBeaconRb7Entity.HEAL_RANGE_BASE
      + RoseBeaconRb7Entity.HEAL_RANGE_PER_LEVEL * this.level;
  }

  /** 当前单次治疗量(点):1 级起 +1(最高 2 点) */
  private getHealAmount(): number {
    return RoseBeaconRb7Entity.HEAL_AMOUNT_BASE + (this.level >= 1 ? 1 : 0);
  }

  /** 行为前:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 主循环:按节奏为范围内所有受伤玩家治疗 */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead) return;
    if (this.healPulseTimer > 0) {
      this.healPulseTimer = Math.max(0, this.healPulseTimer - context.deltaTime);
    }
    this.healCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.healCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.healCooldownRemaining += this.getHealInterval();
    }
  }

  /** 治疗范围内所有受伤玩家(各自的治疗量不超过其生命上限) */
  public override action(context: ActionLoopContext): void {
    const range = this.getHealRange();
    const rangeSq = range * range;
    let healedAny = false;

    for (const player of context.playerEntities) {
      if (player.isDead) continue;
      if (player.health >= player.healthMax) continue;
      const dx = player.position.x - this.position.x;
      const dy = player.position.y - this.position.y;
      if (dx * dx + dy * dy > rangeSq) continue;

      const healed = Math.min(this.getHealAmount(), player.healthMax - player.health);
      if (healed <= 0) continue;
      player.health += healed;
      healedAny = true;
    }

    if (healedAny) {
      this.healPulseTimer = 0.4;
    }
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

  /** 绘制:蔷薇主体 + 五瓣花徽 + 治疗脉冲环 */
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

    // 治疗脉冲环:治疗瞬间向外扩散,提示"刚刚生效"
    if (this.healPulseTimer > 0) {
      const t = 1 - Math.min(1, this.healPulseTimer / 0.4);
      const radius = this.getHealRange() * (0.35 + 0.65 * t);
      ctx.globalAlpha = 0.35 * (1 - t);
      ctx.strokeStyle = RoseBeaconRb7Entity.GLOW_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 主体
    ctx.fillStyle = this.fillColor || RoseBeaconRb7Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = this.strokeColor || RoseBeaconRb7Entity.GLOW_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

    // 五瓣花徽:中央花心 + 四瓣
    ctx.fillStyle = RoseBeaconRb7Entity.GLOW_COLOR;
    const petal = 3;
    ctx.fillRect(screenPos.x - petal / 2, screenPos.y - petal / 2, petal, petal);
    ctx.fillRect(screenPos.x - petal / 2, top + 2.5, petal, 2.5);
    ctx.fillRect(screenPos.x - petal / 2, top + h - 5, petal, 2.5);
    ctx.fillRect(left + 2.5, screenPos.y - petal / 2, 2.5, petal);
    ctx.fillRect(left + w - 5, screenPos.y - petal / 2, 2.5, petal);

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

export { RoseBeaconRb7Entity };
