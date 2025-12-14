#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/accountServer/database_clean_inactive_accounts.py
# 用于手动清理未激活的账户

# 1.试运行（查看哪些账户会被删除） 超过 24 小时未激活的账户
# python database_clean_inactive_accounts.py --hours 24

# 2.清理超过 60秒 未激活的账户
# python database_clean_inactive_accounts.py --second 60 --execute

# 3.实际执行删除操作
# python database_clean_inactive_accounts.py --hours 24 --execute

# 4.查看数据库统计信息
# python database_clean_inactive_accounts.py --stats

# 5.自定义数据库路径
# python database_clean_inactive_accounts.py --db-path /path/to/your/database.db --hours 48 --execute

import sqlite3
import time
import os
import argparse
import logging
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

# 配置日志
def setup_logging():
    """配置日志系统"""
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    log_filename = f"{log_dir}/cleanup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_filename, encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)

class AccountCleaner:
    """账户清理器"""
    
    def __init__(self, db_path='users_sqlite_3_py.db'):
        self.db_path = db_path
        self.logger = setup_logging()
    
    def get_connection(self):
        """获取数据库连接"""
        return sqlite3.connect(self.db_path)
    
    def execute_query(self, query, params=None):
        """执行查询"""
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
                return cursor.rowcount
        finally:
            conn.close()
    
    def format_duration(self, seconds):
        """将秒数格式化为可读的时间字符串"""
        if seconds < 60:
            return f"{seconds}秒"
        elif seconds < 3600:
            minutes = seconds // 60
            return f"{minutes}分钟"
        elif seconds < 86400:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours}小时{minutes}分钟"
        else:
            days = seconds // 86400
            hours = (seconds % 86400) // 3600
            return f"{days}天{hours}小时"
    
    def get_inactive_accounts(self, seconds_threshold=86400):
        """
        获取未激活的账户
        
        Args:
            seconds_threshold: 秒阈值，创建时间超过这个时间的未激活账户将被清理
            
        Returns:
            未激活账户列表
        """
        current_time = int(time.time())
        threshold_time = current_time - seconds_threshold
        
        query = '''
            SELECT id, email, name, created_at, email_verified, verification_code
            FROM users 
            WHERE email_verified = 0 AND created_at < ?
            ORDER BY created_at ASC
        '''
        
        inactive_accounts = self.execute_query(query, (threshold_time,))
        
        duration_str = self.format_duration(seconds_threshold)
        self.logger.info(f"找到 {len(inactive_accounts)} 个超过 {duration_str} 未激活的账户")
        
        return inactive_accounts
    
    def format_timestamp(self, timestamp):
        """格式化时间戳为可读格式"""
        return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
    
    def display_inactive_accounts(self, accounts):
        """显示未激活账户信息"""
        if not accounts:
            self.logger.info("没有找到未激活的账户")
            return
        
        self.logger.info("未激活账户列表:")
        self.logger.info("-" * 80)
        self.logger.info(f"{'ID':<5} {'Email':<25} {'Name':<15} {'Created At':<20}")
        self.logger.info("-" * 80)
        
        for account in accounts:
            account_id, email, name, created_at, verified, code = account
            created_str = self.format_timestamp(created_at)
            self.logger.info(f"{account_id:<5} {email:<25} {name:<15} {created_str:<20}")
    
    def cleanup_inactive_accounts(self, seconds_threshold=86400, dry_run=True):
        """
        清理未激活账户
        
        Args:
            seconds_threshold: 秒阈值
            dry_run: 是否为试运行（不实际删除）
            
        Returns:
            删除的账户数量
        """
        duration_str = self.format_duration(seconds_threshold)
        self.logger.info(f"开始清理未激活账户 (试运行: {dry_run}, 阈值: {duration_str})")
        
        # 获取未激活账户
        inactive_accounts = self.get_inactive_accounts(seconds_threshold)
        
        if not inactive_accounts:
            self.logger.info("没有需要清理的未激活账户")
            return 0
        
        # 显示账户信息
        self.display_inactive_accounts(inactive_accounts)
        
        if dry_run:
            self.logger.info(f"试运行完成: 将删除 {len(inactive_accounts)} 个未激活账户")
            self.logger.info("使用 --execute 参数实际执行删除操作")
            return len(inactive_accounts)
        
        # 实际删除操作
        self.logger.info("开始实际删除未激活账户...")
        
        deleted_count = 0
        for account in inactive_accounts:
            account_id, email, name, created_at, verified, code = account
            
            try:
                # 删除账户
                delete_query = "DELETE FROM users WHERE id = ?"
                result = self.execute_query(delete_query, (account_id,))
                
                if result > 0:
                    self.logger.info(f"已删除账户: ID={account_id}, Email={email}, Name={name}")
                    deleted_count += 1
                else:
                    self.logger.warning(f"删除账户失败: ID={account_id}")
                    
            except Exception as e:
                self.logger.error(f"删除账户时出错 (ID={account_id}): {e}")
        
        self.logger.info(f"清理完成: 成功删除 {deleted_count} 个未激活账户")
        return deleted_count
    
    def get_database_stats(self):
        """获取数据库统计信息"""
        stats = {}
        
        try:
            # 总用户数
            total_users = self.execute_query("SELECT COUNT(*) FROM users")[0][0]
            stats['total_users'] = total_users
            
            # 已激活用户数
            verified_users = self.execute_query("SELECT COUNT(*) FROM users WHERE email_verified = 1")[0][0]
            stats['verified_users'] = verified_users
            
            # 未激活用户数
            unverified_users = self.execute_query("SELECT COUNT(*) FROM users WHERE email_verified = 0")[0][0]
            stats['unverified_users'] = unverified_users
            
            # 最早的未激活账户
            oldest_unverified = self.execute_query('''
                SELECT created_at FROM users 
                WHERE email_verified = 0 
                ORDER BY created_at ASC LIMIT 1
            ''')
            if oldest_unverified:
                stats['oldest_unverified'] = self.format_timestamp(oldest_unverified[0][0])
            else:
                stats['oldest_unverified'] = "无"
            
            return stats
            
        except Exception as e:
            self.logger.error(f"获取数据库统计信息时出错: {e}")
            return {}

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='清理未激活的账户')
    parser.add_argument('--hours', type=int, default=24, 
                       help='清理创建时间超过指定小时的未激活账户 (默认: 24小时)')
    parser.add_argument('--second', type=int, 
                       help='清理创建时间超过指定秒的未激活账户 (优先级高于--hours)')
    parser.add_argument('--execute', action='store_true',
                       help='实际执行删除操作 (默认仅为试运行)')
    parser.add_argument('--db-path', default='users_sqlite_3_py.db',
                       help='数据库文件路径 (默认: users_sqlite_3_py.db)')
    parser.add_argument('--stats', action='store_true',
                       help='显示数据库统计信息')
    
    args = parser.parse_args()
    
    cleaner = AccountCleaner(args.db_path)
    
    # 检查数据库文件是否存在
    if not os.path.exists(args.db_path):
        cleaner.logger.error(f"数据库文件不存在: {args.db_path}")
        return
    
    # 显示统计信息
    if args.stats:
        stats = cleaner.get_database_stats()
        if stats:
            cleaner.logger.info("数据库统计信息:")
            cleaner.logger.info(f"  总用户数: {stats['total_users']}")
            cleaner.logger.info(f"  已激活用户: {stats['verified_users']}")
            cleaner.logger.info(f"  未激活用户: {stats['unverified_users']}")
            cleaner.logger.info(f"  最早的未激活账户: {stats['oldest_unverified']}")
        return
    
    # 计算时间阈值（秒）
    if args.second is not None:
        seconds_threshold = args.second
    else:
        seconds_threshold = args.hours * 3600  # 将小时转换为秒
    
    # 执行清理操作
    try:
        deleted_count = cleaner.cleanup_inactive_accounts(
            seconds_threshold=seconds_threshold,
            dry_run=not args.execute
        )
        
        if args.execute and deleted_count > 0:
            cleaner.logger.info(f"成功清理了 {deleted_count} 个未激活账户")
            
    except Exception as e:
        cleaner.logger.error(f"清理过程中发生错误: {e}")

if __name__ == "__main__":
    main()