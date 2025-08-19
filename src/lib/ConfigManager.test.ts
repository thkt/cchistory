import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager } from './ConfigManager';
import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';

vi.mock('fs-extra');
vi.mock('../utils/pathSanitizer', () => ({
  sanitizeOutputPath: vi.fn((p: string) => p)
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockConfigDir = path.join(homedir(), '.config', 'cchistory');
  const mockConfigFile = path.join(mockConfigDir, 'config.json');

  beforeEach(() => {
    configManager = new ConfigManager();
    vi.clearAllMocks();
  });

  describe('load', () => {
    it('should create config file with defaults if it does not exist', async () => {
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.pathExists).mockResolvedValue(false);
      vi.mocked(fs.writeJson).mockResolvedValue(undefined);

      const config = await configManager.load();

      expect(fs.ensureDir).toHaveBeenCalledWith(mockConfigDir);
      expect(fs.pathExists).toHaveBeenCalledWith(mockConfigFile);
      expect(fs.writeJson).toHaveBeenCalledWith(
        mockConfigFile,
        expect.objectContaining({
          exportDir: expect.stringContaining('exports'),
          dateFormat: 'YYYY/MM/DD HH:mm:ss',
          maxPreviewLength: 100,
          maxResultLength: 3000
        }),
        { spaces: 2 }
      );
      expect(config).toHaveProperty('exportDir');
      expect(config).toHaveProperty('dateFormat');
    });

    it('should load existing config file', async () => {
      const mockConfig = {
        exportDir: '~/Tools/custom/path',
        dateFormat: 'YYYY-MM-DD',
        maxPreviewLength: 50,
        maxResultLength: 1000
      };

      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readJson).mockResolvedValue(mockConfig);

      const config = await configManager.load();

      expect(fs.readJson).toHaveBeenCalledWith(mockConfigFile);
      expect(config.exportDir).toBe('~/Tools/custom/path');
      expect(config.maxPreviewLength).toBe(50);
    });

    it('should merge with defaults when loading partial config', async () => {
      const partialConfig = {
        maxPreviewLength: 200
      };

      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readJson).mockResolvedValue(partialConfig);

      const config = await configManager.load();

      expect(config.maxPreviewLength).toBe(200);
      expect(config.dateFormat).toBe('YYYY/MM/DD HH:mm:ss'); // Default value
      expect(config.maxResultLength).toBe(3000); // Default value
    });

    it('should return default config on error', async () => {
      vi.mocked(fs.ensureDir).mockRejectedValue(new Error('Permission denied'));

      const config = await configManager.load();

      expect(config).toEqual(configManager.getDefaultConfig());
    });
  });

  describe('getDefaultConfig', () => {
    it('should return a copy of default config', () => {
      const config1 = configManager.getDefaultConfig();
      const config2 = configManager.getDefaultConfig();

      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same values
      expect(config1).toHaveProperty('exportDir');
      expect(config1).toHaveProperty('dateFormat', 'YYYY/MM/DD HH:mm:ss');
    });
  });
});
