# 职业人物资产 · 女医生试作 v0.1

`female_doctor.blend` 是可独立编辑的源工程；`female_doctor.glb` 是游戏与工作台使用的导出。两者由原 `library-v1/female_ecommerce.blend` 派生，原八套库与人物母工程未覆盖。源、导出、生成脚本指纹见 `manifest.json`。

人体、基础服装与发型沿用已核对的 MakeHuman 系统资产和 Margaret Toigo suits01 图形素材许可（CC0）；MPFB 软件代码许可另计，见上级角色库 README。白大褂颜色／下摆调整、听诊器、口袋、胸牌为项目制作，没有采用演员、CS/GTA 提取人物或医院商标。

本样本为女医生：米制、约 1.68 m、53 骨骼、15 个带骨骼网格、8 个动作和 8 张内嵌图像。新配件绑定到原骨骼，白大褂保留原衣服权重。实际重新打开源文件并重新导入 GLB，核对权重、动画与三种姿势范围，结果在 `validation.json`。`doctor-source.png` 是源工程渲染；`doctor-glb-idle.png`、`doctor-glb-walk.png`、`doctor-glb-attack.png` 均为实际 GLB 导入后的渲染，已经查看。

网页游戏使用本样本替换林医生的视觉模型；工作台点击“查看女医生样本”或打开 `/studio?character=female_doctor` 查看。选择玩家性别／职务会返回原八套装扮。职业与玩法属性不变，Cocos 当前仍使用旧服装。

生成：Blender 后台执行 `blender/build_doctor_character.py`；验证：执行 `blender/validate_doctor_character.py`。脚本会重写样本目录的同名文件；如已手工精修，请先另存新版本，避免重建覆盖。GLB 使用 Y-up；源 Blender 为 Z-up。眼睛保留 BLEND，头发使用 MASK。

未完成：男医生、其他职业新服装、脸部雕刻、口型／表情、专属交流和医疗动作、自然持枪、LOD、纹理共享及微信／iOS 真机验收。基础脸部和八个动作仍来自旧模型，本资产尚未达到用户要求的真人品质。

2026-10-05：教师职业样本位于 `teacher/`，有独立源／GLB／指纹与验证报告，详见该目录 README；其余角色与最终真人品质仍待完成。
