#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/chinese_chess_instruct.py

from .. import instruct
from ..instruct import InstructObject
from typing import Any

class ChineseChessInstruct(instruct.Instruct):
    """中国象棋指令类"""

    def __init__(self):
        super().__init__()

    def create_broadcast_instruct(self,class_: str, conveyor_: str,data: Any) -> InstructObject:
        """处理广播指令"""
        # 中国象棋特定的广播指令处理逻辑
        print(f"处理中国象棋广播指令")
        # 这里可以添加游戏房间广播、棋局状态广播等逻辑
        return InstructObject('broadcast')

    def create_expand_instruct(self,type_: str,class_: str,conveyor_: str,data: Any) -> InstructObject:
        """处理扩展指令"""
        
        return InstructObject('expand')
    
    @staticmethod
    def create_get_token_login(user_id: int,user_token: str) -> InstructObject:
        """创建token登录指令"""
        return InstructObject("get_token_login", data={"user_id": user_id,"user_token": user_token})

    @staticmethod
    def create_token_login(status: str = 'no') -> InstructObject:
        """创建token登录状态指令"""
        return InstructObject("token_login", data=status)