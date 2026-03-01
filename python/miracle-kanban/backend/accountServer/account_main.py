#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/accountServer/account_main.py
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
import configure
import ssl
import datetime
import sys

# 表结构（列名和顺序）v1.0.2
EXPECTED_COLUMNS = [
    'id',                   # 0
    'anonymous_user',       # 1
    'email',                # 2
    'password',             # 3
    'name',                 # 4
    'qq',                   # 5
    'theme_color',          # 6
    'head_img',             # 7
    'token',                # 8
    'token_expiry',         # 9
    'email_verified',       # 10
    'verification_code',    # 11
    'code_expiry',          # 12
    'resetpwd_code',        # 13
    'resetpwd_expiry',      # 14
    'created_at',           # 15
    'last_login'            # 16
]

characters_     = string.digits + string.ascii_letters
maxWriteLog_    = 500 # 记录每个响应内容在日志内的最大长度

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
    log_file.flush()

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
        smtp_server = configure._smtp_server_
        smtp_port = configure._smtp_port_
        sender_email = configure._sender_email_
        sender_password = configure._sender_password_

        # 激活链接 
        activation_link = f"{configure._server_url_}/activate?code={verification_code}&user_id={user_id}"
        subject = "ATSW账户激活"
        # HTML邮件内容 WebsiteAccountActivation.html
        body = f"""<html><head><meta charset="UTF-8"><style>body{{color:#333;margin:0;padding:20px}} .h{{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:20px;text-align:center;border-radius:8px 8px 0 0}} .b{{display:inline-block;background:#4CAF50;color:#fff;padding:12px 24px;text-decoration:none;border-radius:5px;margin:15px 0}} .f{{border-top:1px solid #ddd;color:#666;font-size:18px}}</style></head><body><div class="h"><h2>🎉 欢迎加入 ATSW！</h2></div><div><p>亲爱的 <strong>{name}</strong>，</p><p>感谢您注册我们的网站！请点击下方按钮激活您的账户：</p><div style="text-align:left"><a href="{activation_link}" class="b">🚀 立即激活账户</a></div><p>或者复制以下链接到浏览器中打开：</p><p style="word-break:break-all;background:#eee;padding:10px;border-radius:4px;font-size:12px">{activation_link}</p><p><strong>⚠️ 重要提示：</strong>此链接在 <strong>5分钟</strong> 内有效。</p><p>如果您没有注册此账户，请忽略此邮件。</p></div><div class="f"><p>谢谢！<br>ATSW网站团队</p></div></body></html>"""
        try:
            # 创建HTML邮件
            msg = MIMEText(body, 'html', 'utf-8')
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
    
    @staticmethod
    def send_reset_password_email(email, name, resetpwd_code, user_id):
        """发送密码重置邮件"""
        # 邮件配置 
        smtp_server = configure._smtp_server_
        smtp_port = configure._smtp_port_
        sender_email = configure._sender_email_
        sender_password = configure._sender_password_

        # 重置密码链接
        reset_link = f"{configure._server_url_}/resetpwdrun?user_id={user_id}&resetpwd_code={resetpwd_code}"
        subject = "ATSW密码重置"
        # 重置密码验证邮件内容 ViewPasswordResetVerify.html
        body = f"""<html><head><meta charset="UTF-8"><style>body{{color:#333;margin:0;padding:20px}} .h{{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:20px;text-align:center;border-radius:8px 8px 0 0}} .b{{display:inline-block;background:#4CAF50;color:#fff;padding:12px 24px;text-decoration:none;border-radius:5px;margin:15px 0}} .f{{border-top:1px solid #ddd;color:#666;font-size:18px}}</style></head><body><div class="h"><h2>🔐 ATSW密码重置</h2></div><div><p>亲爱的 <strong>{name}</strong>，</p><p>我们收到了您重置密码的请求。请点击下方按钮重置您的密码：</p><div style="text-align:left"><a href="{reset_link}" class="b">🔑 立即重置密码</a></div><p>或者复制以下链接到浏览器中打开：</p><p style="word-break:break-all;background:#eee;padding:10px;border-radius:4px;font-size:12px">{reset_link}</p><p><strong>⚠️ 重要提示：</strong>此链接在 <strong>5分钟</strong> 内有效。</p><p>如果您没有请求重置密码，请忽略此邮件。</p></div><div class="f"><p>谢谢！<br>ATSW网站团队</p></div></body></html>"""
        try:
            # 创建HTML邮件
            msg = MIMEText(body, 'html', 'utf-8')
            msg['Subject'] = Header(subject, 'utf-8')
            msg['From'] = sender_email
            msg['To'] = email
            
            # 发送邮件
            server = smtplib.SMTP_SSL(host=smtp_server, port=smtp_port, timeout=5)
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, [email], msg.as_string())
            server.quit()
            
            log_message(f"密码重置邮件发送成功: {email}")
            return True
        except Exception as e:
            log_message(f"发送密码重置邮件失败: {email}, 错误: {e}")
            return False

class AccountService:
    """账号服务类"""
    
    def __init__(self):
        self.db = DatabaseManager()
        self.security = SecurityUtils()
        self.email_utils = EmailUtils()
        self.default_reset_password = 'atsw@top'
        self.hashed_reset_password = self.security.hash_password(self.default_reset_password)
        self.allowed_paths = {
            '/register',
            '/tokenlogin',
            '/login',
            '/activate',
            '/getuserdata',
            '/resetpwd',
            '/resetpwdrun',
            '/updatepwd'
        }
    
    def create_html_response(self, title, message, is_success=True):
        """创建HTML响应页面"""
        icon = "✅" if is_success else "❌"
        bg_color = "#d4edda" if is_success else "#f8d7da"
        border_color = "#c3e6cb" if is_success else "#f5c6cb"

        # 激活返回页面 ViewAccountActivationRespone.html
        html = f"""<html><head><meta charset="UTF-8"><title>{title}</title><style>body{{background:linear-gradient(135deg,#667eea,#764ba2);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}} .c{{background:white;padding:30px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.2);text-align:center;width:100%}} .m{{background:{bg_color};border:1px solid {border_color};padding:15px;border-radius:5px;margin:20px 0;color:#155724;font-size:24px}} .i{{font-size:48px;margin-bottom:20px}}</style></head><body><div class="c"><div class="i">{icon}</div><h1>{title}</h1><div class="m">{message}</div></div></body></html>"""
        return html.encode('utf-8')
    
    def create_resetpwd_html_response(self, title, message, is_success=True):
        """创建密码重置HTML响应页面"""
        icon = "✅" if is_success else "❌"
        bg_color = "#d4edda" if is_success else "#f8d7da"
        border_color = "#c3e6cb" if is_success else "#f5c6cb"

        # 密码重置返回页面 ViewPasswordResetRespone.html
        html = f"""<html><head><meta charset="UTF-8"><title>{title}</title><style>body{{background:linear-gradient(135deg,#667eea,#764ba2);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}} .c{{background:white;padding:30px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.2);text-align:center;width:100%;max-width:600px}} .m{{background:{bg_color};border:1px solid {border_color};padding:15px;border-radius:5px;margin:20px 0;color:#155724;font-size:18px;text-align:left}} .i{{font-size:48px;margin-bottom:20px}} .w{{color:#856404;background-color:#fff3cd;border:1px solid #ffeaa7;padding:10px;border-radius:5px;margin:15px 0;font-size:16px}} .btn{{display:inline-block;background:#4CAF50;color:#fff;padding:12px 24px;text-decoration:none;border-radius:5px;margin:15px 0;border:none;cursor:pointer;font-size:16px}} .btn:hover{{background:#45a049}} input{{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:5px;box-sizing:border-box}}</style></head><body><div class="c"><div class="i">{icon}</div><h1>{title}</h1><div class="m">{message}</div></div></body></html>"""
        return html.encode('utf-8')

    def parse_request(self, request_data):
        """解析HTTP请求"""
        try:
            if not request_data or not isinstance(request_data, str):
                return None, None, {}
            
            # 限制请求大小
            if len(request_data) > 8192:  # 8KB限制
                log_message("请求数据过大")
                return None, None, {}
            
            lines = request_data.split('\r\n')
            if not lines:
                return None, None, {}
            
            # 验证请求行格式
            request_line = lines[0].strip()
            if not request_line:
                return None, None, {}
            
            parts = request_line.split()
            if len(parts) < 2:
                return None, None, {}
            
            method = parts[0] # GET OR POST
            path = parts[1] # 包含路径和参数
            
            # 验证路径格式
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
                    try:
                        body = lines[body_start]
                        post_data = parse_qs(body)
                    except:
                        post_data = {}
            
            # 简化参数格式
            params = {}
            for key, value in query_params.items():
                params[key] = value[0] if value else ''
            
            for key, value in post_data.items():
                params[key] = value[0] if value else ''
            
            return method, path, params
            
        except Exception as e:
            log_message(f"解析请求时出错: {e}")
            return None, None, {}
    
    def create_response(self, data, status_code=200, content_type='application/json', cookies=None):
        """创建HTTP响应"""
        status_text = 'OK' if status_code == 200 else 'Not Found'
        response = f"HTTP/1.1 {status_code} {status_text}\r\n"
        response += f"Content-Type: {content_type}\r\n"
        
        # 添加CORS头允许跨域访问api
        response += f"Access-Control-Allow-Origin: {configure._access_control_allow_origin_}\r\n"
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
        if 'old_pwd' in safe_params:
            safe_params['old_pwd'] = '***hidden***'
        if 'new_pwd' in safe_params:
            safe_params['new_pwd'] = '***hidden***'
        if 'base64_img' in safe_params:
            safe_params['base64_img'] = '***base64 image data***'
        
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
                log_message(f"响应内容: {body[:maxWriteLog_]}...")
        except:
            log_message(f"响应给 {addr}: [二进制数据，长度: {len(response_data)}]")
    
    def handle_register(self, params):
        """处理注册请求"""
        response = {"success": False, "message": ""}
        
        try:
            email = params.get('email', '').strip().lower()
            password = params.get('password', '')
            name = params.get('name', '').strip()
            qq = params.get('qq', None)
            if qq != None:
                qq = qq.strip()

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
            verification_code = self.security.generate_random_code(20)
            code_expiry = int(time.time()) + 300  # 5分钟有效
            qq_value = float(qq) if qq and qq != '0' else 0
            
            # 插入用户数据
            user_id = self.db.execute_query('''
                INSERT INTO users 
                (email, password, name, qq, verification_code, code_expiry, email_verified, resetpwd_code, resetpwd_expiry)
                VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
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
    
    def handle_login(self, params):
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
                SELECT id, anonymous_user, email, password, name, qq, theme_color, head_img, email_verified, token, token_expiry
                FROM users 
                WHERE email = ?
            ''', (email,))
            
            if not user:
                response["message"] = "邮箱或密码错误"
                return response, []
            
            user_data = user[0]
            
            # 验证密码
            if not self.security.verify_password(password, user_data[3]):
                response["message"] = "邮箱或密码错误"
                return response, []
            
            # 检查邮箱是否已验证
            if not user_data[8]:
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
                "anonymous_user": bool(user_data[1]),
                "email": user_data[2],
                "password": "",
                "name": user_data[4],
                "qq": user_data[5],
                "theme_color": user_data[6],
                "head_img": user_data[7],
                "token": token
            }
            
            response["success"] = True
            response["message"] = "ok"
            response["user"] = user_data_info
            
            return response, cookie_list
            
        except Exception as e:
            response["message"] = f"登录过程中发生错误: {str(e)}"
            return response, []
    
    def handle_activate(self, params):
        """处理激活请求"""
        
        try:
            verification_code = params.get('code', '').strip()
            user_id = params.get('user_id', '').strip()
            
            if not verification_code or not user_id:
                return self.create_html_response(
                    "激活失败", 
                    "激活参数不完整，请检查链接是否正确。",
                    is_success=False
                )
            
            # 查询用户
            user = self.db.execute_query('''
                SELECT id, verification_code, code_expiry, email_verified, email
                FROM users 
                WHERE id = ? AND verification_code = ?
            ''', (user_id, verification_code))
            
            if not user:
                return self.create_html_response(
                    "激活失败", 
                    "激活链接无效或已过期，请重新注册。",
                    is_success=False
                )
            
            user_data = user[0]
            current_time = int(time.time())
            
            # 检查验证码是否过期
            if user_data[2] < current_time:
                return self.create_html_response(
                    "激活失败", 
                    "激活链接已过期，请重新注册。",
                    is_success=False
                )
            
            # 检查是否已激活
            if user_data[3]:
                return self.create_html_response(
                    "账户已激活", 
                    f"您的账户 {user_data[4]} 已经激活过了，无需重复操作。",
                    is_success=True
                )
            
            # 激活账户
            self.db.execute_query('''
                UPDATE users 
                SET email_verified = 1, verification_code = NULL, code_expiry = NULL
                WHERE id = ?
            ''', (user_id,))
            
            return self.create_html_response(
                "激活成功", 
                f"恭喜！您的账户 {user_data[4]} 已成功激活。<br>现在可以登录使用所有功能了。",
                is_success=True
            )
            
        except Exception as e:
            return self.create_html_response(
                "激活失败", 
                f"激活过程中发生错误。<br>请联系管理员。",
                is_success=False
            )
    
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
                SELECT id, anonymous_user, email, name, qq, theme_color, head_img, token, token_expiry
                FROM users 
                WHERE id = ? AND token = ?
            ''', (user_id, token))
            
            if not user:
                response["message"] = "用户不存在或token无效"
                return response
            
            user_data = user[0]
            current_time = int(time.time())
            
            # 检查token是否过期
            if user_data[8] and user_data[8] < current_time:
                response["message"] = "token已过期，请重新登录"
                return response
            
            # 准备返回的用户数据
            user_data_info = {
                "id": user_data[0],
                "anonymous_user": bool(user_data[1]),
                "email": user_data[2],
                "password": "",
                "name": user_data[3],
                "qq": user_data[4],
                "theme_color": user_data[5],
                "head_img": user_data[6]
            }
            
            response["success"] = True
            response["message"] = "获取用户数据成功"
            response["user"] = user_data_info
            
        except Exception as e:
            response["message"] = f"获取用户数据过程中发生错误: {str(e)}"
        
        return response
    
    def handle_tokenlogin(self, params, cookies):
        """处理token自动登录请求"""
        response = {"success": False, "message": "", "user": None}
    
        try:
            # 从参数或Cookie中获取token和user_id
            user_id = params.get('user_id', '').strip()
            token = params.get('user_token', '').strip()
        
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
                response["message"] = "empty user_id or user_token"
                return response
            
            # 查询用户
            user = self.db.execute_query('''
                SELECT id, anonymous_user, email, password, name, qq, theme_color, head_img, token, token_expiry, email_verified
                FROM users 
                WHERE id = ? AND token = ?
            ''', (user_id, token))
            
            if not user:
                response["message"] = "token无效或用户不存在"
                return response
            
            user_data = user[0]
            current_time = int(time.time())
            
            # 检查token是否过期
            if user_data[9] and user_data[9] < current_time:
                response["message"] = "token已过期，请重新登录"
                return response
            
            # 检查邮箱是否已验证
            if not user_data[10]:
                response["message"] = "账户未激活，请先激活账户"
                return response
            
            # 准备返回的用户数据
            user_data_info = {
                "id": user_data[0],
                "anonymous_user": bool(user_data[1]),
                "email": user_data[2],
                "password": "",
                "name": user_data[4],
                "qq": user_data[5],
                "theme_color": user_data[6],
                "head_img": user_data[7]
            }
            
            response["success"] = True
            response["message"] = "ok"
            response["user"] = user_data_info
            
            return response
        
        except Exception as e:
            response["message"] = f"自动登录过程中发生错误: {str(e)}"
            return response, []
    
    def handle_setheadimg(self, params):
        """设置用户自定义头像"""
        response = {"success": False, "message": ""}
        
        try:
            user_id = params.get('user_id', '').strip()
            token = params.get('user_token', '').strip()
            base64_img = params.get('base64_img', '').strip()
            
            # 验证参数
            if not user_id or not token or not base64_img:
                response["message"] = "参数不完整"
                return response
            
            # 验证用户和token
            user = self.db.execute_query('''
                SELECT id, token, token_expiry
                FROM users 
                WHERE id = ? AND token = ?
            ''', (user_id, token))
            
            if not user:
                response["message"] = "用户不存在或token无效"
                return response
            
            user_data = user[0]
            current_time = int(time.time())
            
            # 检查token是否过期
            if user_data[2] and user_data[2] < current_time:
                response["message"] = "token已过期，请重新登录"
                return response
            
            # 验证base64图片数据
            if not base64_img.startswith('data:image/'):
                response["message"] = "图片格式不正确"
                return response
            
            # 更新头像
            self.db.execute_query('''
                UPDATE users 
                SET head_img = ?
                WHERE id = ?
            ''', (base64_img, user_id))
            
            response["success"] = True
            response["message"] = "更新头像成功！"
            
        except Exception as e:
            response["message"] = f"更新头像失败: {str(e)}"
        
        return response
    
    def handle_resetpwd(self, params):
        """处理重置密码请求(POST)"""
        response = {"success": False, "message": ""}
        
        try:
            user_email = params.get('user_email', '').strip().lower()
            
            if not user_email or '@' not in user_email:
                response["message"] = "请输入有效的邮箱地址。"
                return response
            
            # 查询用户
            user = self.db.execute_query('''
                SELECT id, name, email_verified, resetpwd_expiry
                FROM users 
                WHERE email = ?
            ''', (user_email,))
            
            if not user:
                response["message"] = "抱歉！此账户还未注册。"
                return response
            
            user_data = user[0]
            
            # 检查邮箱是否已验证
            if not user_data[2]:
                response["message"] = "抱歉！此账户还未激活。"
                return response
            
            # 检查是否存在未失效的resetpwd_code
            current_time = int(time.time())
            if user_data[3] and user_data[3] > current_time:
                remaining_time = user_data[3] - current_time
                response["message"] = f"操作频繁，请{remaining_time}秒后再试！"
                return response
            
            # 生成重置码和失效时间
            resetpwd_code = self.security.generate_random_code(18)
            resetpwd_expiry = current_time + 300  # 5分钟有效
            
            # 更新数据库
            self.db.execute_query('''
                UPDATE users 
                SET resetpwd_code = ?, resetpwd_expiry = ?
                WHERE id = ?
            ''', (resetpwd_code, resetpwd_expiry, user_data[0]))
            
            # 发送重置邮件
            email_sent = self.email_utils.send_reset_password_email(
                user_email, user_data[1], resetpwd_code, user_data[0]
            )
            
            if email_sent:
                response["success"] = True
                response["message"] = "重置邮件发送成功，请查收邮件以重置密码！"
            else:
                response["message"] = "抱歉！我们无法向您发送邮件，请联系管理员。"
            
        except Exception as e:
            response["message"] = f"重置密码过程中发生错误: {str(e)}"
        
        return response
    
    def handle_resetpwdrun(self, params):
        """处理重置密码执行请求(GET)"""
        
        try:
            user_id = params.get('user_id', '').strip()
            resetpwd_code = params.get('resetpwd_code', '').strip()
            
            if not user_id or not resetpwd_code:
                return self.create_resetpwd_html_response(
                    "重置失败", 
                    "重置参数不完整，请检查链接是否正确。",
                    is_success=False
                )
            
            # 查询用户
            user = self.db.execute_query('''
                SELECT id, resetpwd_code, resetpwd_expiry, email
                FROM users 
                WHERE id = ? AND resetpwd_code = ?
            ''', (user_id, resetpwd_code))
            
            if not user:
                return self.create_resetpwd_html_response(
                    "重置失败", 
                    "重置链接无效或已过期，请重新请求重置密码。",
                    is_success=False
                )
            
            user_data = user[0]
            current_time = int(time.time())
            
            # 检查重置码是否过期
            if user_data[2] and user_data[2] < current_time:
                return self.create_resetpwd_html_response(
                    "重置失败", 
                    "重置链接已过期，请重新请求重置密码。",
                    is_success=False
                )
            
            # 重置密码并更新重置码过期时间
            self.db.execute_query('''
                UPDATE users 
                SET password = ?, resetpwd_expiry = ?
                WHERE id = ?
            ''', (self.hashed_reset_password, current_time - 1, user_id))  # 设置过期时间为过去时间
            
            success_message = f"""
            您的密码已重置成功！<br><br>
            <strong>新密码：{self.default_reset_password}</strong><br><br>
            请使用此密码登录，并尽快修改为新的密码以确保账户安全。<br><br>
            <div class="w">⚠️ 安全提示：登录后请立即前往账号设置页面修改密码！</div>
            """
            
            return self.create_resetpwd_html_response(
                "密码重置成功", 
                success_message,
                is_success=True
            )
            
        except Exception as e:
            return self.create_resetpwd_html_response(
                "重置失败", 
                f"重置过程中发生错误。<br>请联系管理员。",
                is_success=False
            )
    
    def handle_updatepwd(self, params, cookies):
        """处理更新密码请求(POST)"""
        response = {"success": False, "message": ""}
        
        try:
            user_id = params.get('user_id', '').strip()
            user_token = params.get('user_token', '').strip()
            old_pwd = params.get('old_pwd', '')
            new_pwd = params.get('new_pwd', '')
            
            # 从Cookie中提取token和user_id（如果参数中没有提供）
            cookie_dict = {}
            for cookie in cookies:
                parts = cookie.split('=')
                if len(parts) == 2:
                    cookie_dict[parts[0].strip()] = parts[1].strip()
            
            # 优先使用参数中的值，如果没有则使用Cookie中的值
            if not user_id:
                user_id = cookie_dict.get('user_id', '')
            if not user_token:
                user_token = cookie_dict.get('user_token', '')
            
            # 验证参数
            if not user_id or not user_token:
                response["message"] = "请登录后再试！"
                return response
            
            if not old_pwd or not new_pwd:
                response["message"] = "旧密码和新密码不能为空"
                return response
            
            # 检查新密码长度
            if len(new_pwd) < 8:
                response["message"] = "新密码太短(小于8个字符)！"
                return response
            
            # 检查新旧密码是否相同
            if old_pwd == new_pwd:
                response["message"] = "新密码不能和旧密码一致！"
                return response
            
            # 查询用户
            user = self.db.execute_query('''
                SELECT id, password, token, token_expiry, email_verified
                FROM users 
                WHERE id = ? AND token = ?
            ''', (user_id, user_token))
            
            if not user:
                response["message"] = "请登录后再试！"
                return response
            
            user_data = user[0]
            current_time = int(time.time())
            
            # 检查token是否过期
            if user_data[3] and user_data[3] < current_time:
                response["message"] = "登录已过期，请重新登录后再试。"
                return response
            
            # 检查邮箱是否已验证
            if not user_data[4]:
                response["message"] = "账户未激活，请先激活账户后再试。"
                return response
            
            # 验证旧密码
            if not self.security.verify_password(old_pwd, user_data[1]):
                response["message"] = "旧密码错误！"
                return response
            
            # 更新密码
            hashed_new_password = self.security.hash_password(new_pwd)
            self.db.execute_query('''
                UPDATE users 
                SET password = ?
                WHERE id = ?
            ''', (hashed_new_password, user_id))
            
            response["success"] = True
            response["message"] = "密码更新成功！"
            
        except Exception as e:
            response["message"] = f"更新密码过程中发生错误: {str(e)}"
        
        return response

    def handle_request(self, request_data, addr):
        """处理HTTP请求"""
        method, path, params = self.parse_request(request_data)
        
        if not method or not path:
            return self.create_response({"error": "Invalid request"}, 400)
        
        # 检查路径是否在允许列表中
        if path not in self.allowed_paths:
            log_message(f"拒绝访问未允许的路径: {path} 来自 {addr}")
            return self.create_response({"error": "Not found"}, 404)

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
        if   path == '/register'        and method == 'POST':
            result = self.handle_register(params)
            response = self.create_response(result)
        elif path == '/tokenlogin'      and method == 'POST':
            result = self.handle_tokenlogin(params, cookies)
            response = self.create_response(result)
        elif path == '/login'           and method == 'POST':
            result, cookie_list = self.handle_login(params)
            response = self.create_response(result, cookies=cookie_list)
        elif path == '/activate'        and method == 'GET':
            # 直接返回HTML响应
            html_content = self.handle_activate(params)
            # 创建完整的HTTP响应
            response_lines = [
                "HTTP/1.1 200 OK",
                "Content-Type: text/html; charset=utf-8",
                "Content-Length: " + str(len(html_content)),
                "",
                html_content.decode('utf-8')  # 转换为字符串
            ]
            response = "\r\n".join(response_lines).encode('utf-8')
        elif path == '/getuserdata'     and method == 'POST':
            result = self.handle_getuserdata(params, cookies)
            response = self.create_response(result)
        elif path == '/resetpwd'        and method == 'POST':
            result = self.handle_resetpwd(params)
            response = self.create_response(result)
        elif path == '/resetpwdrun'     and method == 'GET':
            # 直接返回HTML响应
            html_content = self.handle_resetpwdrun(params)
            # 创建完整的HTTP响应
            response_lines = [
                "HTTP/1.1 200 OK",
                "Content-Type: text/html; charset=utf-8",
                "Content-Length: " + str(len(html_content)),
                "",
                html_content.decode('utf-8')  # 转换为字符串
            ]
            response = "\r\n".join(response_lines).encode('utf-8')
        elif path == '/updatepwd'       and method == 'POST':
            result = self.handle_updatepwd(params, cookies)
            response = self.create_response(result)
        # 设置头像功能还未实装
        # elif path == '/setheadimg'      and method == 'POST':
        #     result = self.handle_setheadimg(params)
        #     response = self.create_response(result)
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
        self.ssl_enabled = configure._ssl_enable_
        self.ssl_crt_file = configure._ssl_crt_file_
        self.ssl_key_file = configure._ssl_key_file_
        self.connection_tracker = {}        # 追踪连接
        self.max_connections_per_ip = 20    # 每个IP最大连接数
        self.connection_timeout = 30        # 连接超时秒数
        self.blacklisted_ips = set()
        self.suspicious_patterns = [
            '/.env',
            '/wp-admin',
            '/phpmyadmin',
            '/admin',
            '/config',
            '/debug',
            '/test',
            '/shell',
            't3 12.1.2',   # WebLogic攻击
            'miner1',      # 矿机连接
            'jsonrpc'      # JSON-RPC攻击
        ]
    
    def is_malicious_request(self, request_data, path):
        """检测恶意请求"""
        # 检查可疑路径
        for pattern in self.suspicious_patterns:
            if pattern in request_data or pattern in path:
                return True
        
        # 检查异常请求方法
        if ' HTTP/' not in request_data.split('\r\n')[0]:
            return True
        
        return False

    def check_connection_rate(self, client_ip):
        """检查IP连接频率"""
        current_time = time.time()
        
        # 清理过期记录
        if client_ip in self.connection_tracker:
            self.connection_tracker[client_ip] = [
                ts for ts in self.connection_tracker[client_ip]
                if current_time - ts < 60  # 只保留最近60秒的记录
            ]
        
        # 添加当前连接
        if client_ip not in self.connection_tracker:
            self.connection_tracker[client_ip] = []
        
        self.connection_tracker[client_ip].append(current_time)
        
        # 检查是否超过限制
        if len(self.connection_tracker[client_ip]) > self.max_connections_per_ip:
            log_message(f"IP {client_ip} 连接频率过高，已限制")
            return False
        
        return True

    def handle_client(self, client_socket, addr):
        """处理客户端连接"""
        client_ip = addr[0]
        
        # 检查黑名单
        if client_ip in self.blacklisted_ips:
            client_socket.close()
            return
        
        # 检查连接频率
        if not self.check_connection_rate(client_ip):
            client_socket.close()
            self.blacklisted_ips.add(client_ip)
            log_message(f"IP {client_ip} 已被加入黑名单")
            return
        
        try:
            # 设置超时
            client_socket.settimeout(self.connection_timeout)
            
            # 接收请求数据
            request_data = client_socket.recv(8192).decode('utf-8', errors='ignore') # 8KB限制
            if not request_data:
                return
            
            # 检测恶意请求
            method, path, params = self.account_service.parse_request(request_data)
            if self.is_malicious_request(request_data, path or ''):
                log_message(f"检测到恶意请求来自 {addr}: {request_data[:100]}")
                self.blacklisted_ips.add(client_ip)
                client_socket.close()
                return
            
            # 处理请求
            response = self.account_service.handle_request(request_data, addr)
            
            # 发送响应
            try:
                client_socket.send(response)
            except (BrokenPipeError, ConnectionResetError, socket.timeout) as e:
                log_message(f"发送响应到 {addr} 失败: {e}")    
        except socket.timeout:
            log_message(f"客户端 {addr} 连接超时")
        except UnicodeDecodeError as e:
            log_message(f"客户端 {addr} 发送非UTF-8数据: {e}")
            self.blacklisted_ips.add(client_ip)
        except Exception as e:
            log_message(f"处理客户端 {addr} 请求时出错: {e}")
        finally:
            try:
                client_socket.close()
            except:
                pass
    
    def start(self):
        """启动服务器"""
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        # 设置超时以避免永久阻塞
        server_socket.settimeout(5.0)  # 5秒超时
        
        try:
            server_socket.bind((self.host, self.port))
            server_socket.listen(5)
            
            # 如果启用SSL，包装socket
            if self.ssl_enabled and self.ssl_crt_file and self.ssl_key_file:
                try:
                    # 创建SSL上下文
                    context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
                    context.load_cert_chain(certfile=self.ssl_crt_file, keyfile=self.ssl_key_file)
                    
                    # 增强SSL配置
                    context.set_ciphers('HIGH:!aNULL:!eNULL:!MD5:!3DES:!CAMELLIA:!AES128')
                    context.minimum_version = ssl.TLSVersion.TLSv1_2
                    context.options |= ssl.OP_NO_COMPRESSION
                    context.options |= ssl.OP_SINGLE_DH_USE
                    context.options |= ssl.OP_SINGLE_ECDH_USE

                    # 包装socket
                    server_socket = context.wrap_socket(server_socket, server_side=True)
                    log_message(f"账号服务器已启动")
                    log_message(f"服务器地址: https://{self.host}:{self.port}")
                except Exception as e:
                    log_message(f"SSL配置失败: {e}")
                    log_message(f"账号服务器已启动")
                    log_message(f"服务器地址: http://{self.host}:{self.port}")
            else:
                log_message(f"账号服务器已启动")
                log_message(f"服务器地址: http://{self.host}:{self.port}")
            
            while True:
                try:
                    client_socket, addr = server_socket.accept()
                    log_message(f"接收到来自 {addr} 的连接")
                    
                    # 为每个客户端创建新线程
                    client_thread = threading.Thread(
                        target=self.handle_client, 
                        args=(client_socket, addr)
                    )
                    client_thread.daemon = True
                    client_thread.start()
                    
                except socket.timeout:
                    # 超时是正常的，继续循环
                    continue
                except Exception as e:
                    log_message(f"接受客户端连接时出错: {e}")
                    continue
                    
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
                resetpwd_code TEXT,
                resetpwd_expiry INTEGER,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                last_login INTEGER DEFAULT (strftime('%s', 'now'))
            )
        ''')
        
        # 创建索引以提高查询性能
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_email ON users(email)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_token ON users(token)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_verification_code ON users(verification_code)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_resetpwd_code ON users(resetpwd_code)')
        
        conn.commit()
        log_message(f"数据库初始化成功")
        log_message(f"数据文件: {db_path}")
        
    except sqlite3.Error as e:
        log_message(f"数据库初始化失败: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    log_message(f"账号服务器将启动")
    log_message(f"日志文件: {log_filename}")
    
    # 初始化数据库
    init_database()
    
    # 启动服务器
    server = AccountServer(host=configure._config_host_,port=configure._config_port_)
    server.start()