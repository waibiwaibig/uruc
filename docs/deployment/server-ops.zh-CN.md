[English](server-ops.md) | [中文](server-ops.zh-CN.md)

# 外部服务器运维

`uruc configure` 被有意限制在 city runtime 状态本身，不负责：

- nginx 或其他反向代理
- SSL / certbot
- systemd 服务安装
- 落地页或多站点拓扑

这些事情应该交给外部运维工具。常见职责包括：

- 把构建后的静态落地页放到站点目录
- 把 city runtime 反代到域名或子路径
- 申请和续期证书
- 以系统服务方式安装或监管 runtime

外部运维层通常需要的 runtime 侧参数主要是：

- `BASE_URL`
- `BIND_HOST`
- `PORT`
- `WS_PORT`
- `APP_BASE_PATH`

如果你要为自己的环境做 companion installer，请把它放在主 `uruc` CLI 之外，这样公开 CLI 才能持续保持对本地、局域网和服务器直跑场景的可移植性。
