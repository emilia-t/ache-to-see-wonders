# -*- coding: utf-8 -*-

from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
                             QLabel, QTextEdit, QGroupBox, QProgressBar)
from PyQt5.QtCore import Qt, QProcess
from PyQt5.QtGui import QFont
import subprocess
import os


class HomePage(QWidget):
    def __init__(self):
        super().__init__()
        self.backend_process = None
        self.frontend_process = None
        self.initUI()

    def initUI(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)

        # 标题
        title_label = QLabel("启动控制台")
        title_label.setFont(QFont("Arial", 16, QFont.Bold))
        title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(title_label)

        # 状态显示区域
        status_group = QGroupBox("服务状态")
        status_layout = QVBoxLayout()

        self.backend_status = QLabel("后端服务: 未启动")
        self.frontend_status = QLabel("前端服务: 未启动")

        status_layout.addWidget(self.backend_status)
        status_layout.addWidget(self.frontend_status)
        status_group.setLayout(status_layout)
        layout.addWidget(status_group)

        # 控制按钮区域
        control_layout = QHBoxLayout()

        self.start_backend_btn = QPushButton("启动后端")
        self.start_backend_btn.clicked.connect(self.start_backend)

        self.start_frontend_btn = QPushButton("启动前端")
        self.start_frontend_btn.clicked.connect(self.start_frontend)

        self.stop_all_btn = QPushButton("停止所有服务")
        self.stop_all_btn.clicked.connect(self.stop_all_services)
        self.stop_all_btn.setEnabled(False)

        control_layout.addWidget(self.start_backend_btn)
        control_layout.addWidget(self.start_frontend_btn)
        control_layout.addWidget(self.stop_all_btn)
        layout.addLayout(control_layout)

        # 日志显示区域
        log_group = QGroupBox("运行日志")
        log_layout = QVBoxLayout()

        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(200)
        log_layout.addWidget(self.log_text)

        log_group.setLayout(log_layout)
        layout.addWidget(log_group)

        layout.addStretch()
        self.setLayout(layout)

    def start_backend(self):
        self.log_text.append("正在启动后端服务...")
        try:
            # 这里需要根据实际的后端启动命令修改
            self.backend_process = subprocess.Popen(
                ["python", "backend/main.py"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            self.backend_status.setText("后端服务: 运行中")
            self.start_backend_btn.setEnabled(False)
            self.stop_all_btn.setEnabled(True)
            self.log_text.append("后端服务启动成功")
        except Exception as e:
            self.log_text.append(f"后端服务启动失败: {str(e)}")

    def start_frontend(self):
        self.log_text.append("正在启动前端服务...")
        try:
            # 这里需要根据实际的前端启动命令修改
            self.frontend_process = subprocess.Popen(
                ["npm", "start"],
                cwd="frontend",
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            self.frontend_status.setText("前端服务: 运行中")
            self.start_frontend_btn.setEnabled(False)
            self.stop_all_btn.setEnabled(True)
            self.log_text.append("前端服务启动成功")
        except Exception as e:
            self.log_text.append(f"前端服务启动失败: {str(e)}")

    def stop_all_services(self):
        self.log_text.append("正在停止所有服务...")

        if self.backend_process:
            self.backend_process.terminate()
            self.backend_process = None
            self.backend_status.setText("后端服务: 未启动")
            self.log_text.append("后端服务已停止")

        if self.frontend_process:
            self.frontend_process.terminate()
            self.frontend_process = None
            self.frontend_status.setText("前端服务: 未启动")
            self.log_text.append("前端服务已停止")

        self.start_backend_btn.setEnabled(True)
        self.start_frontend_btn.setEnabled(True)
        self.stop_all_btn.setEnabled(False)