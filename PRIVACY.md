# 隐私说明 / Privacy

适用版本：0.2.0。更新日期：2026-11-02。

## 本地数据

项目、任务、财务、清单、习惯、灵感及设置写入当前知识库实际配置目录中的 `plugins/feifan-life/data.json`；自动备份在同目录 `backups/`。复盘写入用户选择的知识库目录，任务镜像只在主动同步时生成。

插件没有自己的账户、遥测、崩溃上传、广告服务、支付或 AI 服务。不自动搜索其他插件的运行数据，不上传笔记、任务或账目。Obsidian Sync、第三方同步及系统备份如何处理本地文件，取决于用户自己的设置与对应服务。

## 可选天气请求

天气默认关闭。用户启用并填写城市后：

| 接收方 | 发送内容 | 用途 |
|---|---|---|
| `geocoding-api.open-meteo.com` | 城市查询文字、语言及结果数量 | 查找城市坐标 |
| `api.open-meteo.com` | 城市坐标、天气字段及预报天数 | 获取天气 |

服务方在网络连接时也会接收到 IP 地址及常规请求信息。解析后的城市与坐标、天气结果可保存在本地插件数据中。关闭天气后停止后续主动天气请求；已经发出的网络请求无法撤回，也不会自动清除服务方日志。当前并不提供一键擦除服务方数据的能力。

服务方的数据处理与保留由其 [隐私与条款](https://open-meteo.com/en/terms) 说明。其免费 API 有非商业使用限制；收费版本上线前必须另行解决商业许可与调用方式，不能把商业密钥放在公开客户端。

## 图片、链接与反馈

三个内置背景已嵌入插件，显示时不联网。自定义背景从当前知识库内读取。用户主动打开项目文档、图片来源或 GitHub 链接时，浏览器将连接相应网站。

GitHub Issues 是公开讨论区。请勿上传个人账目、笔记、配置、备份或令牌。问题模板仅请求复现所需的版本和操作信息，不要求提供完整知识库。

## 导出与删除

用户可复制、备份或导出自己的数据。禁用插件不会删除数据；删除插件目录会连同其中的主数据和备份一起删除。知识库内普通复盘和镜像文件需由用户管理。

## Future services

This version has no account, payment, AI gateway or telemetry. Future network services require a separate disclosure of the recipient, data sent, purpose and retention before use. The public issue tracker must not be used to upload private vault data.
