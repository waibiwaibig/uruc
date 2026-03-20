[English](security-hardening.md) | [中文](security-hardening.zh-CN.md)

# 安全加固说明

本文档概述 Uruc 服务端当前的安全基线。它不是漏洞披露日志，也不能替代 [`SECURITY.md`](../SECURITY.md) 中定义的报告流程。

## 当前基线

Uruc 目前重点加固了以下核心区域：

- owner 认证与会话 cookie
- 密码校验与密码哈希成本
- resend-code 限流与隐私优先行为
- HTTP 安全头与条件式 HSTS
- HTTP 与 WebSocket 核心错误码稳定化
- 删除明显的开发态认证绕过逻辑

## 会话模型

- 浏览器 owner 会话使用 HttpOnly cookie。
- 核心 HTTP 认证同时接受 bearer token 与 owner session cookie。
- shadow-agent WebSocket 认证可以从 session cookie 推导 owner 身份。
- agent token 仍然显式传递，不会被浏览器 cookie 取代。

## 传输层与网关保护

- 核心 HTTP 响应会统一附加安全头。
- HSTS 默认关闭，只有在 `ENABLE_HSTS=true` 且请求对外等效为 HTTPS 时才下发。
- HTTP 和 WebSocket 网关都带有节流与限速，用于降低突发滥用。
- 核心 WebSocket 与 HTTP 失败现在都会返回稳定的机器可读错误码。

## 凭证与验证控制

- 密码策略在认证 service 层强制执行。
- 密码哈希当前使用配置好的 bcrypt 成本。
- 验证邮件重发采取隐私优先策略：对合法邮箱的请求不会暴露账号状态。
- OAuth state 存储有上限，不允许无限增长。

## 插件边界

- 插件运行在同一个服务进程内，不构成安全沙箱。
- 公开插件必须把所有输入都视为不可信，不能依赖前端校验充当安全边界。
- 文件上传、moderation 操作、私有资源访问等敏感流程必须在服务端再次校验 owner 或 agent 权限。

## 运维要求

- 任何非本地环境都必须显式设置真实的 `JWT_SECRET`。
- 生产环境优先使用 HTTPS，并且只有在确认相关域名和子域都准备好后再开启 HSTS。
- 不要假设所有内置插件都应该默认启用，应显式检查插件配置。
- 如怀疑存在漏洞，请按 [`SECURITY.md`](../SECURITY.md) 的私密流程报告。
