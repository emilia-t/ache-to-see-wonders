import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { PlayerDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/PlayerDynamicEntity/PlayerDynamicEntity';
import type { Point, DynamicEntitieList, GameConfig, EntityDebugFlags } from '@/components/pixel_war/interface/Interface';
import { H_getSkillByTag } from '@/components/pixel_war/registry/SkillRegistry';

/**
 * 技能球实体(kind: skill_orb)
 *
 * 与经验球(ExpOrbDynamicEntity)同为"掉落物"型动态实体:
 * - 击杀携带 loot 配置的 NPC 时按概率掉落
 * - 会向附近的存活玩家飘行,被玩家拾取后玩家获得对应技能
 * - 超过存在时长未被拾取则自动消失
 *
 * 技能球不堆叠、不参与战斗碰撞,仅用于承载一个技能 tag。
 */
class SkillOrbDynamicEntity extends DynamicEntity {
  public static readonly WIDTH = 14;// 物理碰撞体积(宽,px)
  public static readonly HEIGHT = 14;// 物理碰撞体积(高,px)
  public static readonly ATTRACT_RANGE = 200;// 吸引范围(px)
  public static readonly PICKUP_RANGE = 26;// 拾取范围(px)
  public static readonly LIFETIME = 45;// 技能球存在时长(秒)
  public static readonly FALLBACK_COLOR = '#9fe8ff';// 技能未注册时的兜底颜色

  /** 技能标签(如 va2_shoot_skill) */
  public skillTag: string;
  /** 已存活时间(秒) */
  public age: number;
  /** 是否已被拾取(或超时消失),用于移除 */
  public isPickedUp: boolean;

  constructor(position: Point, skillTag: string) {
    super(
      position,
      SkillOrbDynamicEntity.WIDTH,
      SkillOrbDynamicEntity.HEIGHT,
      '',
      '技能球',
      'skill_orb',
      'skill_orb'
    );
    this.skillTag = skillTag;
    this.age = 0;
    this.isPickedUp = false;
    this.speed = 0;
    this.minMoveSpeed = 0;
    this.maxMoveSpeed = 0;
    this.fillColor = this.getSkillColor();
    this.strokeColor = this.getSkillColor();
  }

  /**
   * 技能主题色(技能未注册时使用兜底色)
   */
  public getSkillColor(): string {
    return H_getSkillByTag(this.skillTag)?.color ?? SkillOrbDynamicEntity.FALLBACK_COLOR;
  }

  /**
   * 技能名称(技能未注册时回退为 tag)
   */
  public getSkillName(): string {
    return H_getSkillByTag(this.skillTag)?.name ?? this.skillTag;
  }

  public override update(
    dt: number,
    _staticEntities: StaticEntity[],
    dynamicEntities: DynamicEntitieList,
    _gameConfig: GameConfig
  ): void {
    if (this.isPickedUp) return;

    this.age += dt;
    if (this.age >= SkillOrbDynamicEntity.LIFETIME) {
      this.isPickedUp = true;// 超时消失
      return;
    }

    // 寻找最近的存活玩家
    let nearestPlayer: PlayerDynamicEntity | null = null;
    let nearestDist = Infinity;
    for (const player of dynamicEntities.playerDynamicEntitys) {
      if (player.isDead) continue;
      const d = Math.hypot(this.position.x - player.position.x, this.position.y - player.position.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestPlayer = player;
      }
    }

    if (nearestPlayer && nearestDist <= SkillOrbDynamicEntity.ATTRACT_RANGE) {
      // 向玩家飘行,距离越近速度越快
      const dir = {
        x: (nearestPlayer.position.x - this.position.x) / nearestDist,
        y: (nearestPlayer.position.y - this.position.y) / nearestDist
      };
      const speed = 150 + (1 - nearestDist / SkillOrbDynamicEntity.ATTRACT_RANGE) * 380;
      this.position.x += dir.x * speed * dt;
      this.position.y += dir.y * speed * dt;
    } else {
      // 无目标时使用空气阻力减速(掉落时的随机冲量逐渐衰减)
      this.applyAirResistance(dt);
      this.position.x += this.motionVelocity.x * dt;
      this.position.y += this.motionVelocity.y * dt;
    }

    this.updateCollisionBox();

    // 拾取判定:拾取成功后技能进入玩家背包
    if (nearestPlayer) {
      const d = Math.hypot(this.position.x - nearestPlayer.position.x, this.position.y - nearestPlayer.position.y);
      if (d <= SkillOrbDynamicEntity.PICKUP_RANGE) {
        // 已持有相同技能时也直接消耗技能球,避免地面堆积重复技能球
        nearestPlayer.acquireSkill(this.skillTag);
        this.isPickedUp = true;
      }
    }
  }

  /**
   * 生成六边形路径(顶点朝向 angle)
   */
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

  public draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    _canvasSize: { width: number; height: number },
    _debugFlags?: EntityDebugFlags
  ): void {
    if (this.isPickedUp) return;

    const screenPos = worldToScreen(this.position.x, this.position.y);
    const color = this.getSkillColor();
    const time = performance.now() / 1000;
    // 临近超时前 8 秒开始闪烁提示
    const remaining = SkillOrbDynamicEntity.LIFETIME - this.age;
    const blink = remaining < 8 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 6)) : 1;
    const pulse = 1 + Math.sin(time * 4) * 0.08;
    const radius = (this.width / 2) * pulse;

    ctx.save();
    ctx.globalAlpha = blink;

    // 外层能量光晕
    const glow = ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, radius * 3.2);
    glow.addColorStop(0, color);
    glow.addColorStop(0.35, `${color}66`);
    glow.addColorStop(1, `${color}00`);
    ctx.globalAlpha = blink * 0.55;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = blink;

    // 外层旋转六边形轮廓
    ctx.strokeStyle = `${color}cc`;
    ctx.lineWidth = 1.2;
    this.pathHexagon(ctx, screenPos.x, screenPos.y, radius * 1.85, time * 0.9);
    ctx.stroke();

    // 内层反向旋转六边形(机械结构感)
    ctx.strokeStyle = `${color}88`;
    ctx.lineWidth = 1;
    this.pathHexagon(ctx, screenPos.x, screenPos.y, radius * 1.45, -time * 1.4);
    ctx.stroke();

    // 主体:六边形能量核心
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    this.pathHexagon(ctx, screenPos.x, screenPos.y, radius, Math.PI / 6);
    const body = ctx.createRadialGradient(
      screenPos.x - radius * 0.3,
      screenPos.y - radius * 0.3,
      radius * 0.1,
      screenPos.x,
      screenPos.y,
      radius
    );
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.45, color);
    body.addColorStop(1, `${color}aa`);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 中心竖条(技能光柱)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(screenPos.x - 0.75, screenPos.y - radius * 0.55, 1.5, radius * 1.1);

    // 环绕的能量碎片
    for (let i = 0; i < 3; i++) {
      const theta = time * 2.2 + (Math.PI * 2 / 3) * i;
      const orbit = radius * 2.3;
      ctx.fillStyle = `${color}dd`;
      ctx.beginPath();
      ctx.arc(
        screenPos.x + Math.cos(theta) * orbit,
        screenPos.y + Math.sin(theta) * orbit * 0.75,
        Math.max(1, radius * 0.16),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
  }
}

export { SkillOrbDynamicEntity };
