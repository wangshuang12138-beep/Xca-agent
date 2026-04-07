import { homedir, platform } from 'os';
import { join } from 'path';
import { promises as fs } from 'fs';
import { UserConfigSchema, type UserConfig } from './schema.js';

const CONFIG_FILE = 'config.json';

function getConfigDir(): string {
  const system = platform();
  switch (system) {
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', 'xca');
    case 'win32':
      return join(process.env.APPDATA || homedir(), 'xca');
    default: // linux
      return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'xca');
  }
}

function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE);
}

export async function configExists(): Promise<boolean> {
  try {
    await fs.access(getConfigPath());
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(): Promise<UserConfig> {
  const configPath = getConfigPath();
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return UserConfigSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // 配置文件不存在，返回默认配置
      return getDefaultConfig();
    }
    throw error;
  }
}

export async function saveConfig(config: UserConfig): Promise<void> {
  const configDir = getConfigDir();
  const configPath = getConfigPath();
  
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

function getDefaultConfig(): UserConfig {
  return {
    activeProvider: {
      type: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'gemma4:4b',
    },
    safety: {
      confirmDestructiveCommands: true,
      confirmFileOverwrites: true,
      blockedCommands: ['rm -rf /', 'mkfs', 'dd if=/dev/zero'],
      sensitivePaths: ['~/.ssh', '~/.aws', '~/.env'],
    },
    context: {
      maxHistory: 20,
      summarizeThreshold: 10,
      tokenBudget: 8000,
    },
    ui: {
      theme: 'auto',
      showThinking: true,
      language: 'zh-CN',
    },
  };
}

export { getConfigDir, getConfigPath, getDefaultConfig };
