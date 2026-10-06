# 48 · 持枪动作资源与运行时接入

2026-10-06 · 根工程 0.6.13 · Cocos 0.3.11 · characters-v0.12 · rules-0.6.2 · protocol 3

## 问题、兼容性与实现

47 文档的独立枪械动作尚未用于游戏。本轮生成 assets/characters/weapon-ready-v1 十套导出，每套追加 PistolHold／Shot／Walk／Run 和 RifleHold／Shot／Walk／Run。保留源 grounded-v1 全部原字节、模型、材料、绑定和八个基础动作。原 Blender 源文件以及独立动作银行／动作 Blender 源文件通过 manifest 关联；没有覆盖原美术文件。角色版本升级用于既有资源版本校验。

blender/retarget_weapon_poses.py 按目标／源骨骼绑定旋转计算相对旋转。移动动作保留原本根节点、腿部与躯干，替换双侧锁骨下的手臂／手部旋转为持握姿势。当前手枪使用 Pistol，冲锋枪、步枪、狙击枪、霰弹枪、机关枪使用共用 Rifle 姿势；并未完成各枪尺寸的精细左手、枪托贴合。

共享动画选择依据实际装备与服务器攻击窗口选择持握／射击／行走／奔跑。倒地、受击、技能、救援和交谈的优先级保留；无武器动作资源时回退既有动作，锤子／剪刀仍用原近战动作。两端接入新资源；网页动画控制器注册可循环持握／移动和单次射击，并处理攻击 marker。第一人称仍保留原摄像机武器表现，未因第三人称接入而完成人物手臂。

## 验证结果

111 项完整回归通过（artifacts/weapon-animation-regression.log），语法／严格 Cocos 类型检查通过。新增检查覆盖十套资源原字节／绑定／基础动作保持、全部动作数值有限、移动的根／腿轨道保持，以及武器动作优先级。

完整回归首先发现既有交谈检查固定只接受八基础动作，更新为保留来源的全部动作，并仍独立核对 Three.js 的交谈旋转，不关闭校验。

首次 Cocos 构建编辑器成功，但资源契约拒绝新增动作。实际导入后，旧九动作的 UUID 与播放参数保留，Talk 的 gltfIndex 从 8 到 16，符合新增导出次序。明确迁移工具逐项核对原 UUID、播放参数和新索引对应名称，只允许追加八种已定义动作；实际模型、骨架、纹理、预制体引用检查通过（11 模型、54 图片）。未忽略导入审计。

实际网页男程序员拾取手枪，PistolHold／hand_r 挂点通过；移动、射击扣弹 12/48 至 11/48、双视角切换通过。实际拾取狙击枪后 RifleHold／hand_r 通过；退出 attachments=[]，连接文案只显示服务已连接。证据 artifacts/weapon-animation-root-idle.json、root-long.json、root-home.json 和 root-third.png／root-long.png。短时 Shot 和连续移动循环尚未通过实时截图单独验收，不能以扣弹替代动作表现验收。

最终 Web／微信构建、当前源码 SHA256 指纹及实际编译模块检查通过，见 artifacts/weapon-animation-build-verification.json 和 weapon-animation-compiled-web.log／compiled-wechat.log。两端构建的导入审计／PNG 后处理通过；未签名，也未做真机验证。

实际 Cocos 男程序员拾取手枪后 PistolHold、hand_r Socket 通过；J 射击弹药由 12/48 到 11/48。切换第一人称转为 Main Camera 挂点，返回第三人称恢复手骨；方向短按后 x 从 -18 到 -17.08，武器随动。退出后 status=home、actors=0、room 空、attachments=[]、input.active=false。证据 artifacts/weapon-animation-cocos-idle.json／first.json／moved.json／home.json 和 cocos-third.png。短时射击与连续移动的最终动作观感仍未单独验收。

## 未完成

全部十套外观的近景渲染／动态接触验收、运行时俯仰和射线／枪口对齐、不同长枪左手支撑、闭合手指、枪托、换弹、后坐力与腿部协调、近战专用动作及真实第一人称手臂仍需完善。当前接入的是阶段性持握姿势，不能称为高质量完成射击系统或微信／iOS 真机验收。空间、服务端伤害／弹药／拾取、剧情与性别判定未改变。双端完整验收后才发布 GitHub 与部署。
