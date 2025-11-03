#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# The relative position of this file: /special_config.py

# 电子邮箱相关配置
_smtp_server_ = 'smtp.your-email-provider.com' # smtp 服务器地址
_smtp_port_ = 465 # smtp 端口
_sender_email_ = 'noreply@yoursite.com' # 发送给用户时用的电子邮箱
_sender_password_ = 'your_email_password' # 密码
_run_site_ = 'https://run.site.com' # 网站地址

# ssl 相关配置
_ssl_enable_ = False # 是否启用 ssl
_ssl_crt_file_ = '' # crt 证书文件地址 请确保证书拥有完整的证书链 参考这篇文章:https://myacghome.com/doc.php?id=38
_ssl_key_file_ = '' # key 密钥文件地址