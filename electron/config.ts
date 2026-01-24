import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface TorConfig {
  useBridges: boolean;
  bridgeLines: string;
}

const DEFAULT_CONFIG: TorConfig = {
  useBridges: false,
  bridgeLines: '',
};

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private config: TorConfig;

  private constructor() {
    this.configPath = path.join(app.getPath('userData'), 'tor-config.json');
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): TorConfig {
    if (!fs.existsSync(this.configPath)) {
      return { ...DEFAULT_CONFIG };
    }
    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (e) {
      console.error('ConfigManager: Failed to load config', e);
      return { ...DEFAULT_CONFIG };
    }
  }

  public getTorConfig(): TorConfig {
    return this.config;
  }

  public saveTorConfig(newConfig: Partial<TorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (e) {
      console.error('ConfigManager: Failed to save config', e);
    }
  }
}
