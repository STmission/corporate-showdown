# Corporate Showdown 平台客户端切片

Cocos Creator **3.8.8**，子工程 **0.3.14**。海岸总部与八套人物资源、中文大厅和首关权威会话已接入源码；实际 Cocos 完整通关、触控、音频和正式设备验证尚未完成，不是可上架客户端。

在仓库根目录运行 `npm run sync:cocos`，再运行 `npm run build:cocos:web` / `build:cocos:wechat` / `build:cocos:ios`。构建脚本检查精确编辑器版本、共享源码指纹、源资产和场景引用。启动 `npm start` 后 Web 引擎入口为 `http://127.0.0.1:4173/engine/`。默认 WebSocket 地址仅供本机开发。

共享脚本由 `prototype` 生成，不直接修改 `assets/scripts/canonical`；修改源文件后同步。需要 macOS GUI 会话，不能假设编辑器为无界面的普通 Node 编译器。

构建证据在根目录 `artifacts`，缓存和输出为本地生成文件。微信 `touristappid` / iOS `com.example.corporateshowdown.probe` 是占位，不能上传。iOS 编译、签名和真机测试依赖完整 Xcode 与开发者环境。

详细范围、运行失败及未完成验收见 [21 · 权威客户端](../../docs/21-engine-authoritative-client.md)；历史资产与双端预研见 [20 文档](../../docs/20-platform-engine-probe.md)。严格 TypeScript 检查不代替引擎实际编译和运行。

二十一模型（含十套第一人称前臂）已接入资产导入合同和实际构建，保留原资产和 UUID，Web 实际进入/移动/退出/再进入已验证；完整通关和设备仍待验收。资源路径、验证和性能差距见 [23 · 共享贴图接入](../../docs/23-shared-texture-integration.md)。

默认使用原网格 GPU 实例化；Web 参数 batch=static/off 保留对照。仅在支持设备启用，不改变布局/碰撞；渲染预算和帧率仍需验证。见 [25 文档](../../docs/25-environment-instancing.md)。

单人武器原型及输入构建兼容修复见 [30 文档](../../docs/30-weapon-prototype.md)。编译产物额外检查：`node platform/cocos/tools/verify-input-build.mjs`；浏览器动作验证与真机验证分开记录。

职业 NPC 移动与交流停留、中文活动提示见 [31 文档](../../docs/31-npc-life-routines.md)。

第一人称真实前臂、手腕校正和武器材质修正见 [52 文档](../../docs/52-cocos-first-person-arms.md)。当前设备与完整美术验收继续推进。
