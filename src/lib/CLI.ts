import inquirer from 'inquirer';
import chalk from 'chalk';
import dayjs from 'dayjs';
import { ConfigManager } from './ConfigManager.js';
import { ConversationManager } from './ConversationManager.js';
import { MarkdownExporter } from './MarkdownExporter.js';
import type { Conversation } from '../types.js';

export class CLI {
  private configManager: ConfigManager;
  private conversationManager: ConversationManager;
  private exporter: MarkdownExporter | null = null;

  constructor() {
    this.configManager = new ConfigManager();
    this.conversationManager = new ConversationManager();
  }

  async run(_args: string[]): Promise<void> {
    console.log(chalk.cyan.bold('\n🤖 Claude Conversation History Browser\n'));

    const config = await this.configManager.load();
    this.exporter = new MarkdownExporter(config);

    const conversations = await this.conversationManager.loadConversations(config);

    if (conversations.length === 0) {
      console.log(chalk.yellow('❌ No conversation history found.'));
      console.log(chalk.gray(`Search path: ~/.claude/projects/`));
      return;
    }

    console.log(chalk.green(`✅ Found ${conversations.length} conversation${conversations.length === 1 ? '' : 's'}\n`));

    await this.interactiveMode(conversations);
  }


  private truncatePreview(text: string, maxLength: number): string {
    return text.length > maxLength 
      ? text.substring(0, maxLength) + '...' 
      : text;
  }

  private formatConversationChoice(conversation: Conversation, index: number): string {
    // Fixed-width formatting for aligned display (space-only alignment)
    const indexStr = String(index + 1).padStart(3);
    const dateStr = conversation.startTime.padEnd(20);
    const projectStr = conversation.project.padEnd(25);
    const messageStr = String(conversation.messageCount).padStart(8);
    const previewStr = this.truncatePreview(conversation.preview, 40);
    
    return `${chalk.yellow(indexStr)}  ${dateStr}  ${projectStr}  ${messageStr}  ${previewStr}`;
  }

  private async interactiveMode(conversations: Conversation[]): Promise<void> {
    const choices = conversations.map((conv, index) => ({
      name: this.formatConversationChoice(conv, index),
      value: index
    }));

    try {
      const { selectedIndex } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedIndex',
          message: 'Select a conversation to export:',
          choices,
          loop: false
        }
      ]);

      const selected = conversations[selectedIndex];
      console.log(chalk.cyan(`\nSelected conversation: ${selected.project} (${selected.startTime})`));

      const messages = await this.conversationManager.loadConversationContent(selected.filePath);
      
      const timestamp = dayjs().format('YYYY-MM-DD_HHmmss');
      const filename = `claude_${selected.project}_${timestamp}.md`;
      
      if (!this.exporter) {
        console.error(chalk.red('❌ Failed to initialize exporter'));
        return;
      }

      const filepath = await this.exporter.export(messages, filename);
      console.log(chalk.green(`✅ Export complete: ${filepath}`));
    } catch (error) {
      // Handle user cancellation (Ctrl+C) or export errors
      if (error instanceof Error) {
        if (error.message.includes('canceled') || error.name === 'ExitPromptError') {
          console.log(chalk.yellow('\n⚠️  Operation cancelled'));
        } else {
          console.error(chalk.red(`❌ Export failed: ${error.message}`));
        }
      }
    }
  }
}
