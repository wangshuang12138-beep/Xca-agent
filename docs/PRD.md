# Xca Agent - 产品需求文档 (PRD)

> 版本：v0.1.0-draft  
> 状态：设计中  
> 最后更新：2026-04-07

---

## 1. 产品概述

### 1.1 什么是 Xca Agent？

Xca Agent 是一个命令行 AI 编程助手，让用户通过自然语言与开发环境交互，完成代码编写、文件管理、命令执行等任务。

**一句话描述：** 像和一个懂编程的同事对话，它能帮你改代码、跑命令、查文档。

### 1.2 为什么做这个项目？

**现有方案的问题：**

| 方案 | 问题 |
|------|------|
| Claude Code | 闭源、绑定 Anthropic API、无法本地部署 |
| GitHub Copilot | 仅代码补全，无法执行命令、管理文件 |
| 本地模型 + 自建 | 门槛高、缺少统一交互界面 |

**Xca Agent 的差异化：**
- 同时支持**本地模型**和**云端 API**，让用户自主选择
- 真正的**工具调用能力**（不只是聊天）
- **跨平台**原生支持，不搞 WSL 那一套
- 完全开源，代码透明

### 1.3 目标用户

1. **隐私敏感型开发者** - 代码不能上云，需要本地模型
2. **多模型尝鲜者** - 想对比不同模型效果，不想装十个客户端
3. **定制化需求者** - 需要改造 Agent 行为，闭源产品无法满足
4. **学习爱好者** - 想了解 AI Agent 原理，从源码学习

---

## 2. 核心功能

### 2.1 功能全景图

```
┌─────────────────────────────────────────────────────────────┐
│                        Xca Agent                            │
├─────────────────────────────────────────────────────────────┤
│  交互层  │  聊天界面 · 命令解析 · 上下文展示 · 权限确认       │
├─────────────────────────────────────────────────────────────┤
│  核心层  │  对话管理 · 工具编排 · LLM路由 · 记忆系统          │
├─────────────────────────────────────────────────────────────┤
│  工具层  │  文件操作 · 命令执行 · 代码搜索 · 终端复用         │
├─────────────────────────────────────────────────────────────┤
│  接入层  │  Ollama · OpenAI · Anthropic · OpenRouter         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 功能详解

#### 2.2.1 多 LLM 支持

**需求描述：** 用户可以灵活切换不同的模型提供商，支持本地和云端混合使用。

**为什么重要：**
- 不同场景需要不同模型（简单问答 vs 复杂推理）
- 用户有隐私、成本、效果的不同权衡
- 避免 vendor lock-in

**具体功能：**

| 提供商 | 类型 | 支持模型示例 | 使用场景 |
|--------|------|-------------|----------|
| Ollama | 本地 | Llama 3, Gemma 4, Qwen | 隐私敏感、离线使用 |
| OpenAI | 云端 | GPT-4o, GPT-4o-mini | 追求最强效果 |
| Anthropic | 云端 | Claude 3.5 Sonnet, Claude 3 Opus | 编程任务首选 |
| OpenRouter | 聚合 | 上述所有 + 更多 | 统一接入、自动切换 |

**交互设计：**

```bash
# 查看当前配置
xca config show

# 切换到本地模型
xca config set provider ollama --model gemma4:26b

# 切换到 Claude
xca config set provider anthropic --model claude-3-5-sonnet-20241022

# 测试当前模型连通性
xca config test
```

#### 2.2.2 工具调用系统

**需求描述：** Agent 可以通过调用预定义工具与用户环境交互。

**为什么重要：**
- 没有工具的 LLM 只是聊天机器人
- 工具让 AI 从"说"进化到"做"
- 这是实现 Claude Code 体验的核心

**工具清单：**

**文件类工具：**
| 工具 | 功能 | 安全级别 |
|------|------|----------|
| `read_file` | 读取文件内容，支持分块读取大文件 | 低风险 |
| `write_file` | 创建/覆盖文件 | 中风险 - 确认覆盖 |
| `edit_file` | 精确替换文本块 | 低风险 - 需 exact match |
| `list_directory` | 列出目录内容 | 低风险 |
| `search_files` | 全局文本搜索 | 低风险 |

**命令类工具：**
| 工具 | 功能 | 安全级别 |
|------|------|----------|
| `execute_command` | 执行 shell 命令 | 高风险 - 需确认 |
| `list_processes` | 查看运行中的进程 | 低风险 |
| `kill_process` | 终止进程 | 中风险 - 需确认 |

**代码类工具：**
| 工具 | 功能 | 安全级别 |
|------|------|----------|
| `read_code` | 读取代码并保留结构 | 低风险 |
| `apply_diff` | 应用 unified diff 格式的修改 | 中风险 - 需确认 |

**交互设计：**

```bash
# 危险命令需要确认
User: 删除 node_modules
Agent: 我将执行 `rm -rf node_modules`，这不可恢复。确认？(y/N)

# 文件修改需要确认
Agent: [建议修改 src/index.ts]
@@ -1,5 +1,5 @@
 function greet() {
-  console.log("Hello");
+  console.log("Hello, World!");
 }

确认应用此修改？(y/n/diff)
```

#### 2.2.3 上下文管理

**需求描述：** 智能管理对话历史和文件上下文，避免超出模型 token 限制。

**为什么重要：**
- 长对话会导致上下文窗口溢出
- 大文件直接塞进去浪费 token
- 用户需要看到 Agent "记得"之前的讨论

**具体功能：**

1. **对话历史管理**
   - 自动保留最近 N 轮对话
   - 早期对话自动生成摘要
   - 支持 `/clear` 手动清空

2. **文件上下文**
   - 大文件自动分块读取
   - 相关文件智能关联（如修改 .ts 时自动读取同目录 .test.ts）
   - 已读文件缓存，避免重复读取

3. **Token 预算**
   ```typescript
   interface TokenBudget {
     maxContext: number;      // 模型最大上下文
     reservedForResponse: number;  // 预留回复空间
     availableForInput: number;    // 实际可用输入
   }
   ```

**交互设计：**

```bash
# 查看当前上下文状态
xca context status
> 当前对话：12 轮
> Token 使用：3,245 / 8,192
> 已加载文件：src/index.ts, src/utils.ts
> 历史摘要：用户正在开发一个 CLI 工具...

# 手动添加文件到上下文
xca context add ./README.md

# 清空上下文
xca context clear
```

#### 2.2.4 跨平台支持

**需求描述：** 原生支持 Windows 和 macOS，提供一致的用户体验。

**为什么重要：**
- 开发者使用不同操作系统
- 路径、权限、命令差异需要处理
- 不能像某些工具一样"Linux only"

**平台差异处理：**

| 特性 | macOS | Windows |
|------|-------|---------|
| 路径格式 | `/Users/name/project` | `C:\Users\name\project` |
| Shell | bash/zsh | PowerShell/CMD |
| 权限 | Unix 权限位 | ACL |
| 配置文件位置 | `~/.config/xca/` | `%APPDATA%\xca\` |
| 快捷键 | Cmd+... | Ctrl+... |

**技术策略：**
- 使用 Node.js 的 `path` 模块处理路径
- 抽象 Shell 执行层，自动检测可用 shell
- 配置文件使用 XDG 规范（macOS 可选遵循）

---

## 3. 用户场景

### 场景 1：新项目初始化

**用户：** 想创建一个 TypeScript + React 项目

**交互流程：**

```bash
$ mkdir my-app && cd my-app
$ xca

User: 帮我初始化一个 TypeScript React 项目
Agent: 我来帮你设置。首先查看当前目录结构...
[工具：list_directory]

Agent: 目录为空。我将创建：
- package.json
- tsconfig.json
- src/App.tsx
- src/main.tsx
- index.html

确认继续？(y/N) y

[工具：write_file x6]
[工具：execute_command: npm install]

Agent: 项目初始化完成！你可以运行 `npm run dev` 启动开发服务器。
```

### 场景 2：代码重构

**用户：** 需要把一个回调函数改写成 async/await

**交互流程：**

```bash
User: 把 fetchData 改成用 async/await
Agent: 让我先查看相关代码...
[工具：search_files: fetchData]
[工具：read_file: src/api.ts]

Agent: 找到 fetchData 函数。建议修改为：
```typescript
// 原代码
function fetchData(callback) {
  request('/api/data', (err, res) => {
    callback(err, res);
  });
}

// 修改后
async function fetchData() {
  return request('/api/data');
}
```
确认应用修改？(y/n/view diff) y

[工具：edit_file]

Agent: 修改完成。需要我帮你更新调用方吗？
[工具：search_files: fetchData(]
```

### 场景 3：本地模型离线使用

**用户：** 在飞机上/没网的环境，用本地模型继续工作

**交互流程：**

```bash
# 提前配置好本地模型
$ xca config set provider ollama --model gemma4:26b

# 断网后正常使用
$ xca

User: 帮我写一个计算斐波那契数列的函数
Agent: [本地模型推理中...]
Agent: 这是一个递归实现：
```typescript
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// 更高效的迭代版本
function fibonacciIterative(n: number): number {
  if (n <= 1) return n;
  let prev = 0, curr = 1;
  for (let i = 2; i <= n; i++) {
    [prev, curr] = [curr, prev + curr];
  }
  return curr;
}
```
需要我帮你添加到项目中吗？
```

### 场景 4：多模型对比

**用户：** 想对比不同模型的代码质量

**交互流程：**

```bash
$ xca ask --provider ollama --model gemma4:26b \
  "写一个 LRU Cache"

[Gemini 的结果...]

$ xca ask --provider anthropic \
  "写一个 LRU Cache"

[Claude 的结果...]

# 或者使用 OpenRouter 快速切换
$ xca config set provider openrouter --model anthropic/claude-3.5-sonnet
```

---

## 4. 交互设计

### 4.1 启动方式

```bash
# 方式 1：交互模式（默认）
xca
> 进入持续对话模式

# 方式 2：单条命令
xca "帮我修复这个 bug"
> 执行一次对话后退出

# 方式 3：文件输入
xca -f prompt.txt
> 从文件读取输入

# 方式 4：管道
ls -la | xca "分析这些文件的用途"
```

### 4.2 内置命令

在交互模式下，以 `/` 开头的命令有特殊含义：

| 命令 | 功能 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空对话上下文 |
| `/undo` | 撤销最后一次修改 |
| `/model` | 查看/切换当前模型 |
| `/cost` | 查看本次会话的 API 消耗 |
| `/exit` | 退出程序 |

### 4.3 权限确认机制

不同风险等级的操作需要不同确认方式：

**高风险（执行命令、删除文件）：**
```
Agent: 即将执行：rm -rf /important/data
⚠️  危险操作！这可能导致数据丢失。
请输入 "delete" 确认：_____
```

**中风险（修改现有文件）：**
```
Agent: 即将修改：src/config.ts
显示 diff？(y/n) y
[diff 内容]
确认应用？(y/N) y
```

**低风险（读取文件、列出目录）：**
```
Agent: [直接执行，无需确认]
```

### 4.4 输出格式

**思考过程展示：**
```
🤔 正在分析...
   - 发现 3 个可能的文件
   - 读取 src/auth.ts
   - 定位到问题：缺少 null 检查

💡 建议修复：
```

**工具调用展示：**
```
🔧 使用工具：read_file
   参数：{"path": "src/index.ts"}

🔧 使用工具：edit_file
   文件：src/index.ts
   状态：✅ 成功
```

---

## 5. 非功能性需求

### 5.1 性能要求

| 指标 | 目标 | 说明 |
|------|------|------|
| 启动时间 | < 2s | 冷启动到可交互 |
| 工具响应 | < 500ms | 本地工具执行 |
| 首 token 延迟 | < 3s | 云端模型首字返回 |
| 内存占用 | < 200MB | 空闲时 |

### 5.2 安全要求

1. **危险命令白名单** - 默认禁止 `rm -rf /`, `mkfs` 等
2. **敏感文件保护** - 读取 `.env`, `~/.ssh/` 等需要额外确认
3. **命令审计日志** - 记录所有执行过的命令
4. **沙箱模式** - 可选只读模式，禁止任何修改

### 5.3 兼容性

- Node.js 18+（LTS 版本）
- Windows 10+ / macOS 12+
- 支持深色/浅色终端

---

## 6. 竞品分析

### 6.1 Claude Code

| 优势 | 劣势 |
|------|------|
| 模型质量极高 | 闭源、绑定 Anthropic |
| 工具调用精准 | 无法本地部署 |
| 上下文管理优秀 | 月费 $20+ |

**学习点：** 工具调用格式、上下文压缩策略

### 6.2 Cline (VS Code 插件)

| 优势 | 劣势 |
|------|------|
| 开源 | 依赖 VS Code |
| 支持多模型 | 只能在编辑器内使用 |
| 支持 MCP | 配置较复杂 |

**学习点：** 模型切换 UI、MCP 集成

### 6.3 aider

| 优势 | 劣势 |
|------|------|
| 命令行友好 | 主要面向 git 仓库 |
| 支持多文件编辑 | 界面较朴素 |
| 与 git 集成好 | 配置门槛较高 |

**学习点：** git 集成、多文件上下文管理

---

## 7. 附录

### 7.1 术语表

| 术语 | 解释 |
|------|------|
| LLM | Large Language Model，大语言模型 |
| Token | 模型处理文本的最小单位 |
| Tool Use | 模型调用外部工具的能力 |
| Context Window | 模型能处理的上下文长度 |
| MoE | Mixture of Experts，混合专家模型 |
| MCP | Model Context Protocol，Anthropic 提出的工具协议 |

### 7.2 待决策事项

- [ ] 是否支持 MCP 协议？
- [ ] 是否内置 RAG（知识库）能力？
- [ ] 是否支持多 Agent 协作？
- [ ] 插件系统的设计范围？

### 7.3 参考资料

- [Claude Code 介绍](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Ollama API 文档](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Cline 源码](https://github.com/cline/cline)
- [aider 源码](https://github.com/Aider-AI/aider)

---

**文档状态：** 草案评审中  
**下一步：** 技术方案设计 → 原型验证 → 详细设计确认
