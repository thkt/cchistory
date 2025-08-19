import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sanitizeOutputPath } from './pathSanitizer';
import { homedir } from 'os';
import path from 'path';
import fs from 'fs-extra';

describe('pathSanitizer', () => {
  const testDir = path.join(homedir(), 'Tools', 'test-temp');
  
  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });
  
  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('sanitizeOutputPath', () => {
    it('should expand home directory', () => {
      const result = sanitizeOutputPath('~/Tools/test');
      expect(result).toBe(path.join(homedir(), 'Tools', 'test'));
    });

    it('should resolve relative paths', () => {
      const cwd = process.cwd();
      process.chdir(path.join(homedir(), 'Tools'));
      const result = sanitizeOutputPath('./test');
      expect(result).toBe(path.join(homedir(), 'Tools', 'test'));
      process.chdir(cwd);
    });

    it('should allow paths within ~/Tools', () => {
      const validPaths = [
        '~/Tools/cli/cchistory/exports',
        path.join(homedir(), 'Tools', 'project'),
        '~/Tools/nested/deep/path'
      ];

      validPaths.forEach(p => {
        expect(() => sanitizeOutputPath(p)).not.toThrow();
      });
    });

    it('should reject paths outside ~/Tools', () => {
      const invalidPaths = [
        '/tmp/test',
        '~/Documents/test',
        '/etc/passwd',
        '../../../etc/passwd',
        '~/Tools/../Documents'
      ];

      invalidPaths.forEach(p => {
        expect(() => sanitizeOutputPath(p)).toThrow();
      });
    });

    it('should prevent path traversal attacks', () => {
      const attacks = [
        '~/Tools/../../../etc/passwd',
        '~/Tools/../../Documents/secret',
        '~/Tools/./../../Desktop',
        '~/Tools/test/../../../Documents'
      ];

      attacks.forEach(attack => {
        expect(() => sanitizeOutputPath(attack)).toThrow();
      });
    });

    it('should resolve symlinks and validate real path', async () => {
      const symlinkPath = path.join(testDir, 'symlink');
      const targetPath = '/tmp/outside';
      
      // Create a symlink pointing outside ~/Tools
      await fs.ensureDir(targetPath);
      await fs.ensureSymlink(targetPath, symlinkPath);
      
      expect(() => sanitizeOutputPath(symlinkPath)).toThrow();
      
      await fs.remove(targetPath);
    });

    it('should handle non-existent paths', () => {
      const nonExistent = path.join(homedir(), 'Tools', 'does-not-exist', 'test');
      const result = sanitizeOutputPath(nonExistent);
      expect(result).toBe(nonExistent);
    });

    it('should normalize paths correctly', () => {
      const messyPath = '~/Tools//cli/../cli/./cchistory///exports';
      const result = sanitizeOutputPath(messyPath);
      expect(result).toBe(path.join(homedir(), 'Tools', 'cli', 'cchistory', 'exports'));
    });

    it('should respect custom allowedBasePath', () => {
      const customBase = '~/Documents';
      
      // Should allow paths within custom base
      const validPath = '~/Documents/exports';
      expect(() => sanitizeOutputPath(validPath, customBase)).not.toThrow();
      
      // Should reject paths outside custom base
      const invalidPath = '~/Tools/exports';
      expect(() => sanitizeOutputPath(invalidPath, customBase)).toThrow();
    });

    it('should use default base when allowedBasePath is not provided', () => {
      // Should allow paths within default ~/Tools
      const validPath = '~/Tools/exports';
      expect(() => sanitizeOutputPath(validPath)).not.toThrow();
      
      // Should reject paths outside default ~/Tools
      const invalidPath = '~/Documents/exports';
      expect(() => sanitizeOutputPath(invalidPath)).toThrow();
    });
  });
});
