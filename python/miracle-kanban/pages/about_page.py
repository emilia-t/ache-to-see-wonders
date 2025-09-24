# -*- coding: utf-8 -*-
import PyQt5
from PyQt5.QtWidgets import QWidget, QVBoxLayout, QLabel, QTextEdit
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont, QPixmap
from PyQt5.QtWidgets import QApplication
import platform


class AboutPage(QWidget):
    def __init__(self, version="1.0.0", app_name="奇迹看板"):
        super().__init__()
        self.version = version
        self.app_name = app_name
        self.initUI()

    def initUI(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setAlignment(Qt.AlignTop)

        # 标题
        title_label = QLabel("关于奇迹看板")
        title_label.setFont(QFont("Arial", 20, QFont.Bold))
        title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(title_label)

        # 版本信息
        version_label = QLabel("版本 " + self.version)
        version_label.setFont(QFont("Arial", 12))
        version_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(version_label)


        layout.addSpacing(20)

        # 描述信息
        description = QTextEdit()
        description.setReadOnly(True)
        description.setHtml("""
        <h3>奇迹看板</h3>
        <p>专用于ATSW的后端和前端程序启动管理工具，支持AI模型管理和后端设置。</p>

        <h4>主要功能：</h4>
        <ul>
            <li>一键启动/停止后端和前端服务</li>
            <li>灵活的程序配置管理</li>
            <li>AI模型下载和管理</li>
            <li>跨平台支持 (Windows/Linux)</li>
            <li>直观的用户界面</li>
        </ul>

        <h4>系统信息：</h4>
        <p>操作系统: {}</p>
        <p>Python版本: {}</p>
        <p>看板版本: {}</p>
        """.format(
            platform.system(),
            platform.python_version(),
            self.version
        ))
        description.setMaximumHeight(540)
        layout.addWidget(description)

        # 版权信息
        copyright_label = QLabel("© 2025 Ache to see wonders 保留所有权利。")
        copyright_label.setAlignment(Qt.AlignCenter)
        copyright_label.setStyleSheet("color: gray; margin-top: 20px;")
        layout.addWidget(copyright_label)

        layout.addStretch()
        self.setLayout(layout)