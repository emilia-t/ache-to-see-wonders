import { OrdinaryBulletDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/BulletDynamicEntity/OrdinaryBulletDynamicEntity/OrdinaryBulletDynamicEntity';
import { HostileNpcDynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/NpcDynamicEntity/HostileNpcDynamicEntity/HostileNpcDynamicEntity';
import type { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import type { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import type { Point, DynamicEntitieList, GameConfig, ActionLoopContext} from '@/components/pixel_war/interface/Interface';
import type { EntityDebugFlags } from '@/components/pixel_war/interface/Interface';

class WhitePixelEntity extends HostileNpcDynamicEntity {
  public static GENERATE_WEIGHT = 0.8;
  private static readonly ACTION_INTERVAL = 1;

  private isActionLoopRunning: boolean;
  private actionCooldownRemaining: number;

  constructor(
    position: Point,
    ownerId: number | null,
    teamId: number | null
  ) {
    super(position, ownerId, teamId, '', '', 0, 'white_pixel');
    this.fillColor = '#ffffff';
    this.strokeColor = '#bebebe';
    this.health = 100;
    this.healthMax = 100;
    this.isActionLoopRunning = false;
    this.actionCooldownRemaining = 0;
  }

  public tryPickupItem(_item: ItemEntity): boolean {
    return false;
  }

  public pickupItem(_item: ItemEntity): void {
    // 白色像素不拾取任何物品。
  }

  public override actionLoop(context: ActionLoopContext): void {
    if(this.ownerId === null){// 普通情况下只能在移动时射击
      if (this.isDead || !this.isMoving) {
        if (this.isActionLoopRunning) {
          this.actionAfter(context);
        }
        return;
      }

      if (!this.isActionLoopRunning) {
        this.actionBefore(context);
        return;
      }

      this.actionCooldownRemaining -= context.deltaTime;
      while (this.actionCooldownRemaining <= 0 && this.isMoving && !this.isDead) {
        this.action(context);
        this.actionCooldownRemaining += WhitePixelEntity.ACTION_INTERVAL;
      }
    }
    else{// 被玩家吸附情况下不考虑移动的条件
      if (this.isDead) {
        if (this.isActionLoopRunning) {
          this.actionAfter(context);
        }
        return;
      }

      if (!this.isActionLoopRunning) {
        this.actionBefore(context);
        return;
      }

      this.actionCooldownRemaining -= context.deltaTime;
      while (this.actionCooldownRemaining <= 0 && !this.isDead) {
        this.action(context);
        this.actionCooldownRemaining += WhitePixelEntity.ACTION_INTERVAL;
      }
    }
  }

  public override action(context: ActionLoopContext): void {
    const direction = this.getNormalizedFacingDirection();
    const spawnDistance = this.width * 0.6;
    if(this.ownerId === null){
      context.spawnBullet(
        new OrdinaryBulletDynamicEntity(
          {
            x: this.position.x + direction.x * spawnDistance,
            y: this.position.y + direction.y * spawnDistance,
          },
          direction,
          this.id,
          this.teamId
        )
      );
    }
    else{
      let bulletColor = '';
      for(const player of context.playerEntities){
        if(player.personRule.bulletColor !== ''){
          bulletColor = player.personRule.bulletColor;
          break;
        }
      }
      if(bulletColor !== ''){
        context.spawnBullet(
          new OrdinaryBulletDynamicEntity(
            {
              x: this.position.x + direction.x * spawnDistance,
              y: this.position.y + direction.y * spawnDistance,
            },
            direction,
            this.id,
            this.teamId,
            bulletColor
          )
        );
      }
      else{
        context.spawnBullet(
          new OrdinaryBulletDynamicEntity(
            {
              x: this.position.x + direction.x * spawnDistance,
              y: this.position.y + direction.y * spawnDistance,
            },
            direction,
            this.id,
            this.teamId
          )
        );
      }
    }
  }

  public override actionBefore(context: ActionLoopContext): void {
    this.isActionLoopRunning = true;
    this.action(context);
    this.actionCooldownRemaining = WhitePixelEntity.ACTION_INTERVAL;
  }

  public override actionAfter(_context: ActionLoopContext): void {
    this.isActionLoopRunning = false;
    this.actionCooldownRemaining = 0;
  }

  /**
   * 白色像素只沿上下左右四个正交方向随机移动。
   * @param target 忽略，实际目标由内部生成
   * @param staticEntities 静态实体列表，用于避障
   * @param options 忽略
   */
  public override setTarget(
    target: Point,
    staticEntities: StaticEntity[] = [],
    options: { preferStraight?: boolean } = {}
  ): boolean {
    const directions = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    const distance = 100 + Math.random() * 200;
    const newTarget: Point = {
      x: this.position.x + randomDir.x * distance,
      y: this.position.y + randomDir.y * distance,
    };

    return super.setTarget(newTarget, staticEntities, { preferStraight: true });
  }

  /**
   * 改写了部分
   * 1.移动完成后缩短停留时间，停留结束后自动开始下一段正交移动。
   * 2.如果npc有ownerId 则跟随ovner移动
   */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    if(this.ownerId !== null ){
      for(let pi=0;pi<dynamicEntity.playerDynamicEntitys.length;pi++){
        if(dynamicEntity.playerDynamicEntitys[pi].id === this.ownerId){
          let servant = dynamicEntity.playerDynamicEntitys[pi].selectServantByID(this.id);
          if(servant !== null){
            let newPosition = dynamicEntity.playerDynamicEntitys[pi].rowColToWorldPosition(servant.row,servant.col);
            if(newPosition !== null){
              this.position.x = newPosition.x;
              this.position.y = newPosition.y;
              this.updateCollisionBox();
              this.isMoving = false;
              this.nextTarget = { ...newPosition };
              this.targetHistory = [{ ...newPosition }];
              this.curvePoints = [{ ...newPosition }];
              this.currentCurveIndex = 0;
            }
          }
        }
      }
      return;
    }

    const wasMoving = this.isMoving;

    super.update(dt, staticEntities, dynamicEntity, gameConfig);

    if (this.isDead) return;

    if (wasMoving && !this.isMoving && this.stayDurationRemaining > 0) {
      this.stayDurationRemaining = 1 + Math.random() * 2;
    }

    if (!this.isMoving && this.stayDurationRemaining <= 0) {
      this.setTarget(this.position, staticEntities, { preferStraight: true });
    }
  }

  private getNormalizedFacingDirection(): Point {
    const len = Math.hypot(this.facingDirection.x, this.facingDirection.y);
    if (len < 0.0001) return { x: 0, y: 1 };
    return {
      x: this.facingDirection.x / len,
      y: this.facingDirection.y / len,
    };
  }

  /**
   * 绘制实体
   * @param ctx 
   * @param worldToScreen 
   * @param canvasSize 
   * @param debugFlags 
   */
  public draw(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    canvasSize: { width: number; height: number },
    debugFlags?: EntityDebugFlags
  ): void {
    const screenPos = worldToScreen(this.position.x, this.position.y);
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const left = screenPos.x - halfW;
    const top = screenPos.y - halfH;

    // 白色矩形
    ctx.fillStyle = this.fillColor || '#999';
    ctx.fillRect(left, top, this.width, this.height);
    ctx.strokeStyle = this.strokeColor || '#000';
    ctx.strokeRect(left, top, this.width, this.height);

    // 受伤闪烁
    if (this.damageFlashTimer > 0) {
      const intensity = Math.min(1, this.damageFlashTimer / 0.25);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 0, 0, ${0.45 * intensity})`;
      ctx.fillRect(left, top, this.width, this.height);
      ctx.restore();
    }

    // 血条
    const healthRatio = Math.max(0, Math.min(1, this.health / this.healthMax));
    const barWidth = Math.max(36, this.width);
    const barHeight = 4;
    const barX = screenPos.x - barWidth / 2;
    const topY = screenPos.y - halfH - 16;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';// 血条底
    ctx.fillRect(barX, topY, barWidth, barHeight);
    ctx.fillStyle = '#2ecc71';// 血条值
    ctx.fillRect(barX, topY, barWidth * healthRatio, barHeight);

    /////// 调试信息start
    if (debugFlags) {
      if (debugFlags.showTag) {//底部的tag
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(this.tag, screenPos.x, screenPos.y + halfH + 20);
      }
      const debugLines: string[] = [];//顶部的属性文本
      if(debugFlags.showHealth){
        debugLines.push(`health: ${this.health.toFixed(0)}`);
      }
      if(debugFlags.showMovementSpeed){
        debugLines.push(`speed: ${this.speed.toFixed(2)}`);
      }
      if(debugFlags.showMovementPassion){
        debugLines.push(`passion: ${(this.movementPassion * 100).toFixed(1)}%`);
      }
      if (debugLines.length > 0){// 按顺序渲染多行文本
        const lineHeight = 14;
        const baseY = screenPos.y - halfH - 28; // 最靠近头部的一行
        ctx.font = '11px Consolas, "Courier New", monospace';
        ctx.fillStyle = '#87cefa';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        for (let i = 0; i < debugLines.length; i++) {
          ctx.fillText(debugLines[i], screenPos.x, baseY - i * lineHeight);
        }
      }
      // 恢复默认文本排版设置,避免影响其他绘制
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'transparent';
      // 碰撞盒
      if (debugFlags.showCollisionBoxes) {
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const box = this.collisionBox;
        const topLeft = worldToScreen(box.x, box.y + box.height); // 注意Y轴转换
        const width = box.width;
        const height = box.height;
        ctx.strokeRect(topLeft.x, topLeft.y, width, height);
        ctx.restore();
      }
      // 运动轨迹
      if(debugFlags.showHistoricalTrajectory){
        ctx.save();
        // 1. 绘制平滑曲线路径(计划路径)
        if (this.curvePoints && this.curvePoints.length > 1) {
          ctx.beginPath();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#00ffff';  // 青色
          ctx.setLineDash([5, 5]);      // 虚线
          const firstScreen = worldToScreen(this.curvePoints[0].x, this.curvePoints[0].y);
          ctx.moveTo(firstScreen.x, firstScreen.y);
          for (let i = 1; i < this.curvePoints.length; i++) {
            const screenPos = worldToScreen(this.curvePoints[i].x, this.curvePoints[i].y);
            ctx.lineTo(screenPos.x, screenPos.y);
          }
          ctx.stroke();
        }
        // 2. 绘制历史目标点(targetHistory)
        if (this.targetHistory && this.targetHistory.length > 0) {
          ctx.fillStyle = 'rgba(255, 165, 0, 0.8)'; // 橙色
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          for (const pt of this.targetHistory) {
            const screenPos = worldToScreen(pt.x, pt.y);
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
        // 3. 绘制下一个目标点(nextTarget)
        const nextTarget = this.nextTarget;
        if (nextTarget && !(nextTarget.x === this.position.x && nextTarget.y === this.position.y)) {
          const screenPos = worldToScreen(nextTarget.x, nextTarget.y);
          ctx.beginPath();
          ctx.arc(screenPos.x, screenPos.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'; // 半透明红
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.stroke();
        }
        ctx.restore();
      }
      // 绘制朝向调试箭头
      if (debugFlags.showFacingDirection) {
        ctx.save();
        ctx.strokeStyle = '#1e90ff';
        ctx.fillStyle = '#1e90ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        const center = worldToScreen(this.position.x, this.position.y);
        const direction = this.facingDirection;
        const dirLen = Math.hypot(direction.x, direction.y);
        if (dirLen > 0.0001){
          const unitX = direction.x / dirLen;
          const unitY = direction.y / dirLen;
          const arrowLength = Math.max(this.width, this.height) * 0.9;
          const tipCanvas = {
            x: this.position.x + unitX * arrowLength,
            y: this.position.y + unitY * arrowLength,
          };
          const tip = worldToScreen(tipCanvas.x, tipCanvas.y);

          // 箭身
          ctx.beginPath();
          ctx.moveTo(center.x, center.y);
          ctx.lineTo(tip.x, tip.y);
          ctx.stroke();

          // 箭头
          const headLength = 8;
          const angle = Math.atan2(tip.y - center.y, tip.x - center.x);
          ctx.beginPath();
          ctx.moveTo(tip.x, tip.y);
          ctx.lineTo(
            tip.x - headLength * Math.cos(angle - Math.PI / 6),
            tip.y - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            tip.x - headLength * Math.cos(angle + Math.PI / 6),
            tip.y - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      // 绘制随机游走范围调试圆
      if (debugFlags.showMovementRange) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        const center = worldToScreen(this.position.x, this.position.y);
        const radius = Math.max(1, this.wanderRange);
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      //绘制兴趣范围调试圆
      if (debugFlags.showInterestRange) {
        if (this.perceptionRange !== 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          const center = worldToScreen(this.position.x, this.position.y);
          const radius = Math.max(1, this.perceptionRange);
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    /////// 调试信息end
  }

  public override updateNoMovementWatchdog(dt: number): boolean {// 不需要监测,此行为由actionLoop接管
    return false;
  }
}

export { WhitePixelEntity };
