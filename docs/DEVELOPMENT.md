# DEVELOPMENT

## 1. 开发

### 1.1 Fork & Clone

### 1.2 安装依赖

```sh
corepack yarn --immutable
```

### 1.3 先成功构建一次

```sh
corepack yarn build
```

## 2. 修改代码

### 2.1 注意事项

#### 不要让 AI 自动跑 eslint --fix

本项目里有很多 eslint 报错是需要专门解决，因而暂时留在那里的，不需要 AI 来修

## 3. 调试

先找人要到一个名为 `.env.local` 的文件置于项目根目录下。

### 3.1 调试前端

前端调试是使用 PC 端小程序环境进行调试，因此配置的主要目的就是让本机访问
390721.xyz 时能访问到本机的开发服务器。

要达成这一点的所需步骤：

#### 3.1.1 配置 HTTPS

最简单的方法是使用 [mkcert.dev](https://mkcert.dev)，根据 README 生成
`390721.xyz` `*.390721.xyz` 的 key 和 crt，然后在 `.env.local` 里填写两个文件的路径即可。

```ini
NEKOIL_FE_HTTPS_KEY=D:/nekoil-fe.key
NEKOIL_FE_HTTPS_CERT=D:/nekoil-fe.crt
```

#### 3.1.2 配置 DNS

改 hosts 让 390721.xyz 解析到本机 127.0.0.1 即可。

#### 3.1.3 启动开发服务器

运行

```sh
corepack yarn workspace nekoil-web dev
```

然后正常在 tg 中打开小程序，翻到最下方显示「开发模式」则已进入开发模式，代码更改后右键刷新小程序即可生效。

### 3.2 调试后端

#### 3.2.1 开发模式

```sh
corepack yarn build && corepack yarn start
```

#### 3.2.2 只测试后端

请求示例：

```sh
curl -fL -X POST -H 'Nekoil-Proxy-Token: 填 envlocal 里的对应值' -H 'Nekoil-Internal-Token: 填 envlocal 里的对应值' -H 'Content-Type: application/json' -d '{"query":"填你想获取的 cp 的 cpid"}' http://127.0.0.1:5140/nekoil/v0/cp/cp.get
```

#### 3.2.3 使用正式环境的前端测试本地开发模式的后端

TODO

#### 3.2.4 使用本地开发模式的前端测试本地开发模式的后端

TODO

## 4. 提交代码
