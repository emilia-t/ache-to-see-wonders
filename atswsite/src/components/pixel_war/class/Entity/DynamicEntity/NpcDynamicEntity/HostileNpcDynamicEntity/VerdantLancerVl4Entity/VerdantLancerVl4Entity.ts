import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import { PiercingBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/PiercingBulletDynamicEntity/PiercingBulletDynamicEntity';
import { FanShootSkill } from '@/components/pixel_war/class/Skill/Skills/FanShootSkill/FanShootSkill';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {
  Point,
  DynamicEntitieList,
  GameConfig,
  ActionLoopContext,
  EntityDebugFlags
} from '@/components/pixel_war/interface/Interface';

/**
 * 敌对 NPC「VerdantLancerVl4」(青翠枪骑兵 vl4)。
 *
 * <p>行为:<b>主动冲锋</b>型敌人 —— 无视随机游走,始终朝<b>最近的玩家</b>直线冲锋;
 * 一旦与目标的距离进入 {@link VerdantLancerVl4Entity.CHARGE_FIRE_RANGE} 之内,
 * 便按节奏挺枪突刺,射出一发<b>穿甲弹</b>(可贯穿沿途多个目标),逼迫玩家横向闪避。</p>
 *
 * <p>等级差异:生命 3 + 1 × Level(升级即回满);掉落经验 exp = 4 + 2 × Level;
 * 突刺间隔随等级缩短(1.4 - 0.1 × Level 秒);每级移动速度 +25(略高于普通 NPC,
 * 强化"冲锋"的压迫感)。</p>
 *
 * <p>战利品:子弹球(75%)+「扇面连射」技能球(20%)。</p>
 */
class VerdantLancerVl4Entity extends HostileNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.12;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '青翠枪骑兵';

  /** 主色调(青翠) */
  public static readonly MAIN_COLOR = '#57C77A';
  /** 辉光/描边色(浅绿) */
  public static readonly GLOW_COLOR = '#D6FFE0';

  /** 基准突刺间隔(秒) */
  public static readonly ACTION_INTERVAL = 1.4;
  /** 每级缩短的突刺间隔(秒) */
  public static readonly ACTION_INTERVAL_PER_LEVEL = 0.1;
  /** 基准生命值 */
  public static readonly HEALTH_BASE = 3;
  /** 每级增加的生命值 */
  public static readonly HEALTH_PER_LEVEL = 1;
  /** 基础掉落经验值 */
  public static readonly BASE_GAME_EXP = 4;
  /** 击杀获得的分数 */
  public static readonly KILL_SCORE = 4;
  /** 每级移动速度增益(高于普通 NPC) */
  public static readonly MOVE_SPEED_BONUS_PER_LEVEL = 25;
  /** 最小移动速度(px/s) */
  public static readonly MIN_MOVE_SPEED = 85;
  /** 最大移动速度(px/s) */
  public static readonly MAX_MOVE_SPEED = 130;
  /** 进入该距离内才会挺枪突刺(px) */
  public static readonly CHARGE_FIRE_RANGE = 260;

  /** 最近玩家位置(每帧由 update 解析;为空表示无目标) */
  private playerPosition: Point | null = null;
  /** 突刺冷却剩余(秒) */
  private actionCooldownRemaining = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'verdant_lancer_vl4');
    this.fillColor = VerdantLancerVl4Entity.MAIN_COLOR;
    this.strokeColor = VerdantLancerVl4Entity.GLOW_COLOR;
    this.health = VerdantLancerVl4Entity.HEALTH_BASE;
    this.healthMax = VerdantLancerVl4Entity.HEALTH_BASE;
    this.kill_score = VerdantLancerVl4Entity.KILL_SCORE;
    this.game_exp = VerdantLancerVl4Entity.BASE_GAME_EXP;
    this.mapColor = VerdantLancerVl4Entity.MAIN_COLOR;
    this.minMoveSpeed = VerdantLancerVl4Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = VerdantLancerVl4Entity.MAX_MOVE_SPEED;
    this.speed = VerdantLancerVl4Entity.MIN_MOVE_SPEED;
    this.loot = [
      { type: 'skillOrb', tag: FanShootSkill.TAG, odds: 0.2 },
      // 会发射子弹的 NPC 有概率掉落子弹球(概率 75%)
      { type: 'bulletOrb', tag: 'bullet_orb', odds: 0.75 }
    ];
  }

  /** 等级上限:5(与其他上限 5 的 NPC 共用 6 档等级概率表) */
  public override getMaxLevel(): number {
    return 5;
  }

  /** 每级移动速度增益:枪骑兵 +25 */
  protected override getMoveSpeedBonusPerLevel(): number {
    return VerdantLancerVl4Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.healthMax = VerdantLancerVl4Entity.HEALTH_BASE
      + VerdantLancerVl4Entity.HEALTH_PER_LEVEL * this.level;
    this.health = this.healthMax;
    this.game_exp = VerdantLancerVl4Entity.BASE_GAME_EXP + this.level * 2;
  }

  /** 当前突刺间隔(秒):随等级缩短,下限 0.5 秒 */
  private getActionInterval(): number {
    return Math.max(
      0.5,
      VerdantLancerVl4Entity.ACTION_INTERVAL
        - VerdantLancerVl4Entity.ACTION_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 覆盖移动目标:始终朝最近的玩家冲锋(允许弯曲路径绕开障碍) */
  public override setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    const playerPos = this.playerPosition;
    if (!playerPos) return false;
    return super.setTarget(playerPos, staticEntities, { ...options, preferStraight: false });
  }

  /** 每帧更新:解析最近玩家位置 → 被吸附时跟随主人,否则继续冲锋 */
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

    this.playerPosition = this.resolveNearestPlayerPosition(dynamicEntity);
    super.update(dt, staticEntities, dynamicEntity, gameConfig);
  }

  /** 解析最近的存活玩家位置(无玩家时返回 null) */
  private resolveNearestPlayerPosition(dynamicEntity: DynamicEntitieList): Point | null {
    let nearest: Point | null = null;
    let nearestDist = Infinity;
    for (const player of dynamicEntity.playerDynamicEntitys) {
      if (player.isDead) continue;
      const dist = Math.hypot(
        player.position.x - this.position.x,
        player.position.y - this.position.y
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { x: player.position.x, y: player.position.y };
      }
    }
    return nearest;
  }

  /** 行为前:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 主循环:进入突刺距离后按节奏挺枪;距离过远时蓄势不开火 */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead) return;
    if (this.ownerId !== null) {
      // 从者跟随主人时不再主动冲锋突刺,避免"跟着玩家乱刺"
      return;
    }
    const target = this.playerPosition;
    if (target === null) return;
    const distance = Math.hypot(target.x - this.position.x, target.y - this.position.y);
    if (distance > VerdantLancerVl4Entity.CHARGE_FIRE_RANGE) return;

    this.actionCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.actionCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.actionCooldownRemaining += this.getActionInterval();
    }
  }

  /** 朝最近玩家方向挺枪突刺,射出一发穿甲弹 */
  public override action(context: ActionLoopContext): void {
    const target = this.playerPosition;
    const direction = target !== null
      ? this.getUnitDirectionTo(target)
      : this.getUnitFacingDirection();
    const spawnDistance = this.width * 0.75;
    context.spawnBullet(
      new PiercingBulletDynamicEntity(
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

  /** 指向某点的归一化单位向量(重合时回退当前朝向) */
  private getUnitDirectionTo(target: Point): Point {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.0001) return this.getUnitFacingDirection();
    return { x: dx / len, y: dy / len };
  }

  /** 归一化的朝向单位向量(朝向可能为零向量时回退为正东) */
  private getUnitFacingDirection(): Point {
    const fx = this.facingDirection.x;
    const fy = this.facingDirection.y;
    const len = Math.hypot(fx, fy);
    if (len < 0.0001) return { x: 1, y: 0 };
    return { x: fx / len, y: fy / len };
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

  /** 绘制:青翠主体 + 朝向的长枪尖 + 受伤闪烁 + 等级徽标 */
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

    // 长枪:沿当前朝向伸出的尖锥(屏幕 y 轴与世界反向,故取负)
    const angle = Math.atan2(-this.facingDirection.y, this.facingDirection.x);
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(angle);
    ctx.fillStyle = VerdantLancerVl4Entity.GLOW_COLOR;
    ctx.beginPath();
    ctx.moveTo(w * 1.15, 0);
    ctx.lineTo(w * 0.55, -3);
    ctx.lineTo(w * 0.55, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 主体
    ctx.save();
    ctx.fillStyle = this.fillColor || VerdantLancerVl4Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = this.strokeColor || VerdantLancerVl4Entity.GLOW_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

    // 内部矛刃纹
    ctx.beginPath();
    ctx.moveTo(screenPos.x, top + 3.5);
    ctx.lineTo(screenPos.x, top + h - 3.5);
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

export { VerdantLancerVl4Entity };
