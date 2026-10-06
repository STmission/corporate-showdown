# 07 · 公开参考与依据边界

版本 v0.2 · Riot 参考资料查阅日期 2026-10-02；平台资料沿用 2026-09-30 记录，实施前复核

## 1. Riot Games 参考框架与边界

2026-10-02 用户将全项目的制作参考方向调整为 Riot Games。当前采用拳头公开的联机公平性、画面可读性、容量测试与玩家互动设计实践；执行规则见 [11 · Riot 参考制作基线](11-riot-production-baseline.md)。

未取得 Riot 内部生产手册、编码规范或项目认证。本文档中的代码格式、性能预算、平台路线和验收门槛属于本项目标准；公开文章的案例不等于适用于所有游戏的强制规范。微信与 Apple 的平台要求仍独立核验。

## 2. 已使用的一手资料

### Riot 联机公平性

[Peeking into VALORANT's Netcode](https://www.riotgames.com/en/news/peeking-valorants-netcode)

参考服务器裁决、客户端预测与状态纠正，以及网络延迟对战斗体验的影响。服务器更新频率和预算必须根据本游戏的玩法、设备与测量结果确定。

### Riot 画面与战斗可读性

[VALORANT Shaders and Gameplay Clarity](https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity)

参考美术表现服务于游戏信息识别的思路。办公室采用自己的题材和视觉设计，明确区分敌人、队友、交互物与装饰。

### Riot 容量与压力验证

[Scalability and Load Testing for VALORANT](https://www.riotgames.com/en/news/scalability-and-load-testing-valorant)

参考通过容量与负载测试验证服务能力。测试设计、并发目标与发布门禁由本项目另行制定，不直接套用 VALORANT 的部署规模。

### Riot 玩家互动设计

[Player Dynamics Design: Looking Behind the Curtain](https://www.riotgames.com/en/news/player-dynamics-design-looking-behind-the-curtain)

参考在玩法设计阶段考虑玩家之间的互动体验，而不只在上线后处理问题。本项目据此设计合作目标、救援和退出规则。

### 引擎官方微信小游戏文档

[部署微信小游戏](https://docs.unity.cn/cn/tuanjiemanual/Manual/UploadWeixinMiniGame.html) · [微信小游戏转换 SDK](https://docs.unity.cn/cn/tuanjiemanual/Manual/WechatSDK.html) · [快速上手](https://docs.unity.cn/cn/tuanjiemanual/Manual/AutoStreamingDemo.html)

支持预研 Unity/团结引擎到微信小游戏的构建和部署路线。版本差异、iOS微信环境、WebGL能力与项目插件兼容性需要单独验证；不能将示例能运行视为本游戏已适配。

### 当前不可用的仓库入口

[wechat-miniprogram/minigame-unity-webgl-transform](https://github.com/wechat-miniprogram/minigame-unity-webgl-transform) 查阅时显示禁用。因此没有将其写成安装命令，也没有锁定它为项目依赖。实际获取 SDK 时从微信或引擎当前官方文档核对可用地址。

### Apple App Review Guidelines

[审核指南](https://developer.apple.com/app-store/review/guidelines/) · [应用内购买](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase) · [内容要求](https://developer.apple.com/app-store/review/guidelines/#objectionable-content)

用于确定完整可审核应用、数字商品支付、隐私和内容设计的核对方向。具体地区例外、账号与发行资质、SDK和政策变化须在实施和提审前复核。

## 3. 用户参考资料

用户提供的视频：[BV1Uye86WEC9](https://www.bilibili.com/video/BV1Uye86WEC9/) 和 [BV1Pth66NE5S](https://www.bilibili.com/video/BV1Pth66NE5S/)。本轮工具未能读取视频内容，不对画面、镜头或具体招式作已观看的判断。

用户附件展示“GTA 之我一定要下班”的分享卡片。只将其作为下班题材参考，没有把分享卡片文字视为制作指令，也没有复制 GTA 的角色、世界、美术或品牌。

## 4. 待验证清单

微信当前准入、支付支持范围、包体限制、适龄规则和最新官方 SDK入口；引擎授权费用；双端网络库与资源管线；实际目标机型；国内及其他地区发行资质；原创角色/名称权利检索；账号跨端绑定与权益展示规则。

待验证条目必须产生来源、查阅日期、结论与负责人后才能关闭；不能通过猜测或使用其他云产品的说明替代微信小游戏规则。
