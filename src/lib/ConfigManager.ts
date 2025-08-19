import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import type { Config } from '../types.js';
import { sanitizeOutputPath } from '../utils/pathSanitizer.js';

export class ConfigManager {
  private readonly configDir: string;
  private readonly configFile: string;
  private readonly defaultConfig: Config;

  constructor() {
    this.configDir = path.join(homedir(), '.config', 'cchistory');
    this.configFile = path.join(this.configDir, 'config.json');
    
    // Get the project root directory (2 levels up from this file)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..', '..');
    
    // Default to exports directory in the project root
    const defaultExportDir = process.env.CCHISTORY_EXPORT_DIR || 
                           path.join(projectRoot, 'exports');
    
    this.defaultConfig = {
      exportDir: defaultExportDir,
      dateFormat: 'YYYY/MM/DD HH:mm:ss',
      maxPreviewLength: 100,
      maxResultLength: 3000
    };
  }

  async load(): Promise<Config> {
    try {
      await fs.ensureDir(this.configDir);
      
      if (await fs.pathExists(this.configFile)) {
        const configData = await fs.readJson(this.configFile);
        const config = { ...this.defaultConfig, ...configData };
        
        // Validate and sanitize export directory
        config.exportDir = sanitizeOutputPath(config.exportDir, config.allowedBasePath);
        
        return config;
      } else {
        await fs.writeJson(this.configFile, this.defaultConfig, { spaces: 2 });
        console.log(chalk.green(`✅ 設定ファイルを作成しました: ${this.configFile}`));
        return this.defaultConfig;
      }
    } catch (error) {
      console.error(chalk.yellow('⚠️  設定ファイルの読み込みに失敗しました。デフォルト設定を使用します。'));
      return this.defaultConfig;
    }
  }

  getDefaultConfig(): Config {
    return { ...this.defaultConfig };
  }
}
