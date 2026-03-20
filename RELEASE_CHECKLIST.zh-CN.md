[English](RELEASE_CHECKLIST.md) | [中文](RELEASE_CHECKLIST.zh-CN.md)

# 公开发布检查清单

在把新的公开变更 push 到 GitHub 仓库之前，先过一遍这份清单。

## 仓库卫生

- 确认 `git status --short` 是干净的，或者只包含这次发布有意提交的改动。
- 确认本地 `.env`、数据库、上传目录、日志、`.uruc` 和构建产物没有被 git 跟踪。
- 确认示例配置只放在 `*.example` 文件里。

## 许可证与声明

- 保留根目录 [`LICENSE`](LICENSE) 文件，并确保其中是完整的 Apache License 2.0 文本。
- 保留根目录 [`NOTICE`](NOTICE) 文件，并确保其内容与仓库实际公开内容一致。
- 确认公开包元数据里声明的 license 与 Apache-2.0 保持一致。
- 如果你准备分发容器、预构建二进制或其他打包产物，重新检查第三方许可证义务。

## 公开治理文档

- 确认 [`README.zh-CN.md`](README.zh-CN.md) 对仓库的描述仍然准确。
- 确认 [`CONTRIBUTING.zh-CN.md`](CONTRIBUTING.zh-CN.md) 反映当前公开协作流程。
- 确认 [`SECURITY.zh-CN.md`](SECURITY.zh-CN.md) 指向真实可达的私密安全报告联系方式。
- 确认 [`CODE_OF_CONDUCT.zh-CN.md`](CODE_OF_CONDUCT.zh-CN.md) 指向真实可达的行为准则执行联系方式。
- 确认 [`THIRD_PARTY_LICENSES.zh-CN.md`](THIRD_PARTY_LICENSES.zh-CN.md) 仍然符合当前仓库分发方式。

## 验证命令

运行：

```bash
npm run docs:check
npm run i18n:check --workspace=packages/human-web
```

如果是较大的公开变更，建议额外运行：

```bash
npm run test --workspace=packages/server
npm run test --workspace=packages/human-web
npm run build --workspace=packages/server
npm run build --workspace=packages/human-web
```

## GitHub 就绪项

- 确认仓库简介、topics 和可见性就是你准备公开的状态。
- 确认 issue 和 pull request 设置符合你希望外部贡献者参与的方式。
- 如果你启用了 GitHub 私密漏洞报告或安全公告功能，记得让 [`SECURITY.md`](SECURITY.md) 与之保持一致。

## 最后复核

- 最后再看一遍 diff。
- 确认每一条新的公开表述都基于事实。
- 只有在面向发布的文档和验证结果都与仓库现状一致时再 push。
