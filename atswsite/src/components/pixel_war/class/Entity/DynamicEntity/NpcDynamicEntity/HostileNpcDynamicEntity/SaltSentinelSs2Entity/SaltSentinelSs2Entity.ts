import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import { WaveBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/WaveBulletDynamicEntity/WaveBulletDynamicEntity';
import { NovaShootSkill } from '@/components/pixel_war/class/Skill/Skills/NovaShootSkill/NovaShootSkill';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {
  Point,
  DynamicEntitieList,
  GameConfig,
  ActionLoopContext,
  EntityDebugFlags
} from '@/components/pixel_war/interface/Interface';

/**
 * 敌对 NPC「SaltSentinelSs2」(盐白哨兵 ss2)。
 *
 * <p>行为:几乎不动的<b>扫描哨塔</b> —— 以极低速度小幅游走,不受"移动中才能射击"限制,
 * 按固定节奏朝<b>最近的玩家</b>方向释放一道 3 发扇面波弹(±20°),
 * 且每释放一次,整道扇面的朝向就顺时针偏转 {@link SaltSentinelSs2Entity.SWEEP_DEG_PER_BURST}°,
 * 于是弹幕像雷达扫描一样绕着哨塔转圈,玩家必须卡着扫过之后的空档推进。</p>
 *
 * <p>等级差异:生命 5 + 1 × Level(升级即回满);掉落经验 exp = 5 + 2 × Level;
 * 弹幕间隔随等级缩短(2.6 - 0.3 × Level 秒);每级移动速度仅 +5,保持"重装哨塔"定位。</p>
 *
 * <p>战利品:子弹球(75%)+「新星环射」技能球(25%)。</p>
 */
class SaltSentinelSs2Entity extends HostileNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.12;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '盐白哨兵';

  /** 主色调(盐白) */
  public static readonly MAIN_COLOR = '#EDF3F7';
  /** 辉光/描边色(浅青) */
  public static readonly GLOW_COLOR = '#7FD3E8';
  /** 炮口颜色 */
  public static readonly BARREL_COLOR = '#3C6E7A';

  /** 基准弹幕间隔(秒) */
  public static readonly BURST_INTERVAL = 2.6;
  /** 每级缩短的弹幕间隔(秒) */
  public static readonly BURST_INTERVAL_PER_LEVEL = 0.3;
  /** 基准生命值 */
  public static readonly HEALTH_BASE = 5;
  /** 每级增加的生命值 */
  public static readonly HEALTH_PER_LEVEL = 1;
  /** 基础掉落经验值 */
  public static readonly BASE_GAME_EXP = 5;
  /** 击杀获得的分数 */
  public static readonly KILL_SCORE = 5;
  /** 每级移动速度增益(远低于普通 NPC) */
  public static readonly MOVE_SPEED_BONUS_PER_LEVEL = 5;
  /** 最小移动速度(px/s) */
  public static readonly MIN_MOVE_SPEED = 30;
  /** 最大移动速度(px/s) */
  public static readonly MAX_MOVE_SPEED = 42;
  /** 每次弹幕的子弹数量(扇形均分) */
  public static readonly BULLETS_PER_BURST = 3;
  /** 扇形半张角(度) */
  public static readonly SPREAD_HALF_ANGLE_DEG = 20;
  /** 每次弹幕结束后扫掠角的推进量(度,顺时针) */
  public static readonly SWEEP_DEG_PER_BURST = 25;

  /** 弹幕冷却剩余(秒) */
  private burstCooldownRemaining = 0;
  /** 当前扫掠角(度):在瞄准方向的基础上叠加的偏转量 */
  private sweepDeg = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'salt_sentinel_ss2');
    this.fillColor = SaltSentinelSs2Entity.MAIN_COLOR;
    this.strokeColor = SaltSentinelSs2Entity.GLOW_COLOR;
    this.health = SaltSentinelSs2Entity.HEALTH_BASE;
    this.healthMax = SaltSentinelSs2Entity.HEALTH_BASE;
    this.kill_score = SaltSentinelSs2Entity.KILL_SCORE;
    this.game_exp = SaltSentinelSs2Entity.BASE_GAME_EXP;
    this.mapColor = SaltSentinelSs2Entity.MAIN_COLOR;
    // 重型哨塔:移动缓慢
    this.minMoveSpeed = SaltSentinelSs2Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = SaltSentinelSs2Entity.MAX_MOVE_SPEED;
    this.speed = SaltSentinelSs2Entity.MIN_MOVE_SPEED;
    this.loot = [
      { type: 'skillOrb', tag: NovaShootSkill.TAG, odds: 0.25 },
      // 会发射子弹的 NPC 有概率掉落子弹球(概率 75%)
      { type: 'bulletOrb', tag: 'bullet_orb', odds: 0.75 }
    ];
  }

  /** 等级上限:2 */
  public override getMaxLevel(): number {
    return 2;
  }

  /** 每级移动速度增益:哨塔只有 +5 */
  protected override getMoveSpeedBonusPerLevel(): number {
    return SaltSentinelSs2Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.healthMax = SaltSentinelSs2Entity.HEALTH_BASE
      + SaltSentinelSs2Entity.HEALTH_PER_LEVEL * this.level;
    this.health = this.healthMax;
    this.game_exp = SaltSentinelSs2Entity.BASE_GAME_EXP + this.level * 2;
  }

  /** 当前弹幕间隔(秒):随等级缩短,下限 1.0 秒 */
  private getBurstInterval(): number {
    return Math.max(
      1,
      SaltSentinelSs2Entity.BURST_INTERVAL
        - SaltSentinelSs2Entity.BURST_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 行为前:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 主循环:按固定节奏释放扫描扇面弹幕 */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead) return;
    this.burstCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.burstCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.burstCooldownRemaining += this.getBurstInterval();
    }
  }

  /** 朝最近玩家方向释放一道 3 发扇面波弹,并把扫掠角顺时针推进 */
  public override action(context: ActionLoopContext): void {
    const aimDirection = this.getAimDirection(context);
    const centerDeg = Math.atan2(aimDirection.y, aimDirection.x) * 180 / Math.PI
      + this.sweepDeg;

    const spawnDistance = this.width * 0.75;
    const count: number = SaltSentinelSs2Entity.BULLETS_PER_BURST;
    const halfAngle = SaltSentinelSs2Entity.SPREAD_HALF_ANGLE_DEG;
    const bulletSpeed = this.getBulletMoveSpeed();

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1; // -1 .. 1
      const rad = ((centerDeg + t * halfAngle) * Math.PI) / 180;
      const direction: Point = { x: Math.cos(rad), y: Math.sin(rad) };
      context.spawnBullet(
        new WaveBulletDynamicEntity(
          {
            x: this.position.x + direction.x * spawnDistance,
            y: this.position.y + direction.y * spawnDistance
          },
          direction,
          this.id,
          this.teamId,
          '',
          bulletSpeed
        )
      );
    }

    // 炮口朝向锁定为本次扇面中心方向(随快照下发,多人端亦可正确绘制炮口)
    this.facingDirection = { x: Math.cos(centerDeg * Math.PI / 180), y: Math.sin(centerDeg * Math.PI / 180) };
    // 扫掠角顺时针推进,形成"雷达扫描"效果
    this.sweepDeg += SaltSentinelSs2Entity.SWEEP_DEG_PER_BURST;
    if (this.sweepDeg >= 360) this.sweepDeg -= 360;
  }

  /** 行为后:无动作 */
  public override actionAfter(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 瞄准方向:优先指向最近的存活玩家,无玩家时退回当前朝向 */
  private getAimDirection(context: ActionLoopContext): Point {
    let nearest: Point | null = null;
    let nearestDist = Infinity;
    for (const player of context.playerEntities) {
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
    if (nearest !== null && nearestDist > 0.0001) {
      return {
        x: (nearest.x - this.position.x) / nearestDist,
        y: (nearest.y - this.position.y) / nearestDist
      };
    }
    return this.getUnitFacingDirection();
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

  /** 绘制:深色炮管(朝当前朝向)+ 盐白底座 + 扫描刻度环 */
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

    // 炮管:沿当前朝向伸出的深色长条
    const barrelAngle = Math.atan2(-this.facingDirection.y, this.facingDirection.x);
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(barrelAngle);
    ctx.fillStyle = SaltSentinelSs2Entity.BARREL_COLOR;
    ctx.fillRect(0, -2, w * 0.95, 4);
    ctx.fillStyle = SaltSentinelSs2Entity.GLOW_COLOR;
    ctx.fillRect(w * 0.8, -1.5, 3, 3);
    ctx.restore();

    // 底座
    ctx.save();
    ctx.fillStyle = this.fillColor || SaltSentinelSs2Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = this.strokeColor || SaltSentinelSs2Entity.GLOW_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
    // 内嵌扫描环
    ctx.strokeRect(left + 4.5, top + 4.5, w - 9, h - 9);
    // 中心感应核
    ctx.fillStyle = SaltSentinelSs2Entity.GLOW_COLOR;
    ctx.fillRect(screenPos.x - 2, screenPos.y - 2, 4, 4);

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

export { SaltSentinelSs2Entity };
