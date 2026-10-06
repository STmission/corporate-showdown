# 第一人称前臂与手部资产

每个职务／性别 `.blend` 是独立可编辑源文件，对应 `.glb` 包含真实衣袖末端、前臂、手部、材质和蒙皮。原完整人物没有被覆盖。manifest.json 关联来源和导出哈希，validation.json 保存实际源重开／GLB 重导入结果。

制作与验证：

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python blender/extract_first_person_arms.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python blender/validate_first_person_arms.py
node --test prototype/tests/first-person-assets.test.mjs
```

尚未替换游戏运行时的第一人称手部。开放肘部边缘必须位于相机画面之外，需按每套衣袖检验相机位置；动作库保留既有16动作，握指／换弹等专用动作仍需制作。
