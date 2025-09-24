#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import platform
from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QIcon

from kanban_app import KanbanApp

# 定义版本号
VERSION = "1.0.0"
APP_NAME = "奇迹看板"

def main():
    # 设置高DPI支持
    if hasattr(Qt, 'AA_EnableHighDpiScaling'):
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    if hasattr(Qt, 'AA_UseHighDpiPixmaps'):
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setApplicationVersion(VERSION)

    # 创建主窗口
    window = KanbanApp(version=VERSION, app_name=APP_NAME)
    window.show()

    sys.exit(app.exec_())


if __name__ == '__main__':
    main()