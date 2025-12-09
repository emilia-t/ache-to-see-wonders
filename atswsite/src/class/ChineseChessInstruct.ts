// The relative position of this file: src/class/ChineseChessInstruct.ts
// 负责中国象棋游戏指令的创建发送
import type InstructObject from '@/interface/InstructObject';
import Instruct from './Instruct';
import Tool from './Tool';
import type Coord3D from '@/interface/Coord3D';
import type PieceSyncData from '@/interface/PieceSyncData';

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
    public broadcastGiveUp(conveyor: string): void{
        this.send(ChineseChessInstruct._broadcastGiveUp_(conveyor));
    }
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
    public getSelectCampRed(): void {
        this.send(ChineseChessInstruct._getSelectCampRed_());
    }
    public selectCampRed(status:boolean=true): void {
        this.send(ChineseChessInstruct._selectCampRed_(status));
    }
    public getSelectCampBlack(): void {
        this.send(ChineseChessInstruct._getSelectCampBlack_());
    }
    public selectCampBlack(status:boolean=true): void {
        this.send(ChineseChessInstruct._selectCampBlack_(status));
    }
    public getCampData(){
        this.send(ChineseChessInstruct._getCampData_());
    }
    public campData(email1:string,name1:string,id1:number,email2:string,name2:string,id2:number){
        this.send(ChineseChessInstruct._campData_(email1,name1,id1,email2,name2,id2));
    }
    public getRbHeadPositionPitchYaw(){
        this.send(ChineseChessInstruct._getRbHeadPositionPitchYaw_());
    }
    public rbHeadPositionPitchYaw(conveyor1:string,position1:Coord3D,pitch1:number,yaw1:number,conveyor2:string,position2:Coord3D,pitch2:number,yaw2:number){
        this.send(ChineseChessInstruct._rbHeadPositionPitchYaw_(conveyor1,position1,pitch1,yaw1,conveyor2,position2,pitch2,yaw2));
    }
    public getSyncChessPieces(): void {
        this.send(ChineseChessInstruct._getSyncChessPieces_());
    }
    public syncChessPieces(pieces: Array<{
        piece_name: string;
        position: Coord3D;
        is_picked: boolean;
        picked_by: string;
    }>): void {
        this.send(ChineseChessInstruct._syncChessPieces_(pieces));
    }
    public switchCampPoll(pollConveyor:string,second:number):void{
        this.send(ChineseChessInstruct._switchCampPoll_(pollConveyor,second));
    }
    public switchCampVote(conveyor:string,status:boolean):void{
        this.send(ChineseChessInstruct._switchCampVote_(conveyor,status));
    }
    public switchCampResult(result:string,total:number,agree:number,disagree:number):void{
        this.send(ChineseChessInstruct._switchCampResult_(result,total,agree,disagree));
    }
    public broadcastResetAllChessPieces(conveyor: string):void{
        this.send(ChineseChessInstruct._broadcastResetAllChessPieces_(conveyor));
    }
    public broadcastHeadPositionPitchYaw(conveyor:string,position:Coord3D,pitch:number,yaw:number,camp:string=''){
        this.send(ChineseChessInstruct._broadcastHeadPositionPitchYaw_(conveyor,position,pitch,yaw,camp));
    }
    public broadcastUserLeftGame(conveyor:string){
        this.send(ChineseChessInstruct._broadcastUserLeftGame_(conveyor));
    }
    public broadcastUserJoinGame(conveyor:string){
        this.send(ChineseChessInstruct._broadcastUserJoinGame_(conveyor));
    }
    public broadcastRequestDraw(conveyor:string,){
        this.send(ChineseChessInstruct._broadcastRequestDraw_(conveyor));
    }
    public broadcastResponseDraw(conveyor:string,status:boolean){
        this.send(ChineseChessInstruct._broadcastResponseDraw_(conveyor,status));
    }
    /**
     * 创建普通文本消息|字符数量限制800(个)
     * @param conveyor 
     * @param text 
     */
    public broadcastSpMessage(conveyor:string,text:string){
        const limitedText = text.length > 800 ? text.substring(0,800) : text;
        this.send(ChineseChessInstruct._broadcastSpMessage_(conveyor,limitedText));
    }
    // ==============================
    // 创建指令对象的静态方法
    // ==============================
    public static _broadcastSpMessage_(conveyor:string,text:string): InstructObject {
        return {
            "type": "broadcast",
            "class": "sp_message",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": {
                "text": text
            }
        };
    }

    public static _broadcastResponseDraw_(conveyor:string,status:boolean): InstructObject {
        return {
            "type": "broadcast",
            "class": "response_draw",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": status
        };
    }

    public static _broadcastRequestDraw_(conveyor: string): InstructObject {
        return {
            "type": "broadcast",
            "class": "request_draw",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }

    public static _broadcastUserJoinGame_(conveyor: string): InstructObject {
        return {
            "type": "broadcast",
            "class": "user_join_game",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }

    public static _broadcastUserLeftGame_(conveyor: string): InstructObject {
        return {
            "type": "broadcast",
            "class": "user_left_game",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }

    public static _broadcastHeadPositionPitchYaw_(conveyor:string,position:Coord3D,pitch:number,yaw:number,camp:string=''): InstructObject {
        return {
            "type": "broadcast",
            "class": "head_position_pitch_yaw",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": {
                "position":position,
                "pitch":pitch,
                "yaw":yaw,
                "camp":camp
            }
        };
    }

    public static _broadcastGiveUp_(conveyor: string): InstructObject {
        return {
            "type": "broadcast",
            "class": "give_up",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }

    public static _broadcastResetAllChessPieces_(conveyor: string): InstructObject {
        return {
            "type": "broadcast",
            "class": "reset_all_chess_pieces",
            "conveyor": conveyor,
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }

    public static _getRbHeadPositionPitchYaw_(): InstructObject {
        return {
            "type": "get_rb_head_position_pitch_yaw",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }

    public static _rbHeadPositionPitchYaw_(conveyor1:string,position1:Coord3D,pitch1:number,yaw1:number,conveyor2:string,position2:Coord3D,pitch2:number,yaw2:number): InstructObject {
        return {
            "type": "rb_head_position_pitch_yaw",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": {
                "red":{
                    "conveyor":conveyor1,
                    "position":position1,
                    "pitch":pitch1,
                    "yaw":yaw1
                },
                "black":{
                    "conveyor":conveyor2,
                    "position":position2,
                    "pitch":pitch2,
                    "yaw":yaw2
                }
            }
        };
    }

    public static _switchCampPoll_(pollConveyor:string,second:number): InstructObject {
        return {
            "type":"switch_camp_poll",
            "class":"",
            "conveyor":"",
            "time": Tool.getFormatTime(),
            "data": {
                "pollConveyor":pollConveyor,
                "timeout":second
            }
        };
    }
    public static _switchCampVote_(conveyor:string,status:boolean): InstructObject {
        return {
            "type":"switch_camp_vote",
            "class":"",
            "conveyor":conveyor,
            "time": Tool.getFormatTime(),
            "data": status
        };
    }
    public static _switchCampResult_(result:string,total:number,agree:number,disagree:number): InstructObject {
        return {
            "type":"switch_camp_result",
            "class":"",
            "conveyor":"",
            "time": Tool.getFormatTime(),
            "data": {
                "result": result,// 'all_pass' | 'partly_pass' | 'timeout' | 'shorthanded'
                "total": total,
                "agree": agree,
                "disagree": disagree
            } 
        };
    }

    public static _getCampData_(): InstructObject {
        return {
            "type": "get_camp_data",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }

    public static _campData_(email1:string,name1:string,id1:number,email2:string,name2:string,id2:number): InstructObject {
        return {
            "type": "camp_data",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": {
                "red":{
                    "email":email1,
                    "name":name1,
                    "id":id1,
                },
                "black":{
                    "email":email2,
                    "name":name2,
                    "id":id2
                }
            }
        };
    }

    public static _getSelectCampRed_(): InstructObject {
        return {
            "type": "get_select_camp_red",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }

    public static _selectCampRed_(status: boolean=true): InstructObject {
        return {
            "type": "select_camp_red",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": status
        };
    }

    public static _getSelectCampBlack_(): InstructObject {
        return {
            "type": "get_select_camp_black",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }

    public static _selectCampBlack_(status: boolean=true): InstructObject {
        return {
            "type": "select_camp_black",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": status
        };
    }

    public static _getSyncChessPieces_(): InstructObject {
        return {
            "type": "get_sync_chess_pieces",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": ""
        };
    }

    public static _syncChessPieces_(pieces: Array<PieceSyncData>): InstructObject {
        return {
            "type": "sync_chess_pieces",
            "class": "",
            "conveyor": "",
            "time": Tool.getFormatTime(),
            "data": {
                "pieces": pieces
            }
        };
    }

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