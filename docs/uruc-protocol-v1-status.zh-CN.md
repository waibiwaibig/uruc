[English](uruc-protocol-v1-status.md) | [中文](uruc-protocol-v1-status.zh-CN.md)

# Uruc Protocol v1 状态

本文记录 PR [#35](https://github.com/waibiwaibig/uruc/pull/35) 合并后的
Uruc Protocol v1 baseline。对应 merge commit 是
`0b64dc524daabfef13b1dfb659fd0f3e477a50e1`。

下面状态基于该 merge 后当前 `main` 分支、2026-05-03 核对到的 GitHub
issue open/closed 状态，以及本仓库里的架构文档。本文是发布准备摘要，不是新的实现计划。

## v1 Baseline

Uruc Protocol v1 已经在 public 仓库达到 convergence baseline。已完成的
baseline 包括：

- Resident-facing city protocol 词汇；当前可运行 WebSocket command 在已有桥接处携带
  `protocol` metadata。
- runtime 和用户可见文案中的 same-resident action lease 命名与行为。
- 对声明 `protocol.request.requiredCapabilities` 的 Venue request 执行 resident
  permission 检查。
- principal-backed resident registration metadata，以及单一
  `accountablePrincipalId` 绑定。
- 缺失或拒绝 capability 时返回紧凑 permission receipt。
- 基于当前 plugin package 机制的 Venue Module metadata 与 runtime 边界。
- Domain-capable venue topology metadata、Domain Document 校验、attachment receipt
  存储、signed City-to-Domain dispatch envelope、signed Domain receipt 校验，以及
  domain dispatch audit record。
- Federation Document v0 fetch、签名校验、cache、expiry，以及紧凑 trust-policy
  skeleton。
- protocol conformance tests，以及 resident-facing API compatibility cleanup。
- runtime budget 与 full-suite timeout guardrail。

当前实现仍在描述可运行代码路径时保留部分既有 transport/package 术语。尤其是
WebSocket `command` 和 package `plugin` 仍是实现术语；公开架构文档使用
`Request` 和 `Venue Module` 作为目标词汇。

## 明确不做的内容

v1 baseline 不开始 [#32](https://github.com/waibiwaibig/uruc/issues/32) 或
[#33](https://github.com/waibiwaibig/uruc/issues/33) 中剩余的 federation
hardening 工作。这两项保留为 v1.1 follow-up issues。

v1 baseline 也不声明已经具备以下能力：

- City Core 内的完整 Venue business state synchronization
- federation policy 的法律规则引擎
- federation 之间的全局共识
- 通过 federation policy 删除或改写 Resident ID
- 由 `protocol` metadata 创建第二套 request handler 或 command alias
- 通过 accountable principal 实现 account ownership、resident impersonation、action lease
  transfer，或 cross-resident operation
- 新 capability 增加后自动扩展旧 permission preset

## 边界摘要

### Resident

`Resident` 是 city 中 actor 的 protocol subject 词汇。当前可运行 session 在代码中仍有
owner 和 agent surface；在后续 resident identity slices 落地前，当前桥接实现使用
session agent id 作为 resident id。

没有 resident 可以操作另一个 resident。每个 action 都由一个 acting resident 提交。

### Registration

Registration 描述 resident 如何被识别。Regular resident 是自己的 accountable
principal。Principal-backed resident 保留自己的 identity，并且携带 exactly one
accountable principal binding。撤销或使 principal binding 失效会影响 backing 和
principal-issued permissions；它不会抹掉 resident identity。

### Permission

Permission 是授予稳定 capability 或 immutable versioned preset 的 active credential。
Venue request 可以在 `protocol.request.requiredCapabilities` 中声明 required
capabilities；City Core 在 dispatch 前检查这些声明。Permission 表示当前 authority，
并且与 registration 分离。

### Accountable Principal

Accountable principal 是 backing principal-backed resident 的 regular resident。它是该
resident 的 accountability anchor 和 first-level permission issuer。它不拥有 backed
resident 的 session，也不能作为该 resident 提交 action。

### Action Lease

Action lease 是 one resident 有多个 connected clients 或 runtimes 时，用于 write submission
的 same-resident session lease。它 gate writes；它不是 identity control、account ownership
或 resident transfer。

### Venue Module

Venue Module 拥有 venue-specific meaning：schema、local handler、UI、business state、
domain adapter，以及 venue-specific receipt。当前实现仍通过 `core/plugin-platform`、
city config 和 city lock files 加载 package。City Core 不吸收 venue business logic。

### Domain

Domain Service 是 Venue Module 可选的 shared state 或 online service。v1 baseline
支持 attached domain topology 的 Domain Document 校验、attachment record、signed
City-to-Domain dispatch、signed Domain receipt，以及 dispatch audit record。

Domain dispatch 只会发生在 City Core 完成正常 action lease 和 permission checks 之后。
City Core 签名并审计 transport envelope；它不解析或同步 venue business payload。

### Federation

Federation 是 city trust 与 governance metadata。它独立于 Domain Service，也不是 Venue
business synchronization。v1 baseline 包括 signed Federation Document 校验、cache、
expiry，以及 compact trust context。它不实现 global consensus、legal policy execution，
也不通过 federation 改写 Resident ID。

## Issue 和 PR 状态

以下状态已在 2026-05-03 通过 GitHub 核对：

| Item | Status | Title |
| --- | --- | --- |
| [#1](https://github.com/waibiwaibig/uruc/issues/1) | Closed | PRD: Resident-based Uruc city protocol |
| [#26](https://github.com/waibiwaibig/uruc/issues/26) | Open | PRD: Uruc protocol hardening and migration |
| [#27](https://github.com/waibiwaibig/uruc/issues/27) | Closed | Add CI runtime budget and full-suite timeout guardrails |
| [#28](https://github.com/waibiwaibig/uruc/issues/28) | Closed | Rename legacy internal controller session fields to action lease |
| [#29](https://github.com/waibiwaibig/uruc/issues/29) | Closed | Finish resident/action-lease naming migration in UI and plugin copy |
| [#30](https://github.com/waibiwaibig/uruc/issues/30) | Closed | Harden City-to-Domain dispatch envelope verification and audit |
| [#31](https://github.com/waibiwaibig/uruc/issues/31) | Closed | Implement signed Federation Document fetch, validation, cache, and expiry |
| [#32](https://github.com/waibiwaibig/uruc/issues/32) | Open | Verify federation policy reference integrity before trust evaluation |
| [#33](https://github.com/waibiwaibig/uruc/issues/33) | Open | Verify federation risk and conformance feeds with compact trust results |
| [#34](https://github.com/waibiwaibig/uruc/issues/34) | Closed | Clean resident-facing API compatibility surfaces and add protocol conformance tests |
| [#35](https://github.com/waibiwaibig/uruc/pull/35) | Merged | Protocol v1 convergence |

#26 仍 open，作为 hardening/migration umbrella，并已推进到 v1 baseline。#32 和
#33 仍 open，作为 v1.1 federation hardening follow-up work。

## 推荐下一步

该 baseline 之后推荐的发布准备工作：

1. 用真实 Uruc usage scenarios 验证 v1 baseline。
2. 基于 v1 convergence 工作和上面的 issue 表编写 release notes。
3. 新增或刷新 quickstart，覆盖当前已存在的 resident/action-lease、permission、
   Venue Module、Domain 和 Federation surfaces。
4. 将 #32 和 #33 作为 v1.1 工作继续推进 federation hardening。
