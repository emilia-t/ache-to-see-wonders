#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /backend/chineseChess/tool.py

import datetime
import re
from typing import Optional, Union
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
import base64
import random

class Tool:

    """生成格式为 'YYYY-MM-DD HH:mm:ss:SSS' 的时间字符串"""
    @staticmethod
    def get_format_time(date: Optional[datetime.datetime] = None) -> str:
        if date is None:
            date = datetime.datetime.now()

        return date.strftime('%Y-%m-%d %H:%M:%S:%f')[:-3]  # 去掉最后3位，保留毫秒

    """获取当前时间戳（毫秒）"""
    @staticmethod
    def get_timestamp() -> int:
        return int(datetime.datetime.now().timestamp() * 1000)

    """解析格式为 'YYYY-MM-DD HH:mm:ss:SSS' 的时间字符串为时间戳（毫秒）"""
    @staticmethod
    def format_time_to_timestamp(time_string: str) -> int:
        try:
            # 解析时间字符串
            pattern = r'^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}):(\d{3})$'
            match = re.match(pattern, time_string)
            if not match:
                raise ValueError('Invalid time string format')

            year, month, day, hour, minute, second, millisecond = map(int, match.groups())

            # 创建datetime对象
            dt = datetime.datetime(year, month, day, hour, minute, second, millisecond * 1000)

            # 转换为时间戳（毫秒）
            return int(dt.timestamp() * 1000)
        except Exception as e:
            print(f'Failed to parse time string: {e}')
            return -1

    """将时间戳转换为格式化的时间字符串"""
    @staticmethod
    def timestamp_to_format_time(timestamp: int) -> str:
        dt = datetime.datetime.fromtimestamp(timestamp / 1000.0)
        return Tool.get_format_time(dt)

    """计算两个时间字符串之间的时间差（毫秒）"""
    @staticmethod
    def format_time_minus_format_time(
            start_time: str,
            end_time: Optional[str] = None
    ) -> int:
        if end_time is None:
            end_time = Tool.get_format_time()

        start_timestamp = Tool.format_time_to_timestamp(start_time)
        end_timestamp = Tool.format_time_to_timestamp(end_time)

        if start_timestamp == -1 or end_timestamp == -1:
            return -1

        return end_timestamp - start_timestamp

    """使用RSA公钥加密字符串"""
    @staticmethod
    def rsa_encrypt(plain_text: str, public_key: str) -> str:
        try:
            # 加载公钥
            public_key_obj = serialization.load_pem_public_key(
                public_key.encode('utf-8'),
                backend=default_backend()
            )

            # 加密数据
            encrypted = public_key_obj.encrypt(
                plain_text.encode('utf-8'),
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )

            # 转换为base64字符串
            return base64.b64encode(encrypted).decode('utf-8')

        except Exception as e:
            print(f'RSA encryption failed: {e}')
            raise Exception('RSA encryption failed')

    """使用RSA私钥解密字符串"""
    @staticmethod
    def rsa_decrypt(encrypted_text: str, private_key: str) -> str:
        try:
            # 加载私钥
            private_key_obj = serialization.load_pem_private_key(
                private_key.encode('utf-8'),
                password=None,
                backend=default_backend()
            )

            # 解密数据
            encrypted_data = base64.b64decode(encrypted_text)
            decrypted = private_key_obj.decrypt(
                encrypted_data,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )

            return decrypted.decode('utf-8')

        except Exception as e:
            print(f'RSA decryption failed: {e}')
            raise Exception('RSA decryption failed')


    from typing import Union, List

    """生成随机的rgba颜色"""
    @staticmethod
    def create_random_rgba(random_alpha: bool = False, output_string: bool = True) -> Union[
        str, List[Union[int, float]]]:
        """
            random_alpha: 如果为 False 则 alpha 为 1，否则生成 0.6-1 的小数（保留2位小数）
            output_string: 如果为 False 则输出长度为4的数组，否则输出字符串类型的 RGBA 颜色
            根据 output_string 参数返回数组或字符串格式的 RGBA 颜色
        """
        r = random.randint(0, 255)
        g = random.randint(0, 255)
        b = random.randint(0, 255)

        if random_alpha:
            a = round(random.uniform(0.6, 1.0), 2)
        else:
            a = 1.0

        if output_string:
            return f"rgba({r},{g},{b},{a})"
        else:
            return [r, g, b, a]
