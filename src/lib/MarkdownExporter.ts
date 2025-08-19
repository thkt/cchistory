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
      return `> 💡 **Command**: \`${cmd}\``;
    });
    
    // Format command-message tags
    text = text.replace(/<command-message>([^<]+)<\/command-message>/g, (_, msg) => {
      return `> ℹ️ **Status**: ${msg}`;
    });
    
    // Format command-args tags
    text = text.replace(/<command-args>([^<]*)<\/command-args>/g, (_, args) => {
      if (args.trim()) {
        return `> 📝 **Arguments**: \`${args}\``;
      }
      return '';
    });
    
    // Clean up whitespace between consecutive blockquotes
    // Remove any blank lines between blockquotes
    text = text.replace(/(^|\n)(> [^\n]+)\s*\n+\s*(?=> )/gm, '$1$2\n');
    
    // Ensure blockquotes end with proper line breaks  
    text = text.replace(/(^|\n)(> [^\n]+)$/gm, '$1$2  ');
    
    // Format local-command-stderr with collapsible section for long errors
    text = text.replace(/<local-command-stderr>([\s\S]*?)<\/local-command-stderr>/g, (_, error) => {
      const trimmedError = error.trim();
      if (!trimmedError) {
        return `\n> ⚠️ **Error Output**: (empty)\n`;
      }
      
      const lines = trimmedError.split('\n');
      if (lines.length > 10) {
        // For long errors, show first few lines and make rest collapsible
        const preview = lines.slice(0, 5).map((line: string) => `> ${line}`).join('\n');
        return `\n> ⚠️ **Error Output**: \`\`\`\n${preview}\n> ...\n> (${lines.length - 5} more lines)\`\`\`\n`;
      } else {
        const formattedLines = lines.map((line: string, index: number) => {
          if (index === lines.length - 1) {
            return `> ${line}\`\`\``;
          }
          return `> ${line}`;
        }).join('\n');
        return `\n> ⚠️ **Error Output**: \`\`\`\n${formattedLines}\n`;
      }
    });
    
    // Format local-command-stdout similarly
    text = text.replace(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/g, (_, output) => {
      const trimmedOutput = output.trim();
      if (!trimmedOutput) {
        return `\n> 📤 **Output**: (empty)\n`;
      }
      
      const lines = trimmedOutput.split('\n');
      if (lines.length > 10) {
        const preview = lines.slice(0, 5).map((line: string) => `> ${line}`).join('\n');
        return `\n> 📤 **Output**: \`\`\`\n${preview}\n> ...\n> (${lines.length - 5} more lines)\`\`\`\n`;
      } else {
        const formattedLines = lines.map((line: string, index: number) => {
          if (index === lines.length - 1) {
            return `> ${line}\`\`\``;
          }
          return `> ${line}`;
        }).join('\n');
        return `\n> 📤 **Output**: \`\`\`\n${formattedLines}\n`;
      }
    });
    
    return text;
  }

  private normalizeCodeBlockIndentation(content: string): string {
    const lines = content.split('\n');
    
    // Check if this looks like git status output
    const gitStatusLines = lines.map(line => 
      line.match(/^([MADRCU?!]+|\s[MADRCU?!]+)\s+\S/) || 
      line.match(/^(\?\?|\s\?\?)\s+\S/)
    );
    
    const hasGitStatus = gitStatusLines.some(match => match !== null);
    
    if (hasGitStatus) {
      // Check if we have mixed indentation (some lines with space, some without)
      const hasIndentedLines = lines.some(line => line.startsWith(' ') && line.trim());
      const hasUnindentedLines = lines.some(line => !line.startsWith(' ') && line.trim());
      
      if (hasIndentedLines && hasUnindentedLines) {
        // Add space to unindented lines to align them
        return lines.map(line => {
          if (line.trim() && !line.startsWith(' ')) {
            return ' ' + line;
          }
          return line;
        }).join('\n');
      }
      return content;
    }
    
    // Check if this looks like git diff stat output
    const gitDiffStatLines = lines.filter(line => 
      line.match(/^\s*\S+\.\S+\s+\|\s+\d+/) ||  // File stat lines
      line.match(/^\s*\d+\s+files?\s+changed/)   // Summary line
    );
    
    if (gitDiffStatLines.length > 0) {
      // Check for mixed indentation
      const hasIndentedLines = lines.some(line => line.startsWith(' ') && line.trim());
      const hasUnindentedLines = lines.some(line => !line.startsWith(' ') && line.trim());
      
      if (hasIndentedLines && hasUnindentedLines) {
        // Add space to unindented lines
        return lines.map(line => {
          if (line.trim() && !line.startsWith(' ')) {
            return ' ' + line;
          }
          return line;
        }).join('\n');
      }
      return content;
    }
    
    // Find the minimum indentation (excluding empty lines)
    let minIndent = Infinity;
    for (const line of lines) {
      if (line.trim()) {
        const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
        minIndent = Math.min(minIndent, leadingSpaces);
      }
    }
    
    // If all lines have at least one space of common indentation, remove it
    if (minIndent > 0 && minIndent !== Infinity) {
      return lines.map(line => {
        // Preserve empty lines
        if (!line.trim()) return line;
        // Remove common indentation
        return line.substring(minIndent);
      }).join('\n');
    }
    
    return content;
  }

  private formatEmptyCodeBlocks(text: string): string {
    // Detect empty code blocks and replace with (empty code block)
    text = text.replace(/```(\w*)\n\s*\n```/g, (_match, lang) => {
      const language = lang || '';
      return `\`\`\`${language}\n(empty code block)\n\`\`\``;
    });
    
    // Also handle code blocks with only whitespace
    text = text.replace(/```(\w*)\n(\s+)\n```/g, (match, lang, spaces) => {
      if (spaces.trim() === '') {
        const language = lang || '';
        return `\`\`\`${language}\n(empty code block)\n\`\`\``;
      }
      return match;
    });
    
    // Normalize indentation within code blocks
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, content) => {
      const language = lang || '';
      if (content.trim()) {
        const normalized = this.normalizeCodeBlockIndentation(content);
        return `\`\`\`${language}\n${normalized}\`\`\``;
      }
      return `\`\`\`${language}\n${content}\`\`\``;
    });
    
    return text;
  }

  private formatContentPart(item: ContentPart): string {
    if (item.type === 'text' && item.text) {
      const cleaned = this.cleanMetadata(item.text);
      const formatted = this.formatContinuationSummary(cleaned);
      // Check for empty code blocks in regular text content
      const withEmptyBlocks = this.formatEmptyCodeBlocks(formatted);
      // Adjust heading levels
      return this.adjustHeadingLevels(withEmptyBlocks);
    }
    
    if (item.type === 'tool_use') {
      const toolName = item.name || 'Unknown Tool';
      let jsonContent = '';
      
      try {
        jsonContent = JSON.stringify(item.input || {}, null, 2);
      } catch (error) {
        jsonContent = '(error formatting JSON)';
      }
      
      // Check if JSON is effectively empty
      if (!item.input || Object.keys(item.input).length === 0) {
        return [
          '',
          `🔧 **Tool Use**: ${toolName}`,
          '```json',
          '(empty)',
          '```'
        ].join('\n');
      }
      
      // Ensure the JSON content is properly formatted and closed
      // Sometimes JSON might be truncated or malformed in the source data
      if (!jsonContent.endsWith('}') && !jsonContent.endsWith(']')) {
        jsonContent = jsonContent + '\n... (truncated)';
      }
      
      // Use template literal correctly for markdown code block
      const result = [
        '',
        `🔧 **Tool Use**: ${toolName}`,
        '```json',
        jsonContent,
        '```'
      ].join('\n');
      
      return result;
    }
    
    if (item.type === 'tool_result') {
      let result = typeof item.content === 'string' 
        ? item.content 
        : JSON.stringify(item.content, null, 2);
      
      // Clean metadata from tool results as well
      if (typeof item.content === 'string') {
        result = this.cleanMetadata(result);
        // Remove cat -n style line numbers (e.g., "   1→content" or "     2→content")
        result = this.removeCatLineNumbers(result);
      }
      
      // Check if content is effectively empty (only whitespace or empty)
      if (!result.trim()) {
        return `\n📤 **Tool Result**: (empty result)\n`;
      }
      
      // Normalize indentation BEFORE truncation to preserve structure
      const normalized = this.normalizeCodeBlockIndentation(result);
      
      // Check if content appears to be already truncated from source
      const isAlreadyTruncated = normalized.endsWith('... (truncated)') || 
                                 normalized.endsWith('(truncated)');
      
      // Truncate after normalizing to avoid broken output
      let finalContent = normalized;
      if (!isAlreadyTruncated && normalized.length > this.config.maxResultLength) {
        // Find a good break point to avoid cutting in the middle of a line
        const cutoff = this.config.maxResultLength;
        const lastNewline = normalized.lastIndexOf('\n', cutoff);
        const breakPoint = lastNewline > cutoff - 100 ? lastNewline : cutoff;
        finalContent = normalized.substring(0, breakPoint) + '\n... (truncated)';
      }
      
      // Check for nested code blocks that might be incomplete
      // Count opening and closing backticks
      const backtickMatches = [...finalContent.matchAll(/```/g)];
      const backtickCount = backtickMatches.length;
      
      // If odd number of ```, the code block is not properly closed
      if (backtickCount % 2 !== 0) {
        // Find the last ``` position
        const lastBacktickIndex = finalContent.lastIndexOf('```');
        // Check if it's an opening backtick (has language identifier or nothing after it)
        const afterBacktick = finalContent.substring(lastBacktickIndex + 3).trim();
        if (!afterBacktick || /^[a-z]+$/i.test(afterBacktick.split('\n')[0])) {
          // It's an unclosed code block, close it before truncation marker
          finalContent = finalContent + '\n```\n... (truncated)';
        }
      }
      // Ensure proper formatting even if source data was cut off
      else if (!finalContent.endsWith('... (truncated)') && !finalContent.endsWith('(truncated)')) {
        // Check if the content appears to be cut off mid-sentence
        const lines = finalContent.split('\n');
        const lastLine = lines[lines.length - 1] || '';
        
        // Detect incomplete lines (ending with comma, opening paren, etc.)
        const incompletePatterns = [
          /,\s*$/,          // Ends with comma
          /\(\s*$/,         // Ends with opening parenthesis
          /\[\s*$/,         // Ends with opening bracket
          /\{\s*$/,         // Ends with opening brace
          /=\s*$/,          // Ends with equals sign
          /\+\s*$/,         // Ends with plus sign
          /->\s*$/,         // Ends with arrow
          /\|\s*$/,         // Ends with pipe
          /&&\s*$/,         // Ends with logical AND
          /\|\|\s*$/,       // Ends with logical OR
          /:\s*$/,          // Ends with colon
          /\w+\.\w*$/,      // Ends with incomplete method call
        ];
        
        const isIncomplete = incompletePatterns.some(pattern => pattern.test(lastLine.trim()));
        
        if (isIncomplete || (lastLine && !lastLine.trim().match(/[.;}\])]$/))) {
          // Content appears to be cut off, add truncation marker
          finalContent = finalContent + '\n... (truncated)';
        }
      }
      
      return [
        '',
        '📤 **Tool Result**:',
        '```',
        finalContent,
        '```'
      ].join('\n');
    }
    
    return '';
  }

  private removeCatLineNumbers(text: string): string {
    // Remove cat -n style line numbers (e.g., "     1→content" or "   123→content")
    // Pattern: optional spaces, number, arrow (→ or tab), then content
    return text.split('\n').map(line => {
      // Match lines that start with spaces, number, and arrow/tab
      const match = line.match(/^\s*\d+[→\t](.*)$/);
      if (match) {
        return match[1]; // Return only the content part
      }
      return line;
    }).join('\n');
  }

  private adjustHeadingLevels(text: string): string {
    // Adjust heading levels within message content
    // Convert # to ####, ## to #####, etc.
    return text.replace(/^(#{1,3})\s/gm, (_match, hashes) => {
      const newLevel = '#'.repeat(hashes.length + 3);
      return `${newLevel} `;
    });
  }

  private formatContent(content: string | unknown): string {
    if (typeof content === 'string') {
      const cleaned = this.cleanMetadata(content);
      const formatted = this.formatContinuationSummary(cleaned);
      const withEmptyBlocks = this.formatEmptyCodeBlocks(formatted);
      // Adjust heading levels in user/assistant messages
      return this.adjustHeadingLevels(withEmptyBlocks);
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
