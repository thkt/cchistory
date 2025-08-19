import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import dayjs from 'dayjs';
import type { Config, Conversation, Message } from '../types.js';

export class ConversationManager {
  private readonly claudePath: string;
  private readonly projectsPath: string;

  constructor() {
    this.claudePath = path.join(homedir(), '.claude');
    this.projectsPath = path.join(this.claudePath, 'projects');
  }

  async loadConversations(config: Config): Promise<Conversation[]> {
    try {
      const projects = await fs.readdir(this.projectsPath);
      const conversations: Conversation[] = [];

      for (const project of projects) {
        // Skip hidden files like .DS_Store
        if (project.startsWith('.')) continue;
        
        const projectPath = path.join(this.projectsPath, project);
        
        // Check if it's actually a directory
        const stat = await fs.stat(projectPath);
        if (!stat.isDirectory()) continue;
        
        const files = await fs.readdir(projectPath);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

        for (const file of jsonlFiles) {
          const filePath = path.join(projectPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());

          if (lines.length === 0) continue;

          try {
            const firstMessage = JSON.parse(lines[0]);
            const sessionId = this.extractSessionId(firstMessage);
            const rawTimestamp = firstMessage.timestamp;
            
            // Parse and format the date safely
            let startTime = 'Unknown Date';
            let timestamp = '1970-01-01T00:00:00Z'; // Default for sorting
            
            if (rawTimestamp) {
              const parsedDate = dayjs(rawTimestamp);
              if (parsedDate.isValid()) {
                startTime = parsedDate.format(config.dateFormat);
                timestamp = rawTimestamp;
              } else {
                // If dayjs can't parse it, try to use it as-is for sorting
                timestamp = rawTimestamp;
              }
            } else {
              // Try to extract date from filename as fallback
              const fileDate = file.match(/(\d{4}-\d{2}-\d{2})/);
              if (fileDate) {
                const parsedDate = dayjs(fileDate[1]);
                if (parsedDate.isValid()) {
                  startTime = parsedDate.format(config.dateFormat);
                  timestamp = fileDate[1];
                }
              }
            }

            const userMessages = lines
              .map(line => {
                try {
                  const msg = JSON.parse(line);
                  if (msg.type === 'user' && msg.message?.content) {
                    return this.extractTextContent(msg.message.content);
                  }
                  return null;
                } catch {
                  return null;
                }
              })
              .filter(Boolean);

            const cleanedFirstMessage = userMessages[0] ? this.cleanXmlTags(userMessages[0]) : '';
            const preview = cleanedFirstMessage 
              ? cleanedFirstMessage.substring(0, config.maxPreviewLength) + (cleanedFirstMessage.length > config.maxPreviewLength ? '...' : '')
              : 'No preview available';

            // Extract only the last directory name from the project path
            const displayProject = this.extractProjectName(project);

            conversations.push({
              id: file.replace('.jsonl', ''),
              project: displayProject,
              filePath,
              timestamp,
              startTime,
              messageCount: lines.length,
              preview,
              sessionId: sessionId || 'unknown'
            });
          } catch (error) {
            console.error(chalk.yellow(`⚠️  ファイルの解析に失敗: ${file}`));
          }
        }
      }

      conversations.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return conversations;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.substring(0, 100) : 'Unknown error';
      console.error(chalk.red(`❌ 会話履歴の読み込みに失敗: ${errorMessage}`));
      return [];
    }
  }

  async loadConversationContent(filePath: string): Promise<Message[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (error) {
        console.warn(chalk.yellow('⚠️  Invalid JSON line skipped'));
        return null;
      }
    }).filter(Boolean) as Message[];
  }

  private extractSessionId(message: Message): string | undefined {
    return message.sessionId || message.cwd?.split('/').pop();
  }

  private extractTextContent(content: string | unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      const textParts = content
        .filter(item => item.type === 'text' && item.text)
        .map(item => item.text);
      return textParts.join(' ');
    }
    
    return 'No text content';
  }

  private cleanXmlTags(text: string): string {
    // Remove all XML/HTML tags including their content for specific command tags
    text = text.replace(/<command-[^>]*>[\s\S]*?<\/command-[^>]*>/g, '');
    // Remove self-closing command tags
    text = text.replace(/<command-[^>]*\/>/g, '');
    // Remove any other XML/HTML tags but keep their content
    text = text.replace(/<[^>]+>/g, '');
    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  private extractProjectName(fullProjectPath: string): string {
    // Extract project name from the full path
    // e.g. "-Users-thkt-GitHub-my-project" -> "my-project"
    // e.g. "-Users-thkt--claude" -> ".claude"
    
    // Handle simple cases without the full path prefix
    if (!fullProjectPath.startsWith('-Users-')) {
      return fullProjectPath;
    }
    
    // Remove the common prefix "-Users-thkt-"
    let remaining = fullProjectPath;
    if (remaining.startsWith('-Users-thkt-')) {
      remaining = remaining.substring('-Users-thkt-'.length);
    } else if (remaining.startsWith('-Users-')) {
      // Handle other users by removing just "-Users-[username]-"
      const parts = remaining.split('-');
      if (parts.length > 2) {
        remaining = parts.slice(3).join('-'); // Skip '', 'Users', and username
      }
    }
    
    // Look for known parent directories and take everything after them
    const parentDirs = ['GitHub-', 'Documents-', 'Tools-cli-', 'Desktop-', 'Downloads-', 'Projects-'];
    
    for (const parent of parentDirs) {
      const index = remaining.indexOf(parent);
      if (index !== -1) {
        const projectPart = remaining.substring(index + parent.length);
        // Handle empty project names (hidden directories)
        if (projectPart === '' || projectPart === '-') {
          // e.g., "-Users-thkt--claude" -> take 'claude' and add dot
          const segments = remaining.split('-');
          const lastNonEmpty = segments.filter(s => s).pop();
          return lastNonEmpty ? '.' + lastNonEmpty : fullProjectPath;
        }
        return projectPart;
      }
    }
    
    // Special case for hidden directories (double dash)
    if (remaining.startsWith('-')) {
      const parts = remaining.split('-').filter(s => s);
      if (parts.length > 0) {
        return '.' + parts[parts.length - 1];
      }
    }
    
    // Fallback: return everything after the common prefix
    return remaining || fullProjectPath;
  }
}
