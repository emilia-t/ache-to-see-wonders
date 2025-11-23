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
    def create_broadcast_give_up(conveyor: str) -> InstructObject:
        """创建广播重置所有棋子指令"""
        return InstructObject("broadcast", instruct_class="give_up", conveyor=conveyor)
    
    @staticmethod
    def create_broadcast_reset_all_chess_pieces(conveyor: str) -> InstructObject:
        """创建广播重置所有棋子指令"""
        return InstructObject("broadcast", instruct_class="reset_all_chess_pieces", conveyor=conveyor)

    @staticmethod
    def create_sync_chess_pieces(pieces_data: List[Dict[str, Any]]) -> InstructObject:
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