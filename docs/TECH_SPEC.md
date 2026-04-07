# Xca Agent - 技术方案文档

> 版本：v0.1.0-draft  
> 状态：设计中  
> 对应 PRD：v0.1.0

---

## 1. 技术选型

### 1.1 核心语言：TypeScript + Node.js

**选择理由：**
- 跨平台能力：同一份代码跑 Windows/macOS/Linux
- 生态成熟：丰富的库支持（CLI、HTTP、文件操作）
- 开发效率：类型安全 + 现代语言特性
- 分发友好：可用 pkg/nexe 打包为独立可执行文件

**备选方案对比：**

| 方案 | 优势 | 劣势 | 结论 |
|------|------|------|------|
| Rust | 性能极致、单二进制 | 开发周期长、团队学习成本 | ❌ 适合 v2.0 |
| Python | AI 生态最强 | 分发困难、用户需装 Python | ❌ 不适合 CLI 工具 |
| Go | 编译快、单二进制 | 类型系统较弱、错误处理冗长 | ❌ 生态不如 Node |
| Deno | 现代化、内置 TS | 生态较小、与 Node 不兼容 | ❌ 风险较高 |

### 1.2 运行时要求

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- Node.js 18+ 提供原生 Fetch API
- 长期支持版本，稳定性有保障

### 1.3 关键依赖

| 依赖 | 用途 | 替代方案 |
|------|------|----------|
| `commander` | CLI 命令解析 | `yargs`, `oclif` |
| `chalk` | 终端颜色输出 | `ansi-colors`, `kleur` |
| `inquirer` | 交互式提示 | `enquirer`, `@inquirer/prompts` |
| `ora` | 加载动画 | `cli-spinners` |
| `diff` | 文本 diff 计算 | `diff-match-patch` |
| `zod` | 运行时类型校验 | `joi`, `valibot` |
| `globby` | 文件 glob 匹配 | `fast-glob` |
| `execa` | 进程执行 | `child_process` 原生 |

---

## 2. 系统架构

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                         │
│  CLI Parser │ Interactive UI │ Output Formatter │ Input Handler │
├─────────────────────────────────────────────────────────────────┤
│                        Core Layer                               │
│  Agent │ Conversation │ Tool Orchestrator │ Context Manager    │
├─────────────────────────────────────────────────────────────────┤
│                      Provider Layer                             │
│  OllamaAdapter │ OpenAIAdapter │ AnthropicAdapter │ OpenRouter  │
├─────────────────────────────────────────────────────────────────┤
│                       Tool Layer                                │
│  FileSystem │ Shell │ Search │ Git │ Editor                     │
├─────────────────────────────────────────────────────────────────┤
│                      Platform Layer                             │
│  Path Resolver │ Shell Detector │ Permission Manager           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块依赖图

```
                    ┌─────────────┐
                    │     CLI     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Agent    │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐    ┌─────▼─────┐
    │Provider │      │  Tools    │    │  Context  │
    └────┬────┘      └─────┬─────┘    └─────┬─────┘
         │                 │                │
    ┌────┴────┐      ┌─────┴─────┐    ┌─────┴─────┐
    │LLM APIs │      │ File/Shell│    │ Memory    │
    └─────────┘      └───────────┘    └───────────┘
```

### 2.3 核心流程

**对话处理流程：**

```
用户输入
    │
    ▼
[Input Parser] ──→ 内置命令？ ──是──→ [Command Handler]
    │                │
    │               否
    │                │
    ▼                ▼
[Context Builder] ←── 加载历史、相关文件
    │
    ▼
[Token Budget Check]
    │
    ├── 超出预算？──→ [Context Compression]
    │
    ▼
[LLM Provider] ──→ 发送请求
    │
    ▼
[Response Parser]
    │
    ├── 纯文本 ──→ 直接输出
    │
    └── 工具调用 ──→ [Tool Executor] ──→ 执行结果回填 ──→ [LLM Provider]
                                              │
                                              ▼
                                         最终回复给用户
```

---

## 3. 核心模块设计

### 3.1 Provider 抽象层

**接口定义：**

```typescript
// src/providers/base.ts

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

interface LLMResponse {
  content?: string;
  tool_calls?: ToolCall[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

abstract class BaseProvider {
  abstract readonly name: string;
  abstract readonly supportedModels: string[];
  
  constructor(protected config: ProviderConfig) {}
  
  // 发送消息，返回完整响应
  abstract chat(
    messages: Message[], 
    tools?: Tool[],
    options?: ChatOptions
  ): Promise<LLMResponse>;
  
  // 流式响应
  abstract stream(
    messages: Message[],
    tools?: Tool[],
    options?: ChatOptions
  ): AsyncIterable<LLMResponseChunk>;
  
  // 计算 token 数（估算）
  abstract countTokens(text: string): number;
  
  // 测试连通性
  abstract ping(): Promise<boolean>;
}
```

**Provider 实现列表：**

| Provider | 核心差异点 |
|----------|-----------|
| `OllamaProvider` | 本地 HTTP 接口，无需认证，支持模型拉取 |
| `OpenAIProvider` | 标准 OpenAI 格式，Bearer Token 认证 |
| `AnthropicProvider` | 特殊 message 格式，支持 system prompt，tool 格式不同 |
| `OpenRouterProvider` | 兼容 OpenAI 格式，支持路由头 |

### 3.2 工具系统

**工具接口：**

```typescript
// src/tools/base.ts

interface ToolContext {
  cwd: string;
  workspaceRoot: string;
  userPermissions: PermissionSet;
}

interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: JSONSchema;
  abstract readonly riskLevel: 'low' | 'medium' | 'high';
  
  abstract execute(
    args: unknown, 
    context: ToolContext
  ): Promise<ToolResult>;
  
  // 可选：格式化工具结果供 LLM 阅读
  formatForLLM?(result: ToolResult): string {
    return result.content;
  }
}
```

**工具实现示例：**

```typescript
// src/tools/file-system.ts

class ReadFileTool extends BaseTool {
  name = 'read_file';
  description = '读取文件内容，支持分块读取大文件';
  riskLevel = 'low';
  
  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      offset: { type: 'number', description: '起始行号（从1开始）' },
      limit: { type: 'number', description: '读取行数' }
    },
    required: ['path']
  };
  
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { path, offset, limit } = ReadFileSchema.parse(args);
    const fullPath = resolvePath(ctx.cwd, path);
    
    // 安全检查
    if (isSensitivePath(fullPath)) {
      return {
        success: false,
        content: '',
        error: '拒绝访问敏感路径'
      };
    }
    
    try {
      const content = await readFileChunk(fullPath, offset, limit);
      return {
        success: true,
        content,
        metadata: { totalLines: await getLineCount(fullPath) }
      };
    } catch (e) {
      return {
        success: false,
        content: '',
        error: e.message
      };
    }
  }
}
```

### 3.3 上下文管理

**Token 预算分配：**

```typescript
// src/context/budget.ts

interface TokenBudget {
  // 模型总容量
  maxContext: number;
  
  // 预留回复空间（避免输入塞满导致无法输出）
  reservedForResponse: number;
  
  // 实际可用于输入的预算
  get availableForInput(): number;
  
  // 已使用
  used: number;
  
  // 剩余
  get remaining(): number;
}

class ContextManager {
  private messages: Message[] = [];
  private fileCache: Map<string, FileCache> = new Map();
  
  constructor(
    private budget: TokenBudget,
    private summarizer: Summarizer
  ) {}
  
  // 添加消息，自动处理超预算
  async addMessage(message: Message): Promise<void> {
    const messageTokens = estimateTokens(message.content);
    
    if (this.budget.remaining < messageTokens) {
      // 需要压缩上下文
      await this.compressContext();
    }
    
    this.messages.push(message);
    this.budget.used += messageTokens;
  }
  
  // 压缩策略：摘要早期对话
  private async compressContext(): Promise<void> {
    // 保留最近 N 轮
    const recentMessages = this.messages.slice(-6);
    
    // 早期的进行摘要
    const oldMessages = this.messages.slice(0, -6);
    const summary = await this.summarizer.summarize(oldMessages);
    
    this.messages = [
      { role: 'system', content: `历史摘要：${summary}` },
      ...recentMessages
    ];
    
    this.recalculateBudget();
  }
  
  // 添加文件到上下文（自动分块）
  async addFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const tokens = estimateTokens(content);
    
    if (tokens > this.budget.remaining * 0.5) {
      // 文件太大，只读部分
      const chunk = content.slice(0, this.budget.remaining * 0.5 * 4);
      await this.addMessage({
        role: 'user',
        content: `文件 ${filePath} 部分内容：\n\n${chunk}...\n（文件过大，仅显示前 ${chunk.length} 字符）`
      });
    } else {
      await this.addMessage({
        role: 'user',
        content: `文件 ${filePath}：\n\n${content}`
      });
    }
  }
  
  getMessages(): Message[] {
    return this.messages;
  }
  
  clear(): void {
    this.messages = [];
    this.fileCache.clear();
    this.budget.used = 0;
  }
}
```

### 3.4 Agent 核心编排

```typescript
// src/agent.ts

interface AgentConfig {
  provider: BaseProvider;
  tools: BaseTool[];
  contextManager: ContextManager;
  safetyConfig: SafetyConfig;
}

class Agent {
  private toolMap: Map<string, BaseTool>;
  
  constructor(private config: AgentConfig) {
    this.toolMap = new Map(tools.map(t => [t.name, t]));
  }
  
  async process(userInput: string): Promise<void> {
    // 1. 添加到上下文
    await this.config.contextManager.addMessage({
      role: 'user',
      content: userInput
    });
    
    // 2. 循环处理，直到没有工具调用
    let hasToolCalls = true;
    while (hasToolCalls) {
      const response = await this.config.provider.chat(
        this.config.contextManager.getMessages(),
        this.getToolDefinitions()
      );
      
      // 3. 处理工具调用
      if (response.tool_calls?.length > 0) {
        await this.handleToolCalls(response.tool_calls);
        hasToolCalls = true;
      } else {
        // 4. 输出最终回复
        console.log(response.content);
        await this.config.contextManager.addMessage({
          role: 'assistant',
          content: response.content
        });
        hasToolCalls = false;
      }
    }
  }
  
  private async handleToolCalls(calls: ToolCall[]): Promise<void> {
    for (const call of calls) {
      const tool = this.toolMap.get(call.function.name);
      if (!tool) {
        console.error(`未知工具：${call.function.name}`);
        continue;
      }
      
      // 安全检查
      if (tool.riskLevel !== 'low') {
        const confirmed = await confirmToolExecution(tool, call);
        if (!confirmed) continue;
      }
      
      // 执行工具
      const args = JSON.parse(call.function.arguments);
      const result = await tool.execute(args, this.getContext());
      
      // 回填结果
      await this.config.contextManager.addMessage({
        role: 'tool',
        tool_call_id: call.id,
        content: result.success 
          ? result.content 
          : `错误：${result.error}`
      });
    }
  }
}
```

---

## 4. 数据模型

### 4.1 配置模型

```typescript
// src/config/schema.ts

const ProviderConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ollama'),
    baseUrl: z.string().default('http://localhost:11434'),
    model: z.string(),
    apiKey: z.null().optional()
  }),
  z.object({
    type: z.literal('openai'),
    baseUrl: z.string().default('https://api.openai.com/v1'),
    model: z.string(),
    apiKey: z.string()
  }),
  z.object({
    type: z.literal('anthropic'),
    baseUrl: z.string().default('https://api.anthropic.com'),
    model: z.string(),
    apiKey: z.string()
  }),
  z.object({
    type: z.literal('openrouter'),
    baseUrl: z.string().default('https://openrouter.ai/api/v1'),
    model: z.string(),
    apiKey: z.string()
  })
]);

const UserConfigSchema = z.object({
  // 当前激活的 provider
  activeProvider: ProviderConfigSchema,
  
  // Fallback 配置
  fallback: ProviderConfigSchema.optional(),
  
  // 安全设置
  safety: z.object({
    confirmDestructiveCommands: z.boolean().default(true),
    confirmFileOverwrites: z.boolean().default(true),
    allowedCommands: z.array(z.string()).optional(),
    blockedCommands: z.array(z.string()).default(['rm -rf /', 'mkfs', 'dd']),
    sensitivePaths: z.array(z.string()).default(['~/.ssh', '~/.env'])
  }),
  
  // 上下文设置
  context: z.object({
    maxHistory: z.number().default(20),
    summarizeThreshold: z.number().default(10),
    tokenBudget: z.number().default(8000)
  }),
  
  // UI 设置
  ui: z.object({
    theme: z.enum(['auto', 'dark', 'light']).default('auto'),
    showThinking: z.boolean().default(true),
    language: z.string().default('zh-CN')
  })
});

type UserConfig = z.infer<typeof UserConfigSchema>;
```

### 4.2 对话历史存储

```typescript
// 存储格式：JSONL
// ~/.config/xca/conversations/2026-04-07-session-id.jsonl

interface ConversationRecord {
  id: string;
  timestamp: string;
  messages: Message[];
  metadata: {
    provider: string;
    model: string;
    totalTokens: number;
    durationMs: number;
  };
}
```

---

## 5. 平台适配

### 5.1 路径处理

```typescript
// src/platform/path.ts

import { homedir, platform } from 'os';
import { join, resolve, normalize } from 'path';

class PathResolver {
  // 解析 ~ 为用户目录
  resolveHome(inputPath: string): string {
    if (inputPath.startsWith('~/') || inputPath === '~') {
      return join(homedir(), inputPath.slice(1));
    }
    return inputPath;
  }
  
  // 跨平台配置目录
  getConfigDir(): string {
    const system = platform();
    switch (system) {
      case 'win32':
        return join(process.env.APPDATA || '', 'xca');
      case 'darwin':
        return join(homedir(), 'Library', 'Application Support', 'xca');
      default: // linux
        return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'xca');
    }
  }
  
  // 安全路径检查（防止目录遍历）
  isSafePath(targetPath: string, allowedRoot: string): boolean {
    const resolved = resolve(targetPath);
    const root = resolve(allowedRoot);
    return resolved.startsWith(root);
  }
}
```

### 5.2 Shell 适配

```typescript
// src/platform/shell.ts

interface ShellInfo {
  command: string;
  args: string[];
  shell: 'bash' | 'zsh' | 'powershell' | 'cmd';
}

class ShellDetector {
  detect(): ShellInfo {
    const system = platform();
    
    if (system === 'win32') {
      // 优先 PowerShell，fallback CMD
      if (this.hasPowerShell()) {
        return { command: 'powershell', args: ['-Command'], shell: 'powershell' };
      }
      return { command: 'cmd', args: ['/c'], shell: 'cmd' };
    }
    
    // macOS/Linux
    const shell = process.env.SHELL || '/bin/bash';
    const shellName = shell.split('/').pop();
    
    return {
      command: shell,
      args: ['-c'],
      shell: shellName === 'zsh' ? 'zsh' : 'bash'
    };
  }
  
  private hasPowerShell(): boolean {
    // 检测 PowerShell 是否存在
    try {
      execSync('powershell -Command "exit 0"', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 6. 安全设计

### 6.1 权限系统

```typescript
// src/safety/permissions.ts

interface PermissionSet {
  readFiles: boolean;
  writeFiles: boolean;
  executeCommands: boolean;
  allowedPaths: string[];
  blockedPaths: string[];
  allowedCommands: string[];
  blockedCommands: string[];
}

enum RiskLevel {
  LOW = 'low',      // 读取操作
  MEDIUM = 'medium', // 修改现有文件
  HIGH = 'high'     // 删除、执行命令
}

class SafetyChecker {
  constructor(private permissions: PermissionSet) {}
  
  checkFileRead(path: string): { allowed: boolean; reason?: string } {
    if (this.isBlockedPath(path)) {
      return { allowed: false, reason: '路径在黑名单中' };
    }
    return { allowed: this.permissions.readFiles };
  }
  
  checkFileWrite(path: string, exists: boolean): { allowed: boolean; reason?: string } {
    if (!this.permissions.writeFiles) {
      return { allowed: false, reason: '文件写入未授权' };
    }
    if (exists && this.permissions.confirmFileOverwrites) {
      return { allowed: true, reason: '需要确认覆盖' };
    }
    return { allowed: true };
  }
  
  checkCommand(command: string): { allowed: boolean; risk: RiskLevel; reason?: string } {
    // 解析命令名
    const cmd = command.trim().split(' ')[0];
    
    // 检查黑名单
    if (this.permissions.blockedCommands.some(bc => command.includes(bc))) {
      return { allowed: false, risk: RiskLevel.HIGH, reason: '命令在黑名单中' };
    }
    
    // 危险命令识别
    if (['rm', 'dd', 'mkfs', 'fdisk'].includes(cmd)) {
      return { allowed: true, risk: RiskLevel.HIGH, reason: '危险命令，需确认' };
    }
    
    return { allowed: true, risk: RiskLevel.MEDIUM };
  }
  
  private isBlockedPath(path: string): boolean {
    return this.permissions.blockedPaths.some(bp => 
      path.includes(bp.replace('~', homedir()))
    );
  }
}
```

### 6.2 审计日志

```typescript
// src/safety/audit.ts

interface AuditEntry {
  timestamp: string;
  type: 'command' | 'file_read' | 'file_write' | 'tool_call';
  details: Record<string, unknown>;
  userConfirmed?: boolean;
}

class AuditLogger {
  private logPath: string;
  
  constructor() {
    this.logPath = join(getConfigDir(), 'audit.log');
  }
  
  async log(entry: AuditEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.logPath, line, 'utf-8');
  }
  
  async getRecent(limit = 100): Promise<AuditEntry[]> {
    const content = await fs.readFile(this.logPath, 'utf-8');
    return content
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .map(line => JSON.parse(line));
  }
}
```

---

## 7. 测试策略

### 7.1 测试分层

```
tests/
├── unit/              # 单元测试
│   ├── providers/     # Provider 适配器测试
│   ├── tools/         # 工具测试
│   ├── context/       # 上下文管理测试
│   └── utils/         # 工具函数测试
├── integration/       # 集成测试
│   ├── provider-e2e/  # 真实 API 测试（可选）
│   └── tool-e2e/      # 工具链测试
└── fixtures/          # 测试数据
```

### 7.2 关键测试用例

| 模块 | 测试场景 |
|------|----------|
| Provider | 各 Provider 格式转换正确、错误处理、超时处理 |
| Tools | 路径安全、大文件处理、权限检查 |
| Context | Token 预算计算、摘要生成、历史清理 |
| Agent | 多轮工具调用、错误恢复、超时取消 |

---

## 8. 构建与分发

### 8.1 打包配置

```json
// package.json
{
  "scripts": {
    "build": "tsc",
    "package": "pkg dist/index.js --targets node18-win-x64,node18-macos-x64,node18-macos-arm64",
    "test": "vitest"
  },
  "pkg": {
    "scripts": ["dist/**/*.js"],
    "assets": ["templates/**/*"]
  }
}
```

### 8.2 安装方式

| 方式 | 命令 |
|------|------|
| npm | `npm install -g xca-agent` |
| Homebrew | `brew install xca-agent` |
| 独立二进制 | GitHub Releases 下载 |
| 源码 | `git clone && npm install && npm link` |

---

## 9. 性能优化

### 9.1 启动优化
- 使用 `esbuild` 打包为单文件，减少 require 时间
- 延迟加载 Provider 实现（用到再加载）
- 配置缓存，避免重复读取文件

### 9.2 运行时优化
- 文件读取使用流式，避免大文件内存占用
- 工具并行执行（无依赖时）
- Token 估算使用近似算法，避免频繁调用 tokenizer

---

## 10. 开发路线图

详见 [ROADMAP.md](./ROADMAP.md)

---

**下一步：**
1. 评审 PRD 和 TECH_SPEC
2. 确定 MVP 功能范围
3. 开始原型开发
