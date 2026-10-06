# 独立人物源资产库

八套 `*.blend` 每个只包含一套人物，米制、原点归零、53 骨骼、9 网格、8 动作和内嵌图像。与原 GLB 对应的指纹见 `manifest.json`，独立重新打开的验证见 `validation.json`。源工程从 `../workplace-characters.blend` 提取，保留母工程。

这是原 v0.9 外观的独立编辑基础，尚未按新参考完成视觉精修。不要把可打开或骨骼计数检查当作动作听感、游戏表现或最终质量验收。导出时保存新版本 GLB 和源文件关联，检查比例、轴向、材质、骨骼和全部动作，不直接覆盖现有游戏版本。

提取：Blender 后台执行 `blender/extract_character_library.py`；验证：执行 `blender/validate_character_library.py`。首次写新 Scene 时已遇到 Blender 原生崩溃；改为在写出前选中新 Scene 并同步 ViewLayer 后成功，原母工程未被覆盖。
