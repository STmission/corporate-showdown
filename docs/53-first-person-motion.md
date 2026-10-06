# 53 · 第一人称持枪移动动作

2026-10-07 · 根网页 0.6.18／Cocos 0.3.14

## 原因与兼容

两条前臂运行时曾固定把速度 0 传给动作选择器，导致虽有 PistolWalk／Run 和 RifleWalk／Run 资源，第一人称移动仍只播放持握。改由客户端 MotionPace 采样本地渲染姿态（包含移动预测），用 0.08 秒平滑速度选择既有持枪移动动作并调整播放速度。

首帧、切换玩家、隐藏视角、无效时间步、后台长间隔重置采样；超过 12 米／秒的单次位移视为纠正／跳变，不用作奔跑动作。静止后回落到持握。此模块只用于表现，不提供可信移动、伤害或战斗结果；服务器协议、人物数值、场景和原始模型均不变。

Cocos 通过 canonical 源指纹同步同一模块。根网页资源路由新增 client/motion-pace.mjs；Pages 构建改写 ../client 与 ../shared 导入，保持仓库子路径。首次完整回归发现 Pages 路径逸出，修正后独立路径测试和最终完整回归通过。严格 TypeScript 发现速度成员初始化的推断问题，明确构造初始化后重新核验通过。

## 验证状态

最终 npm run check 和 118 项完整回归通过（93.134 秒），严格 TypeScript 无输出退出 0。真实十套 GLB 测试保留骨骼／网格／动画并验证 PistolWalk、RifleRun、射击优先级和释放；MotionPace 单测验证停步、跳变、切换玩家、隐藏和时间步恢复。原始 GLB 解码测试不代表贴图美术质量完成。

本地压缩静态试玩实际进入、拾取手枪、切换第一人称并通过键盘移动；DOM 实际诊断显示 visible=true、PistolWalk、pistol。证据 artifacts/first-person-motion-web-proof.json／first-person-motion-web.png。87 文件发行包复用既有 31 个模型派生包，仅修改运行代码和资源清单，约 43.3 MB。网页更新已推送到 codex/web-preview（866b25908e4bb07b0e7bf3333f1b16471fc405c6），Pages 构建 built 且无错误，新模块公网 HTTP 200、text/javascript。公网浏览器已实际进入、拾取、切换第一人称、移动并返回大厅；运行诊断 PistolWalk、visible=true，证据 artifacts/first-person-motion-public-proof.json／first-person-motion-public.png。

Cocos Web 与微信当前源实际重建均成功，导入／PNG 门禁通过，构建记录的 EngineFirstPerson 哈希与当前源码一致。Cocos Web 实际进入、拾取并切换第一人称，移动后 DOM 诊断显示 PistolRun、visible=true；证据 artifacts/first-person-motion-cocos-proof.json／first-person-motion-cocos.png。它们不等于微信／iOS 真机或发行验收。

## 剩余

这里使用现有从完整人物派生的动作，尚缺专用第一人称空手、自然握指、瞄准和换弹，以及各武器姿态／近墙与设备性能检查。完整人物品质、更多剧情与后端／双端发行目标继续。完整源工程正分批上传，不以部分分支宣称完整源树已交付。
