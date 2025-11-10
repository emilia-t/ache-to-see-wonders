#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/chinese_chess_main.py

import asyncio
import websockets
import json
import sqlite3
import secrets
import os
from typing import Dict, Any, Optional
import server_config
import chinese_chess_instruct
from .. import tool
import sql_statement
import datetime

# 创建日志文件
current_time = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
log_filename = f"{current_time}-log.log"
log_file = open(log_filename, 'w', encoding='utf-8')

def log_message(message):
    """记录日志信息到文件和控制台"""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted_message = f"[{timestamp}] {message}"
    print(formatted_message)
    log_file.write(formatted_message + '\n')
    log_file.flush()  # 确保立即写入文件

class ChineseChessServer:
    def __init__(self, host='localhost', port=2424, db_path='chess.db'):
        self.host = host
        self.port = port
        self.db_path = db_path
        self.connected_clients = {}
        self.logged_users = {}  # websocket -> user_id
        self.online_users = {}  # user_id -> websocket
        self.game_rooms =   {}

        # 初始化数据库
        self.init_database()

        #指令
        self.instruct = chinese_chess_instruct.ChineseChessInstruct()

    async def start_server(self):
        """启动WebSocket服务器"""
        print(f"中国象棋服务器启动在 {self.host}:{self.port}")

        # 使用新的websockets API
        async with websockets.serve(self.handle_connection, self.host, self.port):
            await asyncio.Future()  # 永久运行

    def init_database(self):
        """初始化数据库表"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # 读取并执行SQL文件
            sql_file = 'chess_db.sql'
            if os.path.exists(sql_file):
                with open(sql_file, 'r', encoding='utf-8') as f:
                    sql_script = f.read()
                cursor.executescript(sql_script)
            else:
                # 如果SQL文件不存在，直接创建表
                self.init_create_tables(cursor)

            conn.commit()
            conn.close()
            print("数据库初始化完成")
        except Exception as e:
            print(f"数据库初始化失败: {e}")

    def init_create_tables(self, cursor):
        """创建数据库表"""
        cursor.execute(sql_statement._server_config_table_)
        cursor.execute(sql_statement._pieces_table_)
        cursor.execute(sql_statement._insert_server_config_)

    """
    ==============================
    事件与指令处理
    ==============================
    """
    async def handle_connection(self, websocket):
        client_id = id(websocket)
        self.connected_clients[client_id] = websocket

        try:
            print(f"客户端连接: {client_id}")

            # 发送公钥
            await websocket.send(self.instruct.create_publickey(server_config._config_publickey_).to_json())

            async for message in websocket:
                await self.handle_message(websocket, message)

        except websockets.exceptions.ConnectionClosed:
            print(f"客户端断开: {client_id}")
        finally:
            # 清理连接
            if client_id in self.connected_clients:
                del self.connected_clients[client_id]
            # 清理认证用户
            if websocket in self.logged_users:
                user_id = self.logged_users[websocket]
                if user_id in self.online_users:
                    del self.online_users[user_id]
                del self.logged_users[websocket]

    async def handle_message(self, websocket, message):
        """处理客户端消息"""
        try:
            instruct = json.loads(message)
            instruct_type = instruct.get('type')

            print(f"收到指令: {instruct_type}")

            # 根据指令类型处理
            handlers = {
                'ping': self.handle_ping,
                'get_publickey': self.handle_get_publickey,
                'get_login': self.handle_get_login,
                'get_anonymous_login': self.handle_get_anonymous_login,
                'get_server_config': self.handle_get_server_config,
                'get_user_data': self.handle_get_user_data,
                'broadcast': self.handle_broadcast,
                'get_token_login': self.handle_get_token_login,
                # 可以添加更多指令处理...
            }

            handler = handlers.get(instruct_type)
            if handler:
                await handler(websocket, instruct)
            else:
                await self.handle_unknown_instruct(websocket, instruct)

        except json.JSONDecodeError:
            pass

    async def handle_ping(self, websocket, instruct):
        """处理ping指令"""
        await websocket.send(self.instruct.create_pong().to_json())

    async def handle_get_publickey(self, websocket, instruct):
        """处理获取公钥指令"""
        await websocket.send(self.instruct.create_publickey(server_config._config_publickey_).to_json())

    async def handle_get_login(self, websocket, instruct):
        """处理登录指令"""
        pass
    async def handle_get_token_login(self, websocket, instruct):
        """处理Token登录指令 走 810 账户服务 验证登录"""
        log_message(instruct)
        pass
    
    async def handle_get_anonymous_login(self, websocket, instruct):
        """处理匿名登录指令"""
        data = instruct.get('data', {})
        email = data.get('email', '')
        if email == '':
            return
        # 创建或获取匿名用户
        user = self.get_or_set_anonymous_user(email)
        if user:
            self.logged_users[websocket] = user['id']
            self.online_users[user['id']] = websocket
            await websocket.send(self.instruct.create_anonymous_login('ok').to_json())
        else:
            await websocket.send(self.instruct.create_anonymous_login('no').to_json())

    async def handle_get_server_config(self, websocket, instruct):
        """处理获取服务器配置指令"""
        config = self.get_server_config()
        await websocket.send(self.instruct.create_server_config(config).to_json())

    async def handle_get_user_data(self, websocket, instruct):
        """处理获取用户数据指令"""
        if websocket in self.logged_users:
            user_id = self.logged_users[websocket]
            user_data = self.get_user_data(user_id)
            if user_data:
                await websocket.send(self.instruct.create_user_data(user_data).to_json())
                return

        # 如果没有用户数据，返回空数据
        empty_user_data = {
            "anonymous_user": True,
            "email": "",
            "name": "未登录用户",
            "qq": 0,
            "theme_color": "rgba(255,255,255,1)"
        }
        await websocket.send(self.instruct.create_user_data(empty_user_data).to_json())

    async def handle_broadcast(self, websocket, instruct):
        """处理广播指令"""
        # 广播消息给所有连接的用户
        for client_id, client_ws in self.connected_clients.items():
            if client_ws != websocket:  # 不发送给发送者自己
                try:
                    await client_ws.send(json.dumps(instruct))
                except:
                    pass

    async def handle_unknown_instruct(self, websocket, instruct):
        """处理未知指令"""
        return False

    """
    ==============================
    数据库操作相关
    ==============================
    """
    def get_user_login(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """验证用户登录"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # 这里应该使用加密验证，暂时简单匹配
            cursor.execute(
                sql_statement._select_user__email_,
                (email,)
            )
            user = cursor.fetchone()

            if user:
                # 更新最后登录时间
                cursor.execute(
                    sql_statement._update_user_last_login__id_,
                    (user[0],)
                )
                conn.commit()

                return {
                    "id": user[0],
                    "email": user[1],
                    "name": user[2],
                    "qq": user[3],
                    "theme_color": user[4],
                    "anonymous_user": bool(user[5])
                }
            return None
        except Exception as e:
            print(f"用户验证错误: {e}")
            return None
        finally:
            conn.close()

    def get_or_set_anonymous_user(self, email: str) -> Optional[Dict[str, Any]]:
        """获取或创建匿名用户"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # 查找用户
            cursor.execute(
                sql_statement._select_user__email_,
                (email,)
            )
            user = cursor.fetchone()

            if user:
                # 更新最后登录时间
                cursor.execute(
                    sql_statement._update_user_last_login__id_,
                    (user[0],)
                )
                conn.commit()

                return {
                    "id": user[0],
                    "email": user[1],
                    "name": user[2],
                    "qq": user[3],
                    "theme_color": user[4],
                    "anonymous_user": bool(user[5])
                }
            else:
                # 创建新匿名用户 名称是随机数 0 - 10000
                name = f"匿名用户{secrets.randbelow(10000)}"
                cursor.execute(
                    sql_statement._insert_anonymous_user_,
                    (email, name)
                )
                user_id = cursor.lastrowid
                conn.commit()

                return {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "qq": 0,
                    "theme_color": tool.Tool.create_random_rgba(),
                    "anonymous_user": True
                }
        except Exception as e:
            print(f"创建匿名用户错误: {e}")
            return None
        finally:
            conn.close()

    def get_server_config(self) -> Dict[str, Any]:
        """获取服务器配置"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute(sql_statement._select_server_config_)
            config = cursor.fetchone()

            if config:
                online_number = len(self.logged_users)
                return {
                    "version": config[0],
                    "anonymous_login": bool(config[1]),
                    "key": config[2],
                    "url": config[3],
                    "name": config[4],
                    "online_number": online_number,
                    "max_online": config[5]
                }

            # 返回默认配置
            return {
                "version": "1.0.0",
                "anonymous_login": True,
                "key": "cc1",
                "url": f"ws://{self.host}:{self.port}",
                "name": "中国象棋服务器",
                "online_number": len(self.logged_users),
                "max_online": 100
            }
        except Exception as e:
            print(f"获取服务器配置错误: {e}")
            return {
                "version": "1.0.0",
                "anonymous_login": True,
                "key": "cc1",
                "url": f"ws://{self.host}:{self.port}",
                "name": "中国象棋服务器",
                "online_number": len(self.logged_users),
                "max_online": 100
            }
        finally:
            conn.close()

    def get_user_data(self, user_id: int) -> Optional[Dict[str, Any]]:
        """获取用户数据"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute(
                sql_statement._select_user__id_,
                (user_id,)
            )
            user = cursor.fetchone()

            if user:
                return {
                    "anonymous_user": bool(user[4]),
                    "email": user[0],
                    "name": user[1],
                    "qq": user[2],
                    "theme_color": user[3]
                }
            return None
        except Exception as e:
            print(f"获取用户数据错误: {e}")
            return None
        finally:
            conn.close()


if __name__ == '__main__':
    server = ChineseChessServer()
    asyncio.run(server.start_server())