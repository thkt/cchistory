import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarkdownExporter } from './MarkdownExporter';
import fs from 'fs-extra';
import path from 'path';
import dayjs from 'dayjs';
import type { Config, Message } from '../types';

vi.mock('fs-extra');
vi.mock('../utils/pathSanitizer', () => ({
  sanitizeOutputPath: vi.fn((p: string) => p)
}));

describe('MarkdownExporter', () => {
  let exporter: MarkdownExporter;
  const mockConfig: Config = {
    exportDir: '~/Tools/cli/cchistory/exports',
    dateFormat: 'YYYY/MM/DD HH:mm:ss',
    maxPreviewLength: 100,
    maxResultLength: 3000
  };

  beforeEach(() => {
    exporter = new MarkdownExporter(mockConfig);
    vi.clearAllMocks();
  });

  describe('export', () => {
    it('should create export directory and write markdown file', async () => {
      const messages: Message[] = [
        {
          type: 'user',
          timestamp: '2024-01-01T10:00:00Z',
          sessionId: 'test-session',
          cwd: '/home/user/project',
          version: '1.0.0',
          message: { content: 'Hello' }
        }
      ];

      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await exporter.export(messages, 'test.md');

      expect(fs.ensureDir).toHaveBeenCalledWith('~/Tools/cli/cchistory/exports');
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('~/Tools/cli/cchistory/exports', 'test.md'),
        expect.stringContaining('# Claude Conversation'),
        'utf-8'
      );
      expect(result).toBe(path.join('~/Tools/cli/cchistory/exports', 'test.md'));
    });

    it('should handle export errors', async () => {
      vi.mocked(fs.ensureDir).mockRejectedValue(new Error('Permission denied'));

      await expect(exporter.export([], 'test.md'))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('convertToMarkdown', () => {
    it('should include session metadata when present', () => {
      const messages: Message[] = [
        {
          type: 'user',
          timestamp: '2024-01-01T10:00:00Z',
          sessionId: 'test-session',
          cwd: '/home/user/project',
          version: '1.0.0',
          message: { content: 'Hello' }
        }
      ];

      const result = (exporter as any).convertToMarkdown(messages);

      expect(result).toContain('## Session Information');
      expect(result).toContain('Session ID**: test-session');
      expect(result).toContain('Working Directory**: /home/user/project');
      expect(result).toContain('Version**: 1.0.0');
    });

    it('should format user messages correctly', () => {
      const messages: Message[] = [
        {
          type: 'user',
          timestamp: '2024-01-01T10:00:00Z',
          message: { content: 'Hello world' }
        }
      ];

      const result = (exporter as any).convertToMarkdown(messages);

      expect(result).toContain('### 👤 User 2024-01-01 19:00:00');
      expect(result).toContain('Hello world');
    });

    it('should format assistant messages with thinking', () => {
      const messages: Message[] = [
        {
          type: 'assistant',
          timestamp: '2024-01-01T10:01:00Z',
          thinking: 'Let me think about this...',
          content: [
            { type: 'text', text: 'Here is my response' }
          ]
        }
      ];

      const result = (exporter as any).convertToMarkdown(messages);

      expect(result).toContain('### 🤖 Assistant 2024-01-01 19:01:00');
      expect(result).toContain('> 🤔 **Thinking**');
      expect(result).toContain('> Let me think about this...');
      expect(result).toContain('Here is my response');
    });

    it('should handle tool use content', () => {
      const messages: Message[] = [
        {
          type: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'calculator',
              input: { operation: 'add', a: 1, b: 2 }
            }
          ]
        }
      ];

      const result = (exporter as any).convertToMarkdown(messages);

      expect(result).toContain('🔧 **Tool Use**: calculator');
      expect(result).toContain('```json');
      expect(result).toContain('"operation": "add"');
    });

    it('should handle tool result content', () => {
      const messages: Message[] = [
        {
          type: 'assistant',
          content: [
            {
              type: 'tool_result',
              content: 'Result: 3'
            }
          ]
        }
      ];

      const result = (exporter as any).convertToMarkdown(messages);

      expect(result).toContain('📤 **Tool Result**:');
      expect(result).toContain('Result: 3');
    });

    it('should truncate long tool results', () => {
      const longResult = 'x'.repeat(4000);
      const messages: Message[] = [
        {
          type: 'assistant',
          content: [
            {
              type: 'tool_result',
              content: longResult
            }
          ]
        }
      ];

      const result = (exporter as any).convertToMarkdown(messages);

      expect(result).toContain('... (truncated)');
      expect(result).not.toContain('x'.repeat(3001));
    });

    it('should handle mixed content types', () => {
      const messages: Message[] = [
        {
          type: 'assistant',
          content: [
            { type: 'text', text: 'Let me calculate:' },
            { type: 'tool_use', name: 'calc', input: { expr: '2+2' } },
            { type: 'tool_result', content: '4' },
            { type: 'text', text: 'The answer is 4' }
          ]
        }
      ];

      const result = (exporter as any).convertToMarkdown(messages);

      expect(result).toContain('Let me calculate:');
      expect(result).toContain('🔧 **Tool Use**: calc');
      expect(result).toContain('📤 **Tool Result**:');
      expect(result).toContain('The answer is 4');
    });

    it('should handle messages without timestamps', () => {
      const messages: Message[] = [
        {
          type: 'user',
          message: { content: 'No timestamp' }
        }
      ];

      const result = (exporter as any).convertToMarkdown(messages);

      expect(result).toContain('### 👤 User');
      expect(result).toContain('No timestamp');
    });

    it('should handle array content in message field', () => {
      const messages: Message[] = [
        {
          type: 'user',
          message: {
            content: [
              { type: 'text', text: 'Part 1' },
              { type: 'text', text: 'Part 2' }
            ]
          }
        }
      ];

      const result = (exporter as any).convertToMarkdown(messages);

      expect(result).toContain('Part 1');
      expect(result).toContain('Part 2');
    });

    it('should handle empty messages array', () => {
      const result = (exporter as any).convertToMarkdown([]);

      expect(result).toContain('# Claude Conversation');
      expect(result).toContain('## Conversation');
    });
  });

  describe('formatContent', () => {
    it('should handle string content', () => {
      const result = (exporter as any).formatContent('Simple text');
      expect(result).toBe('Simple text');
    });

    it('should handle object with text type', () => {
      const content = { type: 'text', text: 'Object text' };
      const result = (exporter as any).formatContent(content);
      expect(result).toBe('Object text');
    });

    it('should handle array with mixed types', () => {
      const content = [
        { type: 'text', text: 'Text 1' },
        { type: 'tool_use', name: 'tool', input: {} },
        { type: 'unknown' }
      ];
      const result = (exporter as any).formatContent(content);
      
      expect(result).toContain('Text 1');
      expect(result).toContain('🔧 **Tool Use**: tool');
    });

    it('should handle null or undefined content', () => {
      expect((exporter as any).formatContent(null)).toBe('');
      expect((exporter as any).formatContent(undefined)).toBe('');
    });

    it('should handle non-standard content types', () => {
      const content = { type: 'custom', data: 'something' };
      const result = (exporter as any).formatContent(content);
      expect(result).toBe('');
    });
    
    it('should remove user-prompt-submit-hook metadata from string content', () => {
      const content = 'Normal text<user-prompt-submit-hook>-n {"additional_context": "hidden data"}</user-prompt-submit-hook> more text';
      const result = (exporter as any).formatContent(content);
      
      expect(result).toBe('Normal text more text');
      expect(result).not.toContain('user-prompt-submit-hook');
      expect(result).not.toContain('additional_context');
    });
    
    it('should remove system-reminder metadata from text objects', () => {
      const content = {
        type: 'text',
        text: 'Response text<system-reminder>Internal system note</system-reminder> continued text'
      };
      const result = (exporter as any).formatContent(content);
      
      expect(result).toBe('Response text continued text');
      expect(result).not.toContain('system-reminder');
      expect(result).not.toContain('Internal system note');
    });
    
    it('should remove metadata from array content', () => {
      const content = [
        { type: 'text', text: 'Part 1<user-prompt-submit-hook>hidden</user-prompt-submit-hook>' },
        { type: 'text', text: 'Part 2<system-reminder>note</system-reminder> end' }
      ];
      const result = (exporter as any).formatContent(content);
      
      expect(result).toBe('Part 1\nPart 2 end');
      expect(result).not.toContain('hidden');
      expect(result).not.toContain('note');
    });
    
    it('should clean up excessive newlines after removing metadata', () => {
      const content = 'Text with<user-prompt-submit-hook>removed</user-prompt-submit-hook>\n\n\n\n\nextra lines';
      const result = (exporter as any).formatContent(content);
      
      expect(result).toBe('Text with\n\nextra lines');
    });
    
    it('should handle standalone hook tags', () => {
      const content = 'Text with <user-prompt-submit-hook/> standalone tag';
      const result = (exporter as any).formatContent(content);
      
      expect(result).toBe('Text with  standalone tag');
      expect(result).not.toContain('user-prompt-submit-hook');
    });
  });

  describe('formatAssistantContent', () => {
    it('should format text content', () => {
      const content = [
        { type: 'text', text: 'Assistant response' }
      ];
      const result = (exporter as any).formatAssistantContent(content);
      expect(result).toBe('Assistant response');
    });

    it('should format tool use with input', () => {
      const content = [
        {
          type: 'tool_use',
          name: 'search',
          input: { query: 'test' }
        }
      ];
      const result = (exporter as any).formatAssistantContent(content);
      
      expect(result).toContain('🔧 **Tool Use**: search');
      expect(result).toContain('"query": "test"');
    });

    it('should format tool result with object content', () => {
      const content = [
        {
          type: 'tool_result',
          content: { status: 'success', data: [1, 2, 3] }
        }
      ];
      const result = (exporter as any).formatAssistantContent(content);
      
      expect(result).toContain('📤 **Tool Result**:');
      expect(result).toContain('"status": "success"');
      // JSON.stringify with indentation formats arrays across multiple lines
      expect(result).toContain('1,');
      expect(result).toContain('2,');
      expect(result).toContain('3');
    });

    it('should handle empty content array', () => {
      const result = (exporter as any).formatAssistantContent([]);
      expect(result).toBe('');
    });

    it('should handle unknown content types gracefully', () => {
      const content = [
        { type: 'unknown_type' },
        { type: 'text', text: 'Valid text' }
      ];
      const result = (exporter as any).formatAssistantContent(content);
      
      expect(result).toBe('\nValid text');
    });
  });

  describe('extractSessionMetadata', () => {
    it('should extract all metadata fields when present', () => {
      const message: Message = {
        type: 'user',
        sessionId: 'session-123',
        timestamp: '2024-01-01T10:00:00Z',
        cwd: '/home/user/project',
        version: '1.2.3'
      };

      const result = (exporter as any).extractSessionMetadata(message);

      expect(result).toEqual({
        sessionId: 'session-123',
        timestamp: expect.stringContaining('2024-01-01'),
        cwd: '/home/user/project',
        version: '1.2.3'
      });
    });

    it('should return null when any required field is missing', () => {
      const incomplete: Message[] = [
        { type: 'user', timestamp: '2024-01-01', cwd: '/path', version: '1.0' },
        { type: 'user', sessionId: 'id', cwd: '/path', version: '1.0' },
        { type: 'user', sessionId: 'id', timestamp: '2024-01-01', version: '1.0' },
        { type: 'user', sessionId: 'id', timestamp: '2024-01-01', cwd: '/path' }
      ];

      incomplete.forEach(msg => {
        const result = (exporter as any).extractSessionMetadata(msg);
        expect(result).toBeNull();
      });
    });

    it('should format timestamp using dayjs', () => {
      const message: Message = {
        type: 'user',
        sessionId: 'session-123',
        timestamp: '2024-01-01T10:30:45Z',
        cwd: '/home/user/project',
        version: '1.2.3'
      };

      const result = (exporter as any).extractSessionMetadata(message);

      expect(result?.timestamp).toMatch(/2024-01-01/);
    });
  });
});
