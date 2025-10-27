// The relative position of this file: src/class/ChineseChessInstruct.ts
import Instruct from './Instruct';
import type InstructObject from "@/interface/InstructObject";

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
}