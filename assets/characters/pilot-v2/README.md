# 独立人物精修样本

男程序员，原创职场造型。使用项目已核对的 MakeHuman/MPFB 核心图形资产；新增格子衫纹理与手势由本项目制作。软件代码与图形许可分别沿用主角色库来源记录。

- `male_programmer.blend`：独立可编辑源工程，含灯光、预览相机、53 骨骼与 9 网格。
- `male_programmer.glb`：米制、Y-up 导出，含原八动作与新增 Talk。
- `portrait-before.png` / `portrait-after.png`：相同灯光和镜头的源工程前后对照。
- `body-after.png` / `talk-after.png`：全身与手势真实三维渲染。
- `portrait-glb.png` / `validation.json`：验证脚本成功后生成的实际 GLB 导入渲染及结果。
- `manifest.json`：源文件、脚本、导出指纹与当前状态。

运行 `blender/refine_character_pilot.py` 生成；运行 `blender/validate_character_pilot.py` 复查。生成工具只替换样本目录，不修改运行时资产或旧角色母工程。

当前只做材质、格子纹理和对话手势试作。面部雕刻、头发轮廓、褶皱、职业服装、表情、口型、持枪姿态、LOD 与引擎显示仍未完成，未通过用户要求的真人外观验收。
