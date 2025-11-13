# atswsite

## 配置api(必要的配置):

```bash
cd src/config
cp apiConfig.ts.example.ts apiConfig.ts
vim apiConfig.ts

```

## 配置web json(可选的配置):

```bash
cd public
vim webConfig.json

```

## 运行web:

```bash
npm run dev

```

## 导出web：

请在 src/config/apiConfig.ts 中修改各种服务器 api 接口地址
Please modify various server API interface addresses in src/config/apiConfig.ts

否则导出的 web 将无法正常使用这些服务(例如账号登录)
Otherwise, the exported web will not be able to use these services properly (such as account login)


```bash
npm run build

```

## 已知的问题:

如果你使用的是 Windows 下的 IIS 部署网站,请在网站的 MIME类型 中添加 .gltf model/gltf-binary 以支持传输3D模型文件
If you are using IIS deployment website under Windows, please add .gltf model/gltf binary in the website's MIME type to support transferring 3D model files
