# 海岸总部九个区域模块

每个区域有同名独立 Blender / GLB，采用米制。GLB +Y 向上，Blender +Z 向上；把 GLB 根节点放到 manifest.json 中的 placement 即可复原楼层。原点为功能区域锚点，建筑与海岸使用原世界原点。

所有 6,300 个环境网格经过九份源场景重新加载、实际 GLB 导入和重组几何核对。validation.json 保存结果；reassembled.png 是实际重组预览，天花板仅在该预览中隐藏。原始完整工程不变，职业人物不包含在区域模块中。

提取：blender/extract_environment_modules.py；验证：blender/validate_environment_modules.py。脚本先写 staging；核对和查看后再推广为版本目录。更改源布局后应生成新版本并复核碰撞与加载，不直接替换当前版本。

当前模块继续使用已有办公家具与风格化猫，并非最终写实美术。网页验证入口为 /?environment=modules，Cocos 仍使用完整环境。详细边界见 docs/32-environment-modules.md。

碰撞追踪保留 106 个原始墙面标记和六个共享面别名（全部 112 个逻辑墙体）。推广后运行 prototype/tools/link-module-collision.mjs，别名只允许完全相同的尺寸、位置、高度和材质；不会另生成重叠墙体。
