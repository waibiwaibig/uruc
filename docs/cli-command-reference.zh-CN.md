[English](cli-command-reference.md) | [中文](cli-command-reference.zh-CN.md)

# Uruc CLI 命令参考

本文档描述 `packages/server/src/cli` 的当前实现。
如果文档与实现不一致，以代码为准。

## 入口

| 平台 | 推荐入口 |
| --- | --- |
| 通过 npm 安装后的 macOS / Linux / Windows | `uruc <command>` |
| 源码 checkout 下的 macOS / Linux | `./uruc <command>` |
| 源码 checkout 下的 Windows PowerShell / Command Prompt | `npm run uruc -- <command>` |
| 源码 checkout 下的 WSL / Git Bash | `./uruc <command>` |

所有受支持入口最终都会调用同一套 server CLI。

## 解析模型

- 顶层分发器位于 `packages/server/src/cli/index.ts`。
- 第一个非 flag token 会被当作顶层命令。
- 全局解析器识别 `--json` 和 `--lang <zh-CN|en|ko>`。
- 其他参数会原样转交给选中的命令。
- `--lang` 目前只影响 `help` 和 `configure`。
- `plugin` 现在会接入 `CommandContext`，因此也会使用核心命令那套统一的 JSON 错误输出路径。
- `city` 仍然使用原始参数数组调用。

## 输出与 JSON 支持

| 命令范围 | 当前 JSON 行为 |
| --- | --- |
| `build`、`dashboard`、`stop`、`restart`、`status`、`doctor` | 成功输出支持 `--json` |
| `admin ...` | 大多数子命令支持 `--json` |
| `help`、`configure`、`start`、`logs` | 成功输出仅提供文本 |
| `plugin list`、`plugin scan`、`plugin inspect`、`plugin source list` | 支持 `--json` |
| `plugin validate` | 始终输出 JSON |
| 其他 `plugin ...`、`city init` | 成功输出仅提供文本 |

对自动化来说需要注意的实现细节：

- 对于接收 `CommandContext` 的命令，只要带了 `--json`，顶层错误会输出成 `{"error": "..."}`。
- 这现在也包括 `plugin ...`。
- `city` 仍然自己管理错误输出，因此失败时还是纯文本。

## 推荐操作流程

1. 先运行 `uruc configure` 做首次配置或后续重配。
2. 再运行 `uruc start` 或 `uruc start -b` 启动城市。
3. 日常运维和排障优先使用 `uruc status`、`uruc dashboard`、`uruc logs`、`uruc doctor`。

## 核心运行命令

### `uruc configure`

语法：

```bash
uruc configure [--quickstart|--advanced] [--section <runtime|access|city|plugins|integrations>] [--yes|--accept-defaults]
```

当前行为：

- 运行交互式建城配置流程，并写入当前生效的 server env 文件：
  - 源码 checkout：`packages/server/.env`
  - 通过 npm 安装后的 CLI：`<runtime-home>/.env`
- 在结束前确保城市配置存在，并同步 city lock。
- 当前支持两种模式：
  - `--quickstart`：问题更少，目标是尽快得到可运行城市。
  - `--advanced`：进入一个持久化主菜单，改完一节就立刻保存并回到菜单。
- 交互式 `advanced` 主菜单现在包含 `runtime`、`access`、`city`、`plugins`、`integrations`、`review summary`、`finish`。
- 通过 `--advanced --section ...` 仍可直接进入 `runtime`、`access`、`city`、`plugins`、`integrations` 这些单节捷径。
- `--quickstart` 不能与 `--section` 同时使用。
- `--yes` 和 `--accept-defaults` 在当前实现里是同义参数。
- `--accept-defaults` 目前要求和 `--quickstart` 一起使用。
- QuickStart 会在已有值存在时保留路径类设置，包括：
  - `DB_PATH`
  - `CITY_CONFIG_PATH`
  - `PUBLIC_DIR`
  - `UPLOADS_DIR`
  - 城市级 `pluginStoreDir`
- 插件 onboarding 现在采用 runtime-first 模型：
  - workspace plugins 是 `packages/plugins/*` 下的源码包
  - installed plugins 由 `uruc.city.json` / `uruc.city.lock.json` 定义
  - runtime plugin store 是 `.uruc/plugins/*`
- QuickStart 可以按需提示接入推荐的 workspace plugins。
- Advanced 的 `plugins` 菜单现在是正常插件生命周期命令的一层薄 UI：
  - 顶层先按组展示：查看插件、管理已安装插件、添加插件、修改 runtime plugin store 路径、返回
  - 已安装插件相关动作放在独立子菜单里
  - 添加插件相关动作放在独立子菜单里
  - 已安装插件选择器现在带显式 `back` 项
- source 编辑已经从 `configure` 挪出；请改用 `uruc plugin source ...`。
- 流程结束时，CLI 可以选择只保存、前台启动或受管理后台启动。

当前 section 范围：

| Section | 当前覆盖内容 |
| --- | --- |
| `runtime` | 监听地址、可达性、对外主机、协议、端口、静态目录 |
| `access` | 管理员账号、注册策略、搜索收录策略、站点访问密码 |
| `city` | 数据库路径和城市配置路径 |
| `plugins` | 已安装插件生命周期操作，以及 plugin store 路径编辑 |
| `integrations` | CORS、JWT、Resend 邮件、Google OAuth、GitHub OAuth |

### `uruc build`

语法：

```bash
uruc build [--force] [--json]
```

当前行为：

- 构建 `packages/server` 和 `packages/human-web`。
- 带 `--json` 时返回 JSON。
- `--force` 会传递到底层构建逻辑。

### `uruc start`

语法：

```bash
uruc start [-b|--background]
```

当前行为：

- 如果当前生效的 server env 文件缺失，会先启动 `uruc configure`，然后直接返回，不继续走普通启动路径。
- 在源码 checkout 下，如果仓库根目录存在 `.env` 会给出警告，因为此时真正生效的只有 `packages/server/.env`。
- 会解析当前配置的城市文件路径；如果配置的是非默认路径且文件不存在，会直接报错。
- 启动前会调用 `prepareCityRuntime(...)`：
  - 同步 `uruc.city.lock.json`
  - 当默认城市配置路径不存在时，自动创建一份空的默认城市配置
- 当构建产物过旧时会自动重新构建。
- 会在启动前检查当前配置的 HTTP / WebSocket 端口是否可用。
- 启动模式分为两种：
  - 默认前台启动
  - `-b` 或 `--background` 时走受管理后台启动
- 受管理后台启动会优先使用已安装的 `systemd` 服务；否则退回到 CLI 管理的 detached process 路径。

### `uruc stop`

语法：

```bash
uruc stop [--json]
```

当前行为：

- 如果有活动中的 `systemd` 服务，会优先停止该服务。
- 如果存在 CLI 记录且仍存活的后台进程，会停止该受管理进程。
- 否则会尝试停止一个可识别的、从当前 server package root 启动的本地未受管 Uruc 进程。
- JSON 模式下，如果当前没有运行实例，会返回 `{ "stopped": false, "reason": "already_stopped" }`。

### `uruc restart`

语法：

```bash
uruc restart [--json]
```

当前行为：

- 只支持受管理后台实例或 `systemd` 实例。
- 遇到 `stopped` 或 `unmanaged` 运行模式会直接拒绝。
- 重启前会重新准备城市运行时，并在构建陈旧时自动重建。

### `uruc status`

语法：

```bash
uruc status [--json]
```

当前行为：

- 会报告运行模式：`stopped`、`background`、`systemd`、`unmanaged`。
- 会报告可达性、绑定地址、URL、当前 env 路径、数据库路径、城市配置路径、public dir、管理员用户名和健康状态。
- 当运行实例由 CLI 管理时，也会报告 managed PID 和 managed log 路径。

### `uruc logs`

语法：

```bash
uruc logs [--no-follow]
```

当前行为：

- 如果 Uruc 以 `systemd` 服务运行，会调用 `journalctl -u <service>`。
- 否则读取 CLI 管理的日志文件。
- 默认持续跟随日志。
- `--no-follow` 会切换到有限输出。

### `uruc dashboard`

语法：

```bash
uruc dashboard [--json]
```

当前行为：

- 会先检查运行时健康状态。
- 当运行时可达时，会尝试打开站点首页。
- JSON 模式下会返回是否已打开以及站点 URL。

### `uruc doctor`

语法：

```bash
uruc doctor [--json]
```

当前行为：

- 当前会检查：
  - active server env 是否存在
  - 是否存在无效的 repo-root `.env`
  - DB 路径、城市配置路径、public dir 是否存在
  - 可达性和运行时健康状态
  - 构建是否陈旧
  - 管理员是否存在、配置中的管理员密码是否匹配
  - 插件 config / lock / runtime 是否一致
- JSON 模式下会同时返回高层检查项和逐插件 `pluginChecks`。
- 这是内置排障命令里最完整的一条。

### `uruc help`

语法：

```bash
uruc help
```

当前行为：

- 打印内置帮助文本。
- 使用当前配置语言，或使用 `--lang` 覆盖。

## 管理员命令

所有管理员命令都实现于 `packages/server/src/cli/commands/admin.ts`。

| 命令 | 当前行为 |
| --- | --- |
| `uruc admin create [username] [--password <password>] [--email <email>]` | 创建管理员；缺失字段时会交互提示 |
| `uruc admin list` | 列出管理员 |
| `uruc admin promote <user>` | 将已有用户提升为管理员 |
| `uruc admin reset-password <user> [--password <password>]` | 重置管理员密码；缺失时会交互提示 |
| `uruc admin users [--search <term>]` | 列出用户，可按关键字过滤 |
| `uruc admin ban <user>` / `unban <user>` | 封禁或解封用户 |
| `uruc admin agents` | 列出 Agent |
| `uruc admin freeze <agent>` / `unfreeze <agent>` | 冻结或解冻 Agent |
| `uruc admin kick <agent>` | 断开在线 Agent |

当前支持 JSON 的管理员子命令：

- `create`
- `list`
- `promote`
- `reset-password`
- `users`
- `ban`
- `unban`
- `agents`
- `freeze`
- `unfreeze`
- `kick`

## 插件命令

所有插件命令都实现于 `packages/server/src/cli/plugin-manager.ts`。

当前建议用这三个层次理解插件系统：

- `packages/plugins/*` 是 workspace plugin 源码。
- `uruc.city.json` 和 `uruc.city.lock.json` 定义当前城市已安装的插件集合。
- `.uruc/plugins/*` 是运行时真正加载的 materialized plugin store。

| 命令 | 当前行为 |
| --- | --- |
| `uruc plugin list` | 列出当前城市已安装插件，并显示安装来源、配置版本、revision 和 runtime store 路径 |
| `uruc plugin install <pluginId> [--source <id>] [--version <version>]` | 解析 source-backed 插件版本并安装到当前城市配置 |
| `uruc plugin install <alias>` | 从官方 marketplace source 解析 alias，并安装到当前城市配置 |
| `uruc plugin link <path>` | 把本地 workspace / plugin 路径接入当前城市，供开发调试使用 |
| `uruc plugin enable <pluginId>` / `disable <pluginId>` | 切换插件启用状态 |
| `uruc plugin remove <pluginId>` | 从 `uruc.city.json` 删除插件并重新同步 lock |
| `uruc plugin unlink <pluginId>` | 删除本地 linked 插件；source-backed 插件需要使用 `remove` |
| `uruc plugin update [pluginId]` | 刷新 source-backed 插件版本并重新同步 lock |
| `uruc plugin rollback <pluginId>` | 把 lock 中的插件条目回滚到最近一条历史 revision |
| `uruc plugin inspect <pluginId>` | 输出包含 config 和 lock 状态的 JSON |
| `uruc plugin validate <pluginId|path>` | 输出解析后的插件 manifest JSON |
| `uruc plugin doctor` | 检查已配置插件并报告 warning / failure |
| `uruc plugin gc [--dry-run]` | 清理插件 store 中未使用的 materialized revision |
| `uruc plugin scan [--scope workspace|sources|installed|all] [--json]` | 按 workspace、configured sources、installed plugins 三组扫描并输出插件视图 |
| `uruc plugin source list` / `add <id> <registry>` / `remove <id>` | 在 `plugin` 命名空间下管理 source |
| `uruc plugin pack <path> [--out <dir>]` | 构建可发布的插件 artifact；当插件声明了 `urucFrontend` 时也会把 `frontend-dist/` 打进去 |
| `uruc plugin create <pluginId> [--frontend] [--dir <path>]` | 生成新的后端插件脚手架，可选附带 frontend package metadata |

当前实现中几个重要细节：

- `plugin install <alias>` 默认会走官方 marketplace source：
  - source id：`official`
  - registry URL：`https://uruk.life/uruchub/registry.json`
- `plugin add`、`plugin uninstall` 和 `plugin install <path>` 已移除；现在会直接给出迁移提示。
- `plugin link <path>` 会把插件保存为本地开发覆盖路径。
- `plugin pack <path>` 会先在临时 staging 包里构建 `frontend-dist/`，然后再执行 `npm pack`。
- `plugin update` 会跳过通过 `devOverridePath` 配置的插件。
- `plugin doctor` 遇到硬失败时会以非零退出。
- `plugin inspect` 和 `plugin validate` 即使不带 `--json` 也始终输出 JSON。

## 插件源命令

所有 source 命令现在都位于 `uruc plugin source ...`。

| 命令 | 当前行为 |
| --- | --- |
| `uruc plugin source list` | 输出当前配置的 source 数组，支持 `--json` |
| `uruc plugin source add <id> <registry>` | 添加或替换一条 `type: "npm"` 的 source 记录 |
| `uruc plugin source remove <id>` | 删除一条 source 记录 |

当前 source 解析行为：

- source manager 会按 `{ id, type: "npm", registry }` 原样写入。
- source resolver 目前接受：
  - 含有 `uruc-registry.json` 的本地目录
  - 直接指向本地 `uruc-registry.json` 的路径
  - `file://` URL
  - HTTP(S) registry URL

## 城市命令

所有 city 命令都实现于 `packages/server/src/cli/city-manager.ts`。

| 命令 | 当前行为 |
| --- | --- |
| `uruc city init` | 当城市配置尚不存在时创建一份空配置 |

当前 `city init` 生成的文件内容：

- `apiVersion: 2`
- `approvedPublishers: ["uruc"]`
- `pluginStoreDir: ".uruc/plugins"`
- `plugins: {}`

## 运维备注

- 在源码 checkout 下，仓库根目录 `.env` 不参与运行时和 CLI；真正生效的是 `packages/server/.env`。
- 通过 npm 安装后的 CLI 默认使用 `<runtime-home>/.env`；如果设置了 `URUC_HOME`，则按该目录解析。
- `start` 和 `restart` 会在进程启动前准备城市运行时，但 server bootstrap 本身是在读取磁盘上已经存在的 city lock 文件来加载插件。
- `plugin remove`、`plugin unlink`、`plugin enable`、`plugin disable` 只更新 config / lock，不会对已运行中的 server 进程做热卸载或热重载。
- `plugin gc` 默认保留每个已锁定插件的当前 revision 和最近一条回滚历史。
- `stop` 可以终止一个可识别的本地未受管进程；`restart` 不能重启未受管进程。
