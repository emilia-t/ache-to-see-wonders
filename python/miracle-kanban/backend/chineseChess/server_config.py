#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/server_config.py

import RSAKEYPAIR
_config_version_            = '1.0.0'
_config_anonymous_login_    = True
_config_server_key_         = 'cc1'
_config_server_url_         = 'ws://localhost:2424'
_config_server_name_        = '中国象棋游戏服务器'
_config_max_online_         = 100
_config_publickey_          = RSAKEYPAIR._PUBLICKEY_
_config_privatekey_         = RSAKEYPAIR._PRIVATEKEY_
_api_account_server_url_    = 'http://192.168.90.50:810' # 账号服务器地址