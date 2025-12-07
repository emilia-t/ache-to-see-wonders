// The relative position of this file: src/class/ChessPieceManager.ts
import * as THREE from 'three';
import { sceneConfig, piecesConfig, type PieceNameKeys } from '@/config/chineseChessConfig.ts';
import type Coord3D from '@/interface/Coord3D';
import type PieceSyncData from '@/interface/PieceSyncData';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ChessPieceManager {
  public  chessPieces: THREE.Group = new THREE.Group;
  private pieceOriginalMaterials = new Map<string, THREE.Material | THREE.Material[]>();
  private pieceTrajectories: { [key: string]: {
    points: Coord3D[];
    startTime: number;
    duration: number;
    currentIndex: number;
  } } = {};
  
  private piecesState: { [key: string]: {
    isPicked: boolean;
    pickedBy: string;
    position: Coord3D;
    lastUpdate: number;
  } } = {};
  
  private piecesMoveHistory: { [key: string]: {
    lastPickUpPosition: Coord3D | null;
    lastPickUpTime: number;
    lastPickUpBy: string;
  } } = {};
  
  private scene: THREE.Scene;
  private onProgressUpdate?: (increment: number, status: string) => void;
  private onPieceLoad?: (pieceName: string, piece: THREE.Object3D) => void;

  constructor(
    scene: THREE.Scene,
    onProgressUpdate?: (increment: number, status: string) => void,
    onPieceLoad?: (pieceName: string, piece: THREE.Object3D) => void
  ) {
    this.scene = scene;
    this.onProgressUpdate = onProgressUpdate;
    this.onPieceLoad = onPieceLoad;
  }

  public async createChessPieces(): Promise<THREE.Group> {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      this.chessPieces = new THREE.Group();
      this.chessPieces.name = 'chess_pieces_group';
      
      let loadedPieces = 0;
      const totalPieces = piecesConfig.length;
      
      piecesConfig.forEach((pieceConfig, index) => {
        this.onProgressUpdate?.(0, `加载棋子模型... (${loadedPieces}/${totalPieces})`);
        
        loader.load(
          pieceConfig.modelPath,
          (gltf) => {
            const piece = gltf.scene;
            piece.position.set(
              pieceConfig.position.x,
              pieceConfig.position.y,
              pieceConfig.position.z
            );
            piece.scale.set(
              pieceConfig.scale,
              pieceConfig.scale,
              pieceConfig.scale
            );
            
            piece.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            
            piece.name = pieceConfig.name;
            
            // 保存原始材质
            this.savePieceOriginalMaterial(piece);
            
            // 计算棋子尺寸信息（只在第一个棋子时计算）
            if (index === 0) {
              this.calculatePieceDimensions(piece);
            }
            
            // 记录棋子偏移
            this.recordPieceOffset(piece, pieceConfig.name);
            
            // 添加到组
            this.chessPieces.add(piece);
            loadedPieces++;
            
            this.onProgressUpdate?.(1, `加载棋子模型... (${loadedPieces}/${totalPieces})`);
            this.onPieceLoad?.(pieceConfig.name, piece);
            
            // 所有棋子加载完成
            if (loadedPieces === totalPieces) {
              this.scene.add(this.chessPieces);
              resolve(this.chessPieces);
            }
          },
          undefined,
          (error) => {
            console.error(`棋子模型加载失败: ${pieceConfig.modelPath}`, error);
            loadedPieces++;
            this.onProgressUpdate?.(1, `加载棋子模型... (${loadedPieces}/${totalPieces})`);
            
            if (loadedPieces === totalPieces) {
              this.scene.add(this.chessPieces);
              resolve(this.chessPieces);
            }
          }
        );
      });
    });
  }

  private calculatePieceDimensions(piece: THREE.Object3D) {
    const pieceBbox = new THREE.Box3().setFromObject(piece);
    sceneConfig.altitude.S_chess_pieces_max = pieceBbox.max.y;
    sceneConfig.altitude.S_chess_pieces_min = pieceBbox.min.y;
    sceneConfig.altitude.S_chess_pieces_height = 
      sceneConfig.altitude.S_chess_pieces_max - sceneConfig.altitude.S_chess_pieces_min;
    sceneConfig.altitude.S_chess_pieces_max_plus = 
      sceneConfig.altitude.S_chess_pieces_max - sceneConfig.altitude.S_chess_pieces_height;
  }

  private recordPieceOffset(piece: THREE.Object3D, pieceName: string) {
    const pos_xyz = {
      x: piece.children[0].position.x,
      y: piece.children[0].position.y,
      z: piece.children[0].position.z,
    };
    
    const pieceKey = pieceName as keyof typeof sceneConfig.piecesOffset;
    if (sceneConfig.piecesOffset[pieceKey]) {
      sceneConfig.piecesOffset[pieceKey].x = pos_xyz.x;
      sceneConfig.piecesOffset[pieceKey].y = pos_xyz.y - (sceneConfig.altitude.S_chess_pieces_height / 2);
      sceneConfig.piecesOffset[pieceKey].z = pos_xyz.z;
    }
  }

  private savePieceOriginalMaterial(piece: THREE.Object3D) {
    if (!piece.name) return;
    
    if (piece instanceof THREE.Mesh) {
      this.pieceOriginalMaterials.set(piece.name, piece.material);
    } else {
      const materials: THREE.Material[] = [];
      piece.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          materials.push(child.material);
        }
      });
      if (materials.length > 0) {
        this.pieceOriginalMaterials.set(piece.name, materials);
      }
    }
  }

  public restorePieceState(piece: THREE.Object3D) {
    if (!piece.name) return;
    
    const originalMaterial = this.pieceOriginalMaterials.get(piece.name);
    if (!originalMaterial) return;
    
    if (piece instanceof THREE.Mesh && !Array.isArray(originalMaterial)) {
      piece.material = originalMaterial;
    } else if (Array.isArray(originalMaterial)) {
      let materialIndex = 0;
      piece.traverse((child) => {
        if (child instanceof THREE.Mesh && materialIndex < originalMaterial.length) {
          child.material = originalMaterial[materialIndex];
          materialIndex++;
        }
      });
    }
  }

  public setPieceAsPicked(piece: THREE.Object3D, material: THREE.Material) {
    if (piece instanceof THREE.Mesh) {
      piece.material = material;
    } else {
      piece.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material;
        }
      });
    }
  }

  public setPieceAsPickedByOther(piece: THREE.Object3D) {
    const highlightMaterial = new THREE.MeshLambertMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.6
    });
    this.setPieceAsPicked(piece, highlightMaterial);
  }

  public applyPieceOffset(position: THREE.Vector3, pieceName: string): THREE.Vector3 {
    const offset = sceneConfig.piecesOffset[pieceName as keyof typeof sceneConfig.piecesOffset];
    if (offset) {
      position.x -= offset.x;
      position.y -= offset.y;
      position.z -= offset.z;
    }
    return position;
  }

  public getPieceByName(pieceName: string): THREE.Object3D | null {
    return this.chessPieces?.getObjectByName(pieceName) || null;
  }

  public getAllPieces(): THREE.Object3D[] {
    return this.chessPieces?.children || [];
  }

  public updatePieceState(pieceName: string, state: {
    isPicked: boolean;
    pickedBy: string;
    position: Coord3D;
  }) {
    this.piecesState[pieceName] = {
      ...state,
      lastUpdate: Date.now()
    };
  }

  public getPieceState(pieceName: string) {
    return this.piecesState[pieceName];
  }

  public updateMoveHistory(pieceName: string, conveyor: string, position: Coord3D) {
    if (!this.piecesMoveHistory[pieceName]) {
      this.piecesMoveHistory[pieceName] = {
        lastPickUpPosition: null,
        lastPickUpTime: 0,
        lastPickUpBy: ''
      };
    }
    
    this.piecesMoveHistory[pieceName] = {
      lastPickUpPosition: { ...position },
      lastPickUpTime: Date.now(),
      lastPickUpBy: conveyor
    };
  }

  public getMoveHistory(pieceName: string) {
    return this.piecesMoveHistory[pieceName];
  }

  public addTrajectory(pieceName: string, points: Coord3D[], duration: number) {
    this.pieceTrajectories[pieceName] = {
      points,
      startTime: Date.now(),
      duration,
      currentIndex: 0
    };
  }

  public updateTrajectories(delta: number) {
    const currentTime = Date.now();
    
    Object.keys(this.pieceTrajectories).forEach(pieceName => {
      const trajectory = this.pieceTrajectories[pieceName];
      const piece = this.getPieceByName(pieceName);
      
      if (!piece || !trajectory || trajectory.points.length < 2) {
        delete this.pieceTrajectories[pieceName];
        return;
      }

      const elapsed = currentTime - trajectory.startTime;
      const progress = Math.min(elapsed / trajectory.duration, 1);
      
      const segmentCount = trajectory.points.length - 1;
      const segmentIndex = Math.floor(progress * segmentCount);
      const segmentProgress = (progress * segmentCount) - segmentIndex;
      
      if (segmentIndex < segmentCount) {
        const startPoint = trajectory.points[segmentIndex];
        const endPoint = trajectory.points[segmentIndex + 1];
        
        const currentPosition = {
          x: startPoint.x + (endPoint.x - startPoint.x) * segmentProgress,
          y: startPoint.y + (endPoint.y - startPoint.y) * segmentProgress,
          z: startPoint.z + (endPoint.z - startPoint.z) * segmentProgress
        };
        
        piece.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
      } else {
        const finalPoint = trajectory.points[trajectory.points.length - 1];
        piece.position.set(finalPoint.x, finalPoint.y, finalPoint.z);
        delete this.pieceTrajectories[pieceName];
      }
    });
  }

  public syncPieces(piecesData: PieceSyncData[]) {
    piecesData.forEach((pieceData) => {
      const { piece_name, position, is_picked, picked_by } = pieceData;
      
      this.updatePieceState(piece_name, {
        isPicked: is_picked,
        pickedBy: picked_by,
        position: position
      });
      
      const piece = this.getPieceByName(piece_name);
      if (piece) {
        piece.position.set(position.x, position.y, position.z);
        
        if (is_picked && picked_by) {
          this.setPieceAsPickedByOther(piece);
        } else {
          this.restorePieceState(piece);
        }
      }
    });
  }

  public resetAllPieces() {
    Object.keys(this.piecesState).forEach(pieceName => {
      this.piecesState[pieceName] = {
        isPicked: false,
        pickedBy: '',
        position: { x: 0, y: 0, z: 0 },
        lastUpdate: Date.now()
      };
      
      const piece = this.getPieceByName(pieceName);
      if (piece) {
        piece.position.set(0, 0, 0);
        this.restorePieceState(piece);
      }
      
      if (this.piecesMoveHistory[pieceName]) {
        this.piecesMoveHistory[pieceName].lastPickUpPosition = null;
      }
    });
    
    this.pieceTrajectories = {};
  }

  public getPieceTrajectories () {
    return this.pieceTrajectories;
  }

  public getAllPieceStates() {
    return this.piecesState;
  }
}