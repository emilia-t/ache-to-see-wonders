#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import subprocess
import threading
import time
import platform
from datetime import datetime
from queue import Queue
import sys

class ServerMonitor:
    def __init__(self, ip_list, ping_interval=5, ping_timeout=3, log_to_file=True):
        """
        初始化服务器监控器
        
        参数:
        ip_list: 服务器IP地址列表
        ping_interval: ping间隔时间(秒)
        ping_timeout: ping超时时间(秒)
        log_to_file: 是否记录日志到文件
        """
        self.ip_list = ip_list
        self.ping_interval = ping_interval
        self.ping_timeout = ping_timeout
        self.log_to_file = log_to_file
        self.threads = []
        self.running = False
        self.results_queue = Queue()
        self.stats = {ip: {'success': 0, 'fail': 0, 'last_status': 'Unknown'} for ip in ip_list}
        
        # 根据操作系统确定ping命令
        self.system = platform.system().lower()
        
    def ping_ip(self, ip):
        """
        执行ping命令并返回结果
        
        参数:
        ip: 要ping的IP地址
        
        返回:
        success: 是否ping通
        response_time: 响应时间(ms)
        """
        try:
            # 根据操作系统选择ping命令参数
            if self.system == 'windows':
                ping_cmd = ['ping', '-n', '1', '-w', str(self.ping_timeout * 1000), ip]
            else:  # Linux/Unix/Mac
                ping_cmd = ['ping', '-c', '1', '-W', str(self.ping_timeout), ip]
            
            # 执行ping命令
            start_time = time.time()
            result = subprocess.run(
                ping_cmd, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE, 
                text=True
            )
            end_time = time.time()
            
            # 计算响应时间
            response_time = round((end_time - start_time) * 1000, 2)
            
            # 检查ping是否成功
            success = result.returncode == 0
            
            return success, response_time
            
        except Exception as e:
            return False, 0
    
    def monitor_worker(self, ip):
        """
        监控工作线程函数
        
        参数:
        ip: 要监控的IP地址
        """
        while self.running:
            try:
                # 执行ping
                success, response_time = self.ping_ip(ip)
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                # 更新统计
                if success:
                    self.stats[ip]['success'] += 1
                    self.stats[ip]['last_status'] = 'Online'
                    status_msg = f"{timestamp} - {ip}: ONLINE (响应时间: {response_time}ms)"
                    log_msg = f"{timestamp},{ip},ONLINE,{response_time}"
                else:
                    self.stats[ip]['fail'] += 1
                    self.stats[ip]['last_status'] = 'Offline‼️ '
                    status_msg = f"{timestamp} - {ip}: OFFLINE (请求超时‼️ )"
                    log_msg = f"{timestamp},{ip},OFFLINE,0"
                
                # 输出到控制台
                print(status_msg)
                sys.stdout.flush()
                
                # 记录到队列供主线程处理
                self.results_queue.put({
                    'timestamp': timestamp,
                    'ip': ip,
                    'status': 'ONLINE' if success else 'OFFLINE',
                    'response_time': response_time,
                    'log_msg': log_msg
                })
                
                # 等待间隔时间
                time.sleep(self.ping_interval)
                
            except Exception as e:
                print(f"监控 {ip} 时发生错误: {e}")
                time.sleep(self.ping_interval)
    
    def start_monitoring(self):
        """
        启动监控
        """
        print(f"开始监控 {len(self.ip_list)} 台服务器...")
        print(f"监控间隔: {self.ping_interval}秒")
        print("=" * 60)
        
        self.running = True
        
        # 为每个IP创建监控线程
        for ip in self.ip_list:
            thread = threading.Thread(
                target=self.monitor_worker, 
                args=(ip,),
                daemon=True
            )
            thread.start()
            self.threads.append(thread)
        
        # 启动日志记录线程
        if self.log_to_file:
            log_thread = threading.Thread(
                target=self.log_worker,
                daemon=True
            )
            log_thread.start()
        
        # 启动统计显示线程
        stats_thread = threading.Thread(
            target=self.display_stats_worker,
            daemon=True
        )
        stats_thread.start()
        
        print("监控已启动，按 Ctrl+C 停止...")
        print("-" * 60)
    
    def log_worker(self):
        """
        日志记录工作线程
        """
        log_file = f"server_monitor_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        try:
            with open(log_file, 'w') as f:
                # 写入CSV头部
                f.write("timestamp,ip,status,response_time(ms)\n")
                
                while self.running:
                    try:
                        # 从队列获取结果并写入文件
                        result = self.results_queue.get(timeout=1)
                        f.write(result['log_msg'] + "\n")
                        f.flush()
                    except:
                        continue
        except Exception as e:
            print(f"日志记录错误: {e}")
    
    def display_stats_worker(self):
        """
        显示统计信息的工作线程
        """
        display_interval = 30  # 每30秒显示一次统计
        
        while self.running:
            time.sleep(display_interval)
            self.display_stats()
    
    def display_stats(self):
        """
        显示监控统计信息
        """
        print("\n" + "=" * 60)
        print("服务器状态统计:")
        print("-" * 60)
        
        for ip in self.ip_list:
            stats = self.stats[ip]
            total = stats['success'] + stats['fail']
            if total > 0:
                success_rate = (stats['success'] / total) * 100
            else:
                success_rate = 0
            
            print(f"{ip}:")
            print(f"  当前状态: {stats['last_status']}")
            print(f"  成功率: {success_rate:.2f}% ({stats['success']}/{total})")
            print(f"  最后检查: {datetime.now().strftime('%H:%M:%S')}")
        
        print("=" * 60 + "\n")
    
    def stop_monitoring(self):
        """
        停止监控
        """
        print("\n正在停止监控...")
        self.running = False
        
        # 等待所有线程结束
        for thread in self.threads:
            thread.join(timeout=2)
        
        # 显示最终统计
        self.display_stats()
        print("监控已停止")

def main():
    """
    主函数
    """
    # 要监控的服务器IP地址列表
    server_ips = [
        "106.53.57.90",       
        "193.112.172.128",         
        "192.168.1.1",      # 本地路由器
        "10.0.0.1",         # 示例内网地址
        "127.0.0.1",        # 本地回环地址
    ]
    
    # 创建监控器实例
    monitor = ServerMonitor(
        ip_list=server_ips,
        ping_interval=5,     # 每5秒ping一次
        ping_timeout=2,      # 2秒超时
        log_to_file=True     # 启用日志记录
    )
    
    try:
        # 启动监控
        monitor.start_monitoring()
        
        # 保持主线程运行，直到收到中断信号
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        # 用户按Ctrl+C时停止监控
        monitor.stop_monitoring()
    except Exception as e:
        print(f"发生错误: {e}")
        monitor.stop_monitoring()




if __name__ == "__main__":
    main()