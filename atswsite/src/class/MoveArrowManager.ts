// The relative position of this file: src/class/MoveArrowManager.ts
import * as THREE from 'three';
import { sceneConfig, type PieceNameKeys } from '@/config/chineseChessConfig.ts';
import Tool from '@/class/Tool';
import type Coord3D from '@/interface/Coord3D';

export class MoveArrowManager {
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public createMoveArrow(start: Coord3D, end: Coord3D, camp: string, pieceName: string): THREE.Group {
    const pn = pieceName as PieceNameKeys;
    const pieceOffset: Coord3D = sceneConfig.piecesOffset[pn];
    const startAdj: Coord3D = {
      x: start.x + pieceOffset.x,
      y: start.y + pieceOffset.y,
      z: start.z + pieceOffset.z
    };
    const endAdj: Coord3D = {
      x: end.x + pieceOffset.x,
      y: end.y + pieceOffset.y,
      z: end.z + pieceOffset.z
    };
    
    const group = new THREE.Group();
    
    const direction = new THREE.Vector3(
      endAdj.x - startAdj.x,
      0,
      endAdj.z - startAdj.z
    );
    const distance = direction.length() - sceneConfig.moveArrow.margin;
    const angle = Tool.adjustAngle(Math.atan2(direction.x, direction.z), Math.PI / 2);
    direction.normalize();
    
    let arrowColor: number;
    switch (camp) {
      case 'red':
        arrowColor = sceneConfig.moveArrow.color.red;
        break;
      case 'black':
        arrowColor = sceneConfig.moveArrow.color.black;
        break;
      default:
        arrowColor = sceneConfig.moveArrow.color.default;
    }
    
    const bodyLength = distance - sceneConfig.moveArrow.size.arrowHeadLength;
    
    if (bodyLength > 0) {
      const bodyGeometry = new THREE.PlaneGeometry(
        bodyLength,
        sceneConfig.moveArrow.size.lineWidth
      );
      
      const bodyMaterial = new THREE.MeshBasicMaterial({
        color: arrowColor,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      const bodyPosition = new THREE.Vector3(
        startAdj.x + direction.x * bodyLength / 2,
        sceneConfig.moveArrow.height,
        startAdj.z + direction.z * bodyLength / 2
      );
      
      body.position.copy(bodyPosition);
      body.rotation.z = angle;
      body.rotation.x = -Math.PI / 2;
      
      group.add(body);
    }
    
    const headGeometry = new THREE.Shape();
    const headWidth = sceneConfig.moveArrow.size.arrowHeadWidth;
    const headLength = sceneConfig.moveArrow.size.arrowHeadLength;
    
    headGeometry.moveTo(0, -headWidth / 2);
    headGeometry.lineTo(headLength, 0);
    headGeometry.lineTo(0, headWidth / 2);
    headGeometry.lineTo(0, -headWidth / 2);
    
    const headShapeGeometry = new THREE.ShapeGeometry(headGeometry);
    const headMaterial = new THREE.MeshBasicMaterial({
      color: arrowColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    const head = new THREE.Mesh(headShapeGeometry, headMaterial);
    const headPosition = new THREE.Vector3(
      startAdj.x + direction.x * (distance - headLength),
      sceneConfig.moveArrow.height,
      startAdj.z + direction.z * (distance - headLength)
    );
    
    head.position.copy(headPosition);
    head.rotation.z = Tool.adjustAngle(angle, Math.PI);
    head.rotation.x = -Math.PI / 2;
    
    group.add(head);
    group.name = "arrow_group";
    
    return group;
  }

  public addMoveArrow(start: Coord3D, end: Coord3D, camp: string, pieceName: string) {
    if (!sceneConfig.moveArrow.enabled) return;
    
    const arrowGroup = this.createMoveArrow(start, end, camp, pieceName);
    this.scene.add(arrowGroup);
  }

  public removeAllArrowGroups() {
    if (!this.scene) return;
    
    const objectsToRemove: THREE.Object3D[] = [];
    
    this.scene.traverse((object) => {
      if (object.name === 'arrow_group') {
        objectsToRemove.push(object);
      }
    });
    
    objectsToRemove.forEach((object) => {
      if (object.parent) {
        object.parent.remove(object);
      }
      
      object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          child.geometry.dispose();
        }
      });
    });
  }
}