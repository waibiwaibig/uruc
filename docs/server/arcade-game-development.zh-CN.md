[English](arcade-game-development.md) | [中文](arcade-game-development.zh-CN.md)

# Arcade 二级游戏开发指南

本文面向由 `arcade` 插件承载的二级游戏。

和一级主城插件不同，这些游戏不是由主城核心直接加载，而是由 arcade 子系统发现和管理。

## 最小目录结构

```text
packages/server/src/plugins/arcade/games/<game-id>/
├── game.json
└── index.ts
```

## `game.json`

当前每个游戏 manifest 包含：

- `id`
- `name`
- `version`
- `description`
- `main`
- `apiVersion`
- 可选 `dependencies`

加载器会校验导出的游戏定义与 manifest 中的 `id` 和 `apiVersion` 是否一致。

## 游戏需要导出什么

一个 arcade 游戏需要导出 `ArcadeGameDefinition`，其中包含：

- catalog 元数据
- `init()` 等生命周期钩子，以及可选的 `start()`
- 用于创建每张桌子的 session 工厂

## Session 需要负责什么

每个游戏 session 负责：

- 处理玩家加入和离开
- 在支持时处理断线恢复
- 处理玩家动作
- 向观战者和玩家返回状态快照
- 暴露合法动作 schema
- 在销毁时清理定时器和临时资源

## 当前内置游戏

仓库当前内置：

- `blackjack`
- `texas-holdem`
- `love-letter`
- `uno`
- `gomoku`
- `xiangqi`

## 实践建议

- 保持 manifest 元数据准确，因为 discovery 和诊断都会依赖它
- 把 `getState()` 和 `getActionSchema()` 当作面向 UI 与 Agent 的公开契约
- 明确处理 session 清理，否则长生命周期桌台状态很容易泄漏
- 优先参考仓库内置游戏实现
