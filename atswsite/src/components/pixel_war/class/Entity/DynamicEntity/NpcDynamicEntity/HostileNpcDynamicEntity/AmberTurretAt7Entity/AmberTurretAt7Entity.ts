import { SniperBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/SniperBulletDynamicEntity/SniperBulletDynamicEntity';
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
 * 敌对 NPC「AmberTurretAt7」(琥珀炮台 at7)。
 *
 * <p>行为:几乎不移动的<b>重型炮台</b> —— 以极低的移动速度小幅游走,
 * 不依赖"移动时才开火"的限制,而是按固定节奏朝当前朝向射出一发型穿甲狙击弹
 * (弹体长、存活久、射程类型为 long)。</p>
 *
 * <p>等级差异:生命 6 + 2 × Level(升级即回满);掉落经验 exp = 6 + 2 × Level;
 * 射击间隔随等级缩短(2.4 - 0.4 × Level 秒);每级移动速度仅 +5(远低于普通 NPC 的 +20,
 * 保持"重装炮台"的定位)。</p>
 *
 * <p>战利品:子弹球(概率 75%)。</p>
 */
class AmberTurretAt7Entity extends HostileNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.09;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '琥珀炮台';

  /** 主色调(琥珀) */
  public static readonly MAIN_COLOR = '#E8A33D';
  /** 辉光/描边色 */
  public static readonly GLOW_COLOR = '#FFE0A3';
  /** 炮管颜色 */
  public static readonly BARREL_COLOR = '#6B4A18';

  /** 基准射击间隔(秒) */
  public static readonly ACTION_INTERVAL = 2.4;
  /** 每级缩短的射击间隔(秒) */
  public static readonly ACTION_INTERVAL_PER_LEVEL = 0.4;
  /** 基准生命值 */
  public static readonly HEALTH_BASE = 6;
  /** 每级增加的生命值 */
  public static readonly HEALTH_PER_LEVEL = 2;
  /** 基础掉落经验值 */
  public static readonly BASE_GAME_EXP = 6;
  /** 击杀获得的分数 */
  public static readonly KILL_SCORE = 6;
  /** 每级移动速度增益(远低于普通 NPC) */
  public static readonly MOVE_SPEED_BONUS_PER_LEVEL = 5;
  /** 最小移动速度(px/s) */
  public static readonly MIN_MOVE_SPEED = 30;
  /** 最大移动速度(px/s) */
  public static readonly MAX_MOVE_SPEED = 40;

  /** 射击冷却剩余(秒) */
  private actionCooldownRemaining = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'amber_turret_at7');
    this.fillColor = AmberTurretAt7Entity.MAIN_COLOR;
    this.strokeColor = AmberTurretAt7Entity.GLOW_COLOR;
    this.health = AmberTurretAt7Entity.HEALTH_BASE;
    this.healthMax = AmberTurretAt7Entity.HEALTH_BASE;
    this.kill_score = AmberTurretAt7Entity.KILL_SCORE;
    this.game_exp = AmberTurretAt7Entity.BASE_GAME_EXP;
    this.mapColor = AmberTurretAt7Entity.MAIN_COLOR;
    // 重型:移动缓慢
    this.minMoveSpeed = AmberTurretAt7Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = AmberTurretAt7Entity.MAX_MOVE_SPEED;
    this.speed = AmberTurretAt7Entity.MIN_MOVE_SPEED;
    this.loot = [
      // 会发射子弹的 NPC 有概率掉落子弹球(概率 75%)
      { type: 'bulletOrb', tag: 'bullet_orb', odds: 0.75 }
    ];
  }

  /** 等级上限:2 */
  public override getMaxLevel(): number {
    return 2;
  }

  /** 每级移动速度增益:炮台只有 +5,远低于普通 NPC 的 +20 */
  protected override getMoveSpeedBonusPerLevel(): number {
    return AmberTurretAt7Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.healthMax = AmberTurretAt7Entity.HEALTH_BASE
      + AmberTurretAt7Entity.HEALTH_PER_LEVEL * this.level;
    this.health = this.healthMax;
    this.game_exp = AmberTurretAt7Entity.BASE_GAME_EXP + this.level * 2;
  }

  /** 当前射击间隔(秒):随等级缩短,下限 0.6 秒 */
  private getActionInterval(): number {
    return Math.max(
      0.6,
      AmberTurretAt7Entity.ACTION_INTERVAL
        - AmberTurretAt7Entity.ACTION_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 行为前:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /**
   * 主循环:炮台不受"移动中才能射击"限制,只要存活就按固定节奏持续开火。
   */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead) return;
    this.actionCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.actionCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.actionCooldownRemaining += this.getActionInterval();
    }
  }

  /** 朝当前朝向发射一发型穿甲狙击弹 */
  public override action(context: ActionLoopContext): void {
    const direction = this.getUnitFacingDirection();
    const spawnDistance = this.width * 0.75;
    context.spawnBullet(
      new SniperBulletDynamicEntity(
        {
          x: this.position.x + direction.x * spawnDistance,
          y: this.position.y + direction.y * spawnDistance
        },
        direction,
        this.id,
        this.teamId
      )
    );
  }

  /** 归一化的朝向单位向量(朝向可能为零向量时回退为正东) */
  private getUnitFacingDirection(): Point {
    const fx = this.facingDirection.x;
    const fy = this.facingDirection.y;
    const len = Math.hypot(fx, fy);
    if (len < 0.0001) return { x: 1, y: 0 };
    return { x: fx / len, y: fy / len };
  }

  /** 行为后:无动作 */
  public override actionAfter(_context: ActionLoopContext): void {
    // 无动作
  }

  /**
   * 每帧更新:被玩家吸附为从者时锁定在主人分配的格子上,否则走常规游走。
   */
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

  /** 绘制:深色炮管(朝当前朝向)+ 琥珀重装底座 + 中心铆钉 */
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

    // 炮管:沿当前朝向伸出的深色长条(朝向取自权威端下发的 facingDirection,客户端同样正确)
    const barrelAngle = Math.atan2(-this.facingDirection.y, this.facingDirection.x);
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(barrelAngle);
    ctx.fillStyle = AmberTurretAt7Entity.BARREL_COLOR;
    ctx.fillRect(0, -2, w * 0.95, 4);
    ctx.fillStyle = AmberTurretAt7Entity.GLOW_COLOR;
    ctx.fillRect(w * 0.8, -1.5, 3, 3);
    ctx.restore();

    // 底座
    ctx.save();
    ctx.fillStyle = this.fillColor || AmberTurretAt7Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = this.strokeColor || AmberTurretAt7Entity.GLOW_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
    // 内嵌护甲环,表现"重装"
    ctx.strokeRect(left + 4.5, top + 4.5, w - 9, h - 9);
    // 中心铆钉
    ctx.fillStyle = AmberTurretAt7Entity.GLOW_COLOR;
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

    if(debugFlags){
      if(debugFlags.showTag) {//底部的tag
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(this.tag, screenPos.x, screenPos.y + (this.renderHeight/2) + 20);
      }
    }
  }
}

export { AmberTurretAt7Entity };
