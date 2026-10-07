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
 * 敌对 NPC「CoralRedTentacleT1」(珊瑚红触手 t1)。
 *
 * <p>行为循环:移动 → 驻足 → 移动(与其他敌对 NPC 相同的普通随机游走)。</p>
 *
 * <p>攻击方式:本体自带一条「触手」攻击线段(生成时即存在,不是独立实体),</p>
 * <ul>
 *   <li>线段起点恒为<b>本体中心</b>,因此触手随本体移动而同步移动;</li>
 *   <li>线段以本体为中心<b>顺时针全向旋转</b>,初始方向<b>正西</b>,固定 2°/tick;</li>
 *   <li>线段长度随等级成长:Len = 100 + Level × 25(px);</li>
 *   <li>所有碰到线段的玩家实体:首次接触受 1 点伤害,持续接触每 10 tick 再受 1 点伤害;</li>
 *   <li>特例:本 NPC 被吸附为从者时不会对主人玩家造成伤害(同队玩家同样不受伤)。</li>
 * </ul>
 *
 * <p>关于「旋转角度」的实现:本体只累计一个 tick 计数 {@link CoralRedTentacleT1Entity.tentacleTicks}
 * (每 tick +1,等价于"初始生成 tick 与当前 tick 的差值"),</p>
 * <p>当前角度由该计数<b>派生</b>计算(:angle = 180° - ticks × 2°),因此不需要每 tick 更新"旋转角度"字段,
 * 也不会因多次 update 而累积浮点误差。该计数由权威端维护并随快照下发,客户端据此绘制同一角度。</p>
 *
 * <p>渲染风格:「像素热浪」——复古像素抖动。</p>
 * <ul>
 *   <li>触手由 3px 的方块串构成,边缘用确定性抖动的像素淡出,形成燃烧般的余烬;</li>
 *   <li>整条触手带横向热浪摆动,越靠末端摆幅越大,末端还有随时间向外飘散的火星;</li>
 *   <li>本体同样采用硬边描边 + 棋盘抖动高光,与本作复古像素美术保持一致;</li>
 *   <li>始终沿「本体中心 → 触手末端」的直线绘制,与命中判定完全一致。</li>
 * </ul>
 *
 * <p>等级差异:掉落经验 exp = 5 + Level;移动速度随等级提升(与其他敌对 NPC 相同,每级 +20);无子弹能力。</p>
 *
 * <p>战利品:不配置任何战利品(仅正常掉落经验球)。</p>
 */
type TentacleRenderContext = {
  /** 本体中心(屏幕坐标,即触手起点) */
  origin: { x: number; y: number };
  /** 触手末端(屏幕坐标) */
  end: { x: number; y: number };
  /** 触手的屏幕单位方向向量 */
  dir: { x: number; y: number };
  /** 触手的屏幕像素长度 */
  screenLength: number;
  /** 真实时间(秒),供纯视觉动画使用 */
  timeSec: number;
};

class CoralRedTentacleT1Entity extends HostileNpcDynamicEntity {
  /** 生成权重 */
  public static GENERATE_WEIGHT = 0.22;
  /** NPC 类型显示名称(用于击杀提示等 UI 文案) */
  public static readonly NAME: string = '珊瑚红触手';

  /** 主色调 */
  public static readonly MAIN_COLOR = '#D96C62';
  /** 辉光色调(同时作为描边色) */
  public static readonly GLOW_COLOR = '#F9C8B2';

  /** 触手长度基准(px,等级 0) */
  public static readonly TENTACLE_LENGTH_BASE = 100;
  /** 每级增加的触手长度(px) */
  public static readonly TENTACLE_LENGTH_PER_LEVEL = 25;
  /** 触手旋转角速度(度/tick):顺时针,1 tick = 20ms → 相当于 100°/秒 */
  public static readonly TENTACLE_ROTATION_DEG_PER_TICK = 2;
  /** 触手初始方向(度,世界坐标 y 轴向上):180° 即正西 */
  public static readonly TENTACLE_INITIAL_ANGLE_DEG = 180;
  /** 触手判定半宽(px) */
  public static readonly TENTACLE_HALF_WIDTH = 4;
  /** 触手首次接触伤害 / 持续接触单次伤害(点) */
  public static readonly TENTACLE_DAMAGE = 1;
  /** 触手持续接触的结算间隔(tick):每累计 10 tick 再造成 1 点伤害 */
  public static readonly TENTACLE_CONTACT_TICK_INTERVAL = 10;

  /** 基础掉落经验值(exp = 5 + Level) */
  private static readonly BASE_GAME_EXP = 5;
  /** 击杀获得的分数 */
  private static readonly KILL_SCORE = 5;

  ////////////////////
  // 像素热浪渲染参数 -->
  ////////////////////

  /** 触手像素格边长(px) */
  private static readonly PIXEL_CELL = 3;
  /** 触手核心的像素格半宽(格数):1 → 共 3 格宽 */
  private static readonly PIXEL_CORE_HALF = 1;
  /** 外侧抖动余烬的最大半宽(格数) */
  private static readonly PIXEL_FRINGE_HALF = 2;
  /** 外侧余烬点亮阈值:哈希值大于该值则跳过该像素(越大越稀疏) */
  private static readonly PIXEL_FRINGE_THRESHOLD = 0.55;
  /** 末端飘散火星的数量 */
  private static readonly PIXEL_EMBER_COUNT = 5;

  ////////////////////
  // <-- 像素热浪渲染参数
  ////////////////////

  /**
   * 触手旋转相位(tick 计数)。
   *
   * <p>由权威端每 tick +1;当前角度由 {@link getTentacleAngleDeg} 派生计算,不直接存储角度。</p>
   * <p>该字段随快照下发(多人模式),客户端据此绘制与权威判定完全一致的角度。</p>
   */
  public tentacleTicks = 0;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId, '', '', 0, 'coral_red_tentacle_t1');
    this.fillColor = CoralRedTentacleT1Entity.MAIN_COLOR;
    this.strokeColor = CoralRedTentacleT1Entity.GLOW_COLOR;
    this.health = 1;
    this.healthMax = 1;
    this.kill_score = CoralRedTentacleT1Entity.KILL_SCORE;
    this.game_exp = CoralRedTentacleT1Entity.BASE_GAME_EXP;
    this.mapColor = CoralRedTentacleT1Entity.MAIN_COLOR;
    // 不配置战利品:击杀后仅正常掉落经验球(掉落经验 = 5 + Level)
  }

  /** 等级上限:2(与其他上限 2 的 NPC 共用 3 档等级概率表) */
  public override getMaxLevel(): number {
    return 2;
  }

  /** 等级变化时重算等级相关属性:掉落经验随等级提升(exp = 5 + Level) */
  protected override onNpcLevelApplied(): void {
    this.game_exp = CoralRedTentacleT1Entity.BASE_GAME_EXP + this.level;
  }

  ////////////////////
  // 触手(攻击线段) -->
  ////////////////////

  /** 当前等级的触手长度(px):Len = 100 + Level × 25 */
  public getTentacleLength(): number {
    return CoralRedTentacleT1Entity.TENTACLE_LENGTH_BASE
      + CoralRedTentacleT1Entity.TENTACLE_LENGTH_PER_LEVEL * this.level;
  }

  /**
   * 当前触手角度(度,世界坐标 y 轴向上)。
   *
   * <p>由"累计 tick 计数"派生:初始 180°(正西),每 tick 顺时针 2°(角度递减)。</p>
   */
  public getTentacleAngleDeg(): number {
    return CoralRedTentacleT1Entity.TENTACLE_INITIAL_ANGLE_DEG
      - this.tentacleTicks * CoralRedTentacleT1Entity.TENTACLE_ROTATION_DEG_PER_TICK;
  }

  /** 触手单位方向向量(世界坐标) */
  public getTentacleDirection(): Point {
    const rad = this.getTentacleAngleDeg() * Math.PI / 180;
    return { x: Math.cos(rad), y: Math.sin(rad) };
  }

  /**
   * 当前触手线段(世界坐标):起点 = 本体中心,终点 = 起点 + 方向 × 当前长度。
   *
   * <p>权威端(单人的 Worker / 多人的 Java 服务端)用它做命中判定,因此线段天然跟随本体移动。</p>
   */
  public getTentacleSegment(): { start: Point; end: Point } {
    const direction = this.getTentacleDirection();
    const length = this.getTentacleLength();
    return {
      start: { x: this.position.x, y: this.position.y },
      end: {
        x: this.position.x + direction.x * length,
        y: this.position.y + direction.y * length
      }
    };
  }

  ////////////////////
  // <-- 触手
  ////////////////////

  ////////////////////
  // 行为循环 -->
  ////////////////////

  /** 行为前:无动作 */
  public actionBefore(_context: ActionLoopContext): void {
    // 无动作
  }

  /**
   * 主循环:移动 → 驻足 → 移动。
   *
   * <p>游走与驻足由权威端统一驱动(同其他 NPC);触手命中结算也在权威端逐 tick 处理,
   * 因此这里无需任何动作。</p>
   */
  public actionLoop(_context: ActionLoopContext): void {
    // 无动作:本体不自发产生任何攻击实体
  }

  /** 行为:无动作(无子弹能力) */
  public action(_context: ActionLoopContext): void {
    // 无动作
  }

  /** 行为后:无动作 */
  public actionAfter(_context: ActionLoopContext): void {
    // 无动作
  }

  /**
   * 每帧更新:
   * 1. 推进触手旋转相位(仅累计 tick 计数,角度由该计数派生);
   * 2. 被玩家吸附时锁定在主人的从者网格格子上,不自行游走;
   * 3. 无主时走常规随机游走逻辑。
   */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if (this.isDead) return;

    // 触手持续旋转:只累计 tick 计数,不需要每 tick 记录/更新角度
    this.tentacleTicks += 1;

    if (this.ownerId !== null) {
      // 从者:瞬移到主人分配的格子中心,不参与游走(触手仍随本体一起移动)
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
      if (servant === null) continue;
      const newPosition = player.rowColToWorldPosition(servant.row, servant.col);
      if (newPosition === null) continue;
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

  /** 从者不参与游走目标分配 */
  public override canGetNewWanderTarget(dt: number, staticEntities: StaticEntity[]): boolean {
    if (this.ownerId !== null) return false;
    return super.canGetNewWanderTarget(dt, staticEntities);
  }

  /** 从者不参与"长时间未位移"的重新寻路看门狗 */
  public override updateNoMovementWatchdog(_dt: number): boolean {
    if (this.ownerId !== null) return false;
    return super.updateNoMovementWatchdog(_dt);
  }

  ////////////////////
  // <-- 行为循环
  ////////////////////

  ////////////////////
  // 渲染 -->
  ////////////////////

  /**
   * 绘制实体(「像素热浪」复古像素风格:方块串触手 + 硬边棋盘抖动本体)。
   *
   * <p>角度取自权威端下发的 {@link tentacleTicks}(客户端不会调用 update),因此多人模式下
   * 画面上的触手与权威端判定线段完全一致。</p>
   *
   * <p>触手始终沿「本体中心 → 触手末端」的直线绘制,与命中判定完全一致;
   * 几何全部在屏幕空间完成,因此自动适配世界 y 轴向上 / 屏幕 y 轴向下的翻转以及任意缩放。</p>
   */
  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);

    const angleDeg = this.getTentacleAngleDeg();
    const length = this.getTentacleLength();
    const rad = angleDeg * Math.PI / 180;
    const endScreen = worldToScreen(
      this.position.x + Math.cos(rad) * length,
      this.position.y + Math.sin(rad) * length
    );

    const beamDx = endScreen.x - screenPos.x;
    const beamDy = endScreen.y - screenPos.y;
    const screenLength = Math.hypot(beamDx, beamDy);

    if (screenLength >= 0.5) {
      const rc: TentacleRenderContext = {
        origin: screenPos,
        end: endScreen,
        dir: { x: beamDx / screenLength, y: beamDy / screenLength },
        screenLength,
        // 纯视觉动画统一用真实时间:客户端不调用 update,写实例字段会被快照水合覆盖
        timeSec: performance.now() / 1000
      };
      this.drawPixelHeatwave(ctx, rc);
    }

    this.drawBody(ctx, screenPos);

    // 等级徽标(调试开关 showLevel 开启时)
    this.drawNpcLevelBadge(ctx, worldToScreen, debugFlags);
  }

  /**
   * 绘制本体:硬边描边 + 主体 + 棋盘抖动高光,末尾叠加「受伤闪红」。
   */
  private drawBody(ctx: CanvasRenderingContext2D, screenPos: { x: number; y: number }): void {
    const drawW = this.renderWidth;
    const drawH = this.renderHeight;
    const left = screenPos.x - drawW / 2;
    const top = screenPos.y - drawH / 2;

    ctx.save();

    // 1px 深色描边,让像素方块更「实」
    ctx.fillStyle = '#3A1A18';
    ctx.fillRect(left - 1, top - 1, drawW + 2, drawH + 2);

    // 主体
    ctx.fillStyle = this.fillColor || CoralRedTentacleT1Entity.MAIN_COLOR;
    ctx.fillRect(left, top, drawW, drawH);

    // 棋盘抖动高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    for (let py = 0; py < drawH; py += 2) {
      const offset = (py / 2) % 2 === 0 ? 0 : 1;
      for (let px = offset; px < drawW; px += 2) {
        ctx.fillRect(left + px, top + py, 1, 1);
      }
    }

    // 受伤闪烁
    if (this.damageFlashTimer > 0) {
      const intensity = Math.min(1, this.damageFlashTimer / 0.25);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 0, 0, ${0.45 * intensity})`;
      ctx.fillRect(left, top, drawW, drawH);
    }

    ctx.restore();
  }

  /**
   * 绘制「像素热浪」触手:3px 方块串 + 抖动余烬 + 热浪摆动 + 末端飘散火星。
   *
   * <p>所有像素用 {@link H_hash2} 做确定性抖动,同一坐标每帧结果一致,不会闪烁;
   * 方块沿「本体中心 → 触手末端」的直线排布,永远与命中判定对齐。</p>
   */
  private drawPixelHeatwave(ctx: CanvasRenderingContext2D, rc: TentacleRenderContext): void {
    const { origin, end, dir, screenLength, timeSec } = rc;
    const cell = CoralRedTentacleT1Entity.PIXEL_CELL;
    const coreHalf = CoralRedTentacleT1Entity.PIXEL_CORE_HALF;
    const fringeHalf = CoralRedTentacleT1Entity.PIXEL_FRINGE_HALF;
    const fringeThreshold = CoralRedTentacleT1Entity.PIXEL_FRINGE_THRESHOLD;
    const steps = Math.max(1, Math.round(screenLength / cell));
    const nx = -dir.y;
    const ny = dir.x;

    ctx.save();

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // 热浪:垂直方向的正弦抖动,越靠末端抖动越大
      const jitter = Math.sin(t * 18 - timeSec * 12) * (1 + t * 3);
      const cx = origin.x + (end.x - origin.x) * t + nx * jitter;
      const cy = origin.y + (end.y - origin.y) * t + ny * jitter;

      // 核心实心方块
      for (let k = -coreHalf; k <= coreHalf; k++) {
        ctx.fillStyle = k === 0
          ? 'rgba(255, 244, 232, 0.95)'
          : 'rgba(217, 108, 98, 0.9)';
        ctx.fillRect(
          Math.round(cx + nx * k * cell),
          Math.round(cy + ny * k * cell),
          cell, cell
        );
      }

      // 外侧抖动像素:按确定性哈希随机点亮,形成像素余烬
      for (let k = -fringeHalf; k <= fringeHalf; k++) {
        if (k >= -coreHalf && k <= coreHalf) continue;
        if (H_hash2(i, k + 8) > fringeThreshold) continue;
        ctx.fillStyle = `rgba(255, 150, 120, ${0.5 * (1 - t)})`;
        ctx.fillRect(
          Math.round(cx + nx * k * cell),
          Math.round(cy + ny * k * cell),
          cell, cell
        );
      }
    }

    // 末端余烬:随时间向外飘散的小方块
    for (let e = 0; e < CoralRedTentacleT1Entity.PIXEL_EMBER_COUNT; e++) {
      const seed = H_hash2(e, Math.floor(timeSec * 8));
      const t = ((timeSec * 0.7) + e * 0.2) % 1;
      const ex = end.x + dir.x * t * 18 * (0.5 + seed) + (H_hash2(e, 1) - 0.5) * 10;
      const ey = end.y + dir.y * t * 18 * (0.5 + seed) + (H_hash2(e, 2) - 0.5) * 10;
      ctx.fillStyle = `rgba(255, 180, 120, ${0.6 * (1 - t)})`;
      ctx.fillRect(Math.round(ex), Math.round(ey), cell, cell);
    }

    ctx.restore();
  }

  ////////////////////
  // <-- 渲染
  ////////////////////
}

/**
 * 确定性二维哈希(返回 [0, 1))。
 *
 * <p>用于像素抖动:同一坐标每帧结果一致,避免 Math.random 造成的闪烁。</p>
 */
const H_hash2 = (a: number, b: number): number => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

export { CoralRedTentacleT1Entity };