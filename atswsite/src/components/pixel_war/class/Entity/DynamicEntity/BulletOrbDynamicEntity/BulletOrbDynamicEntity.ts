import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { PlayerDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/PlayerDynamicEntity/PlayerDynamicEntity';
import type { Point, DynamicEntitieList, GameConfig, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

/**
 * 子弹球实体(kind: bullet_orb)
 *
 * 与经验球(ExpOrbDynamicEntity)、技能球(SkillOrbDynamicEntity)同为"掉落物"型动态实体:
 * - 击杀"具备发射子弹能力"的 NPC(普通子弹 / 镭射子弹)时按概率掉落;
 * - **自身不寻找玩家**:只做"存在时长 + 惯性滑行";
 *   由权威端的"玩家主动搜索并吸取"逻辑(Service.updatePickups)按距离牵引与吸收;
 * - 玩家子弹已达上限时不可吸取 —— 此时玩家会跳过它，子弹球静置在地上，
 *   不会再出现"永远绕着满子弹玩家弹跳"的观感;
 * - 玩家剩余容量不足时只吸收一部分,剩余的子弹球继续留在地上;
 * - 超时未被吸取则自动消失。
 *
 * 子弹球不参与战斗碰撞,仅用于承载若干发子弹。
 */
class BulletOrbDynamicEntity extends DynamicEntity {
  public static readonly WIDTH = 10;// 物理碰撞体积(宽,px)
  public static readonly HEIGHT = 10;// 物理碰撞体积(高,px)
  public static readonly ATTRACT_RANGE = 200;// 吸引范围(px)
  public static readonly PICKUP_RANGE = 26;// 拾取范围(px)
  public static readonly LIFETIME = 45;// 子弹球存在时长(秒)
  /** 单颗子弹球默认承载的子弹数 */
  public static readonly DEFAULT_VALUE = 1;

  /** 主色(银色,与子弹外观一致) */
  public static readonly MAIN_COLOR = '#c9d6e3';
  /** 辉光/高光色 */
  public static readonly GLOW_COLOR = '#f2f7fc';
  /** 弹体暗部/描边色 */
  public static readonly CORE_COLOR = '#5c6b7a';

  /** 承载的子弹数(大于 1 时拾取会被拆分) */
  public value: number;
  /** 已存活时间(秒) */
  public age: number;
  /** 是否已被拾取(或超时消失),用于移除 */
  public isPickedUp: boolean;

  constructor(position: Point, value: number = BulletOrbDynamicEntity.DEFAULT_VALUE) {
    super(
      position,
      BulletOrbDynamicEntity.WIDTH,
      BulletOrbDynamicEntity.HEIGHT,
      '',
      '子弹球',
      'bullet_orb',
      'bullet_orb'
    );
    this.value = Math.max(1, Math.floor(value));
    this.age = 0;
    this.isPickedUp = false;
    this.fillColor = BulletOrbDynamicEntity.MAIN_COLOR;
    this.strokeColor = BulletOrbDynamicEntity.GLOW_COLOR;
    this.speed = 0;
    this.minMoveSpeed = 0;
    this.maxMoveSpeed = 0;
  }

  public override update(
    dt: number,
    _staticEntities: StaticEntity[],
    _dynamicEntities: DynamicEntitieList,
    _gameConfig: GameConfig
  ): void {
    if (this.isPickedUp) return;

    this.age += dt;
    if (this.age >= BulletOrbDynamicEntity.LIFETIME) {
      this.isPickedUp = true;// 超时消失
      return;
    }

    // 仅保留惯性滑行(爆出时的冲量逐渐衰减):不再自行寻找玩家
    this.applyAirResistance(dt);
    this.position.x += this.motionVelocity.x * dt;
    this.position.y += this.motionVelocity.y * dt;
    this.updateCollisionBox();
  }

  ////////////////////
  // 被玩家主动吸取(由权威端调用) -->
  ////////////////////

  /** 吸取范围(px):玩家在此范围内会主动牵引本子弹球 */
  public getAbsorbRange(): number {
    return BulletOrbDynamicEntity.ATTRACT_RANGE;
  }

  /** 拾取范围(px):进入该距离即被玩家吸收(子弹球为点判定,与玩家体积无关) */
  public getPickupRange(_player: PlayerDynamicEntity): number {
    return BulletOrbDynamicEntity.PICKUP_RANGE;
  }

  /**
   * 玩家当前能否接受本子弹球。
   *
   * 子弹已满时返回 false —— 此时玩家不会牵引它，
   * 因此子弹球会安静地待在地上，而不是绕着"装不下"的玩家反复弹跳。
   */
  public canBeAbsorbedBy(player: PlayerDynamicEntity): boolean {
    return player.getBulletCapacity() > 0;
  }

  /** 被玩家牵引一帧:朝玩家飘行,距离越近速度越快 */
  public attractTowardPlayer(player: PlayerDynamicEntity, dt: number): void {
    if (this.isPickedUp) return;
    const dx = player.position.x - this.position.x;
    const dy = player.position.y - this.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.0001) return;
    const speed = 150 + (1 - distance / BulletOrbDynamicEntity.ATTRACT_RANGE) * 380;
    this.position.x += (dx / distance) * speed * dt;
    this.position.y += (dy / distance) * speed * dt;
    this.updateCollisionBox();
  }

  /** 被玩家吸收:容量为 0 时不吸收(留在原地),容量不足时只吸收一部分 */
  public absorbByPlayer(player: PlayerDynamicEntity): void {
    const accepted = player.addBulletCount(this.value);
    if (accepted >= this.value) {
      this.isPickedUp = true;
    } else if (accepted > 0) {
      this.value -= accepted;// 仅部分吸收,剩余部分继续留在地上
    }
  }

  /** 是否已被拾取(统一拾取管线使用的读取器) */
  public isAbsorbed(): boolean {
    return this.isPickedUp;
  }

  ////////////////////
  // <-- 被玩家主动吸取
  ////////////////////

  /** 生成六边形路径(顶点朝向 angle) */
  private pathHexagon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    angle: number
  ): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const theta = angle + (Math.PI / 3) * i;
      const px = cx + Math.cos(theta) * radius;
      const py = cy + Math.sin(theta) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /**
   * 绘制子弹球:银色光晕 + 银色子弹图案(尖头朝上,含弹肩与弹壳分界线)。
   * 尺寸仅 10×10,因此不再画六边形轮廓,直接用高对比度的银色子弹体让玩家一眼认出。
   * 临近超时前 8 秒开始闪烁提示。
   */
  public override draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    _debugFlags?: EntityDebugFlags
  ): void {
    if (this.isPickedUp) return;

    const screenPos = worldToScreen(this.position.x, this.position.y);
    const time = performance.now() / 1000;
    const remaining = BulletOrbDynamicEntity.LIFETIME - this.age;
    const blink = remaining < 8 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 6)) : 1;
    const pulse = 1 + Math.sin(time * 4) * 0.06;
    const half = (this.width / 2) * pulse;

    ctx.save();
    ctx.globalAlpha = blink;

    // 外层银色光晕(让 10px 的小球在战场上依然显眼)
    const glow = ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, half * 2.6);
    glow.addColorStop(0, 'rgba(242, 247, 252, 0.95)');
    glow.addColorStop(0.42, 'rgba(201, 214, 227, 0.38)');
    glow.addColorStop(1, 'rgba(201, 214, 227, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, half * 2.6, 0, Math.PI * 2);
    ctx.fill();

    // 银色子弹:竖直,尖头朝上(弹尖 → 弹肩 → 弹壳底)
    const w = this.width * 0.52;
    const h = this.height * 0.96;
    const top = screenPos.y - h / 2;
    const left = screenPos.x - w / 2;
    ctx.beginPath();
    ctx.moveTo(screenPos.x, top);
    ctx.lineTo(screenPos.x + w / 2, top + h * 0.34);
    ctx.lineTo(screenPos.x + w / 2, top + h);
    ctx.lineTo(screenPos.x - w / 2, top + h);
    ctx.lineTo(screenPos.x - w / 2, top + h * 0.34);
    ctx.closePath();

    const body = ctx.createLinearGradient(left, 0, left + w, 0);
    body.addColorStop(0, '#8e9aa8');
    body.addColorStop(0.32, '#eef4fa');
    body.addColorStop(0.62, '#c9d6e3');
    body.addColorStop(1, '#6f7c8a');
    ctx.fillStyle = body;
    ctx.shadowColor = 'rgba(242, 247, 252, 0.95)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(60, 72, 84, 0.9)';
    ctx.lineWidth = Math.max(0.6, this.width * 0.08);
    ctx.stroke();

    // 弹壳分界线(弹头与弹壳的分界,强化"子弹"识别)
    ctx.beginPath();
    ctx.moveTo(left, top + h * 0.62);
    ctx.lineTo(left + w, top + h * 0.62);
    ctx.strokeStyle = 'rgba(70, 84, 98, 0.8)';
    ctx.stroke();

    ctx.restore();
  }
}

export { BulletOrbDynamicEntity };
