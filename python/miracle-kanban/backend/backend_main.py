#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import asyncio
import threading
import subprocess
import signal
import time

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


def run_chinese_chess_server():
    """运行中国象棋WebSocket服务器"""
    try:
        from chineseChess.chinese_chess_main import ChineseChessServer
        print("启动中国象棋服务器...")

        # 创建事件循环并在新线程中运行
        def start_server():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            server = ChineseChessServer()
            try:
                loop.run_until_complete(server.start_server())
                loop.run_forever()
            except KeyboardInterrupt:
                print("收到停止信号，关闭服务器...")
            finally:
                loop.close()

        thread = threading.Thread(target=start_server, daemon=True)
        thread.start()
        return thread
    except Exception as e:
        print(f"启动中国象棋服务器失败: {e}")
        return None


def main():
    print("中国象棋后端服务启动中...")

    # 运行中国象棋服务器
    chess_thread = run_chinese_chess_server()

    if chess_thread:
        print("中国象棋服务器启动成功，监听端口 2424")
    else:
        print("中国象棋服务器启动失败")
        return

    # 保持主线程运行
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n收到关闭信号，正在停止服务...")


if __name__ == '__main__':
    main()