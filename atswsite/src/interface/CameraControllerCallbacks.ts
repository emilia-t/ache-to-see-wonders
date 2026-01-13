import type Coord3D from '@/interface/Coord3D';
import type Rotation3D from '@/interface/Rotation3D';
export default interface CameraControllerCallbacks {
  onMoving?: (position: Coord3D, rotation: Rotation3D) => void;
  onRotating?: (rotation: Rotation3D) => void;
  onModeChange?: (isFirstPerson: boolean) => void;
  onJump?: (velocity: number) => void;
}