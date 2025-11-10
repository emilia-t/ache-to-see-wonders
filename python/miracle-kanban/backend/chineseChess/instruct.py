#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/instruct.py

import json
from datetime import datetime
from typing import Any, Dict, Optional, Union
from abc import ABC, abstractmethod

class InstructObject:
    """指令对象数据类"""

    def __init__(self, instruct_type: str, instruct_class: str = "", conveyor: str = "", data: Any = ""):
        self.type = instruct_type
        self.class_ = instruct_class
        self.conveyor = conveyor
        self.time = self.get_time_string()
        self.data = data

    def get_time_string(self) -> str:
        """获取格式化的时间字符串"""
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S:%f')[:-3]

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "type": self.type,
            "class": self.class_,
            "conveyor": self.conveyor,
            "time": self.time,
            "data": self.data
        }

    def to_json(self) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(), ensure_ascii=False)

class Instruct(ABC):
    """指令基类"""

    def __init__(self):
        self.public_key = ""  # 服务端的公钥，用于加密操作

    def console_log(self, message: str, log_type: str = "info", data: Any = None) -> None:
        """日志记录方法"""
        log_msg = f"[{log_type.upper()}] {message}"
        if data:
            log_msg += f" | Data: {data}"
        print(log_msg)

    def instruct_parse(self, data: str) -> Optional[InstructObject]:
        """指令解析"""
        if not isinstance(data, str) or not data.strip():
            self.console_log("指令数据为空或不是字符串", "error", data)
            return None

        try:
            parsed = json.loads(data)
            if self.is_valid_instruct_object(parsed):
                return InstructObject(
                    instruct_type=parsed["type"],
                    instruct_class=parsed["class"],
                    conveyor=parsed["conveyor"],
                    data=parsed["data"]
                )
            else:
                self.console_log("指令格式验证失败", "error", {
                    "received": parsed,
                    "expected": "InstructObject format"
                })
                return None
        except (json.JSONDecodeError, KeyError) as error:
            self.console_log("JSON解析失败", "error", {
                "data": data,
                "error": str(error)
            })
            return None

    def is_valid_instruct_object(self, obj: Any) -> bool:
        """验证指令对象结构"""
        return (
                obj is not None and
                isinstance(obj, dict) and
                self.is_string_field(obj, "type") and
                self.is_string_field(obj, "class") and
                self.is_string_field(obj, "conveyor") and
                self.is_string_field(obj, "time") and
                "data" in obj and
                self.is_valid_time_format(obj["time"])
        )

    def is_string_field(self, obj: dict, field: str) -> bool:
        """检查字段是否为字符串"""
        return field in obj and isinstance(obj[field], str)

    def is_valid_time_format(self, time_str: str) -> bool:
        """验证时间格式"""
        return bool(time_str)  # 简化验证，实际可根据需要增强

    # ==============================
    # 创建指令对象的静态方法
    # ==============================

    @abstractmethod
    def create_broadcast_instruct(self,class_: str, conveyor_: str,data: Any) -> InstructObject:
        pass

    @abstractmethod
    def create_expand_instruct(self,type_: str,class_: str,conveyor_: str,data: Any) -> InstructObject:
        pass

    @staticmethod
    def create_ping() -> InstructObject:
        """创建ping指令"""
        return InstructObject("ping")

    @staticmethod
    def create_pong() -> InstructObject:
        """创建pong指令"""
        return InstructObject("pong")

    @staticmethod
    def create_get_publickey() -> InstructObject:
        """创建获取公钥指令"""
        return InstructObject("get_publickey")

    @staticmethod
    def create_publickey(public_key: str) -> InstructObject:
        """创建公钥指令"""
        return InstructObject("publickey", data=public_key)

    @staticmethod
    def create_get_login(email: str, password: str) -> InstructObject:
        """创建登录指令"""
        return InstructObject("get_login", data={
            "email": email,
            "password": password
        })

    @staticmethod
    def create_login(status: str = 'no') -> InstructObject:
        """创建登录状态指令"""
        return InstructObject("login", data=status)

    @staticmethod
    def create_get_anonymous_login(email: str) -> InstructObject:
        """创建匿名登录指令"""
        return InstructObject("get_anonymous_login", data={"email": email})

    @staticmethod
    def create_anonymous_login(status: str = 'no') -> InstructObject:
        """创建匿名登录状态指令"""
        return InstructObject("anonymous_login", data=status)

    @staticmethod
    def create_get_server_config() -> InstructObject:
        """创建获取服务器配置指令"""
        return InstructObject("get_server_config")

    @staticmethod
    def create_server_config(config: Dict[str, Any]) -> InstructObject:
        """创建服务器配置指令"""
        return InstructObject("server_config", data=config)

    @staticmethod
    def create_get_user_data() -> InstructObject:
        """创建获取用户数据指令"""
        return InstructObject("get_user_data")

    @staticmethod
    def create_user_data(user_data: Dict[str, Any]) -> InstructObject:
        """创建用户数据指令"""
        return InstructObject("user_data", data=user_data)
