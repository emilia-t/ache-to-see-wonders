# -*- coding: utf-8 -*-

from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
                             QLabel, QTextEdit, QGroupBox, QProgressBar, QMessageBox)
from PyQt5.QtCore import Qt, QProcess
from PyQt5.QtGui import QFont
import subprocess
import os
import sys
import json


class HomePage(QWidget):
    def __init__(self):
        super().__init__()
        self.backend_process = None
        self.frontend_process = None
        self.settings_file = "settings.json"
        self.settings = self.load_settings()
        self.initUI()

    def load_settings(self):
        """加载设置"""
        default_settings = {
            "backend_port": 8000,
            "frontend_port": 3000,
            "auto_start": False,
            "log_level": "INFO",
            "theme": "light"
        }

        if os.path.exists(self.settings_file):
            try:
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return default_settings
        return default_settings

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

    def check_nodejs_installed(self):
        """检查 Node.js 是否安装"""
        try:
            result = subprocess.run(["node", "--version"],
                                    capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        except:
            return False

    def create_server_script(self):
        """创建启动服务器的 Node.js 脚本（ES 模块版本）"""
        script_content = """
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || %d;
const distPath = path.join(__dirname, 'dist');

// MIME 类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function serveFile(filePath, response) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在，返回 index.html 用于 Vue Router 的 history 模式
                serveFile(path.join(distPath, 'index.html'), response);
            } else {
                response.writeHead(500);
                response.end('服务器错误: ' + error.code);
            }
        } else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
}

const server = http.createServer((request, response) => {
    let filePath = new URL(request.url, 'http://localhost').pathname;

    // 默认文件为 index.html
    if (filePath === '/') {
        filePath = '/index.html';
    }

    // 构建完整文件路径
    const fullPath = path.join(distPath, filePath);

    serveFile(fullPath, response);
});

server.listen(port, () => {
    console.log(`前端服务器运行在 http://localhost:${port}`);
    console.log('按 Ctrl+C 停止服务器');
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到关闭信号，正在停止服务器...');
    server.close(() => {
        console.log('服务器已停止');
        process.exit(0);
    });
});
""" % self.settings.get("frontend_port", 3000)

        script_path = "serve_frontend.mjs"
        try:
            with open(script_path, 'w', encoding='utf-8') as f:
                f.write(script_content)
            return script_path
        except Exception as e:
            self.log_text.append(f"创建服务器脚本失败: {str(e)}")
            return None

    def start_backend(self):
        self.log_text.append("正在启动后端服务...")
        try:
            # 从设置中获取后端端口
            backend_port = self.settings.get("backend_port", 8000)

            # 这里需要根据实际的后端启动命令修改
            self.backend_process = subprocess.Popen(
                ["python", "backend/main.py", "--port", str(backend_port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8'
            )
            self.backend_status.setText("后端服务: 运行中")
            self.start_backend_btn.setEnabled(False)
            self.stop_all_btn.setEnabled(True)
            self.log_text.append(f"后端服务启动成功，端口: {backend_port}")

            # 启动后台线程读取输出
            self.start_output_reading(self.backend_process, "后端")

        except Exception as e:
            self.log_text.append(f"后端服务启动失败: {str(e)}")

    def start_frontend(self):
        # 检查 dist 目录是否存在
        if not os.path.exists("dist") or not os.path.exists("dist/index.html"):
            self.log_text.append("错误: dist 目录或 index.html 文件不存在")
            QMessageBox.warning(self, "错误", "前端 dist 目录或 index.html 文件不存在")
            return

        # 检查 Node.js 是否安装
        if not self.check_nodejs_installed():
            self.log_text.append("错误: Node.js 未安装或未在 PATH 中")
            QMessageBox.warning(self, "错误",
                                "Node.js 未安装或未在 PATH 中。请安装 Node.js 后再试。")
            return

        self.log_text.append("正在启动前端服务...")

        try:
            # 从设置中获取前端端口
            frontend_port = self.settings.get("frontend_port", 3000)

            # 方法1: 使用 http-server
            self.log_text.append("尝试使用 http-server 启动...")

            # 检查是否安装了 http-server
            try:
                result = subprocess.run(["npx", "http-server", "--version"],
                                        capture_output=True, text=True, timeout=10)
                if result.returncode != 0:
                    self.log_text.append("http-server 未安装，尝试安装...")
                    install_result = subprocess.run(["npm", "install", "-g", "http-server"],
                                                    capture_output=True, text=True, timeout=60)
                    if install_result.returncode != 0:
                        self.log_text.append("http-server 安装失败，使用自定义脚本")
                        raise Exception("http-server installation failed")
            except:
                self.log_text.append("http-server 检查失败，使用自定义脚本")
                raise

            # 启动 http-server
            self.frontend_process = subprocess.Popen(
                ["npx", "http-server", "dist", "-p", str(frontend_port), "-a", "localhost", "-c-1"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8'
            )

            self.frontend_status.setText("前端服务: 运行中")
            self.start_frontend_btn.setEnabled(False)
            self.stop_all_btn.setEnabled(True)
            self.log_text.append(f"前端服务启动成功，端口: {frontend_port}")
            self.log_text.append(f"前端地址: http://localhost:{frontend_port}")

            # 启动后台线程读取输出
            self.start_output_reading(self.frontend_process, "前端")

        except Exception as e:
            self.log_text.append(f"http-server 启动失败: {str(e)}")
            # 如果 http-server 失败，尝试使用自定义脚本
            self.log_text.append("尝试使用自定义服务器脚本...")
            self.start_frontend_with_custom_script()

    def start_frontend_with_custom_script(self):
        """使用自定义 Node.js 脚本启动前端"""
        try:
            script_path = self.create_server_script()
            if not script_path:
                return

            frontend_port = self.settings.get("frontend_port", 3000)

            self.frontend_process = subprocess.Popen(
                ["node", script_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8'
            )

            self.frontend_status.setText("前端服务: 运行中")
            self.start_frontend_btn.setEnabled(False)
            self.stop_all_btn.setEnabled(True)
            self.log_text.append(f"前端服务启动成功(自定义脚本)，端口: {frontend_port}")
            self.log_text.append(f"前端地址: http://localhost:{frontend_port}")

            # 启动后台线程读取输出
            self.start_output_reading(self.frontend_process, "前端")

        except Exception as e:
            self.log_text.append(f"自定义脚本启动失败: {str(e)}")

    def start_output_reading(self, process, service_name):
        """启动后台线程读取进程输出"""
        from threading import Thread

        def read_output():
            while process and process.poll() is None:
                try:
                    output = process.stdout.readline()
                    if output:
                        self.log_text.append(f"[{service_name}] {output.strip()}")
                except:
                    break

        thread = Thread(target=read_output, daemon=True)
        thread.start()

    def stop_all_services(self):
        self.log_text.append("正在停止所有服务...")

        if self.backend_process:
            try:
                self.backend_process.terminate()
                self.backend_process.wait(timeout=5)
            except:
                self.backend_process.kill()
            finally:
                self.backend_process = None
            self.backend_status.setText("后端服务: 未启动")
            self.log_text.append("后端服务已停止")

        if self.frontend_process:
            try:
                self.frontend_process.terminate()
                self.frontend_process.wait(timeout=5)
            except:
                self.frontend_process.kill()
            finally:
                self.frontend_process = None
            self.frontend_status.setText("前端服务: 未启动")
            self.log_text.append("前端服务已停止")

        self.start_backend_btn.setEnabled(True)
        self.start_frontend_btn.setEnabled(True)
        self.stop_all_btn.setEnabled(False)

        # 清理临时脚本文件
        for temp_file in ["serve_frontend.js", "serve_frontend.mjs"]:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass