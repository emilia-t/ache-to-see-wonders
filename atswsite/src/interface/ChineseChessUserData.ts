import type UserData from "./UserData";

export default interface ChineseChessUserData extends UserData {
    /* 游戏账号相关数据-存在游戏数据库 */
    player_leave: number; // 玩家等级
}