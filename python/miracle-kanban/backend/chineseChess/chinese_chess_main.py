#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/chinese_chess_main.py

import asyncio
import websockets
import json
import sqlite3
import os
from typing import Dict, Any, Optional
import configure
import chinese_chess_instruct
import tool
import sql_statement
import datetime
import aiohttp
from urllib.parse import urlencode
from websockets.exceptions import ConnectionClosed

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

# 从storage.json加载初始值
def load_storage():
    """从storage.json初始值"""
    try:
        with open('./storage.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            visit_count = data.get('visit_count', 0)
            heart_count = data.get('heart_count', 0)
            log_message(f"从storage.json加载数据: visit_count={visit_count}, heart_count={heart_count}")
            return visit_count, heart_count
    except FileNotFoundError:
        log_message("storage.json文件不存在，使用默认值")
        return 0, 0
    except PermissionError:
        print(f"没有权限读取文件 ./storage.json")
        return 0, 0
    except Exception as e:
        log_message(f"加载storage.json失败: {e}，使用默认值")
        return 0, 0

def load_storage_source():
    """从storage.json加载源返回json字符串"""
    try:
        with open('./storage.json', 'r', encoding='utf-8') as f:
            return f.read()  # 读取文件内容并返回
    except FileNotFoundError:
        print(f"错误：文件 ./storage.json 不存在")
        return ""
    except PermissionError:
        print(f"错误：没有权限读取文件 ./storage.json")
        return ""
    except Exception as e:
        print(f"读取文件时发生错误：{e}")
        return ""

def save_storage(visit_count, heart_count):
    """保存初始值到storage.json"""
    try:
        data = {
            "storage": "storage",
            "name": "chinese_chess",
            "visit_count": visit_count,
            "heart_count": heart_count
        }
        with open('./storage.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        log_message(f"已保存数据到storage.json: visit_count={visit_count}, heart_count={heart_count}")
    except Exception as e:
        log_message(f"保存storage.json失败: {e}")

# 初始化计数
visit_count, heart_count = load_storage()

class HTTPClient:
    """HTTP客户端工具类"""
    
    @staticmethod
    async def post_request(url: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """发送POST请求 (application/x-www-form-urlencoded格式)"""
        try:
            # 将数据转换为URL编码格式
            form_data = urlencode(data)
            
            log_message(f"发送HTTP POST请求到: {url}")
            log_message(f"请求数据 (form格式): {form_data}")
            
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=form_data, headers=headers) as response:
                    response_text = await response.text()
                    log_message(f"HTTP响应状态: {response.status}")
                    log_message(f"HTTP响应内容: {response_text}")
                    
                    if response.status == 200:
                        try:
                            result = await response.json()
                            log_message(f"HTTP响应解析成功: {result}")
                            return result
                        except:
                            log_message(f"HTTP响应JSON解析失败: {response_text}")
                            return None
                    else:
                        log_message(f"HTTP请求失败: {response.status} - {response_text}")
                        return None
        except Exception as e:
            log_message(f"HTTP请求异常: {e}")
            return None

class ChessPieceState:
    """棋子状态类"""
    
    def __init__(self, piece_name: str):
        self.piece_name = piece_name
        self.position = {"x": 0, "y": 0, "z": 0}
        self.is_picked = False
        self.picked_by = None  # 拾起者的用户ID
        self.picked_by_ws = None  # 拾起者的WebSocket连接
        self.last_update_time = datetime.datetime.now()

class ChineseChessServer:
    def __init__(self, host='0.0.0.0', port=2424, db_path='chess.db'):
        self.host = host
        self.port = port
        self.db_path = db_path
        self.connected_clients = {}
        self.logged_users = {}  # websocket -> user_data
        self.online_users = {}  # user_id -> websocket
        self.game_rooms = {}

        # 全局计数器
        global visit_count, heart_count
        self.visit_count = visit_count
        self.heart_count = heart_count
        
        # 记录每个会话是否已经发送过heart_3指令
        self.heart_sent_sessions = set()  # 存储websocket对象

        # 棋子状态管理
        self.chess_pieces_state = {}  # piece_name -> ChessPieceState
        self.init_chess_pieces_state()

        # 移动轨迹定时器
        self.moving_timers = {}  # piece_name -> asyncio.Task

        # 初始化数据库
        self.init_database()

        # 指令
        self.instruct = chinese_chess_instruct.ChineseChessInstruct()


    async def auto_save_task(self):
        """自动保存任务，每2分钟保存一次"""
        while True:
            await asyncio.sleep(120)  # 2分钟
            await self.save_current_counts()

    async def save_current_counts(self):
        """保存当前计数到文件"""
        save_storage(self.visit_count, self.heart_count)

    async def start_server(self):
        """启动WebSocket服务器"""
        log_message(f"服务器即将启动在: {self.host}:{self.port}")
        
        # SSL配置
        ssl_context = None
        if configure._config_use_ssl_ and configure._config_ssl_cert_file_ and configure._config_ssl_key_file_:
            try:
                import ssl
                ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                ssl_context.load_cert_chain(configure._config_ssl_cert_file_, configure._config_ssl_key_file_)
                log_message(f"已加载SSL证书: {configure._config_ssl_cert_file_}")
                log_message(f"已加载SSL密钥: {configure._config_ssl_key_file_}")
            except Exception as e:
                log_message(f"SSL配置失败: {e}")
                ssl_context = None
        
        # 创建服务器，设置跨域支持
        start_server = await websockets.serve(
            self.handle_connection, 
            self.host, 
            self.port,
            origins=configure._access_control_allow_origin_,  # 使用配置的跨域规则
            ssl=ssl_context,  # SSL上下文
            ping_interval=20,  # 设置ping间隔
            ping_timeout=20,   # 设置ping超时
            close_timeout=10,  # 设置关闭超时
            max_size=2**20,    # 增加最大消息大小
        )
        
        protocol = "WSS" if ssl_context else "WS"
        log_message(f"服务器已启动在: {self.host}:{self.port} ({protocol})")
        log_message(f"服务器URL: {configure._config_server_url_}")
        log_message("等待客户端连接...")

        # 启动自动保存任务
        asyncio.create_task(self.auto_save_task())

        await asyncio.Future()  # 永久运行

    def init_chess_pieces_state(self):
        """初始化棋子状态"""
        # 初始化所有棋子的状态
        piece_names = [
            "Black_00_chariot_left", "Black_01_horse_left", "Black_02_elephant_left", "Black_03_advisor_left", 
            "Black_04_general", "Black_05_advisor_right", "Black_06_elephant_right", "Black_07_horse_right",
            "Black_08_chariot_right", "Black_09_cannon_left", "Black_10_cannon_right", "Black_11_soldier_1",
            "Black_12_soldier_2", "Black_13_soldier_3", "Black_14_soldier_4", "Black_15_soldier_5",
            "Red_16_soldier_1", "Red_17_soldier_2", "Red_18_soldier_3", "Red_19_soldier_4",
            "Red_20_soldier_5", "Red_21_cannon_left", "Red_22_cannon_right", "Red_23_chariot_left",
            "Red_24_horse_left", "Red_25_elephant_left", "Red_26_advisor_left", "Red_27_general", 
            "Red_28_advisor_right", "Red_29_elephant_right", "Red_30_horse_right", "Red_31_chariot_right"
        ]
        
        for piece_name in piece_names:
            self.chess_pieces_state[piece_name] = ChessPieceState(piece_name)

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
            log_message("数据库初始化完成")
        except Exception as e:
            log_message(f"数据库初始化失败: {e}")

    def init_create_tables(self, cursor):
        """创建数据库表"""
        cursor.execute(sql_statement._pieces_table_)
        
    """
    ==============================
    事件与指令处理
    ==============================
    """
    
    async def handle_connection(self, websocket):
        """处理WebSocket连接"""
        client_id = id(websocket)
        self.connected_clients[client_id] = websocket
        
        websocket.get_instruct_count = 0 # 为每个会话添加指令计数属性
        websocket.visit_counted = False  # 标记是否已经计入来访计数
        
        # 获取客户端信息
        try:
            remote_address = websocket.remote_address
            client_info = f"{remote_address[0]}:{remote_address[1]}" if remote_address else "unknown"
        except:
            client_info = "unknown"
            
        log_message(f"客户端连接: {client_id} from {client_info}")

        try:
            # 发送公钥(为避免无效连接不再主动发送)
            # await websocket.send(self.instruct.create_publickey(configure._config_publickey_).to_json())
            # log_message(f"已向客户端 {client_id} 发送公钥")

            # 处理消息
            async for message in websocket:
                await self.handle_message(websocket, message)

        except ConnectionClosed as e:
            log_message(f"客户端连接关闭: {client_id} - {e}")
        except Exception as e:
            log_message(f"处理客户端 {client_id} 时发生错误: {e}")
        finally:
            # 清理连接
            if client_id in self.connected_clients:
                del self.connected_clients[client_id]
                log_message(f"已清理客户端 {client_id} 的连接")
            
            # 清理用户状态和释放棋子
            if websocket in self.logged_users:
                user_data = self.logged_users[websocket]
                user_id = user_data.get('id')
                
                # 释放该用户拾起的所有棋子
                await self.release_pieces_by_user(websocket, user_id)
                
                if user_id in self.online_users:
                    del self.online_users[user_id]
                del self.logged_users[websocket]
                log_message(f"已清理客户端 {client_id} 的用户状态")
            
            # 清理heart_3发送记录
            if websocket in self.heart_sent_sessions:
                self.heart_sent_sessions.remove(websocket)
    
    async def release_pieces_by_user(self, websocket, user_id):
        """释放用户拾起的所有棋子"""
        for piece_name, piece_state in self.chess_pieces_state.items():
            if piece_state.is_picked and piece_state.picked_by == user_id:
                # 重置棋子状态
                piece_state.is_picked = False
                piece_state.picked_by = None
                piece_state.picked_by_ws = None
                
                # 停止移动轨迹定时器
                if piece_name in self.moving_timers:
                    self.moving_timers[piece_name].cancel()
                    del self.moving_timers[piece_name]
                
                log_message(f"用户断开连接，自动释放棋子 {piece_name}")

    async def handle_message(self, websocket, message):
        """处理客户端消息"""
        try:
            instruct = json.loads(message)
            instruct_type = instruct.get('type')

            # 增加指令计数（排除ping指令）
            if hasattr(websocket, 'get_instruct_count') and instruct_type != 'ping':
                websocket.get_instruct_count += 1
                # 检查是否应该增加访问计数
                if (not hasattr(websocket, 'visit_counted') or not websocket.visit_counted) and websocket.get_instruct_count >= 3:
                    self.visit_count += 1
                    websocket.visit_counted = True

            log_message(f"收到指令: {instruct_type}")

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
                
                'get_storage_json': self.handle_get_storage_json,
                'pick_up_chess': self.handle_pick_up_chess,
                'pick_down_chess': self.handle_pick_down_chess,
                'moving_chess': self.handle_moving_chess,
                'heart_3': self.handle_heart_3
            }

            handler = handlers.get(instruct_type)
            if handler:
                await handler(websocket, instruct)
            else:
                await self.handle_unknown_instruct(websocket, instruct)

        except json.JSONDecodeError:
            pass

    async def handle_get_storage_json(self, websocket, instruct):
        await websocket.send(self.instruct.create_storage_json(load_storage_source()).to_json())

    async def handle_heart_3(self, websocket, instruct):
        """处理heart_3指令"""
        # 检查用户是否已登录
        if websocket not in self.logged_users:
            # log_message("未登录用户尝试发送heart_3指令")
            return
        
        # 检查该会话是否已经发送过heart_3
        if websocket in self.heart_sent_sessions:
            # log_message(f"用户 {self.logged_users[websocket].get('name')} 重复发送heart_3指令，已忽略")
            return
        
        # 增加heart_count
        self.heart_count += 1
        self.heart_sent_sessions.add(websocket)
        
        user_data = self.logged_users[websocket]
        log_message(f"用户 {user_data.get('name')} 发送heart_3指令，heart_count增加到: {self.heart_count}")
        
        # 立即保存到文件
        await self.save_current_counts()
        
        # 发送heart_tk感谢指令
        thank_you_instruct = self.instruct.create_heart_tk()
        await websocket.send(thank_you_instruct.to_json())

    async def handle_ping(self, websocket, instruct):
        """处理ping指令"""
        await websocket.send(self.instruct.create_pong().to_json())

    async def handle_get_publickey(self, websocket, instruct):
        """处理获取公钥指令"""
        await websocket.send(self.instruct.create_publickey(configure._config_publickey_).to_json())

    async def handle_get_login(self, websocket, instruct):
        """处理登录指令 此服务不支持账号认证登录服务"""
        pass

    async def handle_get_token_login(self, websocket, instruct):
        """处理Token登录指令"""
        log_message(f"处理Token登录请求: {instruct}")
        
        data = instruct.get('data', {})
        user_id = data.get('user_id')
        user_token = data.get('user_token')
        
        # 添加详细日志
        log_message(f"Token登录参数 - user_id: {user_id}, user_token: {user_token}")
        
        if not user_id or not user_token:
            log_message(f"Token登录失败: user_id或user_token为空 - user_id: {user_id}, user_token: {user_token}")
            await websocket.send(self.instruct.create_token_login('no').to_json())
            return
        
        # 向账号服务器验证token
        account_server_url = configure._api_account_server_url_
        if not account_server_url:
            log_message("账号服务器URL未配置")
            await websocket.send(self.instruct.create_token_login('no').to_json())
            return
        
        # 发送验证请求到账号服务器 (使用form格式)
        request_data = {
            'user_id': str(user_id),
            'user_token': user_token
        }
        
        response = await HTTPClient.post_request(f"{account_server_url}/tokenlogin", request_data)
        
        if response and response.get('success'):
            user_data = response.get('user', {})
            
            # 记录用户登录状态
            self.logged_users[websocket] = user_data
            self.online_users[user_id] = websocket
            
            log_message(f"用户Token登录成功: {user_data.get('name')} (ID: {user_id})")
            await websocket.send(self.instruct.create_token_login('ok').to_json())
        else:
            error_msg = response.get('message', '未知错误') if response else '账号服务器无响应'
            log_message(f"用户Token登录失败: {error_msg}")
            await websocket.send(self.instruct.create_token_login('no').to_json())

    async def handle_get_anonymous_login(self, websocket, instruct):
        """处理匿名登录指令"""
        pass

    async def handle_get_server_config(self, websocket, instruct):
        """处理获取服务器配置指令"""
        config = self.get_server_config()
        await websocket.send(self.instruct.create_server_config(config).to_json())

    async def handle_get_user_data(self, websocket, instruct):
        """处理获取用户数据指令"""
        if websocket in self.logged_users:
            user_data = self.logged_users[websocket]
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

    async def handle_pick_up_chess(self, websocket, instruct):
        """处理拾起棋子指令"""
        if websocket not in self.logged_users:
            return

        data = instruct.get('data', {})
        piece_name = data.get('piece_name')
        position = data.get('position', {})

        if not piece_name or piece_name not in self.chess_pieces_state:
            return

        piece_state = self.chess_pieces_state[piece_name]
        user_data = self.logged_users[websocket]

        # 检查棋子是否已被其他玩家拾起
        if piece_state.is_picked:
            log_message(f"棋子 {piece_name} 已被其他玩家拾起，无法重复拾起")
            return

        # 更新棋子状态
        piece_state.is_picked = True
        piece_state.picked_by = user_data.get('id')
        piece_state.picked_by_ws = websocket
        piece_state.position = position
        piece_state.last_update_time = datetime.datetime.now()

        log_message(f"玩家 {user_data.get('name')} 拾起棋子 {piece_name}")

        # 广播拾起棋子指令给所有玩家
        conveyor = f"{user_data.get('name')}&{user_data.get('email')}"
        broadcast_instruct = self.instruct.create_broadcast_pick_up_chess(
            conveyor, piece_name, position
        )
        await self.broadcast_to_all(broadcast_instruct, exclude_websocket=websocket)

    async def handle_pick_down_chess(self, websocket, instruct):
        """处理放置棋子指令"""
        if websocket not in self.logged_users:
            return

        data = instruct.get('data', {})
        piece_name = data.get('piece_name')
        position = data.get('position', {})

        if not piece_name or piece_name not in self.chess_pieces_state:
            return

        piece_state = self.chess_pieces_state[piece_name]
        user_data = self.logged_users[websocket]

        # 检查棋子是否是该玩家拾起的
        if not piece_state.is_picked or piece_state.picked_by != user_data.get('id'):
            log_message(f"玩家 {user_data.get('name')} 试图放置不属于自己的棋子 {piece_name}")
            return

        # 更新棋子状态
        piece_state.is_picked = False
        piece_state.picked_by = None
        piece_state.picked_by_ws = None
        piece_state.position = position
        piece_state.last_update_time = datetime.datetime.now()

        # 停止移动轨迹定时器
        if piece_name in self.moving_timers:
            self.moving_timers[piece_name].cancel()
            del self.moving_timers[piece_name]

        log_message(f"玩家 {user_data.get('name')} 放置棋子 {piece_name}")

        # 广播放置棋子指令给所有玩家
        conveyor = f"{user_data.get('name')}&{user_data.get('email')}"
        broadcast_instruct = self.instruct.create_broadcast_pick_down_chess(
            conveyor, piece_name, position
        )
        await self.broadcast_to_all(broadcast_instruct, exclude_websocket=websocket)

    async def handle_moving_chess(self, websocket, instruct):
        """处理移动中棋子指令"""
        if websocket not in self.logged_users:
            return

        data = instruct.get('data', {})
        piece_name = data.get('piece_name')
        trajectory = data.get('trajectory', [])

        if not piece_name or piece_name not in self.chess_pieces_state:
            return

        piece_state = self.chess_pieces_state[piece_name]
        user_data = self.logged_users[websocket]

        # 检查棋子是否是该玩家拾起的
        if not piece_state.is_picked or piece_state.picked_by != user_data.get('id'):
            return

        # 更新棋子位置
        if trajectory:
            latest_position = trajectory[-1]
            piece_state.position = latest_position
            piece_state.last_update_time = datetime.datetime.now()

        # 广播移动中棋子指令给所有玩家
        conveyor = f"{user_data.get('name')}&{user_data.get('email')}"
        broadcast_instruct = self.instruct.create_broadcast_moving_chess(
            conveyor, piece_name, trajectory
        )
        await self.broadcast_to_all(broadcast_instruct, exclude_websocket=websocket)
    
    async def broadcast_to_all(self, instruct_object, exclude_websocket=None):
        """广播消息给所有连接的用户"""
        for client_id, client_ws in self.connected_clients.items():
            if client_ws != exclude_websocket:
                try:
                    await client_ws.send(instruct_object.to_json())
                except:
                    # 如果发送失败，可能是连接已断开
                    pass
    
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
            log_message(f"用户验证错误: {e}")
            return None
        finally:
            conn.close()

    def get_or_set_anonymous_user(self, email: str) -> Optional[Dict[str, Any]]:
        """获取或创建匿名用户"""
        pass

    def get_server_config(self) -> Dict[str, Any]:
        """ 获取服务器配置 """
        try:
            online_number = len(self.logged_users)
            return {
                "version": configure._config_version_,
                "anonymous_login": configure._config_anonymous_login_,
                "key": configure._config_server_key_,
                "url": configure._config_server_url_,
                "name": configure._config_server_name_,
                "online_number": online_number,
                "max_online": configure._config_max_online_
            }
        except Exception as e:
            log_message(f"获取服务器配置错误: {e}")
            # 返回默认配置
            return {
                "version": "1.0.0",
                "anonymous_login": False,
                "key": "cc1",
                "url": f"ws://{self.host}:{self.port}",
                "name": "中国象棋服务器",
                "online_number": online_number,
                "max_online": 100
            }

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
            log_message(f"获取用户数据错误: {e}")
            return None
        finally:
            conn.close()


if __name__ == '__main__':
    server = ChineseChessServer(host=configure._config_host_,port=configure._config_port_)
    asyncio.run(server.start_server())