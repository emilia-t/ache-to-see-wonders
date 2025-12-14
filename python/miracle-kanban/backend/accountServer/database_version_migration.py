#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/accountServer/database_version_migration.py

import sqlite3
import os
import shutil
import time
from datetime import datetime

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

def backup_database():
    """备份数据库文件"""
    db_name = 'users_sqlite_3_py.db'
    db_path = os.path.join(os.path.dirname(__file__), db_name)
    
    # 检查数据库文件是否存在
    if not os.path.exists(db_path):
        print(f"数据库文件 {db_name} 不存在，无需备份")
        return True
    
    # 创建备份目录
    backup_dir = os.path.join(os.path.dirname(__file__), 'database_backup')
    os.makedirs(backup_dir, exist_ok=True)
    
    # 生成带时间戳的备份文件名
    timestamp = datetime.now().strftime('%Y_%m_%d_%H_%M_%S')
    backup_name = f'users_sqlite_3_py_{timestamp}.db'
    backup_path = os.path.join(backup_dir, backup_name)
    
    try:
        # 复制数据库文件
        shutil.copy2(db_path, backup_path)
        print(f"数据库备份成功: {backup_path}")
        return True
    except Exception as e:
        print(f"数据库备份失败: {e}")
        return False

def get_table_columns(cursor:sqlite3.Cursor, table_name:str):
    """获取表的列信息"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns_info = cursor.fetchall()
    
    # 提取列名和顺序
    columns = []
    for col in columns_info:
        columns.append(col[1])  # col[1] 是列名
    
    return columns

def check_columns_match(actual_columns:list):
    """检查实际列是否与预期列匹配（包括顺序）"""
    return actual_columns == EXPECTED_COLUMNS

def read_all_data(cursor:sqlite3.Cursor, table_name:str, old_columns:list):
    """读取表中的所有数据"""
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()
    
    # 将数据转换为字典数组
    data = []
    for row in rows:
        row_dict = {}
        for i, col_name in enumerate(old_columns):
            row_dict[col_name] = row[i]
        data.append(row_dict)
    
    return data

def get_column_default(column_name:str):
    """获取列的默认值"""
    # 根据 init_database 中的定义返回默认值
    defaults = {
        'anonymous_user': 0,
        'qq': 0,
        'theme_color': 'rgba(255,255,255,1)',
        'head_img': 'none',
        'email_verified': 0,
        'created_at': "(strftime('%s', 'now'))",
        'last_login': "(strftime('%s', 'now'))"
    }
    
    return defaults.get(column_name, None)

def create_new_table(cursor:sqlite3.Cursor):
    """创建新表（基于 init_database 中的结构）"""
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

def migrate_database():
    """执行数据库版本迁移"""
    print("警告！即将更新数据库，请退出所有正在使用此数据库的应用程序！")
    print("警告！如果数据库过大请慎重在生产环境下进行数据库版本迁移！")
    print("提示，如果出现异常请立即从database_backup中找到备份并还原。")
    user_input = input("请输入 ok 以开始进行数据库版本迁移：")
    if user_input.strip().lower() != 'ok':
        print("已拒绝执行脚本")
        return False

    db_path = os.path.join(os.path.dirname(__file__), 'users_sqlite_3_py.db')

    # 0. 备份数据库
    print("0. 开始备份数据库...")
    if not backup_database():
        print("备份失败，停止迁移！")
        return False
    
    # 检查数据库文件是否存在
    if not os.path.exists(db_path):
        print(f"数据库文件 {db_path} 不存在，将创建新数据库")
        init_new_database()
        return True
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查users表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if not cursor.fetchone():
            print("users表不存在，将创建新表")
            create_new_table(cursor)
            conn.commit()
            conn.close()
            return True
        
        # 1. 获取当前表的列信息
        print("1. 检查数据表结构...")
        current_columns = get_table_columns(cursor, 'users')
        
        # 2. 检查列是否完整且顺序一致
        print("2. 比较表结构差异...")
        if check_columns_match(current_columns):
            print("表结构完整且顺序一致，无需迁移")
            conn.close()
            return True
        
        print(f"当前列: {current_columns}")
        print(f"预期列: {EXPECTED_COLUMNS}")
        print("3. 表结构不一致，开始迁移...")
        
        # 3. 读取旧表所有数据
        print("4. 读取旧表数据...")
        old_data = read_all_data(cursor, 'users', current_columns)
        print(f"读取到 {len(old_data)} 条记录")
        
        # 4. 删除旧表
        print("5. 删除旧表...")
        cursor.execute("DROP TABLE users")
        
        # 5. 创建新表
        print("6. 创建新表...")
        create_new_table(cursor)
        
        # 6. 插入数据
        print("7. 迁移数据到新表...")
        migration_stats = {
            'total': len(old_data),
            'success': 0,
            'failed': 0
        }
        
        for i, row_data in enumerate(old_data, 1):
            try:
                # 准备插入的数据
                insert_values = []
                
                # 为每一列准备值
                for col in EXPECTED_COLUMNS:
                    if col in row_data:
                        # 旧表中有该列，使用旧值
                        insert_values.append(row_data[col])
                    else:
                        # 旧表中没有该列，使用默认值
                        default_val = get_column_default(col)
                        if default_val is None:
                            insert_values.append(None)
                        else:
                            insert_values.append(default_val)
                
                # 构建插入语句
                placeholders = ', '.join(['?'] * len(EXPECTED_COLUMNS))
                insert_sql = f"INSERT INTO users ({', '.join(EXPECTED_COLUMNS)}) VALUES ({placeholders})"
                
                cursor.execute(insert_sql, insert_values)
                migration_stats['success'] += 1
                
                if i % 100 == 0:
                    print(f"  已迁移 {i}/{len(old_data)} 条记录")
                    
            except Exception as e:
                print(f"  迁移第 {i} 条记录失败: {e}")
                migration_stats['failed'] += 1
                # 继续迁移其他记录
        
        conn.commit()
        print(f"8. 迁移完成！成功: {migration_stats['success']}, 失败: {migration_stats['failed']}, 总计: {migration_stats['total']}")
        
        # 验证迁移结果
        cursor.execute("SELECT COUNT(*) FROM users")
        new_count = cursor.fetchone()[0]
        print(f"9. 新表记录数: {new_count}")
        
        # 验证表结构
        final_columns = get_table_columns(cursor, 'users')
        if check_columns_match(final_columns):
            print("10. 迁移验证成功！")
        else:
            print("10. 警告：迁移后表结构可能不正确")
            print(f"    迁移后列: {final_columns}")
        
        return True
        
    except sqlite3.Error as e:
        print(f"数据库迁移失败: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

def init_new_database():
    """初始化新数据库（当没有旧数据库时）"""
    db_path = os.path.join(os.path.dirname(__file__), 'users_sqlite_3_py.db')
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        create_new_table(cursor)
        conn.commit()
        
        print("已创建新的数据库和users表")
        return True
        
    except sqlite3.Error as e:
        print(f"创建新数据库失败: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    print("开始数据库版本迁移...")
    print("=" * 50)
    
    success = migrate_database()
    
    print("=" * 50)
    if success:
        print("数据库版本迁移完成！")
    else:
        print("数据库版本迁移失败！")