# 43 · 销售人物材质精修与独立资产

2026-10-06 · 根工程 0.6.10 · Cocos 0.3.8 · characters-v0.10 · rules-0.6.2 · protocol 3

## 问题、理由和范围

近景人物质量是用户当前核心要求。核对源文件、原 GLB 和引擎材质后发现：销售眼睛贴图中虹膜／眼白有颜色与不透明 alpha，角膜外层区域是透明的淡紫色；旧销售导出的眼睛材质却为 OPAQUE，产生白色／淡紫色外罩。头发源节点也使用恒定暗色覆盖了原贴图色差。本轮从独立销售 Blender 工程派生材质版本，保留确认的办公布局和单人中文剧情。遵循 11 文档的源资产追踪与实景验证原则，不代表 Riot 内部标准或真人品质验收。

## 已实现与兼容影响

独立源文件与导出在 assets/characters/refined-v2/male_sales/，manifest.json 记录原工程、生成脚本、源／导出 SHA256，validation.json 记录实际重开与姿势验证。原 library-v1、根目录旧销售 GLB、其他角色源文件均保留。制作脚本 blender/refine_sales_character.py；验证脚本 blender/validate_sales_refinement.py。

眼睛导出为 MASK / cutoff 0.4，保留虹膜／眼白纹理；透明外壳采用裁切，没有新增折射角膜。头发恢复源图的发丝明暗变化，保留原 alpha，调整颜色与粗糙度。皮肤降低蜡感，西装提高粗糙度。没有新增脸部拓扑、衣褶、表情或口型。

仍为 9 网格、53 骨骼、10 张内嵌图像、八个原动作；讲解动作继续由现有交流库重定向。几何比较实际解码 POSITION／NORMAL／UV／JOINTS／WEIGHTS：提取过程有一致的 2.937 mm 原点平移，无局部形状变化，权重和其他属性不变。装扮不改变战斗判定／服务器数值。

根服务将原销售资源地址指向新版 GLB，Cocos 同步工具仅替换 male_sales 来源并保留导入 UUID。玩家销售、顾律师和使用该外观槽的 BOSS 都将使用新版；不是三套独立造型。资源审计新增独立源／导出和运行时覆盖关系。characters-v0.10 用于避免旧人物缓存混用，规则和协议版本保持。

## 已验证与发现的缺陷

实际 Blender 源重开与 GLB 导入成功；Idle、Walk、Attack、Down 四个姿势导入渲染通过。portrait-before.png、portrait-source-after.png、portrait-glb.png 及三个 pose-glb 图片保存在独立资产目录，渲染不是游戏截图。

初次 Down 校验以 -0.16 m 为下界失败。实际比较旧／新 GLB 后，旧倒地最低 -0.20254 m、新版 -0.20548 m，相差提取原点 2.937 mm；证据 artifacts/sales-refinement-down-bounds.log。验证改为记录实际旧问题和形状／幅度一致性，不能解释成通过“无穿地”门禁。当前倒地穿地仍待动作／落地修正，资产 manifest 和验证结果均记录。

npm run check、106 项完整回归、严格 Cocos 类型检查、资产审计通过。Web／微信 Cocos 构建成功，源码指纹匹配；11 模型／54 图像导入合同通过。实际编译产物输入、短按移动、交谈、剧情和近墙镜头检查通过，证据 artifacts/sales-refinement-build-verification.json 及 compiled-web／compiled-wechat 日志。导入后的销售眼睛实际 USE_ALPHA_TEST=true、alphaThreshold=0.4。

网页工作台实际选择男销售并播放讲解动作，DOM 记录 male_sales_Explain；证据 artifacts/sales-refinement-studio.png／studio-talk.png。实际 Cocos Web 选择男销售单人出发，七个角色加载；沿工位／中央通道与顾律师交谈，male_sales 播放 Talk，获得 policy 线索和中文职业对白，近景未出现此前不透明眼罩。证据 artifacts/sales-refinement-engine-loaded.json、sales-refinement-lawyer-talk.png/json。截图中的脸部尺寸不足以作为虹膜细节或真人写实品质验收。

最后结束交谈、打开行动菜单并返回大厅，status=home、actors=0、room 为空、输入 inactive；证据 artifacts/sales-refinement-home.json。使用实际鼠标／键盘和只读 DOM 证据，没有传送、修改状态或调用游戏内部操作。

## 尚未完成与下一步

本轮仅一套销售材质精修。其他九套角色的眼睛、头发和近景材质没有因此获得验收。真人级脸部、自然衣褶、表情口型、专业握枪／近战动作、倒地落地、更多职业原创造型和后续剧情仍待制作。优先复查其他角色眼睛导出合同，再制作脸部／动作精修，避免把贴图调整当作完整人物重建。M0—M6 总目标仍执行中；微信构建不是微信真机，Web 试玩不是 iOS 签名／真机／上架验收。
