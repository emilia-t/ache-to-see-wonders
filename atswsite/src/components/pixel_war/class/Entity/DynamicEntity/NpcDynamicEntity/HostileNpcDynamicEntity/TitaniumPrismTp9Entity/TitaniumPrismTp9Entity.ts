import { SpiralBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/SpiralBulletDynamicEntity/SpiralBulletDynamicEntity';
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
 * 敌对 NPC「TitaniumPrismTp9」(钛白棱镜 tp9)。
 *
 * <p>行为:缓慢游走的<b>弹幕发生器</b> —— 每隔固定时间,以自身为中心向 8 个方向
 * 同时射出<b>螺旋弹</b>(弹道会持续弯折),形成一圈向外扩散的盘旋弹幕,
 * 需要玩家观察弹道弯曲方向再找缝隙穿过。</p>
 *
 * <p>等级差异:生命 3 + 1 × Level(升级即回满);掉落经验 exp = 4 + 2 × Level;
 * 弹幕间隔随等级缩短(3.0 - 0.5 × Level 秒)。</p>
 *
 * <p>战利品:子弹球(概率 75%)。</p>
 */
class TitaniumPrismTp9Entity extends HostileNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.13;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '钛白棱镜';

  /** 主色调(钛白) */
  public static readonly MAIN_COLOR = '#DCE6F2';
  /** 辉光/描边色(青蓝) */
  public static readonly GLOW_COLOR = '#7FE9FF';

  /** 基准弹幕间隔(秒) */
  public static readonly BURST_INTERVAL = 3;
  /** 每级缩短的弹幕间隔(秒) */
  public static readonly BURST_INTERVAL_PER_LEVEL = 0.5;
  /** 基准生命值 */
  public static readonly HEALTH_BASE = 3;
  /** 每级增加的生命值 */
  public static readonly HEALTH_PER_LEVEL = 1;
  /** 基础掉落经验值 */
  public static readonly BASE_GAME_EXP = 4;
  /** 击杀获得的分数 */
  public static readonly KILL_SCORE = 4;
  /** 每级移动速度增益 */
  public static readonly MOVE_SPEED_BONUS_PER_LEVEL = 20;
  /** 最小移动速度(px/s) */
  public static readonly MIN_MOVE_SPEED = 45;
  /** 最大移动速度(px/s) */
  public static readonly MAX_MOVE_SPEED = 65;
  /** 每次弹幕发射的螺旋弹数量(全向均分) */
  public static readonly BULLETS_PER_BURST = 8;

  /** 弹幕冷却剩余(秒) */
  private burstCooldownRemaining = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'titanium_prism_tp9');
    this.fillColor = TitaniumPrismTp9Entity.MAIN_COLOR;
    this.strokeColor = TitaniumPrismTp9Entity.GLOW_COLOR;
    this.health = TitaniumPrismTp9Entity.HEALTH_BASE;
    this.healthMax = TitaniumPrismTp9Entity.HEALTH_BASE;
    this.kill_score = TitaniumPrismTp9Entity.KILL_SCORE;
    this.game_exp = TitaniumPrismTp9Entity.BASE_GAME_EXP;
    this.mapColor = TitaniumPrismTp9Entity.MAIN_COLOR;
    this.minMoveSpeed = TitaniumPrismTp9Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = TitaniumPrismTp9Entity.MAX_MOVE_SPEED;
    this.speed = TitaniumPrismTp9Entity.MIN_MOVE_SPEED;
    this.loot = [
      // 会发射子弹的 NPC 有概率掉落子弹球(概率 75%)
      { type: 'bulletOrb', tag: 'bullet_orb', odds: 0.75 }
    ];
  }

  /** 等级上限:2 */
  public override getMaxLevel(): number {
    return 2;
  }

  /** 每级移动速度增益(默认 +20,显式声明以便与 Java 侧常量对齐) */
  protected override getMoveSpeedBonusPerLevel(): number {
    return TitaniumPrismTp9Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.healthMax = TitaniumPrismTp9Entity.HEALTH_BASE
      + TitaniumPrismTp9Entity.HEALTH_PER_LEVEL * this.level;
    this.health = this.healthMax;
    this.game_exp = TitaniumPrismTp9Entity.BASE_GAME_EXP + this.level * 2;
  }

  /** 当前弹幕间隔(秒):随等级缩短,下限 1.0 秒 */
  private getBurstInterval(): number {
    return Math.max(
      1,
      TitaniumPrismTp9Entity.BURST_INTERVAL
        - TitaniumPrismTp9Entity.BURST_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 行为前:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 主循环:不依赖移动状态,按固定节奏释放全向螺旋弹幕 */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead) return;
    this.burstCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.burstCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.burstCooldownRemaining += this.getBurstInterval();
    }
  }

  /** 向四周均分发射一圈螺旋弹 */
  public override action(context: ActionLoopContext): void {
    const count = TitaniumPrismTp9Entity.BULLETS_PER_BURST;
    const spawnDistance = this.width * 0.7;
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      context.spawnBullet(
        new SpiralBulletDynamicEntity(
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

  /**
   * 绘制:钛白棱镜本体 + 随时间缓慢旋转的 8 向刻度环。
   *
   * <p>旋转用真实时间推导(客户端不调用 update,写入实例字段会被快照水合覆盖),
   * 因此单人/多人都能正确旋转。</p>
   */
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

    // 刻度环:8 个随真实时间旋转的小方块,预示弹幕方向数
    const timeSec = performance.now() / 1000;
    const spin = timeSec * (Math.PI / 3);
    const ringRadius = w * 0.85;
    ctx.fillStyle = TitaniumPrismTp9Entity.GLOW_COLOR;
    for (let i = 0; i < TitaniumPrismTp9Entity.BULLETS_PER_BURST; i++) {
      const angle = spin + (i * Math.PI * 2) / TitaniumPrismTp9Entity.BULLETS_PER_BURST;
      const px = screenPos.x + Math.cos(angle) * ringRadius;
      const py = screenPos.y + Math.sin(angle) * ringRadius;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }

    // 棱镜主体
    ctx.fillStyle = this.fillColor || TitaniumPrismTp9Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = this.strokeColor || TitaniumPrismTp9Entity.GLOW_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

    // 内部菱形高光,强化"棱镜"质感
    ctx.beginPath();
    ctx.moveTo(screenPos.x, top + 2.5);
    ctx.lineTo(left + w - 2.5, screenPos.y);
    ctx.lineTo(screenPos.x, top + h - 2.5);
    ctx.lineTo(left + 2.5, screenPos.y);
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

export { TitaniumPrismTp9Entity };
