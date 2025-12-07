// The relative position of this file: src/class/ChessInteractionManager.ts
import * as THREE from 'three';
import { sceneConfig } from '@/config/chineseChessConfig.ts';
import type Coord3D from '@/interface/Coord3D';

export class ChessInteractionManager {
  public isPicking = false;
  public pickedPiece: THREE.Object3D | null = null;
  
  private raycaster: THREE.Raycaster;
  private transparentMaterial: THREE.MeshLambertMaterial;
  private moveTrajectory: Coord3D[] = [];
  private lastMoveBroadcastTime = 0;
  
  private chessPieceManager: any; // 引用 ChessPieceManager
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  
  private onPickUp?: (pieceName: string, position: Coord3D) => void;
  private onPickDown?: (pieceName: string, position: Coord3D) => void;
  private onMoving?: (pieceName: string, trajectory: Coord3D[]) => void;
  private onCheckPicked?: (pieceName: string) => boolean;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    chessPieceManager: any,
    onPickUp?: (pieceName: string, position: Coord3D) => void,
    onPickDown?: (pieceName: string, position: Coord3D) => void,
    onMoving?: (pieceName: string, trajectory: Coord3D[]) => void,
    onCheckPicked?: (pieceName: string) => boolean
  ) {
    this.scene = scene;
    this.camera = camera;
    this.chessPieceManager = chessPieceManager;
    this.onPickUp = onPickUp;
    this.onPickDown = onPickDown;
    this.onMoving = onMoving;
    this.onCheckPicked = onCheckPicked;
    
    this.raycaster = new THREE.Raycaster();
    this.transparentMaterial = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: sceneConfig.pieceInteraction.transparency,
      color: 0xffffff
    });
  }

  public onClick() {
    this.isPicking ? this.placePiece() : this.tryPickPiece();
  }

  public tryPickPiece() {
    if (this.isPicking || !this.chessPieceManager.chessPieces) return;
    
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const intersects = this.raycaster.intersectObjects(this.chessPieceManager.getAllPieces(), true);
    
    if (intersects.length > 0) {
      let piece = intersects[0].object;
      while (piece.parent && piece.parent !== this.chessPieceManager.chessPieces && piece.parent !== this.scene) {
        piece = piece.parent;
      }
      
      if (this.chessPieceManager.chessPieces.children.includes(piece)) {
        // 检查棋子是否已被其他玩家拾起
        if (this.onCheckPicked && this.onCheckPicked(piece.name)) {
          console.log(`棋子 ${piece.name} 已被其他玩家拾起，无法操作`);
          return;
        }
        
        this.pickUpPiece(piece);
        
        const position = {
          x: piece.position.x,
          y: piece.position.y,
          z: piece.position.z
        };
        
        this.onPickUp?.(piece.name, position);
        
        this.moveTrajectory = [position];
        this.lastMoveBroadcastTime = Date.now();
      }
    }
  }

  private pickUpPiece(piece: THREE.Object3D) {
    this.isPicking = true;
    this.pickedPiece = piece;
    this.chessPieceManager.setPieceAsPicked(piece, this.transparentMaterial);
  }

  public placePiece() {
    if (!this.pickedPiece) return;
    
    const pieceName = this.pickedPiece.name;
    if (!pieceName) return;
    
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const intersectableObjects = this.scene.children.filter(this.createIntersectableFilter());
    const intersects = this.raycaster.intersectObjects(intersectableObjects, true);
    
    if (intersects.length === 0) return;
    
    const targetPosition = intersects[0].point.clone();
    const adjustedPosition = this.chessPieceManager.applyPieceOffset(targetPosition, pieceName);
    this.pickedPiece.position.copy(adjustedPosition);
    
    this.chessPieceManager.restorePieceState(this.pickedPiece);
    
    const position = {
      x: this.pickedPiece.position.x,
      y: this.pickedPiece.position.y,
      z: this.pickedPiece.position.z
    };
    
    this.onPickDown?.(pieceName, position);
    
    this.moveTrajectory = [];
    this.resetPickingState();
  }

  public updatePieceFollowing(gameTick: number = 50) {
    if (!this.isPicking || !this.pickedPiece) return;
    
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const intersectableObjects = this.scene.children.filter(this.createIntersectableFilter());
    const intersects = this.raycaster.intersectObjects(intersectableObjects, true);
    
    let targetPosition: THREE.Vector3;
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      targetPosition = intersect.point.clone();
      
      const bbox = new THREE.Box3().setFromObject(this.pickedPiece);
      const bottomOffset = bbox.min.y;
      targetPosition.y -= bottomOffset;
      
      const pieceName = this.pickedPiece.name as keyof typeof sceneConfig.piecesOffset;
      if (sceneConfig.piecesOffset[pieceName]) {
        targetPosition.x -= sceneConfig.piecesOffset[pieceName].x;
        targetPosition.z -= sceneConfig.piecesOffset[pieceName].z;
      }
      
      targetPosition.y += 0.001;
    } else {
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      targetPosition = this.camera.position.clone().add(direction.multiplyScalar(0.1));
    }
    
    this.pickedPiece.position.lerp(targetPosition, sceneConfig.pieceInteraction.followSpeed);
    
    const currentTime = Date.now();
    if (currentTime - this.lastMoveBroadcastTime >= gameTick) {
      const currentPosition = {
        x: this.pickedPiece.position.x,
        y: this.pickedPiece.position.y,
        z: this.pickedPiece.position.z
      };
      
      this.moveTrajectory.push(currentPosition);
      
      if (this.moveTrajectory.length > 10) {
        this.moveTrajectory = this.moveTrajectory.slice(-10);
      }
      
      this.onMoving?.(this.pickedPiece.name, this.moveTrajectory);
      this.lastMoveBroadcastTime = currentTime;
    }
  }

  private createIntersectableFilter() {
    return (obj: THREE.Object3D) => {
      return obj !== this.chessPieceManager.chessPieces &&
             obj !== this.pickedPiece &&
             obj.name !== 'center_grid_helper' &&
             obj.name !== 'center_axes_helper' &&
             obj.name !== 'panorama_cube';
    };
  }

  public resetPickingState() {
    this.isPicking = false;
    this.pickedPiece = null;
    this.moveTrajectory = [];
  }

  public getPickedPiece() {
    return this.pickedPiece;
  }

  public setPickedPiece(piece: THREE.Object3D | null) {
    this.pickedPiece = piece;
    this.isPicking = !!piece;
  }
}