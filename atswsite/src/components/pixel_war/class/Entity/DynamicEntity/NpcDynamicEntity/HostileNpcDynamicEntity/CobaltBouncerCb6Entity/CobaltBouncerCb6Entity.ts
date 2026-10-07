import { RicochetBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/RicochetBulletDynamicEntity/RicochetBulletDynamicEntity';
import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {
  Point,
  DynamicEntitieList,
  GameConfig,
  ActionLoopContext,
  EntityDebugFlags
} from '@/components/pixel_war/interface/Interface';

/**
 * 敌对 NPC「CobaltBouncerCb6」(钴蓝跳弹手 cb6)。
 *
 * <p>行为:中速游走的<b>跳弹射手</b> —— 不受"移动中才能射击"限制,按固定节奏朝当前朝向
 * 发射<b>跳弹</b>;跳弹撞墙后会反弹(最多 3 次),因此在狭窄地形里常常"拐弯"命中,
 * 逼迫玩家注意掩体形状。</p>
 *
 * <p>等级差异:生命 2 + 1 × Level(升级即回满);掉落经验 exp = 3 + 2 × Level;
 * 射击间隔随等级缩短(2.6 - 0.2 × Level 秒)。</p>
 *
 * <p>战利品:子弹球(概率 75%)。</p>
 */
class CobaltBouncerCb6Entity extends HostileNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.11;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '钴蓝跳弹手';

  /** 主色调(钴蓝) */
  public static readonly MAIN_COLOR = '#3E6BD8';
  /** 辉光/描边色 */
  public static readonly GLOW_COLOR = '#9FC0FF';

  /** 基准射击间隔(秒) */
  public static readonly ACTION_INTERVAL = 2.6;
  /** 每级缩短的射击间隔(秒) */
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
  public static readonly MAX_MOVE_SPEED = 105;

  /** 射击冷却剩余(秒) */
  private actionCooldownRemaining = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'cobalt_bouncer_cb6');
    this.fillColor = CobaltBouncerCb6Entity.MAIN_COLOR;
    this.strokeColor = CobaltBouncerCb6Entity.GLOW_COLOR;
    this.health = CobaltBouncerCb6Entity.HEALTH_BASE;
    this.healthMax = CobaltBouncerCb6Entity.HEALTH_BASE;
    this.kill_score = CobaltBouncerCb6Entity.KILL_SCORE;
    this.game_exp = CobaltBouncerCb6Entity.BASE_GAME_EXP;
    this.mapColor = CobaltBouncerCb6Entity.MAIN_COLOR;
    this.minMoveSpeed = CobaltBouncerCb6Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = CobaltBouncerCb6Entity.MAX_MOVE_SPEED;
    this.speed = CobaltBouncerCb6Entity.MIN_MOVE_SPEED;
    this.loot = [
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
    return CobaltBouncerCb6Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.healthMax = CobaltBouncerCb6Entity.HEALTH_BASE
      + CobaltBouncerCb6Entity.HEALTH_PER_LEVEL * this.level;
    this.health = this.healthMax;
    this.game_exp = CobaltBouncerCb6Entity.BASE_GAME_EXP + this.level * 2;
  }

  /** 当前射击间隔(秒):随等级缩短,下限 0.8 秒 */
  private getActionInterval(): number {
    return Math.max(
      0.8,
      CobaltBouncerCb6Entity.ACTION_INTERVAL
        - CobaltBouncerCb6Entity.ACTION_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 行为前:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 主循环:不依赖移动状态,按固定节奏发射跳弹 */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead) return;
    this.actionCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.actionCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.actionCooldownRemaining += this.getActionInterval();
    }
  }

  /** 朝当前朝向发射一发跳弹 */
  public override action(context: ActionLoopContext): void {
    const direction = this.getUnitFacingDirection();
    const spawnDistance = this.width * 0.7;
    context.spawnBullet(
      new RicochetBulletDynamicEntity(
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

  /** 绘制:钴蓝主体 + 四角折角纹(跳弹意象)+ 受伤闪烁 + 等级徽标 */
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
    ctx.fillStyle = this.fillColor || CobaltBouncerCb6Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = this.strokeColor || CobaltBouncerCb6Entity.GLOW_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

    // 内缩的折角方框,暗示"反弹轨迹"
    ctx.beginPath();
    ctx.moveTo(left + 4.5, top + h - 4.5);
    ctx.lineTo(left + 4.5, top + 4.5);
    ctx.lineTo(left + w - 4.5, top + 4.5);
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

export { CobaltBouncerCb6Entity };
