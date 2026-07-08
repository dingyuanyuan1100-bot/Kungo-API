# Kungo-API

基于 `KuGouMusicApi` 的酷狗音乐 Web 客户端与接口封装，支持短信登录、二维码登录、搜索、歌单、播放、歌词、封面与 MV 能力。

## 项目说明

这个仓库在上游 `MakcRe/KuGouMusicApi` 的基础上，补充了一套可直接运行的浏览器端客户端，并整理了适合前端与第三方调用的接口文档。

适用场景：
- 本地启动 API 后直接打开网页使用
- 作为自用音乐面板部署到服务器
- 作为第三方接口网关接入自己的前端项目

## 主要功能

- 短信验证码登录
- 二维码登录
- 登录态本地保存与定时刷新
- 歌曲搜索、歌单搜索、专辑搜索、歌手搜索、MV 搜索
- 我的歌单、歌单歌曲列表
- 歌曲播放、歌词滚动、封面展示
- MV 播放
- 统一封装 `/api` 与 `/raw-api` 调用
- 对无音源歌曲自动跳过处理

## 目录结构

```text
public/kugou-client/         Web 客户端
public/kugou-client/docs/    页面内可视化接口文档
public/kugou-client/modules/ 前端模块化代码
public/kugou-client/styles.css
public/kugou-client/app.js

docs/kugou-client-api.md     仓库内接口文档
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm run dev
```

默认启动地址：

```text
http://127.0.0.1:3000
```

### 3. 打开客户端

```text
http://127.0.0.1:3000/kugou-client/index.html
```

## 客户端默认配置

- 默认 Platform：`life`
- 稳定网关接口：`/api`
- 上游原始接口：`/raw-api`

说明：
- 登录、验证码、二维码、歌词、封面等链路更依赖 `/raw-api`
- 搜索、专辑、歌手、MV、播放等聚合能力优先走 `/api`

## 文档入口

- 仓库接口文档：`docs/kugou-client-api.md`
- 页面接口文档：`public/kugou-client/docs/api.md`

如果服务已启动，也可以直接在浏览器访问：

```text
http://127.0.0.1:3000/kugou-client/docs/
```

## 部署说明

### 本地使用

直接运行：

```bash
npm run dev
```

### 自定义端口

PowerShell：

```powershell
$Env:PORT=4000; npm run dev
```

### 自定义 Host

PowerShell：

```powershell
$Env:HOST='0.0.0.0'; npm run dev
```

### HTTP 代理

如果上游请求需要代理：

```powershell
$Env:KUGOU_API_PROXY='http://127.0.0.1:7890'; npm run dev
```

也可以这样启动：

```bash
node app.js --proxy=http://127.0.0.1:7890
```

## 前端实现要点

- 采用模块化结构拆分 `services`、`player`、`ui`、`auth`、`storage`
- 统一处理 cookie 拼接、token 保存、刷新和重试
- 播放链路对 `no playable source` 做显式过滤
- 歌词、封面、音频地址分别独立获取，避免单链路失败拖垮整体

## 适合作为第三方接口时的建议

- 对外只暴露 `/api` 聚合接口，尽量不要直接暴露完整 `/raw-api`
- 登录态与 cookie 统一放到服务端管理
- 对播放、歌词、封面接口做失败兜底与重试
- 区分公开接口与登录态接口，避免前端直接持有敏感 cookie

## 上游项目

当前能力基于上游项目：

- [MakcRe/KuGouMusicApi](https://github.com/MakcRe/KuGouMusicApi)

灵感来源：

- [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)

## 免责声明

- 本项目仅供学习与技术研究使用
- 请尊重音乐版权，支持正版
- 请勿将本项目用于违法用途或未授权的商业场景
- 如官方平台认为本项目内容不合适，可联系后处理

## License

[The MIT License (MIT)](https://github.com/MakcRe/KuGouMusicApi/blob/main/LICENSE)
