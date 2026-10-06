# 武器持握与射击动作样板

`weapon-pose-pilot.blend` 是独立可编辑 Blender 源文件；`workplace-weapon-poses.glb` 是仅骨骼／动画的导出银行。四个动作：Weapon_PistolHold、Weapon_PistolShot、Weapon_RifleHold、Weapon_RifleShot。原男程序员人物模型保持不变。

运行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python blender/build_weapon_pose_pilot.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python blender/validate_weapon_pose_pilot.py
node prototype/tools/verify-weapon-pose-axes.mjs
```

验证使用真实源文件重开、实际 GLB 重导入、骨骼位置对比和真实人物网格渲染。manifest.json 保存制作来源／输出哈希；validation.json 保存重导入结果。weapon-reference.json 来自游戏共享武器几何及挂点。

目前尚未接入游戏运行时、其他九套人物、移动瞄准或第一人称手臂。手指闭合、换弹和枪托接触也未完成。不能把样板验证写成平台真机验收。范围和限制见项目 docs/47-weapon-pose-authoring.md。
