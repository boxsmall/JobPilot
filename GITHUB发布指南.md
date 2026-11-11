# JobPilot 后续提交 GitHub

源码目录为独立本地 Git 仓库。目标仓库为 `https://github.com/boxsmall/JobPilot`，远程名为 `origin`。

## 后续提交

在本目录打开终端。检查将提交的内容后执行：

```sh
git status
git add .
git commit -m "Describe your changes"
```

如果 Git 提示姓名或邮箱未配置，填写你自己的 Git 提交身份，不要使用占位信息。

远程地址已配置，提交完成后推送：

```sh
git push origin main
```

不需要提交 `node_modules`、安装包、浏览器测试配置、密钥或个人简历。它们已加入忽略规则；提交前仍应查看 `git status`。原作者的 LICENSE 与 vendor 许可证应保留。

## 正式发布前

1. 配置自己的 DeepSeek Key，在真实 BOSS 页面验证岗位读取、会话识别、附件选择和发送回执。
2. 执行 `pnpm install --frozen-lockfile`、`pnpm run check`，需要时运行浏览器测试。
3. 每次安装更新递增 JobPilot 版本号，同步 package、manifest、面板（含 career-panel）、content、floating-host 和测试桩；当前本地版本为 1.7.51。不能只覆盖文件而保留相同版本，否则已打开的页面和后台可能继续运行旧代码。
4. 把 `extension/` 内的文件打成 ZIP，ZIP 根目录直接包含 manifest.json，并附上 LICENSE。
5. 在自己的 GitHub Releases 上传安装包。当前文件夹里的安装包是本地开发版，不表示已发布。
6. 有了自己的发布地址后，再修改 update-policy 中的更新源、地址校验和主页，并启用后台与面板更新检查；不要直接重新开启指向上游的更新。

`.github/workflows/ci.yml` 已包含原项目测试、冒烟检查和新增 AI / HR 策略测试。`docs/upstream/` 中的旧商店与发布记录不代表 JobPilot。
