import fs from 'fs-extra';
import path from 'path';
import dayjs from 'dayjs';
import type { Config, Message, SessionMetadata, ContentPart } from '../types.js';
import { sanitizeOutputPath } from '../utils/pathSanitizer.js';

export class MarkdownExporter {
  constructor(private config: Config) {}

  async export(messages: Message[], filename: string): Promise<string> {
    const exportDir = sanitizeOutputPath(this.config.exportDir, this.config.allowedBasePath);
    await fs.ensureDir(exportDir);
    
    const filepath = path.join(exportDir, filename);
    const markdown = this.convertToMarkdown(messages);
    
    await fs.writeFile(filepath, markdown, 'utf-8');
    return filepath;
  }

  private convertToMarkdown(messages: Message[]): string {
    const lines: string[] = ['# Claude Conversation\n'];
    
    if (messages.length > 0) {
      const metadata = this.extractSessionMetadata(messages[0]);
      if (metadata) {
        lines.push('## Session Information\n');
        lines.push(`- **Session ID**: ${metadata.sessionId}`);
        lines.push(`- **Started**: ${metadata.timestamp}`);
        lines.push(`- **Working Directory**: ${metadata.cwd}`);
        lines.push(`- **Version**: ${metadata.version}\n`);
      }
    }
    
    lines.push('## Conversation\n');
    
    for (const msg of messages) {
      const formattedMsg = this.formatMessage(msg);
      // Only add non-empty messages
      if (formattedMsg.trim()) {
        lines.push(formattedMsg);
      }
    }
    
    return lines.join('\n');
  }

  private formatMessage(msg: Message): string {
    const lines: string[] = [];
    const timestamp = msg.timestamp ? dayjs(msg.timestamp).format('YYYY-MM-DD HH:mm:ss') : '';
    
    if (msg.type === 'user') {
      const formattedContent = this.formatContent(msg.message?.content || msg.content || '');
      
      // Skip empty user messages
      if (!formattedContent.trim()) {
        return '';
      }
      
      lines.push(`### 👤 User ${timestamp}\n`);
      lines.push(formattedContent);
    } else if (msg.type === 'assistant') {
      let hasContent = false;
      const tempLines: string[] = [];
      
      tempLines.push(`### 🤖 Assistant ${timestamp}\n`);
      
      if (msg.thinking) {
        hasContent = true;
        tempLines.push('> 🤔 **Thinking**\n>');
        tempLines.push(msg.thinking.split('\n').map(line => `> ${line}`).join('\n'));
        tempLines.push('');
      }
      
      let mainContent = '';
      if (msg.content && Array.isArray(msg.content)) {
        mainContent = this.formatAssistantContent(msg.content);
      } else if (msg.message?.content) {
        mainContent = this.formatContent(msg.message.content);
      }
      
      if (mainContent.trim()) {
        hasContent = true;
        tempLines.push(mainContent);
      }
      
      // Only add assistant message if it has content
      if (hasContent) {
        lines.push(...tempLines);
      } else {
        return '';
      }
    }
    
    lines.push('');
    return lines.join('\n');
  }

  private cleanMetadata(text: string): string {
    // Remove user-prompt-submit-hook tags and their content
    text = text.replace(/<user-prompt-submit-hook[^>]*>[\s\S]*?<\/user-prompt-submit-hook>/g, '');
    
    // Remove system-reminder tags and their content
    text = text.replace(/<system-reminder[^>]*>[\s\S]*?<\/system-reminder>/g, '');
    
    // Remove any standalone hook tags
    text = text.replace(/<user-prompt-submit-hook[^>]*\/>/g, '');
    
    // Format command-related tags
    text = this.formatCommandTags(text);
    
    // Clean up extra whitespace left by removed tags
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    
    return text;
  }

  private formatCommandTags(text: string): string {
    // Format command-name tags
    text = text.replace(/<command-name>([^<]+)<\/command-name>/g, (_, cmd) => {
      return `\n> 💡 **Command**: \`${cmd}\`\n`;
    });
    
    // Format command-message tags
    text = text.replace(/<command-message>([^<]+)<\/command-message>/g, (_, msg) => {
      return `> ℹ️ **Status**: ${msg}\n`;
    });
    
    // Format command-args tags
    text = text.replace(/<command-args>([^<]*)<\/command-args>/g, (_, args) => {
      if (args.trim()) {
        return `> 📝 **Arguments**: \`${args}\`\n`;
      }
      return '';
    });
    
    // Format local-command-stderr with collapsible section for long errors
    text = text.replace(/<local-command-stderr>([\s\S]*?)<\/local-command-stderr>/g, (_, error) => {
      const lines = error.trim().split('\n');
      if (lines.length > 10) {
        // For long errors, show first few lines and make rest collapsible
        const preview = lines.slice(0, 5).join('\n');
        return `\n> ⚠️ **Error Output**:\n> \`\`\`\n${preview}\n...\n(${lines.length - 5} more lines)\n\`\`\`\n`;
      } else {
        return `\n> ⚠️ **Error Output**:\n> \`\`\`\n${error.trim()}\n\`\`\`\n`;
      }
    });
    
    // Format local-command-stdout similarly
    text = text.replace(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/g, (_, output) => {
      const lines = output.trim().split('\n');
      if (lines.length > 10) {
        const preview = lines.slice(0, 5).join('\n');
        return `\n> 📤 **Output**:\n> \`\`\`\n${preview}\n...\n(${lines.length - 5} more lines)\n\`\`\`\n`;
      } else if (output.trim()) {
        return `\n> 📤 **Output**:\n> \`\`\`\n${output.trim()}\n\`\`\`\n`;
      }
      return '';
    });
    
    return text;
  }

  private formatContentPart(item: ContentPart): string {
    if (item.type === 'text' && item.text) {
      const cleaned = this.cleanMetadata(item.text);
      return this.formatContinuationSummary(cleaned);
    }
    
    if (item.type === 'tool_use') {
      const toolName = item.name || 'Unknown Tool';
      return `\n🔧 **Tool Use**: ${toolName}\n\`\`\`json\n${JSON.stringify(item.input || {}, null, 2)}\n\`\`\``;
    }
    
    if (item.type === 'tool_result') {
      let result = typeof item.content === 'string' 
        ? item.content 
        : JSON.stringify(item.content, null, 2);
      
      // Clean metadata from tool results as well
      if (typeof item.content === 'string') {
        result = this.cleanMetadata(result);
      }
      
      const truncated = result.length > this.config.maxResultLength 
        ? result.substring(0, this.config.maxResultLength) + '\n... (truncated)'
        : result;
      
      return `\n📤 **Tool Result**:\n\`\`\`\n${truncated}\n\`\`\``;
    }
    
    return '';
  }

  private formatContent(content: string | unknown): string {
    if (typeof content === 'string') {
      const cleaned = this.cleanMetadata(content);
      return this.formatContinuationSummary(cleaned);
    }
    
    if (Array.isArray(content)) {
      return content.map((item: ContentPart) => this.formatContentPart(item)).join('\n');
    }
    
    if (typeof content === 'object' && content !== null) {
      return this.formatContentPart(content as ContentPart);
    }
    
    return '';
  }

  private formatAssistantContent(content: ContentPart[]): string {
    return content.map(item => this.formatContentPart(item)).join('\n');
  }

  private formatContinuationSummary(text: string): string {
    // Check if this is a continuation session summary
    if (text.startsWith('This session is being continued from a previous conversation')) {
      // Extract the first line as the summary title
      const lines = text.split('\n');
      const firstLine = lines[0];
      const remainingContent = lines.slice(1).join('\n').trim();
      
      // Format as a collapsible section using HTML details/summary tags
      // These are supported in GitHub-flavored markdown
      return `<details>\n<summary>📋 <strong>${firstLine}</strong></summary>\n\n${remainingContent}\n</details>`;
    }
    
    return text;
  }

  private extractSessionMetadata(firstMessage: Message): SessionMetadata | null {
    if (firstMessage.sessionId && firstMessage.timestamp && firstMessage.cwd && firstMessage.version) {
      return {
        sessionId: firstMessage.sessionId,
        timestamp: dayjs(firstMessage.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        cwd: firstMessage.cwd,
        version: firstMessage.version
      };
    }
    return null;
  }
}
