import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationManager } from './ConversationManager';
import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import dayjs from 'dayjs';

vi.mock('fs-extra');
vi.mock('chalk', () => ({
  default: {
    yellow: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text)
  }
}));

describe('ConversationManager', () => {
  let manager: ConversationManager;
  const mockProjectsPath = path.join(homedir(), '.claude', 'projects');
  let consoleErrorSpy: MockedFunction<typeof console.error>;
  let consoleWarnSpy: MockedFunction<typeof console.warn>;

  beforeEach(() => {
    manager = new ConversationManager();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  describe('loadConversations', () => {
    const mockConfig = {
      exportDir: '~/Tools/cli/cchistory/exports',
      dateFormat: 'YYYY/MM/DD HH:mm:ss',
      maxPreviewLength: 100,
      maxResultLength: 3000
    };

    it('should load conversations from valid jsonl files', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['project1', '.DS_Store', 'project2'] as any)
        .mockResolvedValueOnce(['conv1.jsonl', 'conv2.jsonl', 'other.txt'] as any)
        .mockResolvedValueOnce(['conv3.jsonl'] as any);

      vi.mocked(fs.stat).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('.DS_Store')) {
          return Promise.resolve({ isDirectory: () => false } as any);
        }
        return Promise.resolve({ isDirectory: () => true } as any);
      });

      const mockMessage1 = {
        type: 'user',
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session1',
        message: { content: 'Hello world' }
      };

      const mockMessage2 = {
        type: 'assistant',
        message: { content: 'Hi there' }
      };

      vi.mocked(fs.readFile).mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('conv1.jsonl')) {
          return Promise.resolve(JSON.stringify(mockMessage1) + '\n' + JSON.stringify(mockMessage2));
        }
        if (pathStr.includes('conv2.jsonl')) {
          return Promise.resolve(JSON.stringify(mockMessage1));
        }
        if (pathStr.includes('conv3.jsonl')) {
          return Promise.resolve(JSON.stringify(mockMessage1));
        }
        return Promise.resolve('');
      });

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations).toHaveLength(3);
      expect(conversations[0]).toMatchObject({
        id: expect.stringContaining('conv'),
        project: expect.any(String),
        messageCount: expect.any(Number),
        preview: expect.any(String),
        sessionId: 'session1'
      });
    });

    it('should skip hidden files and non-directories', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['.hidden', 'regular_file.txt', 'valid_project'] as any)
        .mockResolvedValueOnce(['conv.jsonl'] as any);

      vi.mocked(fs.stat).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('valid_project')) {
          return Promise.resolve({ isDirectory: () => true } as any);
        }
        return Promise.resolve({ isDirectory: () => false } as any);
      });

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        type: 'user',
        timestamp: '2024-01-01T10:00:00Z',
        message: { content: 'Test' }
      }));

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].project).toBe('valid_project'); // No '-' in name, so returns as-is
    });

    it('should handle empty jsonl files', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['project1'] as any)
        .mockResolvedValueOnce(['empty.jsonl'] as any);

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.readFile).mockResolvedValue('');

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations).toHaveLength(0);
    });

    it('should handle invalid JSON lines', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['project1'] as any)
        .mockResolvedValueOnce(['invalid.jsonl'] as any);

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.readFile).mockResolvedValue('invalid json\n{"valid": "json"}');

      const conversations = await manager.loadConversations(mockConfig);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ファイルの解析に失敗'));
    });

    it('should extract preview from array content', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['project1'] as any)
        .mockResolvedValueOnce(['array.jsonl'] as any);

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const messageWithArray = {
        type: 'user',
        timestamp: '2024-01-01T10:00:00Z',
        message: {
          content: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' }
          ]
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(messageWithArray));

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations[0].preview).toBe('First part Second part');
    });

    it('should truncate long previews', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['project1'] as any)
        .mockResolvedValueOnce(['long.jsonl'] as any);

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const longText = 'a'.repeat(200);
      const message = {
        type: 'user',
        timestamp: '2024-01-01T10:00:00Z',
        message: { content: longText }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(message));

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations[0].preview).toHaveLength(103); // 100 + '...'
      expect(conversations[0].preview).toMatch(/\.\.\.$/);
    });

    it('should sort conversations by timestamp (newest first)', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['project1'] as any)
        .mockResolvedValueOnce(['old.jsonl', 'new.jsonl'] as any);

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      vi.mocked(fs.readFile).mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('old.jsonl')) {
          return Promise.resolve(JSON.stringify({
            type: 'user',
            timestamp: '2024-01-01T10:00:00Z',
            message: { content: 'Old message' }
          }));
        }
        if (pathStr.includes('new.jsonl')) {
          return Promise.resolve(JSON.stringify({
            type: 'user',
            timestamp: '2024-01-02T10:00:00Z',
            message: { content: 'New message' }
          }));
        }
        return Promise.resolve('');
      });

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations[0].preview).toBe('New message');
      expect(conversations[1].preview).toBe('Old message');
    });

    it('should handle filesystem errors gracefully', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Permission denied'));

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('会話履歴の読み込みに失敗'));
    });

    it('should extract sessionId from cwd if not present', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['project1'] as any)
        .mockResolvedValueOnce(['session.jsonl'] as any);

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const message = {
        type: 'user',
        timestamp: '2024-01-01T10:00:00Z',
        cwd: '/home/user/my-session',
        message: { content: 'Test' }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(message));

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations[0].sessionId).toBe('my-session');
    });
    
    it('should handle missing timestamps gracefully', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['project1'] as any)
        .mockResolvedValueOnce(['no-timestamp.jsonl'] as any);

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const message = {
        type: 'user',
        message: { content: 'No timestamp here' }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(message));

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].startTime).toBe('Unknown Date');
      expect(conversations[0].timestamp).toBe('1970-01-01T00:00:00Z');
    });
    
    it('should extract date from filename when timestamp is missing', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['project1'] as any)
        .mockResolvedValueOnce(['2025-08-18-conversation.jsonl'] as any);

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const message = {
        type: 'user',
        message: { content: 'No timestamp but filename has date' }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(message));

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].timestamp).toBe('2025-08-18');
      expect(conversations[0].startTime).toContain('2025/08/18');
    });
    
    it('should handle invalid timestamp formats gracefully', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['project1'] as any)
        .mockResolvedValueOnce(['invalid-timestamp.jsonl'] as any);

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const message = {
        type: 'user',
        timestamp: 'not-a-valid-date',
        message: { content: 'Invalid timestamp format' }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(message));

      const conversations = await manager.loadConversations(mockConfig);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].startTime).toBe('Unknown Date');
      expect(conversations[0].timestamp).toBe('not-a-valid-date');
    });
  });

  describe('loadConversationContent', () => {
    it('should load and parse all valid JSON lines', async () => {
      const messages = [
        { type: 'user', message: { content: 'Hello' } },
        { type: 'assistant', message: { content: 'Hi' } },
        { type: 'user', message: { content: 'How are you?' } }
      ];

      const content = messages.map(m => JSON.stringify(m)).join('\n');
      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await manager.loadConversationContent('/path/to/file.jsonl');

      expect(result).toHaveLength(3);
      expect(result).toEqual(messages);
    });

    it('should skip invalid JSON lines with warning', async () => {
      const content = 'invalid json\n{"type": "user", "message": {"content": "Valid"}}\nmore invalid';
      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await manager.loadConversationContent('/path/to/file.jsonl');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: 'user' });
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle empty lines', async () => {
      const content = '{"type": "user"}\n\n\n{"type": "assistant"}';
      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await manager.loadConversationContent('/path/to/file.jsonl');

      expect(result).toHaveLength(2);
    });

    it('should handle file read errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await expect(manager.loadConversationContent('/nonexistent.jsonl'))
        .rejects.toThrow('File not found');
    });
  });

  describe('extractTextContent', () => {
    it('should handle string content', () => {
      const content = 'Simple string content';
      const result = (manager as any).extractTextContent(content);
      expect(result).toBe('Simple string content');
    });

    it('should handle array content with text items', () => {
      const content = [
        { type: 'text', text: 'Part 1' },
        { type: 'image', url: 'image.png' },
        { type: 'text', text: 'Part 2' }
      ];
      const result = (manager as any).extractTextContent(content);
      expect(result).toBe('Part 1 Part 2');
    });

    it('should handle empty array', () => {
      const result = (manager as any).extractTextContent([]);
      expect(result).toBe('');
    });

    it('should handle non-text content', () => {
      const result = (manager as any).extractTextContent({ type: 'object' });
      expect(result).toBe('No text content');
    });
  });

  describe('extractSessionId', () => {
    it('should extract sessionId directly if present', () => {
      const message = { sessionId: 'direct-session-id', type: 'user' as const };
      const result = (manager as any).extractSessionId(message);
      expect(result).toBe('direct-session-id');
    });

    it('should extract from cwd if sessionId not present', () => {
      const message = { cwd: '/home/user/project/my-session', type: 'user' as const };
      const result = (manager as any).extractSessionId(message);
      expect(result).toBe('my-session');
    });

    it('should return undefined if neither present', () => {
      const message = { type: 'user' as const };
      const result = (manager as any).extractSessionId(message);
      expect(result).toBeUndefined();
    });
  });

  describe('extractProjectName', () => {
    it('should extract last directory from full path', () => {
      const result = (manager as any).extractProjectName('-Users-thkt-GitHub-my-project');
      expect(result).toBe('my-project');
    });

    it('should handle path ending with dash (hidden directory)', () => {
      const result = (manager as any).extractProjectName('-Users-thkt--claude');
      expect(result).toBe('.claude');
    });

    it('should return as-is when no dash in name', () => {
      const result = (manager as any).extractProjectName('simple_project');
      expect(result).toBe('simple_project');
    });

    it('should handle complex project names', () => {
      const result = (manager as any).extractProjectName('-Users-thkt-Tools-cli-cchistory');
      expect(result).toBe('cchistory');
    });
  });

  describe('cleanXmlTags', () => {
    it('should remove command XML tags with content', () => {
      const input = '<command-message>gemini:search is running…</command-message>Some text';
      const result = (manager as any).cleanXmlTags(input);
      expect(result).toBe('Some text');
    });

    it('should remove command-name tags', () => {
      const input = '<command-name>/gemini:search</command-name> other content';
      const result = (manager as any).cleanXmlTags(input);
      expect(result).toBe('other content');
    });

    it('should remove self-closing command tags', () => {
      const input = 'Text before <command-status/> text after';
      const result = (manager as any).cleanXmlTags(input);
      expect(result).toBe('Text before text after');
    });

    it('should remove all HTML/XML tags but keep content', () => {
      const input = '<div>Content <span>inside</span> tags</div>';
      const result = (manager as any).cleanXmlTags(input);
      expect(result).toBe('Content inside tags');
    });

    it('should handle multiple tags and clean whitespace', () => {
      const input = '<command-message>Running...</command-message>  <br/>  Text   with   spaces';
      const result = (manager as any).cleanXmlTags(input);
      expect(result).toBe('Text with spaces');
    });

    it('should handle text without tags', () => {
      const input = 'Plain text without any tags';
      const result = (manager as any).cleanXmlTags(input);
      expect(result).toBe('Plain text without any tags');
    });
  });
});
