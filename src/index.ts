#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import { createConfigCommand } from './commands/config.js';
import { runInteractiveMode } from './interactive.js';
import { loadConfig } from './config/loader.js';

const packageJson = {
  version: '0.1.0'
};

program
  .name('xca')
  .description('Xca Agent - A flexible LLM agent similar to Claude Code')
  .version(packageJson.version);

// 配置命令
program.addCommand(createConfigCommand());

// 默认：交互模式
program
  .argument('[message]', 'Single message to send (if not provided, enters interactive mode)')
  .option('-p, --provider <provider>', 'Override provider')
  .option('-m, --model <model>', 'Override model')
  .option('--danger', 'Skip safety confirmations (dangerous)')
  .action(async (message, options) => {
    try {
      const config = await loadConfig();
      
      // 覆盖配置
      if (options.provider) config.activeProvider.type = options.provider;
      if (options.model) config.activeProvider.model = options.model;
      if (options.danger) config.safety.confirmDestructiveCommands = false;

      if (message) {
        // 单条消息模式
        console.log(chalk.blue('🤖 Xca Agent'), chalk.gray(`v${packageJson.version}`));
        console.log(chalk.gray('Provider:'), config.activeProvider.type);
        console.log();
        
        // TODO: 实现单条消息处理
        console.log(chalk.yellow('单条消息模式尚未实现，请先使用交互模式'));
        console.log(chalk.gray('运行: xca'));
      } else {
        // 交互模式
        await runInteractiveMode(config);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
