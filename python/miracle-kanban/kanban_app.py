# -*- coding: utf-8 -*-

import sys
import os
from PyQt5.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QStackedWidget, QSizePolicy,
                             QFrame, QApplication)
from PyQt5.QtCore import Qt, QSize, QUrl, QRect
from PyQt5.QtGui import QFont, QIcon, QPainter, QColor, QMouseEvent, QCursor

from pages.home_page import HomePage
from pages.settings_page import SettingsPage
from pages.about_page import AboutPage
from pages.model_page import ModelPage
from PyQt5.QtGui import QDesktopServices


class TitleBar(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent = parent
        self.setFixedHeight(40)
        self.setStyleSheet("""
            TitleBar {
                background-color: #2c3e50;
                color: white;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
            }
            QPushButton {
                background-color: transparent;
                border: none;
                color: white;
                font-size: 16px;
                padding: 5px 12px;
            }
            QPushButton:hover {
                background-color: #b3eefd;
            }
            QPushButton#closeButton:hover {
                background-color: #e74c3c;
                border-top-right-radius: 8px;
            }
        """)
        self.initUI()

        # 拖动相关变量
        self.dragging = False
        self.drag_position = None

    def initUI(self):
        layout = QHBoxLayout()
        layout.setContentsMargins(10, 0, 0, 0)
        layout.setSpacing(0)

        # 标题
        title_label = QLabel("奇迹看板")
        title_label.setStyleSheet("color: #393939; font-size: 14px; font-weight: bold;")
        title_label.setAlignment(Qt.AlignCenter)

        # 占位空间，让按钮在右侧
        layout.addWidget(title_label)
        layout.addStretch()

        # 帮助按钮
        self.help_btn = QPushButton("?")
        self.help_btn.setFixedSize(30, 30)
        self.help_btn.setToolTip("帮助")
        self.help_btn.setStyleSheet("color: #393939;")
        self.help_btn.clicked.connect(self.open_help)

        # 最小化按钮
        self.min_btn = QPushButton("-")
        self.min_btn.setFixedSize(30, 30)
        self.min_btn.setToolTip("最小化")
        self.min_btn.setStyleSheet("color: #393939;")
        self.min_btn.clicked.connect(self.parent.showMinimized)

        # 关闭按钮
        self.close_btn = QPushButton("×")
        self.close_btn.setFixedSize(30, 30)
        self.close_btn.setObjectName("closeButton")
        self.close_btn.setStyleSheet("color: #393939;")
        self.close_btn.setToolTip("关闭")
        self.close_btn.clicked.connect(self.parent.close)

        layout.addWidget(self.help_btn)
        layout.addWidget(self.min_btn)
        layout.addWidget(self.close_btn)

        self.setLayout(layout)

    def open_help(self):
        # 打开帮助网站
        help_url = QUrl("https://atsw.top/help")  # 替换为实际帮助网址
        QDesktopServices.openUrl(help_url)

    def mousePressEvent(self, event: QMouseEvent):
        if event.button() == Qt.LeftButton:
            self.dragging = True
            self.drag_position = event.globalPos() - self.parent.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event: QMouseEvent):
        if event.buttons() == Qt.LeftButton and self.dragging:
            self.parent.move(event.globalPos() - self.drag_position)
            event.accept()

    def mouseReleaseEvent(self, event: QMouseEvent):
        self.dragging = False


class SidebarButton(QPushButton):
    def __init__(self, text, parent=None):
        super().__init__(text, parent)
        self.setFixedHeight(50)
        self.setStyleSheet("""
            SidebarButton {
                background-color: #34495e;
                color: white;
                border: none;
                text-align: left;
                padding-left: 15px;
                padding-right: 15px;
                font-size: 12px;
            }
            SidebarButton:hover {
                background-color: #4a6a8b;
            }
            SidebarButton:checked {
                background-color: #1abc9c;
            }
        """)
        self.setCheckable(True)


class KanbanApp(QMainWindow):
    def __init__(self, version="1.0.0", app_name="奇迹看板"):
        super().__init__()
        self.version = version
        self.app_name = app_name
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setMinimumSize(540, 360)
        self.setGeometry(100, 100, 900, 600)
        self.setStyleSheet("background-color: #ecf0f1;")
        self.initUI()

        # 窗口调整大小相关
        self.resize_direction = None
        self.resize_start = None
        self.resize_geometry = None

    def initUI(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # 标题栏
        self.title_bar = TitleBar(self)
        main_layout.addWidget(self.title_bar)

        # 内容区域
        content_widget = QWidget()
        content_layout = QHBoxLayout()
        content_layout.setContentsMargins(0, 0, 0, 0)
        content_layout.setSpacing(0)

        # 左侧菜单栏 - 固定宽度为80px + 15px + 15px = 110px
        self.sidebar = self.create_sidebar()
        content_layout.addWidget(self.sidebar)

        # 右侧内容区域 - 自动填充剩余空间
        self.content_area = self.create_content_area()
        self.content_area.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        content_layout.addWidget(self.content_area)

        content_widget.setLayout(content_layout)
        main_layout.addWidget(content_widget)

        central_widget.setLayout(main_layout)

        # 默认选择首页
        self.menu_buttons[0].setChecked(True)
        self.stacked_widget.setCurrentIndex(0)

    def create_sidebar(self):
        sidebar = QFrame()
        # 设置菜单栏总宽度为110px (80px内容宽度 + 15px左padding + 15px右padding)
        sidebar.setFixedWidth(110)
        sidebar.setStyleSheet("""
            QFrame {
                background-color: #2c3e50;
            }
        """)

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 菜单按钮
        self.menu_buttons = []
        menu_items = [
            ("启动", "启动后端和前端程序"),
            ("设置", "程序设置"),
            ("模型管理", "管理AI模型"),
            ("关于", "关于奇迹看板")
        ]

        for text, tooltip in menu_items:
            btn = SidebarButton(text)
            btn.setToolTip(tooltip)
            btn.clicked.connect(lambda checked, idx=len(self.menu_buttons): self.switch_page(idx))
            self.menu_buttons.append(btn)
            layout.addWidget(btn)

        layout.addStretch()
        sidebar.setLayout(layout)
        return sidebar

    def create_content_area(self):
        content_widget = QWidget()
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)

        self.stacked_widget = QStackedWidget()
        self.stacked_widget.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        # 添加各个页面
        self.home_page = HomePage()
        self.settings_page = SettingsPage()
        self.model_page = ModelPage()
        self.about_page = AboutPage(version=self.version, app_name=self.app_name)

        self.stacked_widget.addWidget(self.home_page)
        self.stacked_widget.addWidget(self.settings_page)
        self.stacked_widget.addWidget(self.model_page)
        self.stacked_widget.addWidget(self.about_page)

        layout.addWidget(self.stacked_widget)
        content_widget.setLayout(layout)
        return content_widget

    def switch_page(self, index):
        # 取消所有按钮的选中状态
        for btn in self.menu_buttons:
            btn.setChecked(False)

        # 设置当前按钮为选中状态
        self.menu_buttons[index].setChecked(True)

        # 切换到对应页面
        self.stacked_widget.setCurrentIndex(index)

    # 窗口调整大小相关方法
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.resize_direction = self.get_resize_direction(event.pos())
            if self.resize_direction:
                self.resize_start = event.globalPos()
                self.resize_geometry = self.geometry()

    def mouseMoveEvent(self, event):
        if self.resize_direction and event.buttons() == Qt.LeftButton:
            delta = event.globalPos() - self.resize_start
            new_geometry = self.resize_geometry

            if 'left' in self.resize_direction:
                new_geometry.setLeft(new_geometry.left() + delta.x())
            if 'right' in self.resize_direction:
                new_geometry.setRight(new_geometry.right() + delta.x())
            if 'top' in self.resize_direction:
                new_geometry.setTop(new_geometry.top() + delta.y())
            if 'bottom' in self.resize_direction:
                new_geometry.setBottom(new_geometry.bottom() + delta.y())

            if new_geometry.width() >= self.minimumWidth() and new_geometry.height() >= self.minimumHeight():
                self.setGeometry(new_geometry)
                self.resize_start = event.globalPos()
                self.resize_geometry = self.geometry()
        else:
            # 更新鼠标光标
            direction = self.get_resize_direction(event.pos())
            cursor = QCursor()
            if not direction:
                cursor.setShape(Qt.ArrowCursor)
            elif direction == 'left' or direction == 'right':
                cursor.setShape(Qt.SizeHorCursor)
            elif direction == 'top' or direction == 'bottom':
                cursor.setShape(Qt.SizeVerCursor)
            elif direction == 'top-left' or direction == 'bottom-right':
                cursor.setShape(Qt.SizeFDiagCursor)
            elif direction == 'top-right' or direction == 'bottom-left':
                cursor.setShape(Qt.SizeBDiagCursor)
            self.setCursor(cursor)

    def mouseReleaseEvent(self, event):
        self.resize_direction = None

    def get_resize_direction(self, pos):
        margin = 5
        rect = self.rect()

        if pos.x() <= margin:
            if pos.y() <= margin:
                return 'top-left'
            elif pos.y() >= rect.height() - margin:
                return 'bottom-left'
            else:
                return 'left'
        elif pos.x() >= rect.width() - margin:
            if pos.y() <= margin:
                return 'top-right'
            elif pos.y() >= rect.height() - margin:
                return 'bottom-right'
            else:
                return 'right'
        elif pos.y() <= margin:
            return 'top'
        elif pos.y() >= rect.height() - margin:
            return 'bottom'

        return None


if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = KanbanApp()
    window.show()
    sys.exit(app.exec_())