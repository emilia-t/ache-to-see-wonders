# 📝 通信指令结构设计相关

用于记录通信指令结构设计相关。

|修订| 适范围 |       指令名称         |           描述         |      $type      |    #class    |    conveyor   |      time(示例)     | data                       | 返回指令      | 备注         |
|---|--------|------------------------|-----------------------|-----------------|--------------|---------------|---------------------|----------------------------|--------------|--------------|
| — | 服务端 | get publickey instruct |  用于获取服务端RSA公钥  | get_publickey   |       —      |       —       |'2023-03-26 15:55:45'|             —              |$publickey    |—             |
| — | 客户端 | publickey instruct     |  用于发送服务端RSA公钥  | publickey       |       —      |       —       |'2023-03-26 15:55:45'|'RSA_publickey'<String>     |—             |—             |

## 详细指令结构

### get_publickey 指令
- **完整结构**：
  ```json
  {
    "type": "get_publickey",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45",
    "data": ""
  }
### publickey 指令
- **完整结构**：
  ```json
  {
    "type": "publickey",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45",
    "data": "-----BEGIN CERTIFICATE-----MIIGLDB8O2oVwyEsu+h86nn4-----END CERTIFICATE-----"
  }