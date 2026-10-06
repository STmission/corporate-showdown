# 职场人体角色 v0.9

`workplace-characters.blend` 是可编辑的角色库。男、女各有程序员、电商、销售、明星四套完整 GLB；每个角色包含人体、眼睛、眉毛、睫毛、牙齿、舌头、头发、衣服、鞋子及 53 根游戏骨骼，带轻微呼吸待机动画。男女身高分别为 1.78 m 和 1.68 m。

造型方向是韩剧职场穿搭与原创东亚面孔，没有复制具体演员的长相。程序员使用原创蓝色格纹，销售使用领带 / 西装，电商使用商务休闲 / 彩色套装，明星使用夹克 / 日常潮流装。服装组合是独立网格资产切换，不是布料实时模拟。

这是已能使用的写实人体原型，仍可继续精修面部、手指、发型和服装褶皱。v0.9 已新增可编辑的行走、跑步、攻击、受击、倒地、救援与施法准备片段，连同待机每套共八个。坐姿、完整连招、握持、面部和第一人称绑定手臂仍未完成；动作过渡和脚滑尚需精修，不能当作最终商业角色验收。

来源：
- MPFB 2.0.17：https://github.com/makehumancommunity/mpfb2（插件代码 GPLv3）
- MakeHuman system assets：https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html（资产 CC0）
- Margaret Toigo suits01：https://static.makehumancommunity.org/assets/assetpacks/suits01.html（资产 CC0）
- 人体底模 / 形变基础：https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.ASSETS.md（CC0）

外部插件装在本机 Blender 用户扩展目录，没有将插件代码复制到游戏项目。导出的游戏模型不依赖 Blender 或 MPFB。

复现：启用 MPFB 并安装上述两个官方资产包，然后运行 `blender/build_characters.py`；`blender/render_characters.py` 生成真实 3D 预览。`manifest.json` 记录各角色网格数量、骨骼数量和导出路径。

当前继续编辑 `workplace-characters.blend`；`blender/animate_characters.py` 编制动作并导出，`character-actions-v09.png` 为真实渲染。不要用旧人体重建脚本覆盖当前动作库。制作范围和验证见 [18 文档](../../docs/18-character-actions.md)。
