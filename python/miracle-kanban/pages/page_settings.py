#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /pages/page_settings.py

from PyQt5.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton, QComboBox, QCheckBox, QGroupBox, QSpinBox, QFormLayout
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont
import json
import os


class SettingsPage(QWidget):
    def __init__(self):
        super().__init__()
        self.settings_file = "settings.json"
        self.settings = self.load_settings()
        self.initUI()

    def load_settings(self):
        default_settings = {
            "backend_port": 8000,
            "frontend_port": 3000,
            "auto_start": False,
            "log_level": "INFO",
            "theme": "light"
        }

        if os.path.exists(self.settings_file):
            try:
                with open(self.settings_file, 'r') as f:
                    return json.load(f)
            except:
                return default_settings
        return default_settings

    def save_settings(self):
        try:
            with open(self.settings_file, 'w') as f:
                json.dump(self.settings, f, indent=4)
            return True
        except:
            return False

    def initUI(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)

        # 标题
        title_label = QLabel("程序设置")
        title_label.setFont(QFont("Arial", 16, QFont.Bold))
        title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(title_label)

        # 后端设置组
        backend_group = QGroupBox("后端设置")
        backend_layout = QFormLayout()

        self.backend_port = QSpinBox()
        self.backend_port.setRange(1000, 65535)
        self.backend_port.setValue(self.settings["backend_port"])

        self.backend_host = QLineEdit()
        self.backend_host.setText("localhost")

        backend_layout.addRow("端口:", self.backend_port)
        backend_layout.addRow("主机:", self.backend_host)
        backend_group.setLayout(backend_layout)
        layout.addWidget(backend_group)

        # 前端设置组
        frontend_group = QGroupBox("前端设置")
        frontend_layout = QFormLayout()

        self.frontend_port = QSpinBox()
        self.frontend_port.setRange(1000, 65535)
        self.frontend_port.setValue(self.settings["frontend_port"])

        frontend_layout.addRow("端口:", self.frontend_port)
        frontend_group.setLayout(frontend_layout)
        layout.addWidget(frontend_group)

        # 通用设置组
        general_group = QGroupBox("通用设置")
        general_layout = QFormLayout()

        self.auto_start = QCheckBox("启动时自动运行服务")
        self.auto_start.setChecked(self.settings["auto_start"])

        self.log_level = QComboBox()
        self.log_level.addItems(["DEBUG", "INFO", "WARNING", "ERROR"])
        self.log_level.setCurrentText(self.settings["log_level"])

        self.theme = QComboBox()
        self.theme.addItems(["light", "dark"])
        self.theme.setCurrentText(self.settings["theme"])

        general_layout.addRow("自动启动:", self.auto_start)
        general_layout.addRow("日志级别:", self.log_level)
        general_layout.addRow("主题:", self.theme)
        general_group.setLayout(general_layout)
        layout.addWidget(general_group)

        # 按钮区域
        button_layout = QHBoxLayout()

        self.save_btn = QPushButton("保存设置")
        self.save_btn.clicked.connect(self.save_settings_handler)

        self.reset_btn = QPushButton("恢复默认")
        self.reset_btn.clicked.connect(self.reset_settings)

        button_layout.addWidget(self.save_btn)
        button_layout.addWidget(self.reset_btn)
        layout.addLayout(button_layout)

        layout.addStretch()
        self.setLayout(layout)

    def save_settings_handler(self):
        self.settings.update({
            "backend_port": self.backend_port.value(),
            "frontend_port": self.frontend_port.value(),
            "auto_start": self.auto_start.isChecked(),
            "log_level": self.log_level.currentText(),
            "theme": self.theme.currentText()
        })

        if self.save_settings():
            # 显示保存成功消息
            pass

    def reset_settings(self):
        default_settings = {
            "backend_port": 8000,
            "frontend_port": 3000,
            "auto_start": False,
            "log_level": "INFO",
            "theme": "light"
        }

        self.backend_port.setValue(default_settings["backend_port"])
        self.frontend_port.setValue(default_settings["frontend_port"])
        self.auto_start.setChecked(default_settings["auto_start"])
        self.log_level.setCurrentText(default_settings["log_level"])
        self.theme.setCurrentText(default_settings["theme"])