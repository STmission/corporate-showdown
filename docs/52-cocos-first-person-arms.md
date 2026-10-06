# 52 · Cocos 第一人称前臂与武器材质

2026-10-06 · Cocos 0.3.13 · 根网页 0.6.17

## 修改理由与兼容范围

接入十套独立男女／职业前臂资源，保留原始 Blender、GLB 和导出关联。source-assets.json 与 asset-identities.json 记录 21 个模型（原 11 个加 10 个前臂）和 54 张共享图片；原资源 UUID 与既有场景引用继续受导入合同约束。EngineFirstPerson 使用实际蒙皮 Prefab、既有动作及 hand_r socket，第三人称、交谈和退出时隐藏或销毁对应前臂。布局、服务器规则、命中和换装数值不变。

初始持握动作在注册 socket 后采样 0.1 秒，避免 baked animation 第一帧缓存未更新挂点。右腕校正到相机局部 (0.13, -0.28, -0.50) 米，再用持握姿势计算一次挂点基变换；后续骨骼动画仍可驱动武器。此前实际 Cocos Web 进入、拾取及射击扣弹已验证，校准记录见 artifacts/first-person-cocos-calibration-proof.json；对应真实编辑器 Web 与微信构建已完成（0.3.12 阶段），不代表手机实测。

实景发现枪械发白。Cocos Creator 3.8.8 的 builtin-standard.effect 把公开 mainColor 属性映射到内部 albedo uniform，原 EngineWeapons 写 albedo 因而未正确应用颜色。本次统一通过 mainColor 设置标准／无光照材质，保留金属度、粗糙度和共享武器部件。来源是本机精确版本编辑器的引擎效果文件；不更换模型或照搬其他引擎属性。

## 当前验证状态

npm run check 通过，Cocos strict TypeScript 无输出退出 0；117 项完整回归通过（412.864 秒）。0.3.13 实际编辑器 Web 重建成功，退出码 36，导入和 PNG 优化门禁通过。浏览器实际进入、拾取并切换第一人称，枪械呈现原定义的深色材质，射击弹药 12/48→11/48，菜单退出回到已连接大厅；画面证据为 artifacts/cocos-weapon-material-fixed.png。微信实际编辑器重建也成功，退出码 36，导入及 PNG 优化通过；deviceValidated=false、signed=false，仍未记为设备或发行通过。

独立前臂不是最终写实人物：手指闭合、空手、专用换弹／瞄准／行走、近墙深度和更多俯仰画面仍未完成；无微信／iOS 真机、签名或上架验收。50 文档为较早的根网页阶段记录，当前 Cocos 进展以本记录为准。
