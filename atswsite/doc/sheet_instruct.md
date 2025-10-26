# 📝 通信指令结构设计相关

用于记录通信指令结构设计相关。

|修订| 适范围 |           描述        |      $type           |    #class    |    conveyor   |      time(示例)         | data                       | 返回指令          | 备注         |
|---|--------|-----------------------|----------------------|--------------|---------------|------------------------|----------------------------|-------------------|--------------|
| — | 客户   |  用于检测网络连接延迟   | ping                 |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |$pong             |—             |
| — | 服务端 |  用于检测网络连接延迟   | pong                 |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |—                 |—             |
| — | 客户   |  用于获取服务端RSA公钥  | get_publickey        |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |$publickey        |—             |
| — | 服务端 |  用于发送服务端RSA公钥  | publickey            |       —      |       —       |'2023-03-26 15:55:45:214'|'RSA_publickey'             |—                 |—             |
| — | 客户   |  用于登录账号          | get_login            |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |$login            |—             |
| — | 服务端 |  用于登录账号          | login                |       —      |       —       |'2023-03-26 15:55:45:214'|'ok'                        |—                 |—             |
| — | 客户   |  用于登录匿名账号      | get_anonymous_login  |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |$anonymous_login  |—             |
| — | 服务端 |  用于登录匿名账号      | anonymous_login      |       —      |       —       |'2023-03-26 15:55:45:214'|'ok'                        |—                 |—             |
| — | 客户   |  用于登录匿名账号      | get_server_config    |       —      |       —       |'2023-03-26 15:55:45:214'|             —              |$anonymous_login  |—             |
| — | 服务端 |  用于登录匿名账号      | server_config        |       —      |       —       |'2023-03-26 15:55:45:214'| 详见:详细指令结构            |—                 |—             |
## 建立连接过程
- **wss**：
  ```js
    const instructPipe = new Instruct("wss://example.com:2424");//创建指令管道
    //当创建 Instruct 后会做下面的事情
    this.socket = new WebSocket("wss://example.com:2424");
    this.socket.onopen=(ev)=>onOpen(ev);
    this.socket.onmessage=(ev)=>this.onMessage(ev);
    this.socket.onclose=(ev)=>this.onClose(ev);
    this.socket.onerror=(ev)=>this.onError(ev);
    onOpen(){//连接成功事件
          this.isLink=true;
          this.onLog('服务器连接成功','tip');
          this.getServerPublickey();//获取公钥
          this.getServerConfig();//获取服务器配置
          this.intervalPing();//检测连接延迟
          return true;
        }
    onClose(){//断开连接事件
          this.isLink=false;
          this.onLog('服务器连接中断','warn');
          return true;
        }
    onError(){//连接失败事件
          this.isLink=false;
          this.onLog('服务器连接失败','warn');
          return true;
        }
    onMessage(ev){//收到消息事件
          let instructObj=this.instructParse(ev.data);
          if(instructObj===null){this.onLog('无法解析指令','error',ev.data);return false;}
          switch (instructObj.type){
            case 'broadcast':{this.handle_broadcast(instructObj);break;}
            case 'pong':{this.handle_pong(instructObj);break;}
            case 'login':{this.handle_login(instructObj);break;}
            case 'publickey':{this.handle_publickey(instructObj);break;}
            case 'anonymous_login':{this.handle_anonymous_login(instructObj);break;}
            case 'server_config':{this.handle_server_config(instructObj);break;}
            default:{this.onLog('无法解析指令','error',instructObj);}
          }
        }
    intervalPing(){
          setInterval(
            ()=>{
              if(this.isLogin){
                this.lastPing=new Date().getTime();
                this.send(this.Instruct.ping());
              }
            },
            5000
          );
        }

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
### login 指令(data value either 'ok' or 'no')
- **完整结构**：
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
### anonymous_login 指令(data value either 'ok' or 'no')
- **完整结构**：
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