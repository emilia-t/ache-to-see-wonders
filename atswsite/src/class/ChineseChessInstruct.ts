// The relative position of this file: src/class/ChineseChessInstruct.ts
import type InstructObject from '@/interface/InstructObject';
import Instruct from './Instruct';
import Tool from './Tool';

type Coord3D = {
  x: number;
  y: number;
  z: number;
};

export default class ChineseChessInstruct extends Instruct {
    /*
     * 构造器
     */
    constructor(url: string) {
        super(url);
    }
    public handleBroadcastInstruct (instruct: InstructObject): void {
        return;
    }
    public handleExpandInstruct (instruct: InstructObject): void {
        return;
    }
    // ==============================
    // 发送指令的方法
    // ==============================
    public getStorageJson(): void{
        this.send(ChineseChessInstruct._getStorageJson_());
    }
    public storageJson(json:string): void{
        this.send(ChineseChessInstruct._storageJson_(json));
    }
    public heart3(): void {
        this.send(ChineseChessInstruct._heart3_());
    }
    public heartTk(): void {
        this.send(ChineseChessInstruct._heartTk_());
    }
    public broadcastPickUpChess(conveyor: string, pieceName: string, position: Coord3D): void {
        this.send(ChineseChessInstruct._broadcastPickUpChess_(conveyor, pieceName, position));
    }
    public broadcastPickDownChess(conveyor: string, pieceName: string, position: Coord3D): void {
        this.send(ChineseChessInstruct._broadcastPickDownChess_(conveyor, pieceName, position));
    }
    public broadcastMovingChess(conveyor: string, pieceName: string, trajectory: Coord3D[]): void {
        this.send(ChineseChessInstruct._broadcastMovingChess_(conveyor, pieceName, trajectory));
    }
    // ==============================
    // 创建指令对象的静态方法
    // ==============================
    public static _getStorageJson_(): InstructObject {
        return {
            "type": "get_storage_json",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }
    public static _storageJson_(json:string): InstructObject {
        return {
            "type": "storage_json",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": json
        };
    }
    public static _heart3_(): InstructObject {
        return {
            "type": "heart_3",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }
    public static _heartTk_(): InstructObject {
        return {
            "type": "heart_tk",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }
    public static _broadcastPickUpChess_(conveyor: string, pieceName: string, position: Coord3D): InstructObject {
        return {
            "type": "broadcast",
            "class": "pick_up_chess",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": {
                "piece_name": pieceName,
                "position": position
            }
        };
    }
    public static _broadcastPickDownChess_(conveyor: string, pieceName: string, position: Coord3D): InstructObject {
        return {
            "type": "broadcast",
            "class": "pick_down_chess",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": {
                "piece_name": pieceName,
                "position": position
            }
        };
    }
    public static _broadcastMovingChess_(conveyor: string, pieceName: string, trajectory: Coord3D[]): InstructObject {
        return {
            "type": "broadcast",
            "class": "moving_chess",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": {
                "piece_name": pieceName,
                "trajectory": trajectory
            }
        };
    }
}