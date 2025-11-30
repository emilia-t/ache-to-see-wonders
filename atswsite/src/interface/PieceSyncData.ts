import type Coord3D from "./Coord3D";
export default interface PieceSyncData {
  piece_name: string;
  position: Coord3D;
  is_picked: boolean;
  picked_by: string;
}