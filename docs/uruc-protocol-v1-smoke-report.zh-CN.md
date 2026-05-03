[English](uruc-protocol-v1-smoke-report.md) | [中文](uruc-protocol-v1-smoke-report.zh-CN.md)

# Uruc Protocol v1 Smoke 验证报告

验证日期：2026-05-03（Asia/Shanghai）

验证 base commit：`5e8160feb907c366cde7d23cbb9d407094861d38`

工作分支：`codex/protocol-v1-smoke-report`

本文记录 PR #36 合并 protocol status 文档之后，对 Uruc Protocol v1 baseline
做的一次 bounded smoke 验证。验证使用已有 targeted tests 和已有 smoke script。本文没有开始
#32 或 #33 中仍 open 的 federation hardening 工作。

## 已运行检查

| Check | Result |
| --- | --- |
| `npm run test --workspace=@uruc/server -- src/core/server/__tests__/ws-gateway-action-lease.test.ts src/core/server/__tests__/ws-gateway-permission.test.ts src/core/domain/__tests__/domain-attachment.test.ts src/core/domain/__tests__/domain-dispatch.test.ts src/core/federation/__tests__/federation-policy.test.ts src/core/protocol/__tests__/protocol-conformance.test.ts` | 通过：6 个文件，54 个 tests |
| `npm run uruc:smoke` | 通过 |
| `npm run check:bounded` | 通过；运行中发现并修复了 server package 并发 build 共享 `dist` 的竞态，修复位置是 `packages/server/scripts/build-package.mjs` |
| `npm run docs:check` | 通过 |
| `git diff --check` | 通过 |

## 验证项目

### Resident Session 和进入城市

由 `ws-gateway-action-lease.test.ts` 和 `ws-gateway-permission.test.ts` 覆盖。

测试会认证 regular、shadow 和 principal-backed resident sessions，然后执行
`enter_city`。已验证的返回形态是 WebSocket `result` receipt；同时覆盖了现有 regular
agent 和 shadow resident city commands 在没有 venue capability metadata 时仍可运行。

### Action Lease

由 `ws-gateway-action-lease.test.ts` 覆盖。

测试验证 first write command 会自动取得 same-resident action lease；第二个
same-resident writer 会以 `ACTION_LEASE_HELD` 被拒绝，并指向
`acquire_action_lease`。测试还覆盖 lease recovery、previous-holder notification、
read-only command behavior、command discovery、非 holder release rejection，以及带有
`citytime` 的 replacement push。

### Permission Credential 和 Permission-Required Receipt

由 `ws-gateway-permission.test.ts` 覆盖。

测试验证 shadow 和 regular resident sessions 的 active city-issued credentials、
approved capability dispatch、principal-backed approval dispatch、expired approval
rejection，以及 approval-forbidden denial。缺失 capability 时会在 venue dispatch 前被拦截，
并返回 compact error receipt，包含稳定的 `code`、`text`、`nextAction` 和
`details`，包括 `PERMISSION_REQUIRED` with `nextAction: require_approval`，以及
`PERMISSION_DENIED` with `nextAction: deny`。

### Local Venue Module Request

由 `domain-dispatch.test.ts` 和 `ws-gateway-permission.test.ts` 覆盖。

local topology fixture 注册 `acme.local.echo@v1`，执行 request，确认 local handler
被调用一次，返回 compact `result` payload `{ local: true }`，并且没有写入 domain
dispatch audit rows。permission fixture requests 也验证了带 required capabilities 和不带
required capabilities 的 local venue dispatch。

### Domain Topology、Attachment 和 Signed Dispatch

由 `domain-attachment.test.ts` 和 `domain-dispatch.test.ts` 覆盖。

测试验证 Domain Document validation、attachment receipt storage、City Core 完成 permission
checks 之后的 attached domain dispatch、signed City-to-Domain envelope、signed Domain
receipt verification、semantic receipt mismatch rejection、failed receipt auditing，以及
local-topology boundary。本次 smoke 没有临时发明新的 domain system，也没有访问 live external
Domain Service。

### Audit、Receipt、Error Code 和 NextAction 形态

由 `ws-gateway-action-lease.test.ts`、`ws-gateway-permission.test.ts`、
`domain-dispatch.test.ts` 和 `protocol-conformance.test.ts` 覆盖。

targeted tests 验证 stable action-lease codes、permission-required 和 permission-denied
receipts、compact domain dispatch success/failure receipts、domain dispatch audit rows、
protocol conformance checks，以及当前 `nextAction` migration shape。

### Federation

由 `federation-policy.test.ts` 和 `protocol-conformance.test.ts` 覆盖。

没有运行 live federation network verification。当前 smoke 边界是现有 parser、signature
validation、bounded fetch/cache diagnostics、expiry、trust-policy、policy-ref、feed-entry、
risk 和 conformance tests。测试也验证 federation policy results 可以附加到 verification
output，而不会删除或改写 resident identity。

## Live 验证边界

- 未执行 live federation network verification。
- 未使用真实部署的 Uruc instance。
- 未为 #32 或 #33 创建新的 fixture system。
- `npm run uruc:smoke` 验证 local quickstart configuration preservation、bounded server
  startup、health、doctor plugin checks 和 shutdown。它本身不执行 `enter_city`；
  city-entry behavior 由上面列出的 targeted WebSocket tests 覆盖。

## Follow-Up

- #32：verify federation policy reference integrity before trust evaluation。
- #33：verify federation risk and conformance feeds with compact trust results。
- v1 release candidate 部署后，运行真实部署 smoke。
