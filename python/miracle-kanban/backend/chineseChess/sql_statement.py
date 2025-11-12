#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/sql_statement.py

_pieces_table_ = """CREATE TABLE IF NOT EXISTS chess_piece_table (
                id INTEGER PRIMARY KEY CHECK (id = 0),
                name VARCHAR(25) DEFAULT '1.0.0',
                x REAL DEFAULT 0,
                y REAL DEFAULT 0,
                z REAL DEFAULT 0,
                used BOOLEAN DEFAULT FALSE,
                use_player VARCHAR(100) DEFAULT 'none'
            )"""

_select_user__email_            ="SELECT id, email, name, qq, theme_color, anonymous_user FROM users WHERE email = ?"

_select_user__id_               ="SELECT email, name, qq, theme_color, anonymous_user FROM users WHERE id = ?"

_update_user_last_login__id_    ="UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?"

_insert_anonymous_user_         ="INSERT INTO users (email, name, anonymous_user) VALUES (?, ?, TRUE)"

