#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /main.py
import socket
import threading
import json
import time
import os
from urllib.parse import parse_qs, urlparse
import sqlite3
import random
import string
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.header import Header
import special_config
import ssl
import datetime
import sys

characters_ = string.digits + string.ascii_letters
maxcLength = 500 # 记录每个响应内容在日志内的最大长度

# 创建日志文件
current_time = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
log_filename = f"{current_time}-log.txt"
log_file = open(log_filename, 'w', encoding='utf-8')

def log_message(message):
    """记录日志信息到文件和控制台"""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted_message = f"[{timestamp}] {message}"
    print(formatted_message)
    log_file.write(formatted_message + '\n')
    log_file.flush()  # 确保立即写入文件

class DatabaseManager:
    """数据库管理类"""

    def __init__(self):
        self.db_path = 'users_sqlite_3_py.db'
    
    def get_connection(self):
        """获取数据库连接"""
        return sqlite3.connect(self.db_path)
    
    def execute_query(self, query, params=None):
        """执行查询并返回结果"""
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            if query.strip().upper().startswith('SELECT'):
                return cursor.fetchall()
            else:
                conn.commit()
                return cursor.lastrowid
        finally:
            conn.close()

class SecurityUtils:
    """安全工具类"""
    
    @staticmethod
    def generate_random_code(length=18):
        """生成随机验证码（数字+字母）"""
        return ''.join(random.choice(characters_) for _ in range(length))
    
    @staticmethod
    def generate_token(length=22):
        """生成token（数字+字母）"""
        return ''.join(random.choice(characters_) for _ in range(length))
    
    @staticmethod
    def hash_password(password):
        """密码哈希处理"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    @staticmethod
    def verify_password(real_password, hashed_password):
        """验证密码"""
        return SecurityUtils.hash_password(real_password) == hashed_password

class EmailUtils:
    """邮件工具类"""
    
    @staticmethod
    def send_verification_email(email, name, verification_code, user_id):
        """发送验证邮件"""
        # 邮件配置 
        smtp_server = special_config._smtp_server_
        smtp_port = special_config._smtp_port_
        sender_email = special_config._sender_email_
        sender_password = special_config._sender_password_

        # 激活链接 
        activation_link = f"{special_config._run_site_}/activate?code={verification_code}&user_id={user_id}"
        
        subject = "ATSW账户激活"
        body = f"""
        亲爱的 {name}，
        
        感谢您注册我们的网站！
        
        请点击以下链接激活您的账户：
        {activation_link}
        
        此链接在5分钟内有效。
        
        如果您没有注册此账户，请忽略此邮件。
        
        谢谢！
        ATSW网站团队
        """
        
        try:
            # 创建邮件
            msg = MIMEText(body, 'plain', 'utf-8')
            msg['Subject'] = Header(subject, 'utf-8')
            msg['From'] = sender_email
            msg['To'] = email
            
            # 发送邮件
            server = smtplib.SMTP_SSL(host=smtp_server, port=smtp_port, timeout=5)
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, [email], msg.as_string())
            server.quit()
            
            log_message(f"账号激活邮件发送成功: {email}")
            return True
        except Exception as e:
            log_message(f"发送账号激活邮件失败: {email}, 错误: {e}")
            return False

class AccountService:
    """账号服务类"""
    
    def __init__(self):
        self.db = DatabaseManager()
        self.security = SecurityUtils()
        self.email_utils = EmailUtils()
    
    def parse_request(self, request_data):
        """解析HTTP请求"""
        lines = request_data.split('\r\n')
        if not lines:
            return None, None, {}
        
        # 解析请求行
        request_line = lines[0].split()
        if len(request_line) < 2:
            return None, None, {}
        
        method = request_line[0]
        path = request_line[1]
        
        # 解析查询参数
        parsed_url = urlparse(path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)
        
        # 解析POST数据
        post_data = {}
        if method == 'POST':
            # 找到空行后的请求体
            body_start = False
            for i, line in enumerate(lines):
                if line == '':
                    body_start = i + 1
                    break
            
            if body_start and body_start < len(lines):
                body = lines[body_start]
                post_data = parse_qs(body)
        
        # 简化参数格式（从列表转为单个值）
        params = {}
        for key, value in query_params.items():
            params[key] = value[0] if value else ''
        
        for key, value in post_data.items():
            params[key] = value[0] if value else ''
        
        return method, path, params
    
    def create_response(self, data, status_code=200, content_type='application/json', cookies=None):
        """创建HTTP响应"""
        status_text = 'OK' if status_code == 200 else 'Not Found'
        response = f"HTTP/1.1 {status_code} {status_text}\r\n"
        response += f"Content-Type: {content_type}\r\n"
        
        # 添加CORS头允许跨域访问api
        response += "Access-Control-Allow-Origin: *\r\n"
        response += "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
        response += "Access-Control-Allow-Headers: Content-Type, Authorization\r\n"
        
        if cookies:
            for cookie in cookies:
                response += f"Set-Cookie: {cookie}\r\n"
        
        response += "\r\n"
        
        if content_type == 'application/json' and data:
            response += json.dumps(data)
        
        return response.encode('utf-8')
    
    def log_request(self, method, path, params, addr):
        """记录请求信息"""
        # 隐藏敏感信息
        safe_params = params.copy()
        if 'password' in safe_params:
            safe_params['password'] = '***hidden***'
        
        log_message(f"请求来自 {addr}: {method} {path}")
        log_message(f"请求参数: {safe_params}")
    
    def log_response(self, response_data, addr):
        """记录响应信息"""
        try:
            # 尝试解析响应内容
            response_str = response_data.decode('utf-8')
            # 提取状态码
            status_line = response_str.split('\r\n')[0]
            # 提取响应体
            body_start = response_str.find('\r\n\r\n') + 4
            body = response_str[body_start:] if body_start > 3 else ""
            
            # 尝试解析JSON响应体
            try:
                json_body = json.loads(body) if body else {}
                # 隐藏敏感信息
                safe_body = json_body.copy()
                if 'user' in safe_body and safe_body['user'] and 'password' in safe_body['user']:
                    safe_body['user']['password'] = '***'
                
                log_message(f"响应给 {addr}: {status_line}")
                log_message(f"响应内容: {json.dumps(safe_body, ensure_ascii=False)}")
            except:
                log_message(f"响应给 {addr}: {status_line}")
                log_message(f"响应内容: {body[:maxcLength]}...")
        except:
            log_message(f"响应给 {addr}: [二进制数据，长度: {len(response_data)}]")
    
    def handle_register(self, params):
        """处理注册请求"""
        response = {"success": False, "message": ""}
        
        try:
            email = params.get('email', '').strip().lower()
            password = params.get('password', '')
            name = params.get('name', '').strip()
            qq = params.get('qq', '0').strip()
            
            # 验证数据
            errors = self.validate_registration_data(email, password, name, qq)
            if errors:
                response["message"] = "; ".join(errors)
                return response
            
            # 检查邮箱是否已存在
            existing_user = self.db.execute_query(
                "SELECT id FROM users WHERE email = ?", 
                (email,)
            )
            
            if existing_user:
                response["message"] = "该邮箱已被注册"
                return response
            
            # 准备数据
            hashed_password = self.security.hash_password(password)
            verification_code = self.security.generate_random_code(18)
            code_expiry = int(time.time()) + 300  # 5分钟有效
            qq_value = float(qq) if qq and qq != '0' else 0
            
            # 插入用户数据
            user_id = self.db.execute_query('''
                INSERT INTO users 
                (email, password, name, qq, verification_code, code_expiry, email_verified)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (email, hashed_password, name, qq_value, verification_code, code_expiry, 0))
            
            # 发送验证邮件
            email_sent = self.email_utils.send_verification_email(
                email, name, verification_code, user_id
            )
            
            if email_sent:
                response["success"] = True
                response["message"] = "注册成功！请查收邮件激活账户"
            else:
                response["message"] = "注册成功，但发送验证邮件失败，请联系管理员"
            
        except Exception as e:
            response["message"] = f"注册过程中发生错误: {str(e)}"
        
        return response
    
    def validate_registration_data(self, email, password, name, qq=None):
        """验证注册数据"""
        errors = []
        
        # 邮箱验证
        if not email or '@' not in email:
            errors.append("请输入有效的邮箱地址")
        
        # 密码验证
        if not password or len(password) < 8:
            errors.append("密码长度至少8位")
        
        # 姓名验证
        if not name or len(name.strip()) < 2:
            errors.append("姓名长度至少2位")
        
        # QQ验证（可选）
        if qq and (not qq.isdigit() or len(qq) < 5):
            errors.append("QQ号码格式不正确")
        
        return errors
    
    def handle_login(self, params, cookies):
        """处理登录请求"""
        response = {"success": False, "message": "", "user": None}
        
        try:
            email = params.get('email', '').strip().lower()
            password = params.get('password', '')
            
            if not email or not password:
                response["message"] = "邮箱和密码不能为空"
                return response, []
            
            # 查询用户
            user = self.db.execute_query('''
                SELECT id, email, password, name, qq, theme_color, head_img, email_verified, token, token_expiry, anonymous_user
                FROM users 
                WHERE email = ?
            ''', (email,))
            
            if not user:
                response["message"] = "邮箱或密码错误"
                return response, []
            
            user_data = user[0]
            
            # 验证密码
            if not self.security.verify_password(password, user_data[2]):
                response["message"] = "邮箱或密码错误"
                return response, []
            
            # 检查邮箱是否已验证
            if not user_data[7]:
                response["message"] = "请先激活您的账户"
                return response, []
            
            # 生成新token
            token = self.security.generate_token(22)
            token_expiry = int(time.time()) + 15768000  # 182.5天
            
            # 更新用户token
            self.db.execute_query('''
                UPDATE users 
                SET token = ?, token_expiry = ?, last_login = ?
                WHERE id = ?
            ''', (token, token_expiry, int(time.time()), user_data[0]))
            
            # 准备Cookie
            expires = time.strftime("%a, %d-%b-%Y %H:%M:%S GMT", time.gmtime(token_expiry))
            cookie_list = [
                f"user_token={token}; expires={expires}; path=/",
                f"user_id={user_data[0]}; expires={expires}; path=/"
            ]
            
            # 准备返回的用户数据
            user_data_info = {
                "id": user_data[0],
                "anonymous_user": bool(user_data[10]),
                "email": user_data[1],
                "password": "",
                "name": user_data[3],
                "qq": user_data[4],
                "theme_color": user_data[5],
                "head_img": user_data[6]
            }
            
            response["success"] = True
            response["message"] = "登录成功"
            response["user"] = user_data_info
            
            return response, cookie_list
            
        except Exception as e:
            response["message"] = f"登录过程中发生错误: {str(e)}"
            return response, []
    
    def handle_activate(self, params):
        """处理激活请求"""
        response = {"success": False, "message": ""}
        
        try:
            verification_code = params.get('code', '').strip()
            user_id = params.get('user_id', '').strip()
            
            if not verification_code or not user_id:
                response["message"] = "激活参数不完整"
                return response
            
            # 查询用户
            user = self.db.execute_query('''
                SELECT id, verification_code, code_expiry, email_verified 
                FROM users 
                WHERE id = ? AND verification_code = ?
            ''', (user_id, verification_code))
            
            if not user:
                response["message"] = "激活链接无效"
                return response
            
            user_data = user[0]
            current_time = int(time.time())
            
            # 检查验证码是否过期
            if user_data[2] < current_time:
                response["message"] = "激活链接已过期，请重新注册"
                return response
            
            # 检查是否已激活
            if user_data[3]:
                response["success"] = True
                response["message"] = "账户已激活，无需重复操作"
                return response
            
            # 激活账户
            self.db.execute_query('''
                UPDATE users 
                SET email_verified = 1, verification_code = NULL, code_expiry = NULL
                WHERE id = ?
            ''', (user_id,))
            
            response["success"] = True
            response["message"] = "账户激活成功！您现在可以登录了"
            
        except Exception as e:
            response["message"] = f"激活过程中发生错误: {str(e)}"
        
        return response
    
    def handle_getuserdata(self, params, cookies):
        """处理获取用户数据请求"""
        response = {"success": False, "message": "", "user": None}
        
        try:
            user_id = params.get('user_id', '').strip()
            token = params.get('token', '').strip()
            
            if not user_id or not token:
                response["message"] = "用户ID和token不能为空"
                return response
            
            # 从Cookie中提取token和user_id（如果参数中没有提供）
            cookie_dict = {}
            for cookie in cookies:
                parts = cookie.split('=')
                if len(parts) == 2:
                    cookie_dict[parts[0].strip()] = parts[1].strip()
            
            # 优先使用参数中的值，如果没有则使用Cookie中的值
            if not user_id:
                user_id = cookie_dict.get('user_id', '')
            if not token:
                token = cookie_dict.get('user_token', '')
            
            if not user_id or not token:
                response["message"] = "用户ID和token不能为空"
                return response
            
            # 查询用户
            user = self.db.execute_query('''
                SELECT id, email, name, qq, theme_color, head_img, token, token_expiry, anonymous_user
                FROM users 
                WHERE id = ? AND token = ?
            ''', (user_id, token))
            
            if not user:
                response["message"] = "用户不存在或token无效"
                return response
            
            user_data = user[0]
            current_time = int(time.time())
            
            # 检查token是否过期
            if user_data[7] and user_data[7] < current_time:
                response["message"] = "token已过期，请重新登录"
                return response
            
            # 准备返回的用户数据
            user_data_info = {
                "id": user_data[0],
                "anonymous_user": bool(user_data[8]),
                "email": user_data[1],
                "password": "",
                "name": user_data[2],
                "qq": user_data[3],
                "theme_color": user_data[4],
                "head_img": user_data[5]
            }
            
            response["success"] = True
            response["message"] = "获取用户数据成功"
            response["user"] = user_data_info
            
        except Exception as e:
            response["message"] = f"获取用户数据过程中发生错误: {str(e)}"
        
        return response
    
    def handle_request(self, request_data, addr):
        """处理HTTP请求"""
        method, path, params = self.parse_request(request_data)
        
        if not method or not path:
            return self.create_response({"error": "Invalid request"}, 400)
        
        # 记录请求信息
        self.log_request(method, path, params, addr)
        
        # 获取Cookie
        cookies = []
        for line in request_data.split('\r\n'):
            if line.startswith('Cookie:'):
                cookies = [c.strip() for c in line[8:].split(';')]
        
        # 处理OPTIONS预检请求 返回空响应
        if method == 'OPTIONS':
            return self.create_response({})

        # 路由处理
        if path == '/register' and method == 'POST':
            result = self.handle_register(params)
            response = self.create_response(result)
        elif path == '/login' and method == 'POST':
            result, cookie_list = self.handle_login(params, cookies)
            response = self.create_response(result, cookies=cookie_list)
        elif path == '/activate' and method == 'GET':
            result = self.handle_activate(params)
            response = self.create_response(result)
        elif path == '/getuserdata' and method == 'POST':
            result = self.handle_getuserdata(params, cookies)
            response = self.create_response(result)
        else:
            response = self.create_response({"error": "Not found"}, 404)
        
        # 记录响应信息
        self.log_response(response, addr)
        
        return response

class AccountServer:
    """账号服务器类"""
    
    def __init__(self, host='0.0.0.0', port=810):
        self.host = host
        self.port = port
        self.account_service = AccountService()
        self.ssl_enabled = special_config._ssl_enable_
        self.ssl_crt_file = special_config._ssl_crt_file_
        self.ssl_key_file = special_config._ssl_key_file_
    
    def handle_client(self, client_socket, addr):
        """处理客户端连接"""
        try:
            # 接收请求数据
            request_data = client_socket.recv(1024).decode('utf-8')
            if not request_data:
                return
            
            # 处理请求并生成响应
            response = self.account_service.handle_request(request_data, addr)
            
            # 发送响应
            client_socket.send(response)
            
        except Exception as e:
            log_message(f"处理客户端请求时出错: {e}")
        finally:
            client_socket.close()
    
    def start(self):
        """启动服务器"""
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        try:
            server_socket.bind((self.host, self.port))
            server_socket.listen(5)
            
            # 如果启用SSL，包装socket
            if self.ssl_enabled and self.ssl_crt_file and self.ssl_key_file:
                try:
                    # 创建SSL上下文
                    context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
                    context.load_cert_chain(certfile=self.ssl_crt_file, keyfile=self.ssl_key_file)
                    
                    # 包装socket
                    server_socket = context.wrap_socket(server_socket, server_side=True)
                    log_message(f"账号服务已启动（SSL加密），监听端口 {self.port}")
                except Exception as e:
                    log_message(f"SSL配置失败: {e}")
                    log_message(f"账号服务已启动（无SSL），监听端口 {self.port}")
            else:
                log_message(f"账号服务已启动，监听端口 {self.port}")
            
            while True:
                client_socket, addr = server_socket.accept()
                log_message(f"接收到来自 {addr} 的连接")
                
                # 为每个客户端创建新线程
                client_thread = threading.Thread(
                    target=self.handle_client, 
                    args=(client_socket, addr)
                )
                client_thread.daemon = True
                client_thread.start()
                
        except KeyboardInterrupt:
            log_message("服务器正在关闭...")
        except Exception as e:
            log_message(f"服务器错误: {e}")
        finally:
            server_socket.close()
            log_file.close()

def init_database():
    """初始化数据库"""
    db_path = 'users_sqlite_3_py.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 创建users表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                anonymous_user BOOLEAN DEFAULT 0,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                qq REAL DEFAULT 0,
                theme_color TEXT DEFAULT 'rgba(255,255,255,1)',
                head_img TEXT DEFAULT 'none',
                token TEXT UNIQUE,
                token_expiry INTEGER,
                email_verified BOOLEAN DEFAULT 0,
                verification_code TEXT,
                code_expiry INTEGER,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                last_login INTEGER DEFAULT (strftime('%s', 'now'))
            )
        ''')
        
        # 创建索引以提高查询性能
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_email ON users(email)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_token ON users(token)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_verification_code ON users(verification_code)')
        
        conn.commit()
        log_message(f"数据库初始化成功！数据库文件: {db_path}")
        
    except sqlite3.Error as e:
        log_message(f"数据库初始化失败: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    log_message(f"脚本启动，日志文件: {log_filename}")
    
    # 初始化数据库
    init_database()
    
    # 启动服务器
    server = AccountServer()
    server.start()