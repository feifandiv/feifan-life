# GitHub 仓库与发布配置

更新日期：2026-11-02。账号 `feifandiv`，私有准备仓库 `feifan-life` 已创建，本地 main 与 origin 已配置，GPL-3.0-only 已应用。源码推送及 Actions 验收进展见 [发布状态](开源许可与发布状态.md)。

## 两个工程

| 工程 | 建议仓库 | 可见性 | 内容 |
|---|---|---|---|
| Obsidian 客户端 | `feifan-life` | 准备期间 Private，审核后 Public | 插件源码、图片与署名、构建配置、测试、说明文档 |
| 商业服务 | `feifan-life-service` | Private | 订单校验、授权签发、产品账号、AI 网关、积分账本 |

购买链接和客户端授权验证代码可以公开；支付密钥、授权私钥、模型密钥、用户订单及积分数据不能进入公开仓库。私有仓库也不提交生产密钥，部署时通过服务平台的秘密管理注入。

## 首次建立仓库

1. 在 GitHub 创建空的 `feifan-life` 仓库，先选 Private。不要在 GitHub 额外初始化 README、`.gitignore` 或 LICENSE，避免与本工程冲突。
2. 根目录已有作者选定的 GNU GPL v3 正式 `LICENSE`，项目自有代码以 Feifan 署名；复核第三方声明与贡献来源。
3. 审阅所有拟提交内容及 Git 历史，确认仅为本产品工程。`.gitignore` 已排除运行数据、备份、环境文件、构建目录和 Obsidian 配置。
4. 只在本工程根目录初始化 Git，添加远程并推送 `main`。不要在个人知识库根目录执行全量 `git add`。
5. 在 Actions 中运行 CI，确认通过。再打开仓库 Settings → General → Change repository visibility，按准备清单完成后改为 Public。

以下命令假设目标 GitHub 空仓库已经建立、当前目录为本产品工程，且已配置本人的 Git 提交身份和 GitHub 登录。已有本地 Git 仓库时跳过 init；已有 origin 时先核对，不重复添加：

```sh
git init -b main
git add .
git diff --cached --stat
git diff --cached
git commit -m "Prepare public Feifan Life client"
git remote add origin https://github.com/feifandiv/feifan-life.git
git push -u origin main
```

## 仓库设置

| 位置 | 建议设置 |
|---|---|
| Settings → Actions → General | 限定使用 GitHub 官方 Actions；默认 Workflow permissions 设为 Read repository contents；发布任务在 YAML 中单独声明写权限 |
| Settings → Rules → Rulesets | 条件支持时保护 `main`：禁止强制推送和删除，合并前要求 CI 的 `verify` 通过。私人仓库的可用保护能力取决于 GitHub 计划 |
| Settings → General → Features | 启用 Issues；Discussions 可用于用户问答和产品路线 |
| Settings → Security | 启用依赖告警、可用的密钥扫描和私密漏洞报告。具体可用项以仓库计划为准 |
| About | 写明用途、安装入口、网站和支持语言；不要把购买页放进只用于捐赠的 `fundingUrl` |

## 已提供的工作流

- `.github/workflows/ci.yml`：`main` 推送、PR 和手动触发时，安装锁定依赖并执行类型、测试、构建和本地隐私模式检查。普通 PR 不需要写权限或业务密钥。
- `.github/workflows/release.yml`：仅从 `main` 手动运行，检查 LICENSE、第三方声明、版本一致性及现有版本 tag 对应提交，再创建 GitHub Release **草稿**。
- Actions 固定到核对过的官方 commit。依赖和 Actions 版本升级仍需审阅。

发布草稿不会自动向用户发布，也不会提交 Obsidian 目录。仍需人工核对资产和说明后发布。

## 发布一个版本

1. 更新 `manifest.json` 与 `package.json` 的相同版本，按需同步锁文件；版本使用 `x.y.z`。
2. 通过测试和实机验收，合并到 `main`。
3. 在该提交创建同名 tag，例如版本 `0.2.0` 对应 tag `0.2.0`，推送到 GitHub。
4. 在 Actions → Draft Release → Run workflow 中选择 `main`。工作流要求 tag 正好指向所选提交。
5. 在 Releases 中审阅草稿、截图和变更记录，核对 `main.js`、`manifest.json`、`styles.css` 三个附件后再发布。背景图片已嵌入 `main.js`，无需额外安装资产目录。
6. 按届时官方要求在 Obsidian Community 开发者后台关联 GitHub 仓库并提交目录。

## 不应放进仓库的内容

作者或用户的笔记、任务、账目、插件 `data.json`、备份、导出的订单、生产环境配置、支付回调秘密、私钥、模型 API 密钥。公开问题中也应提示用户先脱敏。截图使用 [合成数据展示](screenshots/README.md)，不得用个人工作台历史截图替代。

收费接入参见 [产品权益与授权边界](产品权益与授权边界.md)。当前尚未实现支付和授权后端。

## 官方依据

- [GitHub Actions 权限](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)
- [GitHub 仓库可见性](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [Obsidian 提交插件](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
- [Obsidian 开发者政策](https://docs.obsidian.md/community-directory/developer-policies)
