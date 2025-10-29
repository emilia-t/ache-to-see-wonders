#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /pages/page_model.py

from PyQt5.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QListWidget, QListWidgetItem,QGroupBox, QProgressBar, QLineEdit, QFileDialog, QMessageBox
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from PyQt5.QtGui import QFont
import os
import json


class ModelDownloadThread(QThread):
    progress_updated = pyqtSignal(int)
    download_finished = pyqtSignal(str)
    download_error = pyqtSignal(str)

    def __init__(self, model_url, save_path):
        super().__init__()
        self.model_url = model_url
        self.save_path = save_path

    def run(self):
        try:
            # 这里实现模型下载逻辑
            # 由于实际下载逻辑依赖于具体的模型仓库，这里用模拟进度代替
            for i in range(101):
                self.progress_updated.emit(i)
                self.msleep(50)

            self.download_finished.emit(f"模型下载完成: {os.path.basename(self.save_path)}")
        except Exception as e:
            self.download_error.emit(str(e))


class ModelPage(QWidget):
    def __init__(self):
        super().__init__()
        self.models_file = "models.json"
        self.models = self.load_models()
        self.initUI()

    def load_models(self):
        default_models = {
            "installed": [],
            "available": [
                # {"name": "模型A", "size": "1.2GB", "description": "通用语言模型"},
                # {"name": "模型B", "size": "2.5GB", "description": "专用对话模型"},
                # {"name": "模型C", "size": "800MB", "description": "轻量级模型"}
            ]
        }

        if os.path.exists(self.models_file):
            try:
                with open(self.models_file, 'r') as f:
                    return json.load(f)
            except:
                return default_models
        return default_models

    def save_models(self):
        try:
            with open(self.models_file, 'w') as f:
                json.dump(self.models, f, indent=4)
            return True
        except:
            return False

    def initUI(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)

        # 标题
        title_label = QLabel("模型管理")
        title_label.setFont(QFont("Arial", 16, QFont.Bold))
        title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(title_label)

        # 已安装模型区域
        installed_group = QGroupBox("已安装的模型")
        installed_layout = QVBoxLayout()

        self.installed_list = QListWidget()
        for model in self.models["installed"]:
            item = QListWidgetItem(f"{model['name']} - {model['size']}")
            self.installed_list.addItem(item)

        installed_layout.addWidget(self.installed_list)
        installed_group.setLayout(installed_layout)
        layout.addWidget(installed_group)

        # 可用模型区域
        available_group = QGroupBox("可下载的模型")
        available_layout = QVBoxLayout()

        self.available_list = QListWidget()
        for model in self.models["available"]:
            item = QListWidgetItem(f"{model['name']} - {model['size']} - {model['description']}")
            self.available_list.addItem(item)

        available_layout.addWidget(self.available_list)
        available_group.setLayout(available_layout)
        layout.addWidget(available_group)

        # 下载控制区域
        download_layout = QHBoxLayout()

        self.download_path = QLineEdit()
        self.download_path.setPlaceholderText("选择下载路径...")

        self.browse_btn = QPushButton("浏览")
        self.browse_btn.clicked.connect(self.browse_download_path)

        self.download_btn = QPushButton("下载选中模型")
        self.download_btn.clicked.connect(self.download_model)

        download_layout.addWidget(QLabel("下载路径:"))
        download_layout.addWidget(self.download_path)
        download_layout.addWidget(self.browse_btn)
        download_layout.addWidget(self.download_btn)
        layout.addLayout(download_layout)

        # 下载进度
        self.download_progress = QProgressBar()
        self.download_progress.setVisible(False)
        layout.addWidget(self.download_progress)

        # 状态信息
        self.status_label = QLabel("")
        layout.addWidget(self.status_label)

        layout.addStretch()
        self.setLayout(layout)

    def browse_download_path(self):
        path = QFileDialog.getExistingDirectory(self, "选择下载路径")
        if path:
            self.download_path.setText(path)

    def download_model(self):
        current_item = self.available_list.currentItem()
        if not current_item:
            QMessageBox.warning(self, "警告", "请先选择一个模型")
            return

        if not self.download_path.text():
            QMessageBox.warning(self, "警告", "请选择下载路径")
            return

        model_name = current_item.text().split(" - ")[0]
        self.status_label.setText(f"开始下载: {model_name}")
        self.download_progress.setVisible(True)

        # 启动下载线程
        self.download_thread = ModelDownloadThread(
            f"http://example.com/models/{model_name}",
            os.path.join(self.download_path.text(), model_name)
        )
        self.download_thread.progress_updated.connect(self.download_progress.setValue)
        self.download_thread.download_finished.connect(self.on_download_finished)
        self.download_thread.download_error.connect(self.on_download_error)
        self.download_thread.start()

    def on_download_finished(self, message):
        self.status_label.setText(message)
        self.download_progress.setVisible(False)
        QMessageBox.information(self, "成功", "模型下载完成")

    def on_download_error(self, error_message):
        self.status_label.setText(f"下载失败: {error_message}")
        self.download_progress.setVisible(False)
        QMessageBox.critical(self, "错误", f"下载失败: {error_message}")