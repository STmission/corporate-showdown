# 23 · Cocos 共享贴图接入与运行复查

版本 v0.1 · 2026-10-04 · 客户端切片 0.2.1；负责人/评审人待团队分配

## 原因、实现与兼容

22 文档发现重复 PNG 导致资源膨胀，无损重压缩收益有限。本轮把九个模型改为外置图片的 glTF 衍生资产，同内容图片使用同一路径。办公室布局、人物比例、职务/性别判定、服务器规则与协议不变。

Blender 工程和原始 GLB 保留。`sync_assets.py` 从原始 GLB 生成 `platform/cocos/assets/resources/*.gltf`、52 份按 SHA-256 命名的 PNG 与 `assets/source-buffers/*.bin`。BIN 放在 resources 之外，避免原始缓冲区额外进入运行包；导入器按相对 URI 读取。首次迁移的旧工程 GLB 副本备份在 `.platform-staging/cocos-glb-backup/`；后续同步使用已保存的 glTF metadata，不依赖该忽略目录。

保留模型、Prefab、网格、骨骼与动作 UUID，仍按 `name/name` 加载；男程序员使用 `programmer/programmer`。`asset-identities.json` 保存迁移前身份契约，`asset-derivatives.json` / `source-assets.json` 关联原 GLB、工具和衍生文件指纹。源资产修改须重新同步、构建和验收。

[Cocos glTF 导入说明](https://docs.cocos.com/creator/3.8/manual/en/asset/model/glTF.html)提供相对 URI、Prefab、材质、蒙皮和动画机制依据；下面是本工程验证。

## 已验证的构建结果

`audit_imports.py` 检查实际 metadata/library：九模型 UUID、Prefab、网格数量；各人物 53 骨、八个动作 UUID/名称/设置/原生文件；SkeletalAnimation 引用；纹理采样设置和外部 ImageAsset 引用。确认 52 个共用图片身份，移除旧嵌入图片子资产。门禁失败则整个构建不算成功。

Web / 微信编辑器成功码均为 36，导入审计和 PNG 无损处理均通过。Web PNG 从 114,156,258 bytes（108.87 MiB）降到 46,317,450 bytes（44.17 MiB），减少约 59.4%。Web 生成目录总计 93,793,650 bytes；微信总计 91,322,792 bytes，PNG 合计 46,343,428 bytes（含额外内置图片）。这些是调试输出存储大小，不是下载量、移动内存或发行验收。

证据位于 `artifacts/cocos-{web-desktop,wechatgame}-build.json`、对应 `import-audit.json` / `png-optimization.json`。构建报告记录源指纹和未签名/未验收设备状态。`cocos-shared-assets-regression.log` 记录 62 项通过；`cocos-shared-assets-check.log` 和严格 TypeScript 检查退出 0。原始衍生图片与 GLB 图片字节相同，无损构建处理核验扫描行与颜色元数据。两端各 52 份资源图已通过独立 Pillow 解码，模式、尺寸、像素和图像元数据与 library 原图一致；报告为 `cocos-{web-desktop,wechatgame}-shared-png-verification.json`。

## 实际引擎操作

通过内置浏览器访问 `/engine/`，实际点击单人出发，看到办公楼与 NPC；按 W 后权威 z 从 5.8 变为 5.6466666666666665；菜单退出、返回大厅、再次进入成功。实际切换女生/电商选项后出发；自身模型在第一人称隐藏，这不证明所有服装近景外观已验收。闲置试玩触发失败结束界面，返回可用。

EditBox 默认标签叠加已按引擎固定子节点名修正并实际复查。默认隐藏性能覆盖层，避免挡住操作按钮，性能门禁仍保留。浏览器只读 QA DOM 输出连接、阶段和权威位置，不输出恢复凭据。截图 `cocos-shared-home-v021.png` / `cocos-shared-gameplay-v021.png` 为实际运行画面。

未完成交接—BOSS—成功撤离整条操作及两个/四个实际 Cocos 客户端试玩，Node 四会话测试不能替代。退出大厅后还可能残留上一局提示，需修正。

## 差距与后续

调试浏览器观察约 16—19 FPS、超过 2,100 个 draw call，人物组合改变时纹理指标约 274—400 MB；机器同时运行其他项目，未采集帧时间分位数。这是性能问题线索，不是指定设备验收。共享 PNG 文件不保证 Texture2D/GPU 实例共享，不能声称显存下降。继续检查批处理、采样与 GPU 图片复用、人物 LOD、Bundle 和释放生命周期。当前办公楼 glTF 盘点为 6,300 个网格节点/primitive 引用、59 种材质；其中银色镜面材质 993 个引用。该盘点是场景结构，不等于每帧绘制数，下一步按空间与材质检查静态合批，并保留玻璃排序和剔除粒度。

第一人称手臂、引擎音频/字幕、交互物非颜色识别、动作精修、完整 1/2/4 人回路仍需制作。微信真实 AppID/域名及设备、完整 Xcode、iOS 签名和真机仍未就绪；本轮资源生成不等于平台可玩验收。账户存档、权益订单、容量和发布资料继续按 M0—M6 推进，完整目标未达成。
