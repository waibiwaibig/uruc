# uruc-go Design

**Date:** 2026-03-23

## Goal

在不改变宿主平台接入方式和整体页面结构的前提下，基于 `packages/plugins/chess` 新建一个独立的围棋馆插件 `uruc-go`。除前端颜色风格、棋局引擎、棋盘表现和棋种内在逻辑外，其余结构、房间模型、命令模型、观战机制、实时推送、评分体系和使用流转都尽量保持与 `chess` 一致。

## Confirmed Facts

- 新插件命名：
  - 目录：`packages/plugins/go`
  - 包名：`@uruc/plugin-go`
  - 插件 ID：`uruc.go`
  - 展示名：`uruc-go`
- 规则：
  - 标准 `19x19`
  - 黑先
  - 白贴 `7.5`
  - 无让子
  - 允许 `pass`
  - 双方连续 `pass` 后结算
- 规则口径：按中韩规则、国际规则方向实现。
- 用户要求：除了颜色与风格、国际象棋引擎替换为围棋引擎、棋盘替换为围棋盘、内部逻辑改为围棋，其它都照抄 `packages/plugins/chess`。

## Non-Goals

- 不修改 Uruc 通用插件协议。
- 不抽象新的共享棋类框架。
- 不顺手重构 `packages/plugins/chess`。
- 不扩展到 `13x13` 或 `9x9`。
- 不引入让子、贴目配置、规则切换或房间自定义规则。

## Architecture

### Package Shape

直接复制 `packages/plugins/chess` 的文件结构，在 `packages/plugins/go` 下保留同等职责拆分：

- `index.mjs`：后端插件入口、命令注册、房间状态机、评分、推送
- `frontend/plugin.ts`：前端插件注册与页面挂载
- `frontend/GoPage.tsx`：主页面
- `frontend/runtime.ts`：运行时事件 slice
- `frontend/types.ts`：前后端消息类型
- `frontend/locales/*`：中英文文案
- `frontend/go.css`：围棋馆样式
- `frontend/GoPage.test.tsx`：页面行为测试

### Backend Model

保留 `chess` 的房间与座位模型：

- 双人对局
- waiting / playing / finished 三阶段
- public / private 房间可见性
- ready / unready 开局
- 观战与房间监听
- 断线重连宽限
- Elo 评分

替换棋局状态表示：

- 从 `chess.js` 的 FEN/PGN/合法着法 改为围棋局面对象
- 保存 `19x19` 棋盘、当前行棋方、提子计数、pass 连续次数、着手历史、终局结果
- 命令仍保持与 `chess` 对齐的使用方式，但 `move` 的 payload 和返回值改为围棋坐标与围棋局面

### Frontend Model

保留 `chess` 页面的信息架构：

- New game
- Rooms
- Record
- History
- Leaderboard

替换棋盘与棋局展示：

- 棋盘从 8x8 国际象棋盘改为 19x19 围棋盘
- 走子高亮、最近一步、轮次提示改为围棋语义
- 吃子、pass、终局结果、贴目、当前轮到谁下等信息替换原有象棋文案
- 整体布局、分栏和操作入口尽量与 `chess` 一致，只调整视觉风格

## Engine Decision

实现需要一个可在 Node 和前端都稳定使用的围棋规则引擎，最低能力要求：

- `19x19` 落子合法性校验
- 自杀禁入
- 劫争限制
- `pass`
- 连续两手 `pass` 终局
- 按已确认规则结算胜负

如果现成依赖不能满足这些能力，则在 `packages/plugins/go` 内实现最小围棋规则引擎，但接口仍按 `chess` 的现有代码结构组织，避免改动宿主层。

## Error Handling

保留 `chess` 的错误处理模式：

- 后端统一返回结构化错误与 guide
- 非法操作包括：
  - 非当前回合落子
  - 对无效点位落子
  - 重复加入/离开
  - 非房间成员准备或操作
  - 已结束对局继续操作
- 前端继续以状态同步和必要的 resync 为主，不引入新的错误通道

## Testing

测试策略沿用 `chess`：

- 页面测试复制现有 `ChessPage.test.tsx` 的结构，验证房间页签和 bootstrap 后的显示
- 为围棋引擎增加最小规则测试，覆盖：
  - 合法落子
  - 禁止落在已有棋子上
  - 提子
  - 自杀禁入
  - 劫争限制
  - 连续两手 `pass` 结束
- 插件注册与基本构建应继续兼容现有 CLI / frontend 装载方式

## Implementation Boundary

本次实现以“高保真复制 `chess`”为原则：

- 能不改结构就不改结构
- 能复用原命令名语义就复用语义
- 能平移测试就平移测试
- 仅在围棋规则无法与象棋字段同构时，才对字段名和页面文案做必要替换
