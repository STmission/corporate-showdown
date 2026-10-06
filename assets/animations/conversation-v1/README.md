# 可复用交流动作库 v0.1

`workplace-conversation.blend` 是可编辑动作源，包含现有医生模型作为动作预览载体；`workplace-conversation.glb` 只导出 53 骨骼与动画，不包含人物网格或贴图，约 104 KiB。包含 4 秒循环的讲解（Explain）、倾听（Listen）、安抚（Comfort）。

动作由 `blender/build_conversation_animations.py` 自制，未使用演员动作、视频提取或第三方动捕。预览载体来自已核对的 MakeHuman／suits01 图形资产，来源和许可见角色库记录。原医生源文件及其八动作未覆盖；源和导出指纹见 `manifest.json`。

`blender/validate_conversation_animations.py` 已实际重新打开 Blender 源，检查 15 个姿势采样，实际重新导入动画 GLB 后保留 53 骨骼和三动作。Blender 导入器产生一个骨骼显示用网格，验证确认其来自 custom_shape，不属于 GLB 角色模型。

网页重定向仅使用相对静止姿态的旋转，保留目标骨骼长度、位移和比例。九套现有骨骼已检查，不代表兼容任意第三方骨骼。原八动作合同与角色版本仍保留。工作台“预览动作”可选择三种动作；网页 NPC 在服务器确认交谈期间播放对应手势，结束后恢复站立或行走。

源渲染为 `explain-source.png`、`comfort-source.png`；实际男女 GLB 的网页预览证据存放于 artifacts。当前 Cocos 尚未接入这个库，口型、表情、语音同步、专属职业动作和真机验证未完成。

重新生成会覆盖本目录的同名源／导出文件；手工编辑前另存版本。验证详情见 `docs/34-conversation-animation-bank.md`。
