# 54 · 完整源工程 GitHub 交付

2026-10-07 · 首次完整原资产源树已交付；完整游戏继续制作。

## 已验证交付

公开仓库 STmission/corporate-showdown 的 codex/source 分支，通过 85 个批次接收原始源码、配置、文档、Blender 和 GLB 资产。初始完整源快照来自本地 af5f2a2fe2ef8e1dccac2d6506f38dbf69f646f5，发布提交 60df26f8a6db066813c899a48f5ec9b0abb48560；完成时逐批远端 ref 核对，最终 tree 与源快照一致。过程与完整树记录为 artifacts/github-source-batches.json。

没有改成 LFS 指针，源资产仍为原字节；没有推送 Codex checkpoint refs、全量本地历史、凭据或缓存。首次单次 1.24 GiB 包被中断，改为约 16 MiB 分组；较大单文件单独发送。第 80 批 TLS 连接失败后重试成功，从已核验 ref 继续，未重传已确认的全部资产。最大文件约 78.7 MB，未超过 100 MiB。中间分支 README 明示上传未齐，完整树完成才恢复正式说明。

## 当前发布与检查

网页发行 codex/web-preview 与源工程 codex/source 分开管理。公开 Pages 试玩已更新至 0.6.18，进入、拾取、第一人称移动和退出实测通过；范围见 51／53 文档。后续将本轮 Cocos 0.3.14、代码和文档更新补推到源分支，并接通该分支的 GitHub Actions 检查／测试／构建／部署。自动流水线成功前不声称 GitHub CI 通过；现有 118 项完整回归为本地证据。

全目标尚未完成：写实人物与精细动作、完整内容、真机性能、账户／服务／支付、微信与 iOS 构建签名和发行验收继续推进。源码上传完成不等于游戏完成。
