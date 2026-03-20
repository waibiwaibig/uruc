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

推荐主流程：

- `uruc configure` 用于首次建城或后续重配
- `uruc start [-b]` 用于启动城市；它现在会自动准备 `uruc.city.json` 和 `uruc.city.lock.json`

| 命令 | 作用 |
| --- | --- |
| `uruc configure [--quickstart\|--advanced] [--section <runtime\|access\|city\|plugins\|integrations>]` | 运行交互式建城配置流程，写入 `packages/server/.env`，QuickStart 会保留已有路径定制，确保城市配置存在并同步 city lock |
| `uruc build [--force]` | 构建 `packages/server` 与 `packages/human-web` |
| `uruc start [-b\|--background]` | 以前台或受管理模式启动运行时；`-b` 会走 CLI 管理的后台路径，若已安装 `systemd` 服务则会自动转到该服务；启动前会自动同步 city lock |
| `uruc stop` | 停止受管理的后台进程或 systemd 服务 |
| `uruc restart` | 重启受管理的后台进程或 systemd 服务 |
| `uruc status` | 查看运行模式、配置来源、地址、数据库路径和健康状态 |
| `uruc logs [--no-follow]` | 查看受管理日志，默认持续跟随 |
| `uruc dashboard` | 在运行时可达时打开网站首页 |
| `uruc doctor` | 诊断配置、构建新鲜度、管理员状态、插件 config/lock/runtime 状态和健康检查；`--json` 会带上逐插件 `pluginChecks` |
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
| `uruc plugin list` | 查看当前城市已配置的插件及其锁定 revision |
| `uruc plugin install <path>` | 从本地目录安装插件到当前城市配置 |
| `uruc plugin install <pluginId> [--source <id>] [--version <version>]` | 从已配置的 file-backed source 安装插件 |
| `uruc plugin enable <pluginId>` / `disable <pluginId>` | 打开或关闭一个已配置插件 |
| `uruc plugin uninstall <pluginId>` | 从 `uruc.city.json` 移除插件并重新生成 lock |
| `uruc plugin update [pluginId]` | 刷新单个插件或全部插件的 lock 与 materialized revision |
| `uruc plugin rollback <pluginId>` | 将 lock 回退到上一个已记录 revision |
| `uruc plugin inspect <pluginId>` | 打印插件的 config + lock 状态 |
| `uruc plugin validate <pluginId\|path>` | 校验已安装插件或本地路径的 manifest |
| `uruc plugin doctor` | 检查当前配置的 path-backed 与 source-backed 插件是否可正确解析；disabled 但不可解析的插件只记 warn，不算硬失败 |
| `uruc plugin gc [--dry-run]` | 清理 `.uruc/plugins` 中未再使用的 materialized revision |
| `uruc plugin create <pluginId> [--frontend] [--dir <path>]` | 生成一个新的 V2 插件脚手架 |

## 插件源命令

| 命令 | 作用 |
| --- | --- |
| `uruc source list` | 查看当前城市配置的插件源 |
| `uruc source add <id> <registry>` | 给当前城市添加一个 file-backed 插件源 |
| `uruc source remove <id>` | 移除一个已配置插件源 |

## 城市命令

| 命令 | 作用 |
| --- | --- |
| `uruc city init` | 在不存在时创建一个空的 `uruc.city.json`；现在属于高级 / 手动命令 |

## 备注

- 目前只有 `configure` 和 `help` 会使用 `--lang`。
- `configure` 已经是首次建城和后续重配的主入口；`city init` 和手动 `plugin update` 不再属于推荐主流程。
- QuickStart 会保留已有的文件系统路径设置，例如 `DB_PATH`、`CITY_CONFIG_PATH`、`PUBLIC_DIR`、`UPLOADS_DIR` 以及城市级 `pluginStoreDir`；只有缺失时才回落到默认值。
- `start`、`stop` 和 `restart` 会区分受管理后台实例、systemd 服务和未受 CLI 管理的本地进程。
- 新环境 configure 或启动失败时，优先使用 `doctor` 排查。
- `plugin uninstall` 只更新城市配置和 lock，不会对已经运行中的 server 进程做热卸载。
- `plugin gc` 默认保留每个已锁定插件的当前 revision 和最近一条回滚历史。
