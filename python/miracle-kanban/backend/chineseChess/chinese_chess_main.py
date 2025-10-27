#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import websockets
import json
import sqlite3
import time
import hashlib
import secrets
import os
from datetime import datetime
from typing import Dict, Any, Optional
import server_config

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
        tables = [
            """CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                qq INTEGER,
                theme_color VARCHAR(50) DEFAULT 'rgba(255,255,255,1)',
                anonymous_user BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME DEFAULT CURRENT_TIMESTAMP
            )""",
            """CREATE TABLE IF NOT EXISTS server_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                version VARCHAR(20) DEFAULT '1.0.0',
                anonymous_login BOOLEAN DEFAULT TRUE,
                server_key VARCHAR(100) DEFAULT 'default_key',
                server_url VARCHAR(255) DEFAULT 'ws://localhost:2424',
                server_name VARCHAR(100) DEFAULT '中国象棋服务器',
                max_online INTEGER DEFAULT 100,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )""",
            f"INSERT OR IGNORE INTO server_config (id,version,anonymous_login,server_key,server_url,server_name,max_online) VALUES (1,'{server_config._config_version_}',{server_config._config_anonymous_login_},'{server_config._config_server_key_}','{server_config._config_server_url_}','{server_config._config_server_name_}',{server_config._config_max_online_})"
        ]

        for table_sql in tables:
            cursor.execute(table_sql)

    def create_format_time(self):
        """获取格式化的时间字符串"""
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S:%f')[:-3]

    def create_instruct_object(self, instruct_type: str, data: Any = None) -> Dict[str, Any]:
        """创建指令对象"""
        return {
            "type": instruct_type,
            "class": "",
            "conveyor": "",
            "time": self.create_format_time(),
            "data": data if data is not None else ""
        }


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
            await self.send_public_key(websocket)

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
                # 可以添加更多指令处理...
            }

            handler = handlers.get(instruct_type)
            if handler:
                await handler(websocket, instruct)
            else:
                await self.handle_unknown_instruct(websocket, instruct)

        except json.JSONDecodeError:
            error_msg = self.create_instruct_object('error', '无效的JSON格式')
            await websocket.send(json.dumps(error_msg))

    async def handle_ping(self, websocket, instruct):
        """处理ping指令"""
        pong_msg = self.create_instruct_object('pong')
        await websocket.send(json.dumps(pong_msg))

    async def handle_get_publickey(self, websocket, instruct):
        """处理获取公钥指令"""
        # 这里应该返回真实的RSA公钥，暂时返回模拟值
        public_key = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA模拟公钥内容\n-----END PUBLIC KEY-----"
        publickey_msg = self.create_instruct_object('publickey', public_key)
        await websocket.send(json.dumps(publickey_msg))

    async def handle_get_login(self, websocket, instruct):
        """处理登录指令"""
        data = instruct.get('data', {})
        email = data.get('email', '')
        password = data.get('password', '')  # 应该是加密后的密码

        # 这里应该解密并验证密码，暂时简单验证
        user = self.get_user_login(email, password)
        if user:
            self.logged_users[websocket] = user['id']
            self.online_users[user['id']] = websocket
            login_msg = self.create_instruct_object('login', 'ok')
            await websocket.send(json.dumps(login_msg))
        else:
            login_msg = self.create_instruct_object('login', 'no')
            await websocket.send(json.dumps(login_msg))

    async def handle_get_anonymous_login(self, websocket, instruct):
        """处理匿名登录指令"""
        data = instruct.get('data', {})
        email = data.get('email', 'anonymous@example.com')

        # 创建或获取匿名用户
        user = self.get_or_set_anonymous_user(email)
        if user:
            self.logged_users[websocket] = user['id']
            self.online_users[user['id']] = websocket
            login_msg = self.create_instruct_object('anonymous_login', 'ok')
            await websocket.send(json.dumps(login_msg))
        else:
            login_msg = self.create_instruct_object('anonymous_login', 'no')
            await websocket.send(json.dumps(login_msg))

    async def handle_get_server_config(self, websocket, instruct):
        """处理获取服务器配置指令"""
        config = self.get_server_config()
        config_msg = self.create_instruct_object('server_config', config)
        await websocket.send(json.dumps(config_msg))

    async def handle_get_user_data(self, websocket, instruct):
        """处理获取用户数据指令"""
        if websocket in self.logged_users:
            user_id = self.logged_users[websocket]
            user_data = self.get_user_data(user_id)
            if user_data:
                user_msg = self.create_instruct_object('user_data', user_data)
                await websocket.send(json.dumps(user_msg))
                return

        # 如果没有用户数据，返回空数据
        empty_user_data = {
            "anonymous_user": True,
            "email": "",
            "name": "未登录用户",
            "qq": 0,
            "theme_color": "rgba(255,255,255,1)"
        }
        user_msg = self.create_instruct_object('user_data', empty_user_data)
        await websocket.send(json.dumps(user_msg))

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
        error_msg = self.create_instruct_object('error', f'未知指令类型: {instruct.get("type")}')
        await websocket.send(json.dumps(error_msg))

    """
    ==============================
    发送指令相关
    ==============================
    """
    async def send_public_key(self, websocket):
        """发送公钥给客户端"""
        public_key = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA模拟公钥内容\n-----END PUBLIC KEY-----"
        publickey_msg = self.create_instruct_object('publickey', public_key)
        await websocket.send(json.dumps(publickey_msg))

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
                "SELECT id, email, name, qq, theme_color, anonymous_user FROM users WHERE email = ?",
                (email,)
            )
            user = cursor.fetchone()

            if user:
                # 更新最后登录时间
                cursor.execute(
                    "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
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
                "SELECT id, email, name, qq, theme_color, anonymous_user FROM users WHERE email = ?",
                (email,)
            )
            user = cursor.fetchone()

            if user:
                # 更新最后登录时间
                cursor.execute(
                    "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
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
                # 创建新匿名用户
                name = f"匿名用户{secrets.randbelow(10000)}"
                cursor.execute(
                    "INSERT INTO users (email, name, anonymous_user) VALUES (?, ?, TRUE)",
                    (email, name)
                )
                user_id = cursor.lastrowid
                conn.commit()

                return {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "qq": 0,
                    "theme_color": "rgba(255,255,255,1)",
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

            cursor.execute(
                "SELECT version, anonymous_login, server_key, server_url, server_name, max_online FROM server_config WHERE id = 1"
            )
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
                "key": "chess_server_key",
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
                "key": "chess_server_key",
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
                "SELECT email, name, qq, theme_color, anonymous_user FROM users WHERE id = ?",
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