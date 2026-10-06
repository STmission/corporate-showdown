# 46 · 第三人称武器手骨挂点

2026-10-06 · 根工程 0.6.12 · Cocos 0.3.10 · characters-v0.11 · rules-0.6.2 · protocol 3

## 问题、理由与实现

30 轮第三人称武器固定在角色身体旁 .18／1.03／.26，移动和攻击时不跟随手臂。将第三人称六类枪械、锤子、剪刀挂到右手骨骼，作为后续握枪、装填和近战动作的基础。保持服务端拾取、弹药、射击裁决、空间与外观判定；不以携带挂点代替正确瞄准动作。

prototype/shared/weapon-grip.mjs 根据武器原部件的握把中心，建立相对 hand_r 的携带位移和旋转。手骨 +Y 沿手指，携带时枪口／剪刀刀尖沿此方向；锤子用柄部握持。握把中心对应手掌局部点 (0, .065, .012)。坐标为当前骨骼制作起点，保留角色父链比例；不同外观的细微比例会影响武器视觉尺寸，未改变服务器射程／伤害。未知武器类别拒绝。

网页人物实例保留真实 hand_r 引用，武器挂在手骨并随 AnimationMixer 更新；移除武器从实际 parent 解除。Cocos 使用安装版本 3.8.8 的 SkeletalAnimation.Socket，以完整骨骼路径注册变换输出节点，兼容烘焙骨骼动画，不直接依赖可能不更新的骨骼节点 TRS。挂点随演员生命周期清理；无效演员引用删除，退出注销 Socket 并释放网格。第一人称保持原有摄像机武器；Cocos 第一人称仍没有真实人物手臂，不能称为握枪完成。

两端增加只读武器挂点诊断，记录 parent／挂点模式／骨骼路径和实际世界坐标；仅用于验证，不作为玩家操作或战斗可信输入。canonical 同步包含共享 weapon-grip 模块，根服务提供明确路由。

## 已验证与当前进度

数学验证覆盖八类别握持中心、旋转后手掌对齐与任意手骨变换后保持一致；真实 HTTP 会话检查新模块路由。严格 Cocos 类型和 npm run check 通过，109 项完整回归通过（artifacts/weapon-socket-regression.log）。初次类型检查发现闭包赋值无法可靠收窄 Node，改为返回 Node|null 的递归查找，类型检查重新通过，没有关闭严格检查。

实际网页单人进入、F 拾取手枪 12/48、第三人称 parent=hand_r、移动后世界坐标改变并保留手骨关联、第一／第三人称切换、离开通过；证据 artifacts/weapon-socket-root-idle.json、weapon-socket-root-moved.json、weapon-socket-root-third.png／first.png。只验证了男程序员／手枪路径，不能替代全部男女／武器／动作的实景验收。

退出时发现大厅底部仍显示旧房间码，补充 resetLobby 的连接文案清理，同时清空挂点诊断。实际重新创建、取消行动返回大厅后，连接文案仅“服务已连接”、attachments=[]；见 artifacts/weapon-socket-root-home.json/png。最新 UI 修改后的完整回归 109 项通过（artifacts/weapon-socket-final-regression.log）。

最终 Web／微信构建、实际编译模块的八类别握持几何检查及当前源码 SHA256 指纹通过，见 artifacts/weapon-socket-build-verification.json 和 weapon-socket-compiled-web.log／compiled-wechat.log。

实际 Cocos 男程序员拾取手枪后 parent=hand_r Socket，完整骨骼路径注册成功；切换第一人称 parent=Main Camera，再回第三人称恢复手骨挂点。方向短按后 x 从 -18 到 -17.2333，枪械世界坐标随动；J 射击弹药由 12/48 到 11/48。菜单退出后 status=home、actors=0、room 空、attachments=[]、input.active=false。证据 artifacts/weapon-socket-cocos-idle.json／first.json／moved.json／home.json 及 third.png／first.png／home.png。这是实际桌面 Web 引擎验证，不是微信或 iOS 真机验证。

## 尚未完成

双手瞄准与左手支撑 IK、闭合手指、枪械后坐力、ADS、换弹、近战专用挥击、枪托与身体避让、全部十套外观及八种道具动作、真实第一人称手臂、真机性能与发行仍未完成。当前是中性携带挂点，攻击沿用原普通动作；表现枪口不保证与服务器瞄准射线一致，必须完成射击姿势后再做该验收。M0—M6 目标继续执行，按用户要求双端完整验收后才发布 GitHub 与部署。
