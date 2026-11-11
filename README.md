# 职航 JobPilot

项目仓库：[boxsmall/JobPilot](https://github.com/boxsmall/JobPilot)

一个基于 AutoCast 的本地 Chrome / Edge 求职助手，将简历解析、AI 岗位匹配、投递与 HR 消息处理放到同一个扩展中。

> 当前为本地开发版。已完成自动化与隔离浏览器测试；真实招聘平台兼容性、真实模型调用与账号投递仍需配置后验证。

## 功能

- 本地解析 PDF、DOCX（含表格）、TXT 和 Markdown 简历。
- 默认支持 DeepSeek，也可配置其他兼容 Chat Completions 的 HTTPS 服务。
- 技能、经历、薪资、发展四维评分，展示依据、差距和推荐报告。
- 沿用 AutoCast 的筛选、去重、批量、定时和目标投递；可设置 AI 最低匹配分。
- HR 索要简历后发送指定附件；简单事实问题使用本人确认的信息回复。
- 薪资、到岗、面试等问题生成待确认草稿，回执不明时不自动重发。
- 求职日报、推荐报告预览与 Markdown 导出。

## 安装

下载本项目的本地安装包并解压；在 Chrome / Edge 扩展管理页开启开发者模式，加载直接包含 `manifest.json` 的文件夹。

从源码安装时加载本仓库的 `extension/` 目录。若原版 AutoCast 同时启用，请先停用原版，避免两个扩展操作同一页面。点击扩展图标中的「打开 AI 求职设置」，导入简历并配置你自己的 API Key。

详见 [使用说明](使用说明.md) 和 [隐私说明](PRIVACY.md)。本项目尚未上架商店，也尚未配置自己的 GitHub 更新源。

## 开发

```sh
pnpm install --frozen-lockfile
pnpm run check
# 浏览器检查（使用模拟消息和模型响应，不联系真实招聘者）
pnpm exec playwright install chromium
pnpm run test:career:browser
```

扩展已包含本地解析器。更新依赖后可执行 `pnpm vendor:career` 重新打包解析器。

## 目录

- `extension/`：可加载扩展，包括投递、AI 服务、聊天适配和面板。
- `scripts/`、`tests/`：原项目回归测试、新增策略测试和浏览器测试。
- `docs/upstream/`：保留的上游项目说明，作为来源记录；其中商店链接、发布状态不代表 JobPilot。
- `LICENSE`：保留的 MIT 许可与原作者署名。
- `GITHUB发布指南.md`：后续提交、配置远程仓库与发布步骤。

当前本地开发版本为 `1.7.51`，界面、内容脚本和后台统一版本并校验 AI 详情协议。升级后重新加载扩展，再刷新 BOSS 职位窗口；已打开页面的旧详情脚本会在诊断时检测并更新。JobPilot 尚未发布正式版本。

AI 评分通过普通职位页面读取完整正文，核对岗位链接、ID 和标题后才交给模型；不再由评分或扫描预览自行请求职位详情接口。评分会复用一个临时详情页，结束后关闭；网站要求登录或安全验证时保留该页，需本人完成。已成功取得的评分会保留，模型结构不完整时只重新请求一次。

1.7.49 同时处理列表“出差”后缀与详情标题的差异、网站加载过渡页自行返回职位的过程，以及 AI 回复 JSON 语法错误的一次重试。网站加载过渡期间不会提取内容作为 JD，也不会自动完成需要本人处理的验证。

1.7.51 修复旧扫描器省略职位链接末尾 `~` 时的身份校验，保留网站原始链接；规范化“职 位描述”等标题空格，并允许已标明职位描述的真实短正文。仍拒绝加载占位符、空正文、其他岗位和公司介绍。

1.7.50 兼容已核实的“双休”“五险一金”“包吃住”列表福利后缀，仍严格核对岗位 ID，且不会删掉“广告投放方向”等实际职位方向。新增“补全未评分岗位”：保留资料未变的有效评分，只补未完成或资料已变化的岗位。

单个岗位描述不完整、标题无法核对或 AI 输出仍不合格时，记录该岗位失败并继续下一岗；登录、安全验证或连续系统调用故障才会暂停批次。没有有效依据的岗位不会生成分数。

## 来源与许可

JobPilot 基于 [gstranded/autocast-boss-assistant](https://github.com/gstranded/autocast-boss-assistant)，基线提交 `82601b1f7545199f5d941ba5bd0cc54941065789`，遵循 MIT 许可并保留原版权。

简历评分和消息日报的功能范围分别参考 [JobSearch-Agent](https://github.com/jiangrui06/JobSearch-Agent) 与 [job-auto-apply](https://github.com/Followmyself/job-auto-apply)。未复制这两个项目的源代码、提示词或资源，新增功能独立实现。PDF.js 与 Mammoth 的许可证位于 `extension/vendor/`。
