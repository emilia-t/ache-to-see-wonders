#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/accountServer/configure.py.example.py

# 地址和端口配置
_config_host_ = '0.0.0.0'
_config_port_ = 810
_access_control_allow_origin_ = '*'             # 允许跨域请求的源

# 电子邮箱相关配置
_smtp_server_ = 'smtp.your-email-provider.com'  # smtp 服务器地址
_smtp_port_ = 465                               # smtp 端口
_sender_email_ = 'noreply@yoursite.com'         # 发送给用户时用的电子邮箱
_sender_password_ = 'your_email_password'       # 密码
_server_url_ = 'https://login.site.com:810'     # 本账号服务器的地址

# ssl 相关配置
_ssl_enable_ = False                            # 是否启用 ssl
_ssl_crt_file_ = ''                             # crt 证书文件地址 请确保证书拥有完整的证书链
_ssl_key_file_ = ''                             # key 密钥文件地址