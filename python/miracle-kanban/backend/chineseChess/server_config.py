#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/server_config.py

import RSAKEYPAIR, re, os

# 运行环境，默认在开发环境
_config_environment_ = 'development'  # 开发环境 development | production 生产环境

###########################################################################################
# 基础配置 - 这些配置在所有环境中保持一致
_config_version_                    = '1.0.0'  # 服务器版本
_config_anonymous_login_            = False  # 是否允许匿名登录(暂时不支持匿名登录)
_config_server_key_                 = 'cc1'  # 服务器密钥
_config_server_name_                = '中国象棋游戏服务器'  # 服务器名称
_config_max_online_                 = 100  # 最大在线人数
_config_publickey_                  = RSAKEYPAIR._PUBLICKEY_  # 公钥
_config_privatekey_                 = RSAKEYPAIR._PRIVATEKEY_  # 私钥

# SSL配置
_config_ssl_cert_file_              = '' # SSL证书文件路径
_config_ssl_key_file_               = ''  # SSL私钥文件路径
_config_use_ssl_                    = False  # 是否启用SSL，根据证书文件存在性自动设置

# 根据环境变量调整配置
if _config_environment_ == 'development':
    # 开发环境配置
    _config_host_                   = '192.168.90.161' # 服务器地址
    _config_port_                   = 2424  # 服务器端口
    _config_server_url_             = f'ws://{_config_host_}:{_config_port_}'  # 服务器地址
    _api_account_server_url_        = 'http://192.168.90.50:810'  # 账号服务器地址
    _access_control_allow_origin_   = '*'  # 开发环境允许所有跨域请求
    
    # 开发环境SSL配置（可选）
    if _config_ssl_cert_file_ and _config_ssl_key_file_ and os.path.exists(_config_ssl_cert_file_) and os.path.exists(_config_ssl_key_file_):

        _config_use_ssl_            = True
        _config_server_url_         = f'wss://{_config_host_}:{_config_port_}'  # 开发环境使用wss

    else:
        _config_server_url_ = f'ws://{_config_host_}:{_config_port_}'

elif _config_environment_ == 'production':
    # 生产环境配置
    _config_host_                   = '0.0.0.0' # 生产环境默认监听所有接口
    _config_port_                   = 2424  # 服务器端口
    
    # 生产环境应使用SSL
    if _config_ssl_cert_file_ and _config_ssl_key_file_ and os.path.exists(_config_ssl_cert_file_) and os.path.exists(_config_ssl_key_file_):

        _config_use_ssl_            = True
        _config_server_url_         = 'wss://atsw.top:2424'  # 生产环境使用wss

    else:
        _config_server_url_         = 'ws://atsw.top:2424'
    
    _api_account_server_url_        = 'https://atsw.top:810' # 生产环境账号服务器地址
    _access_control_allow_origin_   = re.compile(r"^https?://([a-zA-Z0-9-]+\.)*atsw\.top(:\d+)?$") # 生产环境跨域配置

else:
    # 默认配置
    _config_host_ = 'localhost'
    _config_port_ = 2424
    _config_server_url_ = f'ws://{_config_host_}:{_config_port_}'
    _api_account_server_url_ = 'http://localhost:810'
    _access_control_allow_origin_ = '*'