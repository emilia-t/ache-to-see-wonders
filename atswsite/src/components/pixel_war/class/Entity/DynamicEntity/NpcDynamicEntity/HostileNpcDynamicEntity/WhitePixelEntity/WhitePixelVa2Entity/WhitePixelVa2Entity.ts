import { WhitePixelEntity,OrdinaryBulletDynamicEntity,StaticEntity } from "@/components/pixel_war/class";
import type { Point, DynamicEntitieList, GameConfig, ActionLoopContext } from "@/components/pixel_war/interface/Interface";

/**
 * 白像素的变种体 va2
 * va2 象征它是以自身为中心向两个方向射击的，并且只能水平移动无法转向或停止
 */
class WhitePixelVa2Entity extends WhitePixelEntity {
  public static GENERATE_WEIGHT = 0.4;

  // 锁定水平移动方向: 1 = 向右, -1 = 向左
  private moveDirectionX: 1 | -1;
  // 是否已经锁定了方向（初始随机后永久锁定）
  private directionLocked: boolean;

  constructor(position: Point, ownerId: number | null, teamId: number | null) {
    super(position, ownerId, teamId);
    this.tag = 'white_pixel_va2';
    
    // 随机选择初始水平移动方向
    this.moveDirectionX = Math.random() < 0.5 ? -1 : 1;
    this.directionLocked = true;
    
    // 确保白变种体不会停留（移动持续）
    this.stayDurationRemaining = 0;
    // 强制移动标志为 true
    this.isMoving = true;
  }

  /**
   * 重写行动方法：向移动方向上下45°各射出一颗子弹，每次射击扣减自身生命值 2 点
   */
  public override action(context: ActionLoopContext): void {
    // 如果已经死亡，不再射击
    if (this.isDead) return;

    // 获取当前移动方向（水平轴 ±1）
    const baseDirectionX = this.moveDirectionX;
    const baseDirection = { x: baseDirectionX, y: 0 };
    
    // 计算两个倾斜方向：+45° 和 -45°
    const angle45 = Math.PI / 4;
    const dir1 = {
      x: baseDirection.x * Math.cos(angle45) - baseDirection.y * Math.sin(angle45),
      y: baseDirection.x * Math.sin(angle45) + baseDirection.y * Math.cos(angle45)
    };
    const dir2 = {
      x: baseDirection.x * Math.cos(-angle45) - baseDirection.y * Math.sin(-angle45),
      y: baseDirection.x * Math.sin(-angle45) + baseDirection.y * Math.cos(-angle45)
    };
    
    const spawnDistance = this.width * 0.6;
    const bulletColor = this.determineBulletColor(context);
    
    // 辅助函数：发射一颗子弹，并扣减生命值
    const shootAndDamage = (direction: Point) => {
      if (this.isDead) return;
      // 发射子弹
      if(bulletColor === ''){
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
        context.spawnBullet(
          new OrdinaryBulletDynamicEntity(
            {
              x: this.position.x + direction.x * spawnDistance,
              y: this.position.y + direction.y * spawnDistance,
            },
            direction,
            this.id,
            this.teamId,
            '',
            bulletColor
          )
        );
      }
      // 每次射击扣减 2 点生命值
      this.applyDamage(2);
    };
    
    // 射出两颗子弹，每颗独立扣血
    shootAndDamage(dir1);
    if (!this.isDead) {
      shootAndDamage(dir2);
    }
  }

  /**
   * 根据归属情况决定子弹颜色
   */
  private determineBulletColor(context: ActionLoopContext): string {
    if (this.ownerId !== null) {
      for (const player of context.playerEntities) {
        if (player.personRule.bulletColor !== '') {
          return player.personRule.bulletColor;
        }
      }
    }
    return '';
  }

  /**
   * 重写更新逻辑：
   * - 当有主人时，沿用父类逻辑实现吸附跟随
   * - 无主人时，采用水平单向移动，永不停止、不转向
   */
  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntity: DynamicEntitieList,
    gameConfig: GameConfig
  ): void {
    // 被玩家吸附时，使用父类的吸附跟随逻辑
    if (this.ownerId !== null) {
      super.update(dt, staticEntities, dynamicEntity, gameConfig);
      return;
    }
    
    // 无主人时的专用移动逻辑
    if (this.isDead) return;
    
    // 更新伤害闪烁和死亡效果
    this.updateDamageEffect(dt);
    this.updateDeathEffect(dt);
    if (this.isDead) return;
    
    // 水平移动：速度 × 方向 × 时间差
    const dx = this.speed * this.moveDirectionX * dt;
    let newX = this.position.x + dx;
    let newY = this.position.y;
    
    // 边界限制（不能超出世界范围，但不改变方向）
    newX = Math.max(gameConfig.worldMinX + this.width / 2, Math.min(gameConfig.worldMaxX - this.width / 2, newX));
    newY = Math.max(gameConfig.worldMinY + this.height / 2, Math.min(gameConfig.worldMaxY - this.height / 2, newY));
    
    // 暂存旧位置用于碰撞解析
    const oldX = this.position.x;
    this.position.x = newX;
    this.updateCollisionBox();
    
    // 解决与静态实体的碰撞（水平方向推离）
    this.resolveStaticCollisionHorizontal(staticEntities, oldX);
    
    // 更新碰撞箱和朝向
    this.updateCollisionBox();
    this.facingDirection = { x: this.moveDirectionX, y: 0 };
    const len = Math.hypot(this.facingDirection.x, this.facingDirection.y);
    if (len > 0.0001) {
      this.facingDirection.x /= len;
      this.facingDirection.y /= len;
    }
    
    // 强制保持移动状态为真，确保 ActionLoop 持续激活
    this.isMoving = true;
    this.stayDurationRemaining = 0;
    
    // 可选项：调用父类的一些辅助方法（但不执行父类的完整移动逻辑）
    this.updateCrowdStuckState(dt);
    this.updateStaticCompressionEffects(dt, staticEntities);

    if(this.health <= 4){
      this.fillColor = '#ffffff25';
      this.strokeColor = '#bebebe25';
    }else if(this.health <= 8){
      this.fillColor = '#ffffff54';
      this.strokeColor = '#bebebe54';
    }else if(this.health <= 12){
      this.fillColor = '#ffffff79';
      this.strokeColor = '#bebebe79';
    }else if(this.health <= 16){
      this.fillColor = '#ffffffa9';
      this.strokeColor = '#bebebea9';
    }else if(this.health <= 20){
      this.fillColor = '#ffffffd2';
      this.strokeColor = '#bebebed2';
    }
  }
  
  /**
   * 水平移动时的静态实体碰撞解析（简单位移推离）
   */
  private resolveStaticCollisionHorizontal(staticEntities: StaticEntity[], oldX: number): void {
    const box = this.collisionBox;
    let overlapOccurred = false;
    for (const se of staticEntities) {
      const seBox = se.collisionBox;
      if (box.x < seBox.x + seBox.width && box.x + box.width > seBox.x &&
          box.y < seBox.y + seBox.height && box.y + box.height > seBox.y) {
        overlapOccurred = true;
        // 推离：根据水平重叠方向修复位置
        const overlapLeft = (box.x + box.width) - seBox.x;
        const overlapRight = (seBox.x + seBox.width) - box.x;
        if (overlapLeft > 0 && overlapLeft <= overlapRight) {
          this.position.x -= overlapLeft;
        } else if (overlapRight > 0) {
          this.position.x += overlapRight;
        }
        this.updateCollisionBox();
      }
    }
    // 如果发生重叠且仍未解决，回退到旧位置
    if (overlapOccurred) {
      const newBox = this.collisionBox;
      let stillOverlap = false;
      for (const se of staticEntities) {
        const seBox = se.collisionBox;
        if (newBox.x < seBox.x + seBox.width && newBox.x + newBox.width > seBox.x &&
            newBox.y < seBox.y + seBox.height && newBox.y + newBox.height > seBox.y) {
          stillOverlap = true;
          break;
        }
      }
      if (stillOverlap) {
        this.position.x = oldX;
        this.updateCollisionBox();
      }
    }
  }
  
  /**
   * 重写 setTarget，使其无效，保证移动方向不会因外部调用而改变
   */
  public override setTarget(
    _target: Point,
    _staticEntities: StaticEntity[] = [],
    _options: { preferStraight?: boolean } = {}
  ): boolean {
    // 变种体不允许修改移动目标，始终按照初始锁定的水平方向移动
    return false;
  }
  
  /**
   * 不进行停留等待，直接返回 false 避免 ActionLoop 中不必要的重置
   */
  public override updateNoMovementWatchdog(_dt: number): boolean {
    return false;
  }
  
  /**
   * 重写 canGetNewWanderTarget，始终返回 false，防止 Wander 机制干扰方向
   */
  public override canGetNewWanderTarget(_dt: number, _staticEntities: StaticEntity[]): boolean {
    return false;
  }
}

export { WhitePixelVa2Entity };