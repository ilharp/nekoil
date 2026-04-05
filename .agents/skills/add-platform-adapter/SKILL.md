---
name: add-platform-adapter
description: 为 nekoil 添加新的平台适配器。
disable-model-invocation: true
---

# 添加平台适配器

为 `nekoil` 添加一个新的聊天平台支持。

## 流程

### 1. 确定 platform 的值和 cpPlatform 的值

platform 的值一般就是 adapter 的名字，如 onebot。

cpPlatform 的值用于区分真正的平台，如 qq。这个值会在前端展示。

cpPlatform 的值为 number，如果要添加新平台的话，新增一个值，并且修改 `packages/typedef/src/cp.ts`。

### 2. 确定平台模型

如果平台原生就不支持合并转发的话，那么大概率不需要任何特殊操作，安装好 adapter 以后 nekoil 即可自动在新平台上工作。

但对于支持这些功能的平台，需要在 `packages/core/src/cp/msg/service.tsx` 里进行更多工作。

### 3. 支持特定功能

平台的一些功能需要在 `packages/core/src/cp/msg/service.tsx` 中进行支持。

1. 为功能指定新的 contentType。
2. 拟定进入这个 contentType 的条件。例如现有代码中，`obForward` 的条件就是基于 `regexResid` 的正则匹配。
3. 进入这个 contentType 后，实现聊天记录内容的获取。这里和接下来的操作都用到了 adapter 的内部 API，这也是 nekoil 仓库中内置了魔改 adapter 的原因。这里用到了 adapter 的「获取聊天记录内容」（`getForwardMsg()`）API。
4. 在后文的 switch 块将聊天记录内容转换为 h 数组。这里用到了 adapter 的「处理接收消息」（`adaptElements()`）API。

### 4. 确定平台是否为纯接收平台

「纯接收平台」是指 Bot 不应发送任何消息的平台。OneBot 就是一个这样的平台。

如果 nekoil 在这个平台上是纯接收的，那么在 `packages/core/src/index.ts` 加入相应的阻止逻辑。
