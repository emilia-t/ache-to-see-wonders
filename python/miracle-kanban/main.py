#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /main.py

import sys
import os
from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QIcon

from kanban_app import KanbanApp

# 定义版本号
VERSION = "1.0.0"
APP_NAME = "奇迹看板"


def get_resource_path(relative_path):
    """获取资源的绝对路径，支持开发环境和打包后环境"""
    try:
        # 打包后的资源路径
        base_path = sys._MEIPASS
    except Exception:
        # 开发环境的资源路径
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)


def main():
    # 设置高DPI支持
    if hasattr(Qt, 'AA_EnableHighDpiScaling'):
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    if hasattr(Qt, 'AA_UseHighDpiPixmaps'):
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setApplicationVersion(VERSION)

    # 设置应用程序图标（任务栏、桌面等显示）
    icon_path = get_resource_path("icons/app_icon.ico")
    if os.path.exists(icon_path):
        app.setWindowIcon(QIcon(icon_path))
    else:
        # 如果ico文件不存在，尝试png文件
        png_icon_path = get_resource_path("icons/app_icon.png")
        if os.path.exists(png_icon_path):
            app.setWindowIcon(QIcon(png_icon_path))
        else:
            print(f"图标文件未找到: {icon_path}")

    # 创建主窗口
    window = KanbanApp(version=VERSION, app_name=APP_NAME)

    # 设置窗口图标（标题栏显示）
    if os.path.exists(icon_path):
        window.setWindowIcon(QIcon(icon_path))
    elif os.path.exists(png_icon_path):
        window.setWindowIcon(QIcon(png_icon_path))

    window.show()

    sys.exit(app.exec_())


if __name__ == '__main__':
    main()