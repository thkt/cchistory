import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { CLI } from './CLI';
import { ConfigManager } from './ConfigManager';
import { ConversationManager } from './ConversationManager';
import { MarkdownExporter } from './MarkdownExporter';
import inquirer from 'inquirer';

vi.mock('./ConfigManager');
vi.mock('./ConversationManager');
vi.mock('./MarkdownExporter');
vi.mock('inquirer');
vi.mock('chalk', () => {
  const mockChalk = {
    cyan: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
    white: vi.fn((text: string) => text)
  };
  mockChalk.cyan.bold = vi.fn((text: string) => text);
  mockChalk.white.bold = vi.fn((text: string) => text);
  return { default: mockChalk };
});

describe('CLI', () => {
  let cli: CLI;
  let consoleLogSpy: MockedFunction<typeof console.log>;
  let consoleErrorSpy: MockedFunction<typeof console.error>;
  
  const mockConfig = {
    exportDir: '~/Tools/cli/cchistory/exports',
    dateFormat: 'YYYY/MM/DD HH:mm:ss',
    maxPreviewLength: 100,
    maxResultLength: 3000
  };

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup mocks with default behaviors
    vi.mocked(ConfigManager).prototype.load = vi.fn().mockResolvedValue(mockConfig);
    vi.mocked(ConversationManager).prototype.loadConversations = vi.fn().mockResolvedValue([]);
    vi.mocked(ConversationManager).prototype.loadConversationContent = vi.fn().mockResolvedValue([]);
    vi.mocked(MarkdownExporter).prototype.export = vi.fn().mockResolvedValue('/path/to/export.md');
    
    cli = new CLI();
  });

  describe('run', () => {
    it('should display header on start', async () => {
      await cli.run([]);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Claude Conversation History Browser'));
    });

    it('should handle no conversations found', async () => {
      await cli.run([]);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No conversation history found'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('~/.claude/projects/'));
    });

    it('should display conversation count when found', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          project: 'test-project',
          filePath: '/path/to/file.jsonl',
          timestamp: '2024-01-01',
          startTime: '2024-01-01 12:00:00',
          messageCount: 10,
          preview: 'Test conversation',
          sessionId: 'session1'
        }
      ];
      
      vi.mocked(ConversationManager).prototype.loadConversations.mockResolvedValue(mockConversations);
      vi.mocked(inquirer.prompt).mockResolvedValue({ selectedIndex: 0 });
      
      await cli.run([]);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 conversation'));
    });

    describe('interactive mode', () => {
      it('should prompt for conversation selection', async () => {
        const mockConversations = [
          {
            id: 'conv1',
            project: 'test-project',
            filePath: '/path/to/file.jsonl',
            timestamp: '2024-01-01',
            startTime: '2024-01-01 12:00:00',
            messageCount: 10,
            preview: 'Test conversation',
            sessionId: 'session1'
          }
        ];
        
        vi.mocked(ConversationManager).prototype.loadConversations.mockResolvedValue(mockConversations);
        vi.mocked(inquirer.prompt).mockResolvedValue({ selectedIndex: 0 });
        
        await cli.run([]);
        
        expect(inquirer.prompt).toHaveBeenCalledWith([
          expect.objectContaining({
            type: 'list',
            name: 'selectedIndex',
            message: 'Select a conversation to export:',
            loop: false
          })
        ]);
      });

      it('should export selected conversation', async () => {
        const mockConversations = [
          {
            id: 'conv1',
            project: 'test-project',
            filePath: '/path/to/file.jsonl',
            timestamp: '2024-01-01',
            startTime: '2024-01-01 12:00:00',
            messageCount: 10,
            preview: 'Test conversation',
            sessionId: 'session1'
          }
        ];
        
        const mockMessages = [
          { type: 'user' as const, message: { content: 'Hello' } },
          { type: 'assistant' as const, message: { content: 'Hi there' } }
        ];
        
        vi.mocked(ConversationManager).prototype.loadConversations.mockResolvedValue(mockConversations);
        vi.mocked(inquirer.prompt).mockResolvedValue({ selectedIndex: 0 });
        vi.mocked(ConversationManager).prototype.loadConversationContent.mockResolvedValue(mockMessages);
        
        await cli.run([]);
        
        expect(vi.mocked(ConversationManager).prototype.loadConversationContent).toHaveBeenCalledWith('/path/to/file.jsonl');
        expect(vi.mocked(MarkdownExporter).prototype.export).toHaveBeenCalledWith(
          mockMessages,
          expect.stringContaining('claude_test-project_')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Export complete: /path/to/export.md'));
      });

      it('should handle export errors gracefully', async () => {
        const mockConversations = [
          {
            id: 'conv1',
            project: 'test-project',
            filePath: '/path/to/file.jsonl',
            timestamp: '2024-01-01',
            startTime: '2024-01-01 12:00:00',
            messageCount: 10,
            preview: 'Test conversation',
            sessionId: 'session1'
          }
        ];
        
        vi.mocked(ConversationManager).prototype.loadConversations.mockResolvedValue(mockConversations);
        vi.mocked(inquirer.prompt).mockResolvedValue({ selectedIndex: 0 });
        vi.mocked(MarkdownExporter).prototype.export.mockRejectedValue(new Error('Export failed'));
        
        await cli.run([]);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Export failed: Export failed'));
      });

      it('should handle user cancellation (Ctrl+C)', async () => {
        const mockConversations = [
          {
            id: 'conv1',
            project: 'test-project',
            filePath: '/path/to/file.jsonl',
            timestamp: '2024-01-01',
            startTime: '2024-01-01 12:00:00',
            messageCount: 10,
            preview: 'Test conversation',
            sessionId: 'session1'
          }
        ];
        
        vi.mocked(ConversationManager).prototype.loadConversations.mockResolvedValue(mockConversations);
        vi.mocked(inquirer.prompt).mockRejectedValue(new Error('User canceled'));
        
        await cli.run([]);
        
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Operation cancelled'));
        expect(vi.mocked(MarkdownExporter).prototype.export).not.toHaveBeenCalled();
      });
    });
  });
});
