import chalk from 'chalk';
import { loadConfig, saveConfig, configExists, getDefaultConfig } from './loader.js';
import type { UserConfig } from './schema.js';

export async function initConfig(): Promise<void> {
  if (await configExists()) {
    console.log(chalk.yellow('Configuration already exists.'));
    console.log(chalk.gray('Use "xca config show" to view current config.'));
    return;
  }

  const defaultConfig = getDefaultConfig();
  await saveConfig(defaultConfig);
  
  console.log(chalk.green('✅ Configuration created at: ~/.config/xca/config.json'));
  console.log(chalk.gray('Edit this file to customize your settings.'));
}

export async function showConfig(): Promise<void> {
  const config = await loadConfig();
  
  console.log(chalk.bold('\n📋 Current Configuration\n'));
  
  console.log(chalk.cyan('Provider:'));
  console.log(`  Type: ${config.activeProvider.type}`);
  console.log(`  Model: ${config.activeProvider.model}`);
  console.log(`  Base URL: ${config.activeProvider.baseUrl}`);
  if ('apiKey' in config.activeProvider) {
    const key = config.activeProvider.apiKey;
    console.log(`  API Key: ${key.slice(0, 4)}****${key.slice(-4)}`);
  }
  
  console.log(chalk.cyan('\nSafety:'));
  console.log(`  Confirm destructive commands: ${config.safety.confirmDestructiveCommands ? '✅' : '❌'}`);
  console.log(`  Confirm file overwrites: ${config.safety.confirmFileOverwrites ? '✅' : '❌'}`);
  
  console.log(chalk.cyan('\nContext:'));
  console.log(`  Max history: ${config.context.maxHistory}`);
  console.log(`  Token budget: ${config.context.tokenBudget}`);
  
  console.log();
}

export async function setConfig(key: string, value: string): Promise<void> {
  const config = await loadConfig();
  
  // 简单的键值设置，后续可以扩展
  if (key === 'provider') {
    if (!['ollama', 'openai', 'anthropic', 'openrouter'].includes(value)) {
      throw new Error(`Unknown provider: ${value}`);
    }
    config.activeProvider = {
      ...getDefaultConfig().activeProvider,
      type: value as 'ollama',
    };
  } else if (key === 'model') {
    config.activeProvider.model = value;
  } else {
    throw new Error(`Unknown config key: ${key}`);
  }
  
  await saveConfig(config);
}

export async function testConfig(): Promise<void> {
  const config = await loadConfig();
  
  console.log(chalk.blue('\n🔄 Testing connection...\n'));
  console.log(`Provider: ${config.activeProvider.type}`);
  console.log(`Model: ${config.activeProvider.model}`);
  console.log(`Base URL: ${config.activeProvider.baseUrl}`);
  console.log();
  
  // TODO: 实际测试连接
  console.log(chalk.yellow('⚠️  Connection test not yet implemented'));
  console.log(chalk.gray('This feature will be available in v0.2.0'));
}
