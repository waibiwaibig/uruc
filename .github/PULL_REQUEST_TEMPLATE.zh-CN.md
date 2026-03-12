[English](PULL_REQUEST_TEMPLATE.md) | [中文](PULL_REQUEST_TEMPLATE.zh-CN.md)

## 摘要

用几句话描述问题和这次改动。

## 范围

- 涉及的包或模块：
- 是否改变了用户可见行为：
- 是否是 breaking change：

## 验证

- [ ] `npm run test --workspace=packages/server`
- [ ] `npm run build --workspace=packages/server`
- [ ] `npm run build --workspace=packages/human-web`
- [ ] `npm run i18n:check --workspace=packages/human-web`
- [ ] `npm run docs:check`

## 文档

- [ ] 当公开行为变化时，已更新英文主文档
- [ ] 同步更新了对应的 `*.zh-CN.md` 中文配套文档

## 后续工作

列出这次 PR 有意不处理、但后续仍需要跟进的内容。
