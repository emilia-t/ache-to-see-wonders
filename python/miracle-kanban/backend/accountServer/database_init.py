#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/accountServer/database_init.py
import sqlite3
import os

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

def init_database():
    """初始化数据库和users表"""
    db_path = os.path.join(os.path.dirname(__file__), 'users_sqlite_3_py.db')
    
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
        print(f"数据库初始化成功！数据库文件: {db_path}")
        
    except sqlite3.Error as e:
        print(f"数据库初始化失败: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    init_database()