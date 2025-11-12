#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/server_config.py

import RSAKEYPAIR
_config_version_            = '1.0.0' # 服务器版本
_config_anonymous_login_    = True # 是否允许匿名登录
_config_server_key_         = 'cc1' # 服务器密钥
_config_server_url_         = 'ws://localhost:2424' # 服务器地址 
_config_server_name_        = '中国象棋游戏服务器' # 服务器名称
_config_max_online_         = 100 # 最大在线人数
_config_publickey_          = RSAKEYPAIR._PUBLICKEY_ # 公钥
_config_privatekey_         = RSAKEYPAIR._PRIVATEKEY_ # 私钥
_config_host_               = '192.168.90.161' # 服务器地址
_config_port_               = 2424 # 服务器端口
_api_account_server_url_    = 'http://192.168.90.50:810' # 账号服务器地址