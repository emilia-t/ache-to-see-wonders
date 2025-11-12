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
    # 棋子状态管理相关指令
    # ==============================

    @staticmethod
    def create_broadcast_pick_up_chess(conveyor: str, piece_name: str, position: Coord3D) -> InstructObject:
        """创建广播拾起棋子指令"""
        return InstructObject("broadcast", class_="pick_up_chess", conveyor=conveyor, data={
            "piece_name": piece_name,
            "position": position
        })

    @staticmethod
    def create_broadcast_pick_down_chess(conveyor: str, piece_name: str, position: Coord3D) -> InstructObject:
        """创建广播放置棋子指令"""
        return InstructObject("broadcast", class_="pick_down_chess", conveyor=conveyor, data={
            "piece_name": piece_name,
            "position": position
        })

    @staticmethod
    def create_broadcast_moving_chess(conveyor: str, piece_name: str, trajectory: List[Coord3D]) -> InstructObject:
        """创建广播移动中棋子指令"""
        return InstructObject("broadcast", class_="moving_chess", conveyor=conveyor, data={
            "piece_name": piece_name,
            "trajectory": trajectory
        })