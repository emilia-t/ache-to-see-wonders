#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/chinese_chess_instruct.py

from instruct import Instruct
from instruct import InstructObject
from typing import Any, Dict, List, TypedDict

class Coord3D(TypedDict):
    x: float
    y: float
    z: float

class PieceSyncData(TypedDict):
    piece_name: str
    position: Coord3D
    is_picked: bool
    picked_by: str

class ChineseChessInstruct(Instruct):
    """中国象棋指令类"""

    def __init__(self):
        super().__init__()

    def create_broadcast_instruct(self, class_: str, conveyor_: str, data: Any) -> InstructObject:
        """处理广播指令"""
        # 中国象棋特定的广播指令处理逻辑
        print(f"处理中国象棋广播指令: {class_}")
        return InstructObject('broadcast', class_=class_, conveyor=conveyor_, data=data)

    def create_expand_instruct(self, type_: str, class_: str, conveyor_: str, data: Any) -> InstructObject:
        """处理扩展指令"""
        return InstructObject(type_, class_=class_, conveyor=conveyor_, data=data)

    # ==============================
    # 自定义指令
    # ==============================
    @staticmethod
    def create_broadcast_sp_message(conveyor:str,text:str):
        """创建普通文本消息|字符数量限制800(个)"""
        limited_text = text[:800] if len(text) > 800 else text
        return InstructObject("broadcast",instruct_class="sp_message",conveyor=conveyor,data={
            "text":limited_text
        })
    @staticmethod
    def create_broadcast_response_draw(conveyor:str,status:bool):
        """创建广播合棋指令"""
        return InstructObject("broadcast",instruct_class="response_draw",conveyor=conveyor,data=status)
    @staticmethod
    def create_broadcast_request_draw(conveyor:str):
        """创建广播合棋指令"""
        return InstructObject("broadcast",instruct_class="request_draw",conveyor=conveyor)
    @staticmethod
    def create_broadcast_user_join_game(conveyor: str) -> InstructObject:
        """创建广播用户加入游戏指令"""
        return InstructObject("broadcast", instruct_class="user_join_game", conveyor=conveyor)
    @staticmethod
    def create_broadcast_user_left_game(conveyor: str) -> InstructObject:
        """创建广播用户离开游戏指令"""
        return InstructObject("broadcast", instruct_class="user_left_game", conveyor=conveyor)
    @staticmethod
    def create_broadcast_head_position_pitch_yaw(conveyor: str,position: Coord3D,pitch: float,yaw: float,camp: str='') -> InstructObject:
        """创建广播玩家头部的坐标与俯仰角与偏航角指令"""
        return InstructObject("broadcast", instruct_class="head_position_pitch_yaw", conveyor=conveyor, data={
            "position":position,
            "pitch":pitch,
            "yaw":yaw,
            "camp":camp
        })
    @staticmethod
    def create_broadcast_give_up(conveyor: str) -> InstructObject:
        """创建广播重置所有棋子指令"""
        return InstructObject("broadcast", instruct_class="give_up", conveyor=conveyor)
    
    @staticmethod
    def create_broadcast_reset_all_chess_pieces(conveyor: str) -> InstructObject:
        """创建广播重置所有棋子指令"""
        return InstructObject("broadcast", instruct_class="reset_all_chess_pieces", conveyor=conveyor)

    @staticmethod
    def create_switch_camp_poll(pollConveyor: str,second: int) -> InstructObject:
        """创建交换阵营投票指令"""
        return InstructObject("switch_camp_poll",data={
            "pollConveyor": pollConveyor,
            "timeout": second
        })
    
    @staticmethod
    def create_switch_camp_vote(conveyor: str,status: bool) -> InstructObject:
        """创建交换阵营投票指令"""
        return InstructObject("switch_camp_vote",conveyor=conveyor,data=status)
    
    @staticmethod
    def create_switch_camp_result(result:str,total:int,agree:int,disagree:int) -> InstructObject:
        """创建交换阵营投票结果指令"""
        return InstructObject("switch_camp_result",data={
            "result": result,# 'all_pass' | 'partly_pass' | 'timeout' | 'shorthanded'
            "total": total,
            "agree": agree,
            "disagree": disagree
        })
    
    @staticmethod
    def create_get_camp_data() -> InstructObject:
        """创建获取阵营数据指令"""
        return InstructObject("get_camp_data")

    @staticmethod
    def create_camp_data(email1:str,name1:str,id1:int,email2:str,name2:str,id2:int) -> InstructObject:
        """创建获取阵营数据指令"""
        return InstructObject("camp_data",data={
            "red" : {"email":email1,"name":name1,"id":id1},
            "black":{"email":email2,"name":name2,"id":id2}
        })

    @staticmethod
    def create_sync_chess_pieces(pieces_data: List[PieceSyncData]) -> InstructObject:
        """创建广播同步棋子状态指令"""
        return InstructObject("sync_chess_pieces", data={
            "pieces": pieces_data
        })

    @staticmethod
    def create_get_sync_chess_pieces() -> InstructObject:
        """创建获取棋子同步状态指令"""
        return InstructObject("get_sync_chess_pieces")
    
    @staticmethod
    def create_get_storage_json() -> InstructObject:
        """创建get_storage_json指令"""
        return InstructObject("get_storage_json")
    
    @staticmethod
    def create_storage_json(json:str) -> InstructObject:
        """创建storage_json指令"""
        return InstructObject("storage_json",data=json)

    @staticmethod
    def create_heart_3() -> InstructObject:
        """创建heart_3指令"""
        return InstructObject("heart_3")

    @staticmethod
    def create_heart_tk() -> InstructObject:
        """创建heart_tk感谢指令"""
        return InstructObject("heart_tk")

    @staticmethod
    def create_broadcast_pick_up_chess(conveyor: str, piece_name: str, position: Coord3D) -> InstructObject:
        """创建广播拾起棋子指令"""
        return InstructObject("broadcast", instruct_class="pick_up_chess", conveyor=conveyor, data={
            "piece_name": piece_name,
            "position": position
        })

    @staticmethod
    def create_broadcast_pick_down_chess(conveyor: str, piece_name: str, position: Coord3D) -> InstructObject:
        """创建广播放置棋子指令"""
        return InstructObject("broadcast", instruct_class="pick_down_chess", conveyor=conveyor, data={
            "piece_name": piece_name,
            "position": position
        })

    @staticmethod
    def create_broadcast_moving_chess(conveyor: str, piece_name: str, trajectory: List[Coord3D]) -> InstructObject:
        """创建广播移动中棋子指令"""
        return InstructObject("broadcast", instruct_class="moving_chess", conveyor=conveyor, data={
            "piece_name": piece_name,
            "trajectory": trajectory
        })
    @staticmethod
    def create_get_rb_head_position_pitch_yaw() -> InstructObject:
        """创建获取红方和黑方头部数据指令"""
        return InstructObject("get_rb_head_position_pitch_yaw")
    @staticmethod
    def create_rb_head_position_pitch_yaw(conveyor1:str,position1:Coord3D,pitch1:float,yaw1:float,conveyor2:str,position2:Coord3D,pitch2:float,yaw2:float) -> InstructObject:
        """创建获取红方和黑方头部数据指令"""
        return InstructObject("rb_head_position_pitch_yaw",data={
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
        })
    @staticmethod
    def create_get_select_camp_red() -> InstructObject:
        """创建选择红色阵营指令"""
        return InstructObject("get_select_camp_red")
    @staticmethod
    def create_select_camp_red(status:bool = True) -> InstructObject:
        """创建选择红色阵营指令"""
        return InstructObject("select_camp_red",data=status)
    @staticmethod
    def create_get_select_camp_black() -> InstructObject:
        """创建选择黑色阵营指令"""
        return InstructObject("get_select_camp_black")
    @staticmethod
    def create_select_camp_black(status:bool = True) -> InstructObject:
        """创建选择黑色阵营指令"""
        return InstructObject("select_camp_black",data=status)