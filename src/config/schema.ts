import { z } from 'zod';

// Provider 配置
export const OllamaConfigSchema = z.object({
  type: z.literal('ollama'),
  baseUrl: z.string().default('http://localhost:11434'),
  model: z.string(),
});

export const OpenAIConfigSchema = z.object({
  type: z.literal('openai'),
  baseUrl: z.string().default('https://api.openai.com/v1'),
  model: z.string(),
  apiKey: z.string(),
});

export const AnthropicConfigSchema = z.object({
  type: z.literal('anthropic'),
  baseUrl: z.string().default('https://api.anthropic.com'),
  model: z.string(),
  apiKey: z.string(),
});

export const OpenRouterConfigSchema = z.object({
  type: z.literal('openrouter'),
  baseUrl: z.string().default('https://openrouter.ai/api/v1'),
  model: z.string(),
  apiKey: z.string(),
});

export const ProviderConfigSchema = z.discriminatedUnion('type', [
  OllamaConfigSchema,
  OpenAIConfigSchema,
  AnthropicConfigSchema,
  OpenRouterConfigSchema,
]);

// 安全设置
export const SafetyConfigSchema = z.object({
  confirmDestructiveCommands: z.boolean().default(true),
  confirmFileOverwrites: z.boolean().default(true),
  allowedCommands: z.array(z.string()).optional(),
  blockedCommands: z.array(z.string()).default(['rm -rf /', 'mkfs', 'dd if=/dev/zero']),
  sensitivePaths: z.array(z.string()).default(['~/.ssh', '~/.aws', '~/.env']),
});

// 上下文设置
export const ContextConfigSchema = z.object({
  maxHistory: z.number().default(20),
  summarizeThreshold: z.number().default(10),
  tokenBudget: z.number().default(8000),
});

// UI 设置
export const UIConfigSchema = z.object({
  theme: z.enum(['auto', 'dark', 'light']).default('auto'),
  showThinking: z.boolean().default(true),
  language: z.string().default('zh-CN'),
});

// 完整配置
export const UserConfigSchema = z.object({
  activeProvider: ProviderConfigSchema,
  fallback: ProviderConfigSchema.optional(),
  safety: SafetyConfigSchema.default({}),
  context: ContextConfigSchema.default({}),
  ui: UIConfigSchema.default({}),
});

export type UserConfig = z.infer<typeof UserConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type SafetyConfig = z.infer<typeof SafetyConfigSchema>;
