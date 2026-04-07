# Xca Agent - 头脑风暴会议纪要

**会议时间：** 2026-04-07  
**参会角色：**
- **产品经理**（PM）：提出需求、权衡取舍
- **技术架构师**（Architect）：评估可行性、设计系统
- **用户体验设计师**（UX）：关注交互流程
- **秘书**（Recorder）：记录过程、整理结论

**会议目标：** 定义 Xca Agent 的产品形态和技术方案

---

## 第一轮：我们到底要做什么？

**PM：** 用户想要一个类似 Claude Code 的 Agent，但有几个关键差异：
1. 能灵活切换本地模型和云端 API
2. 支持 Windows 和 macOS
3. 开源

**UX：** Claude Code 的体验核心是"对话式编程"——不是问答，而是协作。用户说"帮我改代码"，Agent 真的去改文件。这个体验要保留。

**Architect：** 技术上一个关键问题是：本地模型真的能支撑这种工具调用场景吗？Claude 3.5 Sonnet 的工具调用准确率很高，但本地 7B 模型可能会经常出错。

**PM：** 所以要设计 fallback 机制。本地跑不通时自动切云端。选择权给用户。

**结论：**
- ✅ 目标是"可灵活切换模型的 Claude Code 替代品"
- ✅ 核心体验：对话 + 工具调用
- ✅ 必须支持本地模型（Ollama）和云端 API

---

## 第二轮：功能范围怎么切？

**UX：** 功能可以很多，但 MVP 要聚焦。Claude Code 最常用的功能是什么？

**PM：** 根据观察和用户反馈：
1. 读取/修改文件（最高频）
2. 执行命令（npm install、git 等）
3. 代码搜索（找定义、找引用）

**Architect：** 文件修改有两个技术路线：
- A. 全量重写（简单，但会丢格式/注释）
- B. 精确编辑（需要 exact match，但安全）

**UX：** 用户最怕什么？Agent 把代码改坏了还找不到哪里改的。所以必须支持精确编辑，能 diff 查看。

**结论：**
- MVP 工具集：read_file, write_file, edit_file, execute_command, search_files
- edit_file 必须 exact match，不能模糊匹配
- 所有修改操作需确认（可配置）

---

## 第三轮：技术栈选什么？

**Architect：** 候选方案：Rust、Go、Python、Node.js

**PM：** 分发方式很重要。用户不想装 Python 环境，也不想编译 Rust。

**Architect：** 那 Node.js 是最务实的选择：
- 用 pkg 可以打包成单二进制
- 跨平台原生支持
- 生态成熟（CLI 工具链完善）

**UX：** Windows 支持是个坑。很多 CLI 工具 Windows 上体验很差（路径、编码、Shell 差异）。

**Architect：** 需要专门做平台抽象层，处理：
- 路径格式（`\` vs `/`）
- Shell 检测（PowerShell vs CMD vs bash）
- 配置文件位置（XDG vs %APPDATA%）

**结论：**
- ✅ 技术栈：TypeScript + Node.js 18+
- ✅ 打包：pkg 生成独立可执行文件
- ⚠️ 风险点：Windows 适配需要投入时间

---

## 第四轮：Provider 系统怎么设计？

**Architect：** 要支持 Ollama、OpenAI、Anthropic、OpenRouter。它们的 API 格式都不一样。

**PM：** 能不能统一成 OpenAI 格式？很多工具都是这样做的。

**Architect：** OpenRouter 确实是 OpenAI 兼容的，但 Anthropic 的 tool 格式有差异（function 嵌套层级不同）。需要做一层转换。

**UX：** 用户切换 Provider 的体验要简单：
```bash
xca config set provider ollama --model gemma4:26b
```

**Architect：** 配置结构要设计好：
```typescript
type ProviderConfig = 
  | { type: 'ollama'; baseUrl: string; model: string }
  | { type: 'openai'; apiKey: string; model: string }
  // ...
```

**结论：**
- ✅ 抽象 BaseProvider 接口
- ✅ 每个 Provider 独立实现格式转换
- ✅ 配置支持多 Provider + fallback

---

## 第五轮：安全边界在哪里？

**UX：** Agent 能执行命令，这很危险。`rm -rf /` 怎么办？

**Architect：** 分层安全策略：
1. **命令白名单/黑名单**（配置层）
2. **危险操作确认**（交互层）
3. **审计日志**（事后追溯）
4. **只读模式**（完全禁止修改）

**PM：** 默认策略应该保守。第一次用的人不知道风险。

**UX：** 危险命令的确认要明显，不能太容易跳过。比如要求输入 "delete" 或 "yes"。

**结论：**
- ✅ 默认开启所有确认
- ✅ 内置命令黑名单（rm -rf /, mkfs, dd 等）
- ✅ 敏感文件（.ssh, .env）读取需额外确认
- ✅ 所有操作记录审计日志

---

## 第六轮：上下文管理策略

**Architect：** 长对话会撑爆 token 上限。怎么处理？

**PM：** 有几种策略：
1. **滑动窗口**：只保留最近 N 轮
2. **摘要压缩**：早期对话生成摘要
3. **Token 预算**：严格限制输入长度

**Architect：** 文件内容也要管理。不能每次把 1000 行代码全塞进去。

**UX：** 用户需要知道"Agent 还记得什么"。要有命令查看上下文状态。

**结论：**
- ✅ 组合策略：滑动窗口 + 摘要 + Token 预算
- ✅ 大文件自动分块读取
- ✅ 提供 `/context status` 命令查看状态
- ✅ 支持手动添加/清除上下文

---

## 第七轮：差异化亮点

**PM：** 和 Claude Code、Cline、aider 相比，我们的独特价值是什么？

**UX：** 三个竞品的短板：
- Claude Code：闭源、绑定 Anthropic、不能本地
- Cline：依赖 VS Code，不能独立运行
- aider：主要是 git 工作流，通用性不强

**Architect：** 我们的定位是"灵活、跨平台、开源的 Claude Code 替代品"。

**PM：** 一个杀手级场景：飞机上的离线编程。用本地模型继续工作，有网时自动同步。

**结论：**
- ✅ 核心卖点：本地+云端自由切换、跨平台、开源
- ✅ 场景聚焦：隐私敏感、多模型对比、离线使用

---

## 待决策事项

以下问题需要在开发过程中继续讨论：

1. **是否支持 MCP 协议？**
   - 支持：生态更丰富
   - 不支持：简化复杂度
   - **决议：** v1.0 暂不支持，v1.x 评估

2. **是否内置 RAG？**
   - 支持：可以索引代码库
   - 不支持：专注工具调用
   - **决议：** v1.0 暂不支持，优先保证核心体验

3. **插件系统范围？**
   - 支持：用户可以扩展
   - 不支持：只提供配置
   - **决议：** v1.0 只支持配置，v1.1 考虑插件

---

## 用户决策确认（2026-04-07）

### 最终选择

| 决策点 | 用户选择 | 说明 |
|--------|----------|------|
| 1. apply_diff 工具 | ✅ **要** | 放入 MVP |
| 2. 安全策略 | ✅ **选项 B** | 可配置，默认严格，支持危险模式 |
| 3. 上下文管理 | ✅ **选项 B** | 智能摘要 + 分块 |
| 4. Windows 支持 | ✅ **选项 A** | MVP 先 macOS，Windows v0.8 再做 |
| 5. 首要 Provider | ✅ **Ollama** | 本地优先，API 后面加 |

### 对 MVP 的影响

**范围扩大：**
- apply_diff 加入 MVP（原计划 v0.5）
- 智能上下文管理（原计划 v0.6）
- 可配置安全策略（需要配置系统支持）

**范围收缩：**
- Windows 适配移除 MVP（延后到 v0.8）
- 只做 Ollama Provider（OpenAI/Claude v0.5 再加）

**MVP 交付时间：** +3-5 天

---

## 会议结论

### 产品定义
- **名称：** Xca Agent
- **定位：** 跨平台、可灵活切换模型的编程助手
- **核心体验：** 对话式编程 + 工具调用

### MVP 功能
1. 多 Provider 支持（Ollama、OpenAI、Anthropic、OpenRouter）
2. 基础工具集（文件操作、命令执行、搜索）
3. 上下文管理（Token 预算、历史摘要）
4. 安全机制（确认流程、审计日志）
5. 跨平台支持（Windows + macOS）

### 技术方案
- **语言：** TypeScript + Node.js 18+
- **架构：** 分层设计（Provider → Agent → Tools）
- **分发：** pkg 打包独立二进制

### 开发计划
- **阶段 1：** 基础框架（v0.1.0 - v0.4.0）
- **阶段 2：** 功能完善（v0.5.0 - v0.6.0）
- **阶段 3：** 体验优化（v0.7.0 - v1.0.0-beta）
- **阶段 4：** 正式发布（v1.0.0）

---

**会议记录：** 秘书（Recorder）  
**下次会议：** 阶段 1 完成后，评审 MVP 功能
