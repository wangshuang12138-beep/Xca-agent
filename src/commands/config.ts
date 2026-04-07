import { Command } from 'commander';
import chalk from 'chalk';
import { initConfig, showConfig, setConfig, testConfig } from './config/manager.js';

export function createConfigCommand(): Command {
  const config = new Command('config')
    .description('Manage Xca Agent configuration');

  config
    .command('init')
    .description('Initialize configuration file')
    .action(async () => {
      try {
        await initConfig();
        console.log(chalk.green('✅ Configuration initialized'));
      } catch (error) {
        console.error(chalk.red('Failed to initialize config:'), error);
      }
    });

  config
    .command('show')
    .description('Show current configuration')
    .action(async () => {
      try {
        await showConfig();
      } catch (error) {
        console.error(chalk.red('Failed to show config:'), error);
      }
    });

  config
    .command('set')
    .description('Set configuration value')
    .argument('<key>', 'Configuration key (e.g., provider, model)')
    .argument('<value>', 'Value to set')
    .action(async (key, value) => {
      try {
        await setConfig(key, value);
        console.log(chalk.green(`✅ Set ${key} = ${value}`));
      } catch (error) {
        console.error(chalk.red('Failed to set config:'), error);
      }
    });

  config
    .command('test')
    .description('Test connection to current provider')
    .action(async () => {
      try {
        await testConfig();
      } catch (error) {
        console.error(chalk.red('Connection test failed:'), error);
      }
    });

  return config;
}
