# 📝 通信指令结构设计相关

用于记录通信指令结构设计相关。

|修订| 适范围 |           描述        |      $type           |    #class    |    conveyor   |      time(示例)         | data                       | 返回指令          | 备注         |
|---|--------|-----------------------|----------------------|--------------|---------------|------------------------|----------------------------|-------------------|--------------|
| — | 客户   |  用于检测网络连接延迟   | [ping](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#ping-%E6%8C%87%E4%BB%A4)                 |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |$pong             |—             |
| — | 服务端 |  用于检测网络连接延迟   | [pong](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#pong-%E6%8C%87%E4%BB%A4)                 |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |—                 |—             |
| — | 客户   |  用于获取服务端RSA公钥  | [get_publickey](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#get_publickey-%E6%8C%87%E4%BB%A4)        |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |$publickey        |—             |
| — | 服务端 |  用于发送服务端RSA公钥  | [publickey](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#publickey-%E6%8C%87%E4%BB%A4)            |       —      |       —       |'2023-03-26 15:55:45:214'|'RSA_publickey'             |—                 |—             |
| — | 客户   |  用于登录账号          | [get_login](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#get_login-%E6%8C%87%E4%BB%A4)            |       —      |       —       |'2023-03-26 15:55:45:214'| 详见:详细指令结构            |$login            |—             |
| — | 服务端 |  用于登录账号          | [login](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#login-%E6%8C%87%E4%BB%A4)                |       —      |       —       |'2023-03-26 15:55:45:214'|'ok'                        |—                 |—             |
| — | 客户   |  用于登录匿名账号      | [get_anonymous_login](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#get_anonymous_login-%E6%8C%87%E4%BB%A4)  |       —      |       —       |'2023-03-26 15:55:45:214'| 详见:详细指令结构            |$anonymous_login  |—             |
| — | 服务端 |  用于登录匿名账号      | [anonymous_login](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#anonymous_login-%E6%8C%87%E4%BB%A4)      |       —      |       —       |'2023-03-26 15:55:45:214'|'ok'                        |—                 |—             |
| — | 客户   |  用于登录匿名账号      | [get_server_config](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#get_server_config-%E6%8C%87%E4%BB%A4)    |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |$anonymous_login  |—             |
| — | 服务端 |  用于登录匿名账号      | [server_config](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#server_config-%E6%8C%87%E4%BB%A4)        |       —      |       —       |'2023-03-26 15:55:45:214'| 详见:详细指令结构            |—                 |—             |
| — | 客户   |  用于获取账号数据      | [get_user_data](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#get_user_data-%E6%8C%87%E4%BB%A4)    |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |$user_data         |—             |
| — | 服务端 |  用于获取账号数据      | [user_data](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#user_data-%E6%8C%87%E4%BB%A4)        |       —      |       —       |'2023-03-26 15:55:45:214'| 详见:详细指令结构            |—                 |—             |
| — | 客户   |  用于使用Token登录      | [get_token_login](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#get_token_login-%E6%8C%87%E4%BB%A4)    |       —      |       —       |'2023-03-26 15:55:45:214'| 详见:详细指令结构            |$token_login         |—             |
| — | 服务端 |  用于使用Token登录      | [token_login](https://github.com/emilia-t/ache-to-see-wonders/blob/master/atswsite/doc/sheet_instruct.md#token_login-%E6%8C%87%E4%BB%A4)        |       —      |       —       |'2023-03-26 15:55:45:214'| 'ok'            |—                 |—             |

## 建立连接过程
- **wss**：
  ```js
    const instructPipe = new Instruct("wss://example.com:2424");//创建指令管道
    //当创建 Instruct 后会做下面的事情 具体代码以 Instruct.ts 为准
    this.url = url;
    this.socket = new WebSocket(this.url);
    this.socket.onmessage=(ev)=>this.onMessageHandler(ev);
    this.socket.onopen=(ev)=>onOpenHandler(ev);
    this.socket.onclose=(ev)=>this.onCloseHandler(ev);
    this.socket.onerror=(ev)=>this.onErrorHandler(ev);

## 详细指令结构

### ping 指令
- **完整结构**：
  ```json
  {
    "type": "ping",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": ""
  }
### pong 指令
- **完整结构**：
  ```json
  {
    "type": "pong",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": ""
  }
### get_publickey 指令
- **完整结构**：
  ```json
  {
    "type": "get_publickey",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": ""
  }
### publickey 指令
- **完整结构**：
  ```json
  {
    "type": "publickey",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": "-----BEGIN CERTIFICATE-----MIIGLDB8O2oVwyEsu+h86nn4-----END CERTIFICATE-----"
  }
### get_login 指令
- **完整结构**：
  ```json
  {
    "type": "get_login",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": {
      "email": "account and password need encryption(ues server publickey)",
      "password": "account and password need encryption(ues server publickey)",
    }
  }
### login 指令
- **完整结构(data value either 'ok' or 'no')**：
  ```json
  {
    "type": "login",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": "ok"
  }
### get_anonymous_login 指令
- **完整结构**：
  ```json
  {
    "type": "get_anonymous_login",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": {
      "email": "any@anonymous"
    }
  }
### anonymous_login 指令
- **完整结构(data value either 'ok' or 'no')**：
  ```json
  {
    "type": "anonymous_login",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": "ok"
  }
### get_server_config 指令
- **完整结构**：
  ```json
  {
    "type": "get_server_config",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": ""
  }
### server_config 指令
- **完整结构**：
  ```json
  {
    "type": "server_config",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": {
      "version":"1.0.0",
      "anonymous_login":false,
      "key":"k0",
      "url":"wss://example.com:2424",
      "name":"game server",
      "online_number":0,
      "max_online":100
    }
  }
### get_user_data 指令
- **完整结构**：
  ```json
  {
    "type": "get_user_data",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": ""
  }
### user_data 指令
- **完整结构**：
  ```json
  {
    "type": "user_data",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": {
      "id":1,
      "anonymous_user":false,
      "email":"test@qq.com",
      "password":"",
      "name":"test",
      "qq":1234567890,
      "theme_color":"rgba(255,255,255,1)",
      "head_img":"none"
    }
  }
### get_token_login 指令
- **完整结构**：
  ```json
  {
    "type": "get_token_login",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": {
      "user_id": 1,
      "token": "abcdjsldjfdhlsdjf"
    }
  }
### token_login 指令
- **完整结构(data value either 'ok' or 'no')**：
  ```json
  {
    "type": "token_login",
    "class": "",
    "conveyor": "",
    "time": "2023-03-26 15:55:45:214",
    "data": "ok"
  }