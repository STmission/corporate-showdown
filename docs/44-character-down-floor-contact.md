# 44 · 十套人物倒地落地修正

2026-10-06 · 根工程 0.6.11 · Cocos 0.3.9 · characters-v0.11 · rules-0.6.2 · protocol 3

## 问题与决策

43 轮确认销售角色倒地穿地。核对动画制作脚本，Down 以固定 0.15 m 根骨骼高度旋转人物，没有考虑身体、头发和服装的实际落地轮廓。十套在用外观原动作最低点约 -0.119 至 -0.205 m。按实际蒙皮轮廓烘焙每套 Down 根骨骼位移，保留动作旋转、时长、身体尺寸、衣服、材质与既有空间。当前改动是落地修正，不能作为自然倒地动作或真实人体品质验收。沿用 11 文档的源／导出和实景门禁。

## 已实现与兼容

blender/ground_character_down.py 为十套外观生成 assets/characters/grounded-v1/ 中的独立 GLB 和可编辑、已打包 Blender 文件。manifest.json 记录原 GLB、原文件与导出 SHA256、生成脚本指纹、最低点、修正幅度、样本数和重开结果。来源保留：八套根角色中销售采用 refined-v2；医生／教师采用 professions-v1。原源文件及导出不改写。新 Blender 工程从修正 GLB 实际导入保存，原角色造型工程的关联通过 manifest 来源和此前各资产清单追踪；不是原 MPFB 工程原位编辑。

按 96 Hz 计算完整 Down 区间的蒙皮最低点，保持 2 mm 接触余量；换算到 Root 父节点局部坐标后，只新增 Root translation 输入／输出 accessor 并替换该 sampler。原 BIN 数据逐字节保留，几何、骨骼、蒙皮、贴图、材质、其余七动作、Down 的其他通道及动作时长不变。拒绝未支持的动态父节点和矩阵。重导入后在 192 Hz 检查，全十套最低点约 +1.94 mm。

根网页所有角色资源地址与 Cocos 同步工具转向 grounded-v1，保留导入身份及既有 Talk 派生流程。服务端玩法、角色位置、命中判定、伤害和协议不变；仅倒地角色的身体表现改变，BOSS 退场也会使用相应外观修正。characters-v0.11 区分新的动画资产。新增工作台行走、奔跑、攻击、受击、倒地、救援、技能预览；攻击／受击／倒地／技能单次播放并保持最终帧，选择站立恢复。原讲解／倾听／安抚保持循环。

## 验证和失败记录

第一次生成的男程序员导入验证仍穿地约 3.1 mm，因此没有使用该失败版本。检查实际导入关键帧发现：NLA strip 从帧 1 开始，action 数据从帧 0 开始；直接设 active action 后，采样不应再加一帧。修正时间换算并重新生成十套资产，严格门限不放宽。初次失败见 artifacts/down-grounding-initial-failure.log，实际关键帧依据见 down-grounding-import-times.log。

最终生成器实际 GLB 重导入、192 Hz 区间采样、十个 Blender 源文件重开均通过，见 manifest 和 artifacts/down-grounding-build.log。独立 Node／Three glTF 骨骼矩阵计算在每套五个时刻验证接触高度，避免仅复述 Blender 采样逻辑。新增测试逐字节核对原 BIN、原 accessors／bufferViews、节点、骨骼、材质、图像和其他动作；原数据保留通过。完整 107 项回归通过；新增独立蒙皮计算后，最终完整 108 项回归再次通过，见 artifacts/down-grounding-final-regression.log；两项资产专项测试见 artifacts/down-grounding-independent-skin.log。npm run check、严格 Cocos 类型、同步和资产审计通过。

实际网页工作台男程序员／女医生倒地停留以及恢复站立已检查，证据 artifacts/down-grounding-studio-male.png、down-grounding-studio-doctor.png。这是工作台动作预览，不是战斗中实际受击倒地验证。游戏 0.1 s 动作交叉渐变、台阶／斜面和碰撞导致的邻近家具穿插尚未完成全姿势验收；校正目标是角色所在平面，不包含家具接触求解。

十套独立 Blender 源工程的倒地落地图已实际渲染并查看，见 assets/characters/grounded-v1/down-contact-sheet.png。最终 Web／微信构建、11 模型／54 图像导入审计及源码指纹通过，见 artifacts/down-grounding-build-verification.json；两端编译产物的输入／剧情／近墙检查通过。

进一步使用安装的 Cocos 官方 CCON 解码器读取十套实际导入的 Down 曲线，再以独立蒙皮矩阵计算 145 个时刻。尽管 importer sample 设置为 30，Root 修正通道实际保留 73 个关键点；最低点 +1.93 至 +1.94 mm，最大离地约 6.89 mm，通过当前平面落地门限。工具 platform/cocos/tools/verify-down-import.mjs，结果 artifacts/down-grounding-cocos-curves.json/log。该检查仍不包含游戏动作交叉渐变或设备渲染。

最新 Cocos Web 实际单人进入，七个角色正常加载并返回大厅，status=home、actors=0、room 为空；见 artifacts/down-grounding-cocos-loaded.json／home.json。本次没有战斗中实际 Down 镜头证据，不用工作台或编译曲线冒充该验收。

## 尚未完成

自然跌倒／起身、战斗与专用枪械握持、脸部表情口型、其他职业、后续剧情、双端真机性能与发行仍未完成。源材质保留意味着其他九套外观的眼睛／头发问题并未在本轮处理。M0—M6 总目标继续执行。
