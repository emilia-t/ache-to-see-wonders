// The relative position of this file: src/class/ChessPlayerManager.ts
// 负责玩家头部模型、名字标签的管理和更新
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { sceneConfig } from '@/config/chineseChessConfig.ts';
import type Coord3D from '@/interface/Coord3D';
import type CampData from '@/interface/CampData';

interface ChessPlayerHeadData {
  position: Coord3D;
  targetPosition: Coord3D;
  pitch: number;
  yaw: number;
  targetPitch: number;
  targetYaw: number;
  name: string;
  lastUpdate: number;
  camp: string;
}

export class ChessPlayerManager {
  public allPlayersHeadLoaded = false;

  private nameTageMarginTop = 0.28;
  private playersNameTag = new Map<string, CSS2DObject>();
  private playersDataHeadModel: { [key: string]: ChessPlayerHeadData } = {};

  private playerHeadBox_1: THREE.Group | null = null;
  private playerHeadBox_2: THREE.Group | null = null;
  private scene: THREE.Scene;
  private campData: CampData;
  private myCamp: string = '';
  private onInstantiation: () => void;

  constructor(
      scene: THREE.Scene,
      campData: CampData,
      onInstantiation: ()=>void = ()=>{}
    ) {
    this.scene = scene;
    this.campData = campData;
    this.onInstantiation = onInstantiation;
  }

  public setPlayerHeads(head1: THREE.Group, head2: THREE.Group) {
    this.playerHeadBox_1 = head1;
    this.playerHeadBox_2 = head2;
  }

  public setCampData(campData: CampData) {
    this.campData = campData;
  }

  public setMyCamp(camp: string) {
    this.myCamp = camp;
    this.updatePlayerHeadVisibility();
  }

  public updatePlayerHeadVisibility() {
    const redName = this.campData.red.name;
    const blackName = this.campData.black.name;
    
    if (this.playerHeadBox_1) {
      const visible_1 = redName !== '' && this.myCamp !== 'red';
      this.playerHeadBox_1.visible = visible_1;
      this.playerHeadBox_1.traverse((child) => {
        child.visible = visible_1;
      });
    }
    
    if (this.playerHeadBox_2) {
      const visible_2 = blackName !== '' && this.myCamp !== 'black';
      this.playerHeadBox_2.visible = visible_2;
      this.playerHeadBox_2.traverse((child) => {
        child.visible = visible_2;
      });
    }
    this.updateNameTagsVisibility();// 更新名字标签的可见性
  }

  private updateNameTagsVisibility() {
    this.playersNameTag.forEach((nameTag, playerId) => {
      const playerData = this.playersDataHeadModel[playerId];
      if (playerData) {
        const shouldBeVisible = playerData.camp !== this.myCamp;
        nameTag.visible = shouldBeVisible;
        const nameDiv = nameTag.element as HTMLDivElement;
        nameDiv.style.display = shouldBeVisible ? 'block' : 'none';
      }
    });
  }

  public updatePlayerData(conveyor: string, data: {
    position: Coord3D;
    pitch: number;
    yaw: number;
    camp: string;
  }) {
    const oldPlayerData = this.playersDataHeadModel[conveyor];
    const oldCamp = oldPlayerData?.camp;
    
    if (!oldPlayerData) {
      this.playersDataHeadModel[conveyor] = {
        position: data.position,
        targetPosition: data.position,
        pitch: data.pitch,
        yaw: data.yaw,
        targetPitch: data.pitch,
        targetYaw: data.yaw,
        name: conveyor.split('&')[0],
        lastUpdate: Date.now(),
        camp: data.camp
      };
    } else {
      if (oldCamp !== data.camp) {
        this.removePlayerNameTag(conveyor);// 阵营改变，移除旧的nameTag并重新创建
      }
      
      this.playersDataHeadModel[conveyor].targetPosition = data.position;
      this.playersDataHeadModel[conveyor].targetPitch = data.pitch;
      this.playersDataHeadModel[conveyor].targetYaw = data.yaw;
      this.playersDataHeadModel[conveyor].lastUpdate = Date.now();
      this.playersDataHeadModel[conveyor].camp = data.camp;
    }
  }

  private removePlayerNameTag(playerId: string) {
    const nameTag = this.playersNameTag.get(playerId);
    if (nameTag) {
      this.scene.remove(nameTag);
      this.playersNameTag.delete(playerId);
    }
  }

  public smoothUpdatePlayerHeads(delta: number) {
    const lerpFactor = 0.2;
    const rotationLerpFactor = 0.1;
    
    Object.keys(this.playersDataHeadModel).forEach(conveyor => {
      const playerData = this.playersDataHeadModel[conveyor];
      
      // 位置插值
      playerData.position.x += (playerData.targetPosition.x - playerData.position.x) * lerpFactor;
      playerData.position.y += (playerData.targetPosition.y - playerData.position.y) * lerpFactor;
      playerData.position.z += (playerData.targetPosition.z - playerData.position.z) * lerpFactor;
      
      // 旋转插值
      playerData.pitch += (playerData.targetPitch - playerData.pitch) * rotationLerpFactor;
      playerData.yaw += (playerData.targetYaw - playerData.yaw) * rotationLerpFactor;
      
      // 更新模型
      this.updatePlayerHeadModel(conveyor, playerData.position, playerData.pitch, playerData.yaw, playerData.camp);
    });
  }

  public updatePlayerHeadModel(conveyor: string, position: Coord3D, pitch: number, yaw: number, camp: string) {
    if (camp === this.myCamp) return;
    if (this.playerHeadBox_1 === null) return;
    if (this.playerHeadBox_2 === null) return;
    
    let headModel: THREE.Group | null = null;
    let offset: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
    
    if (camp === 'red') {
      headModel = this.playerHeadBox_1;
      offset = sceneConfig.playerHeadBoxOffset.rad_1;
    } else if (camp === 'black') {
      headModel = this.playerHeadBox_2;
      offset = sceneConfig.playerHeadBoxOffset.black_2;
    }
    
    if (headModel) {
      headModel.visible = true;
      
      headModel.position.set(
        position.x - offset.x,
        position.y - offset.y - (sceneConfig.altitude.V_Player_head_box_1 / 2),
        position.z - offset.z
      );
      
      const quaternion = new THREE.Quaternion();
      quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      headModel.setRotationFromQuaternion(quaternion);
      
      this.updatePlayerNameTag(conveyor, position, this.playersDataHeadModel[conveyor]?.name || conveyor);
    }
  }

  public updatePlayerNameTag(playerId: string, position: Coord3D, playerName: string) {
    let nameTag = this.playersNameTag.get(playerId);
    const playerData = this.playersDataHeadModel[playerId];
    
    if (playerData?.camp === this.myCamp) {// 如果玩家阵营与我的阵营相同，不创建名字标签
      if (nameTag) {
        this.scene.remove(nameTag);
        this.playersNameTag.delete(playerId);
      }
      return;
    }
    
    if (!nameTag) {
      nameTag = this.createPlayerNameTag(playerId, position, playerName);
    } else {
      nameTag.position.set(position.x, position.y + this.nameTageMarginTop, position.z);
      
      const nameDiv = nameTag.element as HTMLDivElement;
      if (nameDiv.textContent !== playerName) {
        nameDiv.textContent = playerName;
      }
      
      // 确保名字标签可见
      nameTag.visible = true;
      nameDiv.style.display = 'block';
    }
  }

  private createPlayerNameTag(playerId: string, position: Coord3D, playerName: string): CSS2DObject | undefined {
    if (playerName === '') return undefined;
    
    const nameTagDiv = document.createElement('div');
    nameTagDiv.className = 'player-name-tag';
    nameTagDiv.textContent = playerName;
    nameTagDiv.style.color = 'white';
    nameTagDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    nameTagDiv.style.padding = '4px 8px';
    nameTagDiv.style.borderRadius = '4px';
    nameTagDiv.style.fontSize = '15px';
    nameTagDiv.style.fontFamily = 'Arial, sans-serif';
    nameTagDiv.style.pointerEvents = 'none';
    nameTagDiv.style.whiteSpace = 'nowrap';
    nameTagDiv.style.textAlign = 'center';
    nameTagDiv.style.backdropFilter = 'blur(2px)';
    nameTagDiv.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    
    const nameTag = new CSS2DObject(nameTagDiv);
    nameTag.position.set(position.x, position.y + this.nameTageMarginTop, position.z);
    nameTag.name = "player_name_tag";
    this.scene.add(nameTag);
    this.playersNameTag.set(playerId, nameTag);
    
    return nameTag;
  }

  public forceRefreshPlayerNameTags () {
    // 移除所有现有的名字标签
    this.playersNameTag.forEach((nameTag, playerId) => {
      this.scene.remove(nameTag);
    });
    this.playersNameTag.clear();
    // 重新创建名字标签
    const allPlayers = this.getAllPlayers();
    Object.keys(allPlayers).forEach(playerId => {
      const playerData = allPlayers[playerId];
      this.updatePlayerNameTag(
        playerId,
        playerData.position,
        playerData.name
      );
    });
    this.updatePlayerHeadVisibility();// 更新可见性
  }

  public removePlayer(playerId: string) {
    const nameTag = this.playersNameTag.get(playerId);
    if (nameTag) {
      this.scene.remove(nameTag);
      this.playersNameTag.delete(playerId);
    }
    
    delete this.playersDataHeadModel[playerId];
  }

  public getAllPlayers() {
    return this.playersDataHeadModel;
  }

  public getPlayer(playerId: string) {
    return this.playersDataHeadModel[playerId];
  }

  public dispose() {
    this.playersNameTag.forEach((nameTag, playerId) => {
      this.scene.remove(nameTag);
    });
    this.playersNameTag.clear();
  }
}