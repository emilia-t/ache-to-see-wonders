import { PiercingBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/PiercingBulletDynamicEntity/PiercingBulletDynamicEntity';
import { NeutralNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/NeutralNpcDynamicEntity/NeutralNpcDynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type {
  Point,
  DynamicEntitieList,
  GameConfig,
  ActionLoopContext,
  EntityDebugFlags
} from '@/components/pixel_war/interface/Interface';

/**
 * 中立 NPC「IvoryWandererIw1」(象牙游荡者 iw1)。
 *
 * <p>行为:<b>和平游荡</b> —— 不会主动攻击任何人,只是缓慢地把象牙色身躯挪来挪去,
 * 因此在混战中是可以被忽略的"背景生物"。</p>
 *
 * <p><b>关键特性:被打会记仇并主动追击。</b>一旦受到任意伤害(见 {@link applyDamage} 覆写),
 * 它会立刻"激怒",<b>锁定本次伤害的来源实体</b>并一路追击:</p>
 * <ul>
 *   <li>移动:以仇家当前位置为移动目标(允许弯曲路径绕开障碍),不再随机游荡;</li>
 *   <li>攻击:按固定节奏朝<b>仇家方向</b>发射穿甲弹(可贯穿多个目标);</li>
 *   <li>仇家死亡/离开世界后放弃追击并<b>恢复中立</b>,回到和平游荡;</li>
 * </ul>
 * <p><b>激怒与从者状态互斥(硬性规则):</b>激怒期间不会被任何玩家吸附为从者
 * (见 {@link canBeAbsorbedAsServant});若在成为从者之后被击伤,则立即解除激怒回到中立。</p>
 * <p>激怒后外观会转为亮红脉动描边作为警告;失去仇家即解除,再次被击伤会重新激怒。</p>
 *
 * <p>等级差异:生命 4 + 1 × Level(升级即回满);掉落经验 exp = 3 + 2 × Level;
 * 激怒后的射击间隔随等级缩短(2.0 - 0.2 × Level 秒)。</p>
 *
 * <p>战利品:子弹球(概率 75%)。</p>
 */
class IvoryWandererIw1Entity extends NeutralNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.06;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '象牙游荡者';

  /** 主色调(象牙白) */
  public static readonly MAIN_COLOR = '#F3EEDB';
  /** 和平状态描边色 */
  public static readonly GLOW_COLOR = '#C8BC9A';
  /** 激怒状态描边色(亮红警告) */
  public static readonly ENRAGED_COLOR = '#FF5A4D';

  /** 基准生命值 */
  public static readonly HEALTH_BASE = 4;
  /** 每级增加的生命值 */
  public static readonly HEALTH_PER_LEVEL = 1;
  /** 基础掉落经验值 */
  public static readonly BASE_GAME_EXP = 3;
  /** 击杀获得的分数 */
  public static readonly KILL_SCORE = 3;
  /** 每级移动速度增益 */
  public static readonly MOVE_SPEED_BONUS_PER_LEVEL = 20;
  /** 最小移动速度(px/s) */
  public static readonly MIN_MOVE_SPEED = 55;
  /** 最大移动速度(px/s) */
  public static readonly MAX_MOVE_SPEED = 85;
  /** 激怒后的基准射击间隔(秒) */
  public static readonly ENRAGED_INTERVAL = 2;
  /** 每级缩短的射击间隔(秒) */
  public static readonly ENRAGED_INTERVAL_PER_LEVEL = 0.2;
  /** 与仇家保持的弹性距离(px):过远则逼近、过近则后撤 */
  public static readonly STANDOFF_DISTANCE = 120;
  /** 弹性距离的容差(px):偏差在容差内即原地射击,避免不断抽撞 */
  public static readonly STANDOFF_DEADZONE = 25;
  /** 追击时的重新寻路间隔(秒),避免每帧重建路径 */
  public static readonly CHASE_RETARGET_INTERVAL = 0.2;

  /** 是否已被激怒(受到过伤害) */
  public enraged = false;
  /** 激怒后的射击冷却剩余(秒) */
  private actionCooldownRemaining = 0;
  /** 仇家实体 id(激怒时锁定本次伤害来源;为空表示无追击目标) */
  private enemyId: number | null = null;
  /** 仇家当前位置(每帧由 update 解析;为空表示不追击) */
  private enemyPosition: Point | null = null;
  /** 追击时的重新寻路冷却剩余(秒) */
  private chaseRetargetCooldown = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'ivory_wanderer_iw1');
    this.fillColor = IvoryWandererIw1Entity.MAIN_COLOR;
    this.strokeColor = IvoryWandererIw1Entity.GLOW_COLOR;
    this.health = IvoryWandererIw1Entity.HEALTH_BASE;
    this.healthMax = IvoryWandererIw1Entity.HEALTH_BASE;
    this.kill_score = IvoryWandererIw1Entity.KILL_SCORE;
    this.game_exp = IvoryWandererIw1Entity.BASE_GAME_EXP;
    this.mapColor = IvoryWandererIw1Entity.MAIN_COLOR;
    this.minMoveSpeed = IvoryWandererIw1Entity.MIN_MOVE_SPEED;
    this.maxMoveSpeed = IvoryWandererIw1Entity.MAX_MOVE_SPEED;
    this.speed = IvoryWandererIw1Entity.MIN_MOVE_SPEED;
    this.loot = [
      // 会发射子弹的 NPC 有概率掉落子弹球(概率 75%)
      { type: 'bulletOrb', tag: 'bullet_orb', odds: 0.75 }
    ];
  }

  /** 等级上限:2 */
  public override getMaxLevel(): number {
    return 2;
  }

  /** 每级移动速度增益(与普通 NPC 一致,显式声明以便与 Java 侧常量对齐) */
  protected override getMoveSpeedBonusPerLevel(): number {
    return IvoryWandererIw1Entity.MOVE_SPEED_BONUS_PER_LEVEL;
  }

  /** 等级变化时重算:生命上限(升级即回满)与掉落经验 */
  protected override onNpcLevelApplied(): void {
    this.healthMax = IvoryWandererIw1Entity.HEALTH_BASE
      + IvoryWandererIw1Entity.HEALTH_PER_LEVEL * this.level;
    this.health = this.healthMax;
    this.game_exp = IvoryWandererIw1Entity.BASE_GAME_EXP + this.level * 2;
  }

  /**
   * 追击:激怒且仇家仍在时,忽略外部下发的游走目标,改为以<b>弹性站位点</b>为移动目标
   * (允许弯曲路径以绕开障碍),从而与仇家保持 {@link STANDOFF_DISTANCE} 附近的距离。
   */
  public override setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    const enemyPos = this.enemyPosition;
    if (enemyPos !== null) {
      return super.setTarget(this.getStandoffPoint(enemyPos), staticEntities, {
        ...options,
        preferStraight: false
      });
    }
    return super.setTarget(target, staticEntities, options);
  }

  /**
   * 弹性站位点:以仇家为圆心、沿「仇家 → 自己」方向、距离为 {@link STANDOFF_DISTANCE} 的点。
   *
   * <p>离仇家过远时该点落在两者之间(于是向前逼近),过近时落在更外侧(于是后撤),
   * 于是与自己位置的偏差 |d - STANDOFF| 被逐步消化,形成有弹性的站位距离。</p>
   */
  private getStandoffPoint(enemyPos: Point): Point {
    const standoff = IvoryWandererIw1Entity.STANDOFF_DISTANCE;
    const dx = this.position.x - enemyPos.x;
    const dy = this.position.y - enemyPos.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.0001) {
      // 与仇家完全重合:退化为朝当前朝向的反方向后撤
      const back = this.getUnitFacingDirection();
      return { x: enemyPos.x - back.x * standoff, y: enemyPos.y - back.y * standoff };
    }
    return {
      x: enemyPos.x + (dx / len) * standoff,
      y: enemyPos.y + (dy / len) * standoff
    };
  }

  /**
   * 激怒状态下拒绝被任何玩家吸附为从者(<b>硬性规则</b>)。
   * 由吸附逻辑统一门禁,单人(Worker)与多人(Java)两侧行为一致。
   */
  public override canBeAbsorbedAsServant(): boolean {
    return !this.enraged;
  }

  /**
   * 受伤即"记仇":把和平状态切换为激怒,并锁定本次伤害的来源实体作为仇家。
   *
   * <p>仇家被击败或离开世界后由 {@link resolveEnemyPosition} 恢复中立(再次被击伤会重新激怒)。</p>
   *
   * <p>来源 id 由权威端在结算伤害前写入 {@code DynamicEntity.lastDamagerId}
   * (见 {@code H_applyBulletDamage}),因此这里直接读取即可。</p>
   */
  public override applyDamage(amount: number): void {
    super.applyDamage(amount);
    if (this.isDead || amount <= 0) return;
    this.enraged = true;
    const attackerId = this.lastDamagerId;
    if (attackerId !== null && attackerId !== this.id) {
      this.enemyId = attackerId;
    }
  }

  /** 激怒后的射击间隔(秒):随等级缩短,下限 0.5 秒 */
  private getActionInterval(): number {
    return Math.max(
      0.5,
      IvoryWandererIw1Entity.ENRAGED_INTERVAL
        - IvoryWandererIw1Entity.ENRAGED_INTERVAL_PER_LEVEL * this.level
    );
  }

  /** 行为前:无动作 */
  public override actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 主循环:和平状态下什么都不做;激怒后按节奏发射穿甲弹 */
  public override actionLoop(context: ActionLoopContext): void {
    if (this.isDead || !this.enraged) return;
    this.actionCooldownRemaining -= this.getActionDelta(context.deltaTime);
    while (this.actionCooldownRemaining <= 0 && !this.isDead) {
      this.action(context);
      this.actionCooldownRemaining += this.getActionInterval();
    }
  }

  /** 朝<b>仇家方向</b>发射一发穿甲弹(无仇家时退回当前朝向) */
  public override action(context: ActionLoopContext): void {
    const direction = this.getShotDirection();
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

  /** 每帧更新:被玩家吸附为从者时锁定在主人分配的格子上;否则解析仇家并走追击/游走 */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.isDead) return;
    if (this.ownerId !== null) {
      // 从者由主人网格控制、不参与追击:与「激怒」互斥,这里恢复中立
      this.revertToNeutral();
      this.followOwner(dynamicEntity);
      return;
    }
    if (this.enraged) {
      // 激怒后:每帧定位仇家,并朝弹性站位点重新寻路(仇家消失则在此恢复中立)
      this.enemyPosition = this.resolveEnemyPosition(dynamicEntity);
      this.refreshChaseRetarget(dt, staticEntities);
    } else {
      this.enemyPosition = null;
    }
    super.update(dt, staticEntities, dynamicEntity, gameConfig);
  }

  /**
   * 追击寻路:与仇家的距离偏差超出弹性容差时,按固定间隔重新下发目标
   * (setTarget 覆写会把它改写为弹性站位点),避免每帧重建路径。
   */
  private refreshChaseRetarget(dt: number, staticEntities: StaticEntity[]): void {
    const enemyPos = this.enemyPosition;
    if (enemyPos === null) {
      this.chaseRetargetCooldown = 0;
      return;
    }
    const distance = Math.hypot(enemyPos.x - this.position.x, enemyPos.y - this.position.y);
    if (Math.abs(distance - IvoryWandererIw1Entity.STANDOFF_DISTANCE) <= IvoryWandererIw1Entity.STANDOFF_DEADZONE) {
      // 已在弹性区间内:原地射击,不再调整站位
      this.chaseRetargetCooldown = 0;
      return;
    }
    this.chaseRetargetCooldown -= dt;
    if (this.chaseRetargetCooldown > 0) return;
    this.chaseRetargetCooldown = IvoryWandererIw1Entity.CHASE_RETARGET_INTERVAL;
    this.setTarget(enemyPos, staticEntities, { preferStraight: false });
  }

  /**
   * 解析仇家当前位置:依次在玩家 / NPC 列表中按 id 查找。
   *
   * <p>仇家死亡或被移出世界时清除锁定并<b>恢复中立</b>(停止追击与射击,回到和平游荡;
   * 此后再次被击伤会重新激怒)。无仇家可追时同样恢复中立。</p>
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

    // 仇家已消失(死亡/被移出世界):放弃追击并恢复中立
    this.revertToNeutral();
    return null;
  }

  /** 解除激怒,回到中立游荡状态(清除仇家锁定与追击目标) */
  private revertToNeutral(): void {
    this.enraged = false;
    this.enemyId = null;
    this.enemyPosition = null;
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

  /** 绘制:象牙主体 + 内嵌菱形;激怒后描边转为亮红并带脉动 */
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
    ctx.fillStyle = this.fillColor || IvoryWandererIw1Entity.MAIN_COLOR;
    ctx.fillRect(left, top, w, h);

    // 描边:和平 = 柔和象牙灰;激怒 = 亮红脉动
    if (this.enraged) {
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 220));
      ctx.strokeStyle = IvoryWandererIw1Entity.ENRAGED_COLOR;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 2;
      ctx.strokeRect(left + 1, top + 1, w - 2, h - 2);
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = this.strokeColor || IvoryWandererIw1Entity.GLOW_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
    }

    // 内嵌菱形:象牙质感
    ctx.beginPath();
    ctx.moveTo(screenPos.x, top + 3.5);
    ctx.lineTo(left + w - 3.5, screenPos.y);
    ctx.lineTo(screenPos.x, top + h - 3.5);
    ctx.lineTo(left + 3.5, screenPos.y);
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

export { IvoryWandererIw1Entity };
