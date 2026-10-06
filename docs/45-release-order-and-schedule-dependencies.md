# 45 · 发布顺序、GitHub 与工期依赖

2026-10-06 · 最新用户确认：先发布网页可玩版到 GitHub，再继续剩余微信、iOS 与完整制作。此指令覆盖之前等待双端验收后发布的顺序。

## 发布授权与顺序

目标账号为 STmission，已验证本机 GitHub CLI 登录匹配。先发布公共仓库 STmission/corporate-showdown 与 GitHub Pages 单人网页试玩。Pages 运行独立 Worker 单人沙盒，复用规则、剧情、碰撞与命令幂等；不运行在线奖励、支付或云存档。原 Node 权威服务及合作协议保留，后续正式联机继续由服务器裁决。发布实现与证据见 51 文档。

网页分享不代表完整游戏、微信／iOS 真机或商店发行验收。M0—M6 的剩余内容、美术、双端、账户及服务工作继续推进。

## 工期证据与尚缺信息

现有根工程 0.6.17，Cocos 0.3.13。第一人称前臂已接入两条客户端；Cocos 实际编辑器构建与手腕校正已验证，武器材质属性已修正，当前版本重建与实景复核在进行。这些不是双端成品。人物真实感、表情口型、自然战斗动作、更多职业／剧情、真实触控与性能、账户存档、支付权益和发行仍未完成。既有验证见 12、29、43、44 文档。

本机 xcode-select 指向 /Library/Developer/CommandLineTools，xcrun 找不到 xcodebuild；因此当前没有完整 Xcode 的编译／签名门禁。既有 iOS 导出不证明 iOS 原生编译或真机运行。用户确认仅有部分平台条件，具体已有项尚待逐项确认：Apple 开发者账号／证书、微信主体／正式 AppID 和测试机；平台审核时长也无法由开发端保证。

GitHub 账号不是游戏服务器。游戏依赖 Node 权威模拟与 /socket WebSocket；GitHub Pages 静态托管不能独立提供该后端。服务器／部署平台、地区和费用预算尚未确定；本次先用 Pages 静态单人试玩满足分享。Docker CLI 存在，daemon 可响应，但未据此对外部署。

源码资产约 1.1 GiB，Cocos 可编辑资源约 78 MiB。本机未装 Git LFS。当次实际 Git 候选文件检查为 644 文件、1,222,869,035 字节，当次没有单个文件超过 100 MiB，最大约 78.7 MB；见 artifacts/github-source-size-audit.json。不能把“需要检查大文件”写成“当前已有超限文件”。新增资产后需重新统计，发布前决定源资产版本管理／备份和可重建发行包，LFS 是否采用根据实际存储方案决定。

以上条件下，准确完成日期目前无法由证据证明。不得把随意日期、未来执行承诺或平台审核目标写成确定交付。下一次排期需要明确双端首发内容清单、最低测试机、账号／签名能力与服务器方案，再以实际纵向切片和设备验证耗时估算研发工期；研发结束、朋友测试可用和商店审核通过分别记录。

## 公开依据

- GitHub Pages 为静态托管：https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- GitHub 普通 Git 文件超过 100 MiB 会被拒绝，需要 LFS 等大文件方案：https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github

这不是完成报告；正式日期待依赖与设备验证后制定。全项目目标继续执行，未暂停、未完成、未创建新周期调度。

本轮完整源工程候选检查为 760 文件、1,433,444,620 字节，无单文件超过 100 MiB；此前 644 文件为历史检查。网页发行包已公开并验证可玩。codex/source 分支先建立上传准备节点，完整源树实际推送成功后再记为已上传。
