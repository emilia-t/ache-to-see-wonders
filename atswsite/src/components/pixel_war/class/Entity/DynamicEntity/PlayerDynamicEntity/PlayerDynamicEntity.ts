import type { 
  DynamicEntitieList,
  GameConfig,
  Point,
  EntityDebugFlags,
  ServantGrid,
  Servant,
  PersonRule,
  ServantMap,
  NeighborGrid
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
  
  public teamId: number | null;
  public readonly personRule:PersonRule = {
    fireCooldownNow: 0,//计算数值单位秒
    fireCooldownMax: 0.12,//cd最大值单位秒,
    bulletColor: 'rgba(255, 255, 255, 0.9)'
  };
  private servantGrid:ServantGrid|null = null;
  private servantMap:ServantMap|null = null;
  private isme: boolean;
  

  constructor(
    position: Point,
    teamId: number | null,
    name: string = 'Player',
    isme: boolean = false
  ) {
    super(position, PlayerDynamicEntity.WIDTH, PlayerDynamicEntity.HEIGHT, '', name, 'player', 'player');
    this.isme = isme;
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
    this.teamId = teamId;
    /**
     * 初始化从者网格start
     */
    this.servantGrid = Array.from(
        { length: 15 },
        (_, r) =>
            Array.from(
                { length: 15 },
                (_, c) => ({
                    row: r,
                    col: c,
                    exist: false,
                    npcId: -1,
                    neighbor: [-1,-1,-1,-1,-1,-1,-1,-1] as NeighborGrid
                })
            )
    ) as unknown as ServantGrid;
    this.servantMap = new Map<number, Servant>();
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
    if (this.servantGrid === null) return;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        this.servantGrid[r][c] = {
          row: r,
          col: c,
          exist: false,
          npcId: -1,
          neighbor: [-1, -1, -1, -1, -1, -1, -1, -1] as NeighborGrid
        };
      }
    }
    // 重置 Map
    if (this.servantMap) {
      this.servantMap.clear();
    }
  }
  /**
   * 获取所有从者 ID 列表
   * @returns array
   */
  public getAllServantIds(): number[] {
    if (this.servantMap === null) return [];
    return Array.from(this.servantMap.keys());
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
  public setServant(row: number, col: number, npcEntityId: number): boolean {
    if (this.servantGrid === null || this.servantMap === null) return false;
    if (row === 7 && col === 7) return false;
    if (!this.trySetServant(row, col, npcEntityId)) return false;

    this.servantGrid[row][col].exist = true;
    this.servantGrid[row][col].npcId = npcEntityId;
    this.servantMap.set(npcEntityId, this.servantGrid[row][col]);

    // 更新邻居关系
    this.updateNeighborsForCell(row, col);

    return true;
  }

  /**
   * 移除一个servant
   * @returns { removedRow: number; removedCol: number } | null
   */
  public removeServant(npcEntityId:number):{removedRow:number;removedCol:number}|null{
    if (this.servantGrid === null || this.servantMap === null) return null;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (this.servantGrid[r][c].npcId === npcEntityId) {
          // 记录移除位置
          const removedRow = r, removedCol = c;
          this.servantGrid[r][c].exist = false;
          this.servantGrid[r][c].npcId = -1;
          this.servantGrid[r][c].neighbor = [-1,-1,-1,-1,-1,-1,-1,-1] as NeighborGrid;
          this.servantMap.delete(npcEntityId);

          // 更新邻居关系（只更新自身及周围即可）
          this.updateNeighborsForCell(removedRow, removedCol);
          return {removedRow,removedCol};
        }
      }
    }
    return null;
  }

  /**
   * 从指定格子开始，找出所有与玩家断连的从者并释放它们
   * @param startRow 起始行
   * @param startCol 起始列
   * @param onReleaseNpc 释放回调，用于修改外部 NPC 对象的 ownerId/teamId
   * @returns 被释放的 npcId 列表
   */
  public releaseDisconnectedServants(
    startServant: Servant,
    onReleaseNpc?: (npcId: number) => void
  ): number[] {
    if (!this.servantGrid || !this.servantMap) return [];

    const startCell = startServant;
    //BUG排查 next_
    //{"row": 8,"col": 6,"exist": false,"npcId": -1,"neighbor": [719,-1,-1,-1,-1,-1,478,-1]}测试发现此值异常,看起来已经提前被删除了npcId和exist
    /**
     * 修复了npcId异常的问题，现在可以正确获取死亡的从者的数据了
     * 下面排查无法建立BFS的问题
     * {
          "row": 7,
          "col": 9,
          "exist": true,
          "npcId": 330,
          "neighbor": [
              -1,
              -1,
              -1,
              315,
              -1,
              -1,
              -1,
              -1
          ]
      }
     */
    console.log(startCell);//
    // 如果起始格子当前没有从者，则无需处理（但可能需检查其邻居）
    if (!startCell.exist || startCell.npcId === -1) return [];

    // 收集所有可能与起始从者联通的从者（通过 BFS）
    const connectedIds = new Set<number>();
    const queue: number[] = [startCell.npcId];
    connectedIds.add(startCell.npcId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const servant = this.servantMap.get(currentId);
      if (!servant) continue;
      for (const neighborId of servant.neighbor) {
        if (neighborId !== -1 && !connectedIds.has(neighborId)) {
          connectedIds.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    // 只保留与玩家断连的从者（未被连通到玩家的）
    const disconnected: number[] = [];
    for (const id of connectedIds) {
      const servant = this.servantMap.get(id);
      if (servant && !this.isServantConnectedToPlayer(servant)) {
        disconnected.push(id);
      }
    }

    // 释放这些从者
    for (const id of disconnected) {
      // 从玩家的记录中移除
      this.removeServant(id); // 注意 removeServant 会更新邻居，这里会多次更新但性能可接受
      if (onReleaseNpc) {
        onReleaseNpc(id);
      }
    }

    return disconnected;
  }

  /**
   * 检查某个从者是否与玩家连通（通过 neighbor 链路可达玩家中心的邻居格子）
   * @param startServant 起始从者对象
   * @returns true 表示连通
   */
  private isServantConnectedToPlayer(startServant: Servant): boolean {
    if (!this.servantMap) return false;

    // 玩家中心格子的八个邻居坐标
    const centerNeighbors: [number, number][] = [
      [6,6], [6,7], [6,8],
      [7,6],        [7,8],
      [8,6], [8,7], [8,8]
    ];

    // BFS 队列存储 npcId
    const queue: number[] = [startServant.npcId];
    const visited = new Set<number>([startServant.npcId]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentServant = this.servantMap.get(currentId);
      if (!currentServant) continue;

      // 检查当前从者是否位于玩家中心的八个邻居之一
      for (const [nr, nc] of centerNeighbors) {
        if (currentServant.row === nr && currentServant.col === nc) {
          return true;
        }
      }

      // 遍历当前从者的 neighbors 数组
      for (const neighborId of currentServant.neighbor) {
        if (neighborId !== -1 && !visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    return false;
  }

  /**
   * 通过行列查询servant
   * @returns Servant|null 返回从者信息
   */
  public selectServantByRC(row: number, col: number): Servant | null {
    if (this.servantGrid === null) return null;
    if (row < 0 || row > 14 || col < 0 || col > 14) return null;
    return this.servantGrid[row][col];
  }

  /**
   * 通过npcId查询servant
   * @returns Servant|null 返回从者信息
   */
  public selectServantByID(npcEntityId: number): Servant | null {
    if (this.servantMap === null) return null;
    return this.servantMap.get(npcEntityId) || null;
  }

  /**
   * 通过传入一个世界坐标点返回servant的row和col
   * @returns {row:number,col:number} | null
   */
  public worldPositionToRowCol(worldPosition: Point): { row: number; col: number } | null {
    const deltaX = this.position.x - worldPosition.x;
    const deltaY = worldPosition.y - this.position.y;
    const halfCell = 12.5; // 格子半长（格子边长25）

    // 计算偏移量（格子索引，范围 -7..7）
    let colOffset = Math.floor((deltaX + halfCell) / 25);
    let rowOffset = Math.floor((deltaY + halfCell) / 25);

    // 检查是否超出网格范围
    if (colOffset < -7 || colOffset > 7 || rowOffset < -7 || rowOffset > 7) {
        return null;
    }

    // 偏移量到网格索引（0..14）的映射： offset = -7 → col=14, offset=0 → col=7, offset=7 → col=0
    const col = 7 - colOffset;
    const row = 7 - rowOffset;

    if (row === 7 && col === 7) {
        return null; // 中心格子不可占用
    } else {
        return { row, col };
    }
  }

  /**
   * 通过RC获得世界坐标（格子中心点）
   * @param row 行索引 0-14
   * @param col 列索引 0-14
   * @returns 世界坐标点，无效索引返回 null
   */
  public rowColToWorldPosition(row: number, col: number): Point | null {
    if (row < 0 || row > 14 || col < 0 || col > 14) {
        return null;
    }
    // 索引到偏移量的映射：offset = 7 - index
    const offsetX = col - 7;
    const offsetY = 7 - row;
    // 每个格子边长 25 像素
    const worldX = this.position.x + offsetX * 25;
    const worldY = this.position.y + offsetY * 25;
    return { x: worldX, y: worldY };
  }

  /**
   * 获取某格子八个方向的邻居 npcId 数组（顺序：左上、上、右上、左、右、左下、下、右下）
   */
  private buildNeighborForCell(row: number, col: number): NeighborGrid {
    const neighbors: number[] = [];
    const directions = [
      [-1,-1],  [-1,0],  [-1,1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15) {
        const cell = this.servantGrid![nr][nc];
        if (cell.exist && cell.npcId !== -1) {
          neighbors.push(cell.npcId);
        } else {
          neighbors.push(-1);
        }
      } else {
        neighbors.push(-1);
      }
    }
    // 断言长度为 8 的数组为 NeighborGrid 类型
    return neighbors as NeighborGrid;
  }

  /**
   * 更新指定格子及其周围 3x3 范围内所有格子的 neighbor 信息
   */
  private updateNeighborsForCell(row: number, col: number): void {
    if (!this.servantGrid) return;
    const minRow = Math.max(0, row - 1);
    const maxRow = Math.min(14, row + 1);
    const minCol = Math.max(0, col - 1);
    const maxCol = Math.min(14, col + 1);
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        this.servantGrid[r][c].neighbor = this.buildNeighborForCell(r, c);
      }
    }
  }

  /**
   * getter and setter
   */
  public getIsme():boolean{
    return this.isme;
  }
  public setIsme():void{
    return;
  }
}

export { PlayerDynamicEntity };

