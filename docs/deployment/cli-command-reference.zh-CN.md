[English](cli-command-reference.md) | [中文](cli-command-reference.zh-CN.md)

# Uruc CLI 命令参考

本文档以 `packages/server/src/cli` 的当前实现为准。

## 入口

| 平台 | 推荐命令 |
| --- | --- |
| macOS / Linux | `./uruc <command>` |
| Windows PowerShell / Command Prompt | `npm run uruc -- <command>` |
| WSL / Git Bash | `./uruc <command>` |

所有入口最终都会调用同一套 server CLI。

## 全局选项

| 选项 | 作用 |
| --- | --- |
| `--json` | 在命令支持时输出机器可读 JSON |
| `--lang <zh-CN\|en\|ko>` | 覆盖 `help` 和 `configure` 使用的语言 |

## 核心命令

| 命令 | 作用 |
| --- | --- |
| `uruc configure` | 运行交互式 city runtime 配置流程并写入 `packages/server/.env` |
| `uruc build [--force]` | 构建 `packages/server` 与 `packages/human-web` |
| `uruc start [-b\|--background]` | 以前台或后台模式启动运行时 |
| `uruc stop` | 停止受管理的后台进程或 systemd 服务 |
| `uruc restart` | 重启受管理的后台进程或 systemd 服务 |
| `uruc status` | 查看运行模式、配置来源、地址、数据库路径和健康状态 |
| `uruc logs [--no-follow]` | 查看受管理日志，默认持续跟随 |
| `uruc dashboard` | 在运行时可达时打开网站首页 |
| `uruc doctor` | 诊断配置、构建新鲜度、管理员状态、插件状态和健康检查 |
| `uruc help` | 显示 CLI 内置帮助 |

## 管理员命令

| 命令 | 作用 |
| --- | --- |
| `uruc admin create` | 创建管理员 |
| `uruc admin list` | 列出管理员 |
| `uruc admin promote <user>` | 将已有用户提升为管理员 |
| `uruc admin reset-password <user>` | 重置管理员密码 |
| `uruc admin users [--search <term>]` | 列出用户 |
| `uruc admin ban <user>` / `unban <user>` | 封禁或解封用户 |
| `uruc admin agents` | 列出 Agent |
| `uruc admin freeze <agent>` / `unfreeze <agent>` | 冻结或解冻 Agent |
| `uruc admin kick <agent>` | 踢下线一个在线 Agent |

多数管理员命令也支持 `--json`。

## 插件命令

| 命令 | 作用 |
| --- | --- |
| `uruc plugin list` | 查看当前配置中的插件和已发现插件 |
| `uruc plugin enable <name>` | 在当前插件配置中启用插件 |
| `uruc plugin disable <name>` | 在当前插件配置中禁用插件 |
| `uruc plugin install <path>` | 从本地目录安装插件 |
| `uruc plugin uninstall <name>` | 通过禁用实现软卸载 |
| `uruc plugin uninstall <name> --hard` | 删除插件目录 |
| `uruc plugin discover` | 扫描已配置的插件搜索路径 |

## 备注

- 目前只有 `configure` 和 `help` 会使用 `--lang`。
- `start`、`stop` 和 `restart` 会区分受管理后台实例、systemd 服务和未受 CLI 管理的本地进程。
- `configure` 只负责 city runtime 状态，不负责 nginx / SSL / systemd / 落地页拓扑。
- 新环境启动失败时，优先使用 `doctor` 排查。
