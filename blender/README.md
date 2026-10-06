# Blender 场景工程

主工程：`../assets/models/coastal-headquarters.blend`，Blender 5.2.2 LTS。

已完成导入完整 GLB、按区域组织 11 个集合、打包贴图、米制比例、Cycles / AgX 设置、真实金属镜面和日光 / 室内补光。Blender 原生新增 201 个细节对象，包括休息区木条天花、靠垫、花瓶与花枝、门把手。

预设相机：
- `Camera_Central_Lounge` 中央休息区
- `Camera_Townhall` 演讲区
- `Camera_Office` 办公区
- `Camera_Pantry` 茶水间

工程打开后默认使用中央休息区相机视图与材质预览。数字小键盘 0 切换相机视图，F12 渲染；无小键盘时使用“视图 → 相机 → 活动相机”。在大纲视图展开各功能集合，可以单独选择、隐藏与编辑对象。

`build_environment.py` 是本轮创建原生工程的可复现脚本，输入为完整场景 GLB，输出 `.blend` 和真实渲染 PNG。运行命令：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python blender/build_environment.py
```

脚本重建会替换同名工程。后续手工 / 脚本精修应继续编辑已保存的 `.blend`，不要直接重建覆盖新改动。

本轮是环境制作，不包含已完成的写实男女 / 职务衣服骨骼或猫毛发系统。网页版仍展示前一版 GLB；新增原生 Blender 细节需另行导出才能同步到网页。渲染 PNG 为实际 3D 相机输出，不是 AI 概念图。

## v0.7：中文与职场人体角色

Blender 界面、工具提示和新增数据名称已经设置为简体中文，偏好已保存。已安装官方 MPFB 人体建模扩展和 CC0 系统素材 / suits01 服装包。

角色库：`../assets/characters/workplace-characters.blend`；八套男女 / 职务模型和待机骨骼见该目录的 `README.md` 与 `manifest.json`。

`refine_headquarters.py` 继续编辑已保存的主工程，追加原生柜门、把手、餐具、淋浴设施、办公用品和八名职场角色，并导出 `../assets/models/coastal-headquarters-complete.glb`。新增细节和角色分在 `12_Environment_Finish` 与 `13_Workplace_Characters`，可单独隐藏和编辑。网页版 `/studio` 自动加载该完整 GLB，并能切换八套角色与近距离查看人物。

本次是可使用的环境和人物原型精修。角色尚缺完整战斗 / 移动 / 坐姿 / 表情动画，猫仍是风格化网格，尚不作为最终商业写实美术验收。早期 v0.6 的说明仅对应当时版本。

GLB 导出后会运行 `normalize_glb.py`：将皮肤、衣服设为不透明材质，将头发 / 眉毛 / 睫毛设为透明裁切，避免 MPFB 的通用透明材质在网页中出现黑脸和破面；每个人物仅保留自己的待机动画。此修正保留原始网格、贴图与骨骼数据。

## v0.8：导航同步与游戏环境导出

现有主工程已经同步茶水间南侧分隔、电话门洞与卫生/淋浴隔板调整。`14_Navigation_Corrections` 集合保存新增分隔；112 段墙体带碰撞追踪标记。工作台展示完整模型，游戏使用独立的 `coastal-headquarters-gameplay.glb`，排除八名展示人物，环境约 5.8 MB。

先执行 `npm run export:layout`，再运行 Blender 后台 `--python blender/update_navigation.py`。脚本编辑现有工程、检查墙体、保存并导出两份 GLB；随后执行 `npm run check`、`npm test` 和 `npm run audit:assets`。具体兼容影响、修改理由和未完成项见 [导航与资源拆分](../docs/15-navigation-and-resources.md)。不要用早期重建脚本覆盖当前精修资产。

## 角色 v0.9：原生动作片段

角色源工程 `workplace-characters.blend` 增加八套独立角色各八个 Action/NLA 片段；`animate_characters.py` 导出并生成真实预览。角色库独立于完整环境中的静态展示人物；环境布局仍为 v0.8。当前动作尚需精修和补齐第一人称/完整玩法动作，不当作商业最终验收。步骤和限制见 [18 文档](../docs/18-character-actions.md)。

## 区域模块 v0.1

extract_environment_modules.py 从现有完整工程提取九个区域，不保存原工程；validate_environment_modules.py 实际读取各源场景、导入 GLB 并重组检查，输出剖视渲染。验证及查看后推广到 assets/environment-modules/v0.1，运行 prototype/tools/link-module-collision.mjs 核对共享墙面别名。详情见 [32 文档](../docs/32-environment-modules.md)。当前库已验证，原美术质量边界保持不变。

## 职业服装样本 v0.1

build_doctor_character.py 从独立女电商源制作女医生大褂与配件，保存 assets/characters/professions-v1/female_doctor.blend 和 GLB；validate_doctor_character.py 实际重新打开、导入并渲染 Idle／Walk／Attack 检查。原源工程不覆盖；重建会覆盖样本目录同名文件，手工精修先另存版本。根网页和工作台已接入，Cocos 未同步；脸部与专属动作尚未精修。详见 [33 文档](../docs/33-doctor-profession-asset.md)。

## 独立交流动作库 v0.1

build_conversation_animations.py 从医生样本制作讲解／倾听／安抚，保存带预览人物的独立源工程和只有骨骼／动作的 GLB；validate_conversation_animations.py 实际重新打开与导入验证。原源不覆盖，重建前保留手工精修副本。网页九套角色骨骼重定向及 NPC 交流已验证，Cocos 尚未接入。详见 [34 文档](../docs/34-conversation-animation-bank.md)。
