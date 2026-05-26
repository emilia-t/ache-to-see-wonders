import type { 
  DynamicEntitieList,
  GameConfig,
  Point,
  EntityDebugFlags,
  ServantGrid,
  Servant
} from '@/components/pixel_war/interface/Interface';

import { DynamicEntity } from '@/components/pixel_war/class/Entity/DynamicEntity/DynamicEntity';
import { StaticEntity } from '@/components/pixel_war/class/Entity/StaticEntity/StaticEntity';
import { ItemEntity } from '@/components/pixel_war/class/Entity/ItemEntity/ItemEntity';
import { FoodItemEntity } from '../../ItemEntity/FoodItemEntity/FoodItemEntity';

class PlayerDynamicEntity extends DynamicEntity {
  public static readonly WIDTH = 25;
  public static readonly HEIGHT = 25;
  public static readonly MOVE_SPEED = 320;
  public static readonly playerMoveState = {
    playerMoveW: false,
    playerMoveA: false,
    playerMoveS: false,
    playerMoveD: false
  };
  

  public readonly personRule = {
    fireCooldownNow: 0,//计算数值单位秒
    fireCooldownMax: 0.12//cd最大值单位秒
  };
  private servantGrid:ServantGrid|null = null;
  readonly #isme: boolean;
  

  constructor(
    position: Point,
    name: string = 'Player',
    isme: boolean = false
  ) {
    super(position, PlayerDynamicEntity.WIDTH, PlayerDynamicEntity.HEIGHT, '', name, 'player', 'player');
    this.#isme = isme;
    this.fillColor = '#2d7ff9a1';
    this.minMoveSpeed = PlayerDynamicEntity.MOVE_SPEED;
    this.maxMoveSpeed = PlayerDynamicEntity.MOVE_SPEED;
    this.speed = PlayerDynamicEntity.MOVE_SPEED;
    this.wanderRange = 0;
    this.perceptionRange = 0;
    //this.health = 100;
    //this.healthMax = 100;
    this.health = 100000;
    this.healthMax = 100000;
    this.movementPassion = 1;
    /**
     * 初始化从者网格start
     */
    this.servantGrid = Array.from(
      { length: 9 },
      (_, r) =>
        Array.from(
          { length: 9 },
          (_, c) => ({
            row: r,
            col: c,
            exist: false,
            npcId: -1
          })
        )
    ) as unknown as ServantGrid;
    /**
     * 初始化从者网格end
     */
    this.stop();
  }

  private collidesWithStatic(newPos: Point, staticEntities: StaticEntity[]) {
    const myBox = {
      x: newPos.x - this.width / 2,
      y: newPos.y - this.height / 2,
      width: this.width,
      height: this.height,
    };

    for (const staticEntity of staticEntities) {
      const otherBox = staticEntity.collisionBox;
      const separated =
        myBox.x + myBox.width <= otherBox.x ||
        myBox.x >= otherBox.x + otherBox.width ||
        myBox.y + myBox.height <= otherBox.y ||
        myBox.y >= otherBox.y + otherBox.height;
      if (!separated) return true;
    }
    return false;
  }

  public override update(
    dt: number,
    staticEntities: StaticEntity[],
    dynamicEntitie: DynamicEntitieList,
    gameConfig: GameConfig
  ) {
    if (this.isDead) return;

    //cd count
    this.personRule.fireCooldownNow =  Math.max(0, this.personRule.fireCooldownNow - dt);

    let dx = 0;
    let dy = 0;
    if (PlayerDynamicEntity.playerMoveState.playerMoveW) dy += 1;
    if (PlayerDynamicEntity.playerMoveState.playerMoveS) dy -= 1;
    if (PlayerDynamicEntity.playerMoveState.playerMoveA) dx -= 1;
    if (PlayerDynamicEntity.playerMoveState.playerMoveD) dx += 1;

    const len = Math.hypot(dx, dy);
    if (len < 0.0001) {
      this.isMoving = false;
      this.nextTarget = { ...this.position };
      this.targetHistory = [{ ...this.position }];
      this.curvePoints = [{ ...this.position }];
      this.currentCurveIndex = 0;
      return;
    }

    const velocity = this.speed * dt;
    const moveX = (dx / len) * velocity;
    const moveY = (dy / len) * velocity;
    const nextPosX = { x: this.position.x + moveX, y: this.position.y };
    const nextPosY = { x: this.position.x, y: this.position.y + moveY };
    let moved = false;

    if (!this.collidesWithStatic(nextPosX, staticEntities)) {
      this.position.x = nextPosX.x;
      moved = true;
    }
    if (!this.collidesWithStatic(nextPosY, staticEntities)) {
      this.position.y = nextPosY.y;
      moved = true;
    }

    this.updateCollisionBox();
    this.isMoving = moved;
    this.nextTarget = { ...this.position };
    this.targetHistory = [{ ...this.position }];
    this.curvePoints = [{ ...this.position }];
    this.currentCurveIndex = 0;

    if (moved) {
      this.noMoveDuration = 0;
      this.noMoveLastPos = { ...this.position };
      this.crowdStuckTimer = 0;
      this.insideStaticBlockedTimer = 0;
      this.facingDirection = {
        x: dx / len,
        y: dy / len,
      };
      this.lastMoveDirection = { ...this.facingDirection };
    }

  }

  public override updateCrowdStuckState(_dt: number) {}

  public override updateNoMovementWatchdog(_dt: number): boolean {
    return false;
  }

  public override updateStayDuration(_dt: number) {}

  public override canGetNewWanderTarget(_dt: number, _staticEntities: StaticEntity[]) {
    return false;
  }

  /**
   * 拾取物品检测
   * @param item 
   * @returns 
   */
  public tryPickupItem(item: ItemEntity): boolean {
    if(item instanceof FoodItemEntity && this.health < this.healthMax){
      // 添加碰撞/距离检测
      const distance = Math.hypot(
        this.position.x - item.position.x,
        this.position.y - item.position.y
      );
      const pickupRadius = (this.width + item.width) / 2; // 玩家和物品半径之和
      
      if (distance <= pickupRadius) {
        return true;
      }
    }
    return false;
  }

  /**
   * 拾取物品
   * @param item 
   */
  public pickupItem(item: ItemEntity): void {
    if(item instanceof FoodItemEntity){
      this.health = Math.min(this.healthMax,this.health+item.currentHealthIncrease)
    }
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

    // 绘制本体
    if (this.texture && this.texture.loaded) {
      ctx.drawImage(this.texture.img, left, top, this.width, this.height);
    } else {
      ctx.fillStyle = this.fillColor || '#2d7ff9a1';
      ctx.fillRect(left, top, this.width, this.height);
      ctx.strokeStyle = this.strokeColor || '#000';
      ctx.strokeRect(left, top, this.width, this.height);
    }

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

    // 玩家名称
    ctx.font = '12px "Microsoft YaHei"';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.name, screenPos.x, screenPos.y + halfH + 6);

    /////// 调试信息start
    if (debugFlags) {
      if (debugFlags.showTag) {//底部的tag
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText(this.name, screenPos.x, screenPos.y + halfH + 20);
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
    }
    /////// 调试信息end
  }

  /**
   * 重置玩家的从者网格
   */
  private resetServantGrid(): void {
    if(this.servantGrid===null){
      return;
    }
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            this.servantGrid[r][c] = {
                row: r,
                col: c,
                exist: false,
                npcId: -1
            };
        }
    }
  }
  
  /**
   * 查询servantGrid某个格子是否占用
   * @returns boolean 返回true则允许添加
   */
  private trySetServant(row:number,col:number,npcEntityId:number): boolean {
    if(this.servantGrid === null)return false;
    if(this.servantGrid[row][col].exist === false){
      return true;
    }else{
      return false;
    }
  }

  /**
   * 添加一个servant
   * @returns boolean 返回true则添加成功
   */
  public setServant(row:number,col:number,npcEntityId:number): boolean {
    if(this.servantGrid === null)return false;
    if(this.trySetServant(row,col,npcEntityId) === false){
      return false;
    }
    this.servantGrid[row][col].exist = true;
    this.servantGrid[row][col].npcId = npcEntityId;
    return true;
  }

  /**
   * 移除一个servant
   * @returns boolean 返回true则移除成功
   */
  public removeServant(npcEntityId: number): boolean {
    if(this.servantGrid === null)return false;
    for(let r = 0; r < 9; r++){
      for(let c = 0; c < 9 ; c++){
        if(this.servantGrid[r][c].npcId === npcEntityId){
          this.servantGrid[r][c].exist = false;
          this.servantGrid[r][c].npcId = -1;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 通过行列查询servant
   * @returns Servant|null 返回从者信息
   */
  public selectServantByRC(row: number,col: number): Servant|null {
    if(this.servantGrid === null)return null;
    return this.servantGrid[row][col];
  }

  /**
   * 通过npcId查询servant
   * @returns Servant|null 返回从者信息
   */
  public selectServantByID(npcEntityId: number): Servant|null {
    if(this.servantGrid === null)return null;
    for(let r = 0; r < 9; r++){
      for(let c = 0; c < 9 ; c++){
        if(this.servantGrid[r][c].npcId === npcEntityId){
          return this.servantGrid[r][c];
        }
      }
    }
    return null;
  }

  /**
   * 通过传入一个世界坐标点返回servant的row和col
   * @returns {row:number,col:number} | null
   */
  public worldPositionToRowCol(worldPosition: Point): { row: number; col: number } | null {
    const deltaX = worldPosition.x - this.position.x;
    const deltaY = worldPosition.y - this.position.y;
    const halfCell = 12.5; // 格子半长

    // 计算偏移量（格子索引，范围 -4..4）
    let colOffset = Math.floor((deltaX + halfCell) / 25);
    let rowOffset = Math.floor((deltaY + halfCell) / 25);

    // 检查是否超出网格范围
    if (colOffset < -4 || colOffset > 4 || rowOffset < -4 || rowOffset > 4) {
        return null;
    }

    // 偏移量到网格索引（0..8）的映射： offset = -4 → row=8, offset=0 → row=4, offset=4 → row=0
    const col = 4 - colOffset;
    const row = 4 - rowOffset;

    return { row, col };
  }

  /**
   * 通过RC获得世界坐标（格子中心点）
   * @param row 行索引 0-8
   * @param col 列索引 0-8
   * @returns 世界坐标点，无效索引返回 null
   */
  public rowColToWorldPosition(row: number, col: number): Point | null {
      if (row < 0 || row > 8 || col < 0 || col > 8) {
          return null;
      }
      // 索引到偏移量的映射：offset = 4 - index
      const offsetX = 4 - col;
      const offsetY = 4 - row;
      // 每个格子边长 25 像素
      const worldX = this.position.x + offsetX * 25;
      const worldY = this.position.y + offsetY * 25;
      return { x: worldX, y: worldY };
  }

  /**
   * getter and setter
   */
  public getIsme():boolean{
    return this.#isme;
  }
  public setIsme():void{
    return;
  }
}

export { PlayerDynamicEntity };

