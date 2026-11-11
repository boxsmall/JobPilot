# JobPilot 开发约定

本仓库是独立的 AutoCast 衍生项目。当前用户指令优先；`docs/upstream/` 中的旧路径、旧批准和发布状态仅为历史来源，不适用于本机。

- 在功能分支或 dev 分支开发，保留 MIT 许可证和上游署名。
- 不提交密钥、Cookie、真实简历、浏览器配置目录、node_modules 或本地安装包。
- 使用 `pnpm run check` 验证；涉及界面、解析器或消息操作时运行 `pnpm test:career:browser`。
- 真实投递、联系招聘者、创建远程仓库或推送，须有用户对相应操作的授权。
- 未配置 JobPilot 自己的更新源前保持上游更新关闭。
- 正式发布时同步 package、manifest、面板、content、floating-host 和测试桩中的版本号；参考本项目发布指南。
