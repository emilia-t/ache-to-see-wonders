#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/sql_statement.py

import server_config

_users_table_ = """CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                qq INTEGER,
                theme_color VARCHAR(50) DEFAULT 'rgba(255,255,255,1)',
                anonymous_user BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME DEFAULT CURRENT_TIMESTAMP
            )"""

_server_config_table_ = """CREATE TABLE IF NOT EXISTS server_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                version VARCHAR(20) DEFAULT '1.0.0',
                anonymous_login BOOLEAN DEFAULT TRUE,
                server_key VARCHAR(100) DEFAULT 'default_key',
                server_url VARCHAR(255) DEFAULT 'ws://localhost:2424',
                server_name VARCHAR(100) DEFAULT '中国象棋服务器',
                max_online INTEGER DEFAULT 100,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )"""

_insert_server_config_          =f"INSERT OR IGNORE INTO server_config (id,version,anonymous_login,server_key,server_url,server_name,max_online) VALUES (1,'{server_config._config_version_}',{server_config._config_anonymous_login_},'{server_config._config_server_key_}','{server_config._config_server_url_}','{server_config._config_server_name_}',{server_config._config_max_online_})"

_select_server_config_          ="SELECT version, anonymous_login, server_key, server_url, server_name, max_online FROM server_config WHERE id = 1"

_select_user__email_            ="SELECT id, email, name, qq, theme_color, anonymous_user FROM users WHERE email = ?"

_select_user__id_               ="SELECT email, name, qq, theme_color, anonymous_user FROM users WHERE id = ?"

_update_user_last_login__id_    ="UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?"

_insert_anonymous_user_         ="INSERT INTO users (email, name, anonymous_user) VALUES (?, ?, TRUE)"

