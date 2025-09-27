# -*- coding: utf-8 -*-

import sys
import os
from PyQt5.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QStackedWidget, QSizePolicy,
                             QFrame, QApplication)
from PyQt5.QtCore import Qt, QSize, QUrl, QRect, QPropertyAnimation

# 动态导入 pyqtProperty
try:
    from PyQt5.QtCore import pyqtProperty
except ImportError:
    # 为类型检查器提供回退
    def pyqtProperty(*args, **kwargs):
        return property(*args, **kwargs)

from PyQt5.QtGui import QFont, QIcon, QPainter, QColor, QMouseEvent, QCursor, QLinearGradient

from pages.home_page import HomePage
from pages.settings_page import SettingsPage
from pages.about_page import AboutPage
from pages.model_page import ModelPage
from PyQt5.QtGui import QDesktopServices

'''
    左侧菜单面板的按钮
'''


class SidebarButton(QPushButton):
    # 定义样式表
    Styles = """
        SidebarButton {
            background-color: transparent;
            border: none;
        }
        SidebarButton:hover {
            background-color: #4a6a8b;
        }
    """

    StylesActive = """
        SidebarButton {
            background-color: #ffffff;
            border: none;
        }
        SidebarButton:hover {
            background-color: #4a6a8b;
        }
    """

    def __init__(self, text, inactive_icon_path=None, active_icon_path=None, parent=None):
        super().__init__(text, parent)

        # 设置按钮固定大小
        self.setFixedSize(80, 80)
        self.setCheckable(True)

        # 图标路径
        self.inactive_icon_path = inactive_icon_path
        self.active_icon_path = active_icon_path

        # 图标位置动画属性
        self._icon_y_offset = 0
        self.animation = QPropertyAnimation(self, b"iconYOffset")
        self.animation.setDuration(200)  # 动画时长200毫秒

        # 移除样式表设置
        # self.setStyleSheet(self.Styles)

        # 连接信号，当按钮状态改变时更新外观
        self.toggled.connect(self.update_appearance)

    @pyqtProperty(int)
    def iconYOffset(self):
        return self._icon_y_offset

    @iconYOffset.setter
    def iconYOffset(self, value):
        self._icon_y_offset = value
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        # 整个按钮区域
        button_rect = self.rect()

        # 0. 绘制背景颜色和效果（根据激活状态）
        if self.isChecked():
            # 激活状态：绘制阴影和圆角背景
            shadow_rect = QRect(5, 2, 71, 76)  # 阴影区域，稍微偏移
            painter.setPen(Qt.NoPen)
            painter.setBrush(QColor(0, 0, 0, 20))  # 淡淡的黑色阴影
            painter.drawRoundedRect(shadow_rect, 6, 6)  # 圆角

            # 绘制白色圆角背景
            bg_rect = QRect(5, 0, 70, 76)  # 背景区域
            painter.setBrush(QColor(255, 255, 255))  # 白色背景
            painter.drawRoundedRect(bg_rect, 6, 6)  # 圆角
        else:
            # 未激活状态：透明背景
            painter.fillRect(button_rect, QColor(0, 0, 0, 0))  # 透明背景

        # 1. 绘制左侧状态提示区
        status_rect = QRect(0, 20, 5, 40)
        if self.isChecked():
            # 激活状态：
            painter.fillRect(status_rect, QColor(0, 85, 149, 255))
        else:
            # 未激活状态：透明
            painter.fillRect(status_rect, QColor(0, 0, 0, 0))

        # 2. 绘制右侧内容区
        content_rect = QRect(5, 0, 75, 80)

        # 2.1 绘制上区块图标区域
        # 根据激活状态调整图标位置
        if self.isChecked():
            # 激活状态：图标居中
            icon_rect = QRect(5, self._icon_y_offset, 75, 56)
        else:
            # 未激活状态：图标在顶部
            icon_rect = QRect(5, 0, 75, 56)

        # 根据状态加载不同图标
        if self.isChecked() and self.active_icon_path and os.path.exists(self.active_icon_path):
            icon = QIcon(self.active_icon_path)
        elif self.inactive_icon_path and os.path.exists(self.inactive_icon_path):
            icon = QIcon(self.inactive_icon_path)
        else:
            # 如果没有图标，绘制一个简单的占位符
            painter.setPen(QColor(200, 200, 200))
            painter.drawRect(icon_rect)
            icon = None

        if icon and not icon.isNull():
            # 绘制图标，居中显示
            icon_size = QSize(56, 56)
            icon_center_rect = QRect(
                icon_rect.center().x() - icon_size.width() // 2,
                icon_rect.center().y() - icon_size.height() // 2,
                icon_size.width(),
                icon_size.height()
            )
            icon.paint(painter, icon_center_rect)

        # 2.2 绘制下区块文字区域
        # 只有在未激活状态或没有激活图标时才显示文字
        if not self.isChecked() or not (self.active_icon_path and os.path.exists(self.active_icon_path)):
            text_rect = QRect(5, 56, 75, 24)
            painter.setPen(QColor(95, 95, 95))  # 灰色文字
            painter.setFont(QFont("Arial", 10))  # 小字体
            # 文字居中显示
            painter.drawText(text_rect, Qt.AlignCenter, self.text())

        painter.end()

    def update_appearance(self, checked):
        # 当按钮状态改变时，启动动画
        if checked:
            # 激活状态：图标从顶部移动到中间
            self.animation.setStartValue(0)
            self.animation.setEndValue(12)  # 移动到垂直居中位置
        else:
            # 未激活状态：图标从中间移动回顶部
            self.animation.setStartValue(12)
            self.animation.setEndValue(0)

        self.animation.start()

        # 强制重绘
        self.update()


'''
    自定义标题栏（用于有边框窗口）
'''


class CustomTitleBar(QWidget):
    Styles = """
            CustomTitleBar {
                background-color: #2c3e50;
                color: white;
                height: 30px;
            }
            QPushButton {
                background-color: transparent;
                border: none;
                color: white;
                font-size: 16px;
                padding: 5px 12px;
            }
            QPushButton:hover {
                background-color: #34495e;
            }
            QPushButton#CloseAppWindowButton:hover {
                background-color: #e74c3c;
            }
            QLabel {
                color: white;
                font-size: 14px;
                font-weight: bold;
                padding-left: 10px;
            }
        """

    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent = parent
        self.setFixedHeight(30)
        self.setStyleSheet(self.Styles)
        self.initUI()

    def initUI(self):
        layout = QHBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 标题
        title_label = QLabel("奇迹看板")
        title_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)

        # 占位空间，让按钮在右侧
        layout.addWidget(title_label)
        layout.addStretch()

        # 帮助按钮
        self.help_btn = QPushButton("?")
        self.help_btn.setFixedSize(30, 30)
        self.help_btn.setToolTip("帮助")
        self.help_btn.clicked.connect(self.open_help)

        layout.addWidget(self.help_btn)

        self.setLayout(layout)

    def open_help(self):
        # 打开帮助网站
        help_url = QUrl("https://atsw.top/help")
        QDesktopServices.openUrl(help_url)


'''
    右侧实际内容区域
'''


class KanbanApp(QMainWindow):
    Styles = """
            KanbanApp {
                background-color: #f7f7f7;
            }
            #KanbanAppSidebar {
                background-color: #f3f3f3;
                padding: 10px 10px;
            }
        """

    def __init__(self, version="1.0.0", app_name="奇迹看板"):
        super().__init__()
        self.version = version
        self.app_name = app_name

        # 使用有边框窗口，移除FramelessWindowHint
        # self.setWindowFlags(Qt.FramelessWindowHint)  # 这行被注释掉

        self.setMinimumSize(540, 360)
        self.setGeometry(100, 100, 900, 600)
        self.setStyleSheet(self.Styles)
        self.setWindowTitle("奇迹看板")

        self.setWindowFlags(Qt.Window)

        # 设置窗口属性，确保图标显示
        self.setAttribute(Qt.WA_TranslucentBackground, False)

        # 窗口图标将在main.py中设置
        self.initUI()

    def initUI(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # 自定义标题栏（仅包含帮助按钮和标题）
        # self.title_bar = CustomTitleBar(self)
        # main_layout.addWidget(self.title_bar)

        # 内容区域
        self.content_widget = QWidget()
        self.content_layout = QHBoxLayout()
        self.content_layout.setContentsMargins(0, 0, 0, 0)
        self.content_layout.setSpacing(0)

        # 左侧菜单栏
        self.sidebar = self.create_sidebar()
        self.content_layout.addWidget(self.sidebar)

        # 右侧内容区域
        self.content_area = self.create_content_area()
        self.content_area.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.content_layout.addWidget(self.content_area)

        self.content_widget.setLayout(self.content_layout)
        main_layout.addWidget(self.content_widget)

        central_widget.setLayout(main_layout)

        # 默认选择首页
        self.menu_buttons[0].setChecked(True)
        self.stacked_widget.setCurrentIndex(0)

        # 在sidebar创建完成后调用更新高度的方法
        self.update_sidebar_height()

    def resizeEvent(self, event):
        """窗口大小改变时自动调整侧边栏高度"""
        super().resizeEvent(event)
        self.update_sidebar_height()

    def update_sidebar_height(self):
        """更新侧边栏高度为窗口高度减去标题栏高度"""
        if hasattr(self, 'sidebar') and self.sidebar is not None:
            title_bar_height = self.title_bar.height() if hasattr(self, 'title_bar') else 0
            window_height = self.height()
            sidebar_height = window_height - title_bar_height

            if sidebar_height > 0:
                self.sidebar.setFixedHeight(sidebar_height)

    def create_sidebar(self):
        sidebar = QFrame()
        sidebar.setFixedWidth(100)
        sidebar.setObjectName("KanbanAppSidebar")

        # 设置垂直策略为Fixed，避免布局自动调整
        sidebar.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 菜单按钮
        self.menu_buttons = []
        menu_items = [
            ("启动", "启动后端和前端程序", "icons/start_inactive.png", "icons/start_active.png"),
            ("设置", "看板程序和前后端程序的设置", "icons/settings_inactive.png", "icons/settings_active.png"),
            ("模型", "管理AI模型", "icons/model_inactive.png", "icons/model_active.png"),
            ("关于", "关于奇迹看板", "icons/about_inactive.png", "icons/about_active.png")
        ]

        for text, tooltip, inactive_icon, active_icon in menu_items:
            btn = SidebarButton(text, inactive_icon, active_icon)
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


if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = KanbanApp()
    window.show()
    sys.exit(app.exec_())