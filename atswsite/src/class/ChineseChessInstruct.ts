// The relative position of this file: src/class/ChineseChessInstruct.ts
import type InstructObject from '@/interface/InstructObject';
import Instruct from './Instruct';
import Tool from './Tool';

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
    public getTokenLogin(userId: number, token: string): void {
        this.send(ChineseChessInstruct._getTokenLogin_(userId, token));
    }
    // ==============================
    // 创建指令对象的静态方法
    // ==============================
    public static _getTokenLogin_(userId: number, token: string): InstructObject {
        return {
            type: 'get_token_login',
            class: '',
            conveyor: '',
            time: Tool.getFormatTime(),
            data: {
                user_id: userId,
                user_token: token
            }
        };
    }
}