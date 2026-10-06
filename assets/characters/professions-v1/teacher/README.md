# 许老师 · 独立职业服装样本

`female_teacher.blend` 是可继续编辑的源；`female_teacher.glb` 是网页使用的导出。原女程序员源未覆盖，来源和指纹见 `manifest.json`。人体、基础服装、眼睛与马尾沿用原库 CC0 图形资产；项目新增细框眼镜，调整服装／皮肤／头发材质，没有演员脸部、品牌商标或商业游戏提取资产。

米制约 1.68 m，Blender Z-up／GLB Y-up，53 骨骼、16 网格、8 原动作、8 内嵌图像。眼镜七网格直接绑定头骨；眼睛和镜片为 BLEND，头发为 MASK。网页游戏用于许老师，工作台“查看女教师样本”或 `/studio?character=female_teacher` 可预览。选择玩家性别／职务会返回原八套。

生成：Blender 后台执行 `blender/build_teacher_character.py`。验证：执行 `blender/validate_teacher_character.py`。两脚本会重写本目录同名派生产物；手工精修前请另存版本。生成脚本按节点类型读取材质，兼容 Blender 中文节点名称；使用 `--python-exit-code 1` 让 Python 失败正确反映到进程退出码。

源渲染是 `teacher-source.png`，实际重新导入 GLB 的四姿势渲染是 `teacher-glb-{idle,walk,attack,down}.png`，报告是 `validation.json`。有限坐标、头部配件跟随与少量姿势验证不等于所有帧无穿插。

仍需精修原面部和头发轮廓、表情／口型、服装细节、自然持物、倒地接触、LOD 与平台设备；本资产尚未达到用户要求的真人品质。Cocos 与完整场景展示人物当前未替换。详见 `docs/36-teacher-profession-asset.md`。
