import chalk from 'chalk';
import readline from 'readline';
import type { UserConfig } from './config/schema.js';

export async function runInteractiveMode(config: UserConfig): Promise<void> {
  console.log(chalk.blue('🤖 Xca Agent'), chalk.gray('v0.1.0'));
  console.log(chalk.gray(`Provider: ${config.activeProvider.type} (${config.activeProvider.model})`));
  console.log(chalk.gray('Type /help for commands, /exit to quit\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('> '),
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (!input) {
      rl.prompt();
      return;
    }

    // 处理内置命令
    if (input.startsWith('/')) {
      const handled = await handleCommand(input, config);
      if (!handled) {
        rl.close();
        return;
      }
      rl.prompt();
      return;
    }

    // TODO: 处理正常对话
    console.log(chalk.yellow('🚧 Chat mode not yet implemented'));
    console.log(chalk.gray('This feature will be available in v0.2.0\n'));

    rl.prompt();
  });

  return new Promise((resolve) => {
    rl.on('close', () => {
      console.log(chalk.gray('\nGoodbye!'));
      resolve();
    });
  });
}

async function handleCommand(input: string, config: UserConfig): Promise<boolean> {
  const [command, ...args] = input.slice(1).split(' ');

  switch (command) {
    case 'help':
      showHelp();
      return true;
    
    case 'exit':
    case 'quit':
      return false;
    
    case 'context':
      await showContextStatus(config);
      return true;
    
    case 'clear':
      console.clear();
      console.log(chalk.blue('🤖 Xca Agent'), chalk.gray('v0.1.0'));
      console.log(chalk.gray('Context cleared.\n'));
      return true;
    
    default:
      console.log(chalk.red(`Unknown command: /${command}`));
      console.log(chalk.gray('Type /help for available commands'));
      return true;
  }
}

function showHelp(): void {
  console.log(chalk.bold('\n📖 Available Commands\n'));
  console.log('  /help     Show this help message');
  console.log('  /clear    Clear screen');
  console.log('  /context  Show context status');
  console.log('  /exit     Exit the program');
  console.log();
  console.log(chalk.gray('For configuration, use: xca config <command>'));
  console.log();
}

async function showContextStatus(config: UserConfig): Promise<void> {
  console.log(chalk.cyan('\n📊 Context Status\n'));
  console.log(`Provider: ${config.activeProvider.type}`);
  console.log(`Model: ${config.activeProvider.model}`);
  console.log(`Token budget: ${config.context.tokenBudget}`);
  console.log(chalk.gray('\n🚧 Context tracking not yet implemented'));
  console.log(chalk.gray('This feature will be available in v0.4.0\n'));
}
