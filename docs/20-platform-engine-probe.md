# 20 · 正式引擎预研与双端构建

2026-10-04 · ADR-PLATFORM-001 · 预研中，G1 / M3 尚未通过

## 决策与边界

04 文档的 Unity / 团结 + C# 路线仍是未经真机核验的提案。本机无 Unity / 团结安装，`xcodebuild -version` 显示只有 Command Line Tools，没有完整 Xcode。实际已安装 Cocos Creator 3.8.8、微信开发者工具。因此先建立 `platform/cocos` 的可重复资产及构建预研，验证已有 GLB 在原生引擎中的导入、骨骼动作和双端输出；没有在 G1 未通过前宣布正式引擎定版。

Cocos 支持微信构建输出及 iOS 工程路线、glTF 转换为 Prefab / Skeleton / Animation Clip。以官方资料为依据，但必须通过项目实际构建和设备检查，不能仅凭文档宣布双端兼容。团结目前也有官方转换渠道，04 文档中某旧 GitHub 下载被禁用并不能证明团结路线不可行。

- [Cocos 3.8 命令行构建](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html)
- [Cocos 微信构建](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-wechatgame.html)
- [Cocos glTF 转换](https://docs.cocos.com/creator/3.8/manual/en/asset/model/glTF.html)
- [团结官方微信部署](https://docs.unity.cn/cn/tuanjiemanual/1.9/Manual/UploadWeixinMiniGame.html)

## 当前工程

精确编辑器版本 3.8.8。源工程保存独立场景、TypeScript 预研组件、平台配置及源 GLB 指纹。生成的缓存和输出不入版本管理；原始 Blender 和原型资源继续保留。

预研加载完整 `coastal-headquarters-gameplay.glb` 和一套 `male_programmer.glb`，不复制教程人物或示例环境。场景序列化结构以本地 3D 模板的相机、光照及全局设置为起点，剔除示例对象与纹理，建立独立预研场景。相机第一人称高度 1.65 米、视角 75 度。WASD 仅用于资产浏览：尚未接权威服务器、碰撞、鼠标环视、触控、大厅和完整战斗。这不是第二套战斗规则实现。

`source-assets.json` 关联原导出与预研副本 SHA-256；构建脚本同时验证两侧，变更后的资源须显式同步与复验，不能静默构建旧版本。后续正式路线如确定 Cocos，应复用现有服务器协议与领域规则，不通过客户端执行可信伤害或奖励。

运行：

```sh
npm run build:cocos:web
npm run build:cocos:wechat
npm run build:cocos:ios
```

默认编辑器为本机已安装 3.8.8，可用 `COCOS_EDITOR_PATH` 指定路径。构建记录输出 `artifacts/cocos-<platform>-build.json` 与日志，包含编辑器可执行文件指纹和输入资源指纹；Cocos 官方成功退出码为 36，普通 shell 的非零检查不能直接把 36 当成失败。

微信配置 `touristappid` 为本地预研占位，不能上传或代表用户的开发者账号；iOS `com.example.corporateshowdown.probe` 同样为未签名预研标识。不得把这些配置用于正式发布。

## 实测进展与缺陷

Cocos 导入元数据识别环境 Prefab、人物 Prefab 和八份动画。导入日志报告不支持 `KHR_materials_emissive_strength`；后续需制作引擎材质适配并复核屏幕/灯带发光，不修改原始源资产来掩盖兼容差异。

已执行并确认的记录：

- Web Desktop / 微信生成命令均返回官方成功退出码 36；原型代码 `npm run check` 及完整 58 项回归通过。预研 TypeScript 严格检查通过；`skipLibCheck` 只跳过本地编辑器声明文件未标注的供应商类型，项目源代码仍严格检查。
- Web 实际 Chrome 运行中环境、人物、待机启动状态为 true，连续帧从 3423 增至 3492；点击画布后按 W，相机 z 从 13 移至 7.9204，未捕获 error/unhandledrejection。记录 `artifacts/cocos-probe-runtime.json`。实际 Cocos 动画状态还确认 Idle 四秒循环处于 playing，时钟持续推进；八个导入片段均为 Loop 包装，攻击/受击/倒地的一次性状态需在正式动作控制器覆盖，未验收全部动作。详见 `artifacts/cocos-probe-animation.json`。这验证资源实例化、基本动作启动和可运行渲染，不代表所有动作或正式第一人称控制已验收。
- 初次运行遇到资源引用挂到 PrefabInfo 而非脚本组件、后续遇只查子节点遗漏根节点动画；已修正并复测，构建脚本增加资源引用检查。初次失败记录保留在 `artifacts/cocos-probe-runtime-initial-failure.json`。
- 截图 `artifacts/cocos-probe-web.png` 显示预研镜头前存在大块隔墙；初版起点不是正式首关出生点。0.1.1 已移至 `(-18, 5.8)`，人物置于 `(-18, 2.8)`，两点均通过共享布局的 `validFloorPosition` 检查；新实际页面确认出生位置、环境、人物和 Idle 状态，截图 `artifacts/cocos-probe-spawn-v011.png` / 完整页面 `cocos-probe-spawn-v011-full.png`，可见工位与人物。预研仍未做运行时碰撞、正式镜头和响应式屏幕适配，不能用状态标志代替画面质量验收。
- 调试输出 Web 约 37 MiB / 微信约 35 MiB（磁盘占用），没有测传输压缩和正式资源分包。微信构建包含 game.json、project.config.json；`compileType` 为 game。微信开发者工具 CLI 实际打开被拒绝，错误为占位 `touristappid` 不存在（code 10）。需真实小游戏 AppID，不把构建输出称为小游戏运行通过。
- Cocos CLI 日志另包含编辑器全局 layout/window JSON 读取及退出清理警告；没有改写用户全局布局来掩盖警告。成功退出码仅证明生成阶段，后续原生与持续集成环境要复查这些日志。

iOS 修正 packageName 必填字段后，原生引擎脚本编译及资源输出完成，生成 `platform/cocos/native/engine/ios`、公共 C++ 入口、Info.plist 与 CMake 源工程。最终调用 Xcode 生成器失败，日志为 `Xcode 1.5 not supported` / `Could not create named generator Xcode`，编辑器退出码 34。与 `xcodebuild -version` 的 Command Line Tools 状态一致：本机没有完整 Xcode，不能以另一个生成器或伪造版本绕过 iOS SDK。此输出不含成功的 .xcodeproj / 已编译 .app / 签名 .ipa。

记录 `artifacts/cocos-ios-build.json`、`artifacts/cocos-ios-build.log`；此前错误字段的失败记录为 `artifacts/cocos-ios-initial-config-failure.json`。该原生部分输出来自预研 0.1.0，后续镜头修正为 0.1.1；具备 Xcode 后必须按最新源码重新生成，不重用旧输出作为验收。没有微信/iOS 真机数据、签名、上传或审核证据。

## G1 下一步

完成双端输出和真实运行，接入现有 authoritative server、角色就绪版本、输入/恢复协议、触控、生命周期、场景加载与音频。按全场景 1/2/4 人检查动画、透明材质、路径和镜头，测包体/分包/缓存、帧时、内存及网络。在正式小游戏 AppID、合法域名、完整 Xcode、开发者证书和设备条件具备后完成真机门禁。以结果决定引擎与语言路线，并改写 04 文档的提案，不先维护两套正式客户端。

0.1.1 最新 Web / 微信生成再次通过（退出码 36），构建记录加入项目配置、场景和脚本 SHA-256。Web 合计文件 38,067,652 字节、微信 35,597,044 字节为前一轮未压缩调试输出统计；不能直接据此认定平台包体门禁通过。

完整页面截图的 Cocos 性能面板当帧显示约 1,864 次 draw call、319,710 三角形、18.99 ms 帧时和 164.26 MB GFX 纹理占用。它仅是本机 Chrome 预研的一帧诊断，不是最低设备预算、峰值内存或 P95/P99 验收。后续优先检查静态批次/实例化、纹理与分包，并以微信/iOS 真机采样定预算。默认 Web 调试模板画布 1280×960 超过当前浏览器可视高度，完整截图包含全部画布；正式客户端须重新完成横屏响应式和触控适配。

后续 Cocos 0.2.0 已接入共享权威会话与中文 UI，Web/微信生成再次成功。原预研结论是历史记录，最新功能、运行复验限制及资源包差距见 [21 文档](21-engine-authoritative-client.md)。iOS 缺少完整 Xcode 的结论未变化。

## 共享贴图接入补充（2026-10-04）

Cocos 0.2.1 已接入九份外置图片 glTF，保留源 GLB 与导入身份；实际导入门禁确认 52 个共用图片。Web/微信构建通过，Web PNG 108.87 → 44.17 MiB；62 项回归、语法与严格类型检查通过。内置浏览器已验证单人进入、权威移动、菜单退出和再进入，修正输入框标签。完整通关、两/四个引擎客户端、引擎音频、手臂和真机性能仍待完成。此前暂存未接入、旧包大小与 Chrome 阻塞描述保留为历史。详情见 [23 文档](23-shared-texture-integration.md)。
