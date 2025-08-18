#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import dayjs from 'dayjs';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLAUDE_PATH = path.join(homedir(), '.claude');
const PROJECTS_PATH = path.join(CLAUDE_PATH, 'projects');
const CONFIG_DIR = path.join(homedir(), '.config', 'cchistory');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// デフォルト設定
const DEFAULT_CONFIG = {
  exportDir: path.join(homedir(), 'Tools', 'cli', 'cchistory', 'exports'),
  dateFormat: 'YYYY-MM-DD_HHmmss',
  maxPreviewLength: 100,
  maxResultLength: 3000
};

// 設定ファイルの読み込み
async function loadConfig() {
  try {
    // 設定ディレクトリが存在しない場合は作成
    await fs.ensureDir(CONFIG_DIR);
    
    // 設定ファイルが存在するか確認
    if (await fs.pathExists(CONFIG_FILE)) {
      const configData = await fs.readJson(CONFIG_FILE);
      return { ...DEFAULT_CONFIG, ...configData };
    } else {
      // 設定ファイルが存在しない場合はデフォルト設定で作成
      await fs.writeJson(CONFIG_FILE, DEFAULT_CONFIG, { spaces: 2 });
      console.log(chalk.green(`✅ 設定ファイルを作成しました: ${CONFIG_FILE}`));
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    console.error(chalk.yellow('⚠️  設定ファイルの読み込みに失敗しました。デフォルト設定を使用します。'));
    return DEFAULT_CONFIG;
  }
}

// 会話履歴の読み込み
async function loadConversations(config = DEFAULT_CONFIG) {
  try {
    const projects = await fs.readdir(PROJECTS_PATH);
    const conversations = [];

    for (const project of projects) {
      if (project.startsWith('.')) continue;
      
      const projectPath = path.join(PROJECTS_PATH, project);
      const stats = await fs.stat(projectPath);
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(projectPath);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
        
        for (const file of jsonlFiles) {
          const filePath = path.join(projectPath, file);
          
          // ファイルの統計情報を取得（最終更新時刻用）
          const fileStats = await fs.stat(filePath);
          
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n');
          
          if (lines.length > 0) {
            try {
              // 空行やエラー行をスキップ
              const validLines = lines.filter(l => l.trim());
              if (validLines.length === 0) continue;
              
              const firstLine = JSON.parse(validLines[0]);
              const lastLine = validLines[validLines.length - 1] ? JSON.parse(validLines[validLines.length - 1]) : firstLine;
              
              // 最初のユーザーメッセージを探す
              let firstUserMessage = '';
              for (const line of lines) {
                try {
                  const msg = JSON.parse(line);
                  if (msg.type === 'user' && msg.message?.content) {
                    let content = msg.message.content;
                    
                    // contentが配列の場合（新しい形式）
                    if (Array.isArray(content)) {
                      const textPart = content.find(part => part.type === 'text');
                      content = textPart ? textPart.text : JSON.stringify(content);
                    }
                    
                    // contentがオブジェクトの場合
                    if (typeof content !== 'string') {
                      content = JSON.stringify(content);
                    }
                    
                    firstUserMessage = content.slice(0, config.maxPreviewLength).replace(/\n/g, ' ').trim();
                    break;
                  }
                } catch (e) {
                  // Invalid JSON line, skip it
                  continue;
                }
              }
              
              conversations.push({
                id: path.basename(file, '.jsonl'),
                project: project.replace(/-/g, '/'),
                filePath: filePath,
                timestamp: fileStats.mtime.toISOString(),  // ファイルの最終更新時刻を使用
                startTime: firstLine.timestamp,  // 会話開始時刻
                messageCount: lines.length,
                preview: firstUserMessage || 'No user message found',
                sessionId: firstLine.sessionId
              });
            } catch (e) {
              console.error(`Error parsing ${file}:`, e.message);
            }
          }
        }
      }
    }
    
    // タイムスタンプでソート（新しい順）
    conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return conversations;
  } catch (error) {
    console.error(chalk.red('Error loading conversations:'), error.message);
    return [];
  }
}

// 会話をマークダウンに変換
function convertToMarkdown(jsonlContent, config = DEFAULT_CONFIG) {
  const lines = jsonlContent.trim().split('\n');
  let markdown = '';
  let metadata = null;
  
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      
      // メタデータを最初のエントリから取得
      if (!metadata && data.timestamp) {
        metadata = {
          sessionId: data.sessionId,
          timestamp: data.timestamp,
          cwd: data.cwd,
          version: data.version
        };
      }
      
      // メッセージをマークダウンに変換
      if (data.type === 'user' && data.message) {
        let content = data.message.content;
        
        // contentが配列の場合（新しい形式）
        if (Array.isArray(content)) {
          const toolResultPart = content.find(part => part.type === 'tool_result');
          const textPart = content.find(part => part.type === 'text');
          
          if (toolResultPart) {
            // tool_resultがある場合は特別な処理
            markdown += `\n## User\n\n`;
            markdown += `### 📤 Tool Result\n\n`;
            markdown += '```\n';
            const result = typeof toolResultPart.content === 'string' 
              ? toolResultPart.content 
              : JSON.stringify(toolResultPart.content, null, 2);
            
            if (result.length > 3000) {
              markdown += result.slice(0, 3000);
              markdown += '\n\n... (truncated - ' + (result.length - 3000) + ' more characters)';
            } else {
              markdown += result;
            }
            markdown += '\n```\n';
            
            // テキスト部分もあれば追加
            if (textPart) {
              markdown += '\n' + textPart.text + '\n';
            }
          } else if (textPart) {
            content = textPart.text;
            markdown += `\n## User\n\n${content}\n`;
          } else {
            content = JSON.stringify(content, null, 2);
            markdown += `\n## User\n\n${content}\n`;
          }
        } else {
          // 文字列やその他の場合
          if (typeof content !== 'string') {
            content = JSON.stringify(content);
          }
          markdown += `\n## User\n\n${content}\n`;
        }
        
        markdown += `\n*[${dayjs(data.timestamp).format('YYYY-MM-DD HH:mm:ss')}]*\n`;
      } else if (data.type === 'assistant' && data.message) {
        let content = data.message.content;
        
        // contentが配列の場合（新しい形式）
        if (Array.isArray(content)) {
          // 各種要素を探す
          const thinkingPart = content.find(part => part.type === 'thinking');
          const toolUsePart = content.find(part => part.type === 'tool_use');
          const textPart = content.find(part => part.type === 'text');
          
          markdown += `\n## Assistant\n\n`;
          
          if (thinkingPart) {
            // thinkingがある場合
            markdown += `### 🤔 Thinking (内部思考)\n\n`;
            markdown += '> ' + thinkingPart.thinking.replace(/\n/g, '\n> ');
            markdown += '\n\n';
          }
          
          if (toolUsePart) {
            // tool_useがある場合
            markdown += `### 🔧 Tool Use: ${toolUsePart.name || 'Unknown'}\n\n`;
            markdown += '```json\n';
            markdown += '// Parameters\n';
            markdown += JSON.stringify(toolUsePart.input || toolUsePart.parameters || {}, null, 2);
            markdown += '\n```\n\n';
          }
          
          if (textPart) {
            // テキスト部分があれば追加
            markdown += textPart.text + '\n';
          }
          
          // どれもない場合はJSON表示
          if (!thinkingPart && !toolUsePart && !textPart) {
            markdown += JSON.stringify(content, null, 2) + '\n';
          }
        } else {
          // 文字列の場合（従来の形式）
          markdown += `\n## Assistant\n\n${content}\n`;
        }
        
        markdown += `\n*[${dayjs(data.timestamp).format('YYYY-MM-DD HH:mm:ss')}]*\n`;
      } else if (data.type === 'thinking' && (data.thinking || data.content)) {
        // Thinking タイプ（Claude の内部思考）
        const thinkingContent = data.thinking || data.content;
        markdown += `\n### 🤔 Thinking (内部思考)\n\n`;
        markdown += '> ' + thinkingContent.replace(/\n/g, '\n> ');
        markdown += '\n\n';
      } else if (data.type === 'tool_use' && data.content) {
        // Tool使用
        markdown += `\n### 🔧 Tool Use: ${data.content.name}\n\n`;
        markdown += '```json\n';
        markdown += '// Parameters\n';
        markdown += JSON.stringify(data.content.parameters, null, 2);
        markdown += '\n```\n';
      } else if (data.type === 'tool_result' && data.content) {
        // Tool結果
        markdown += `\n### 📤 Tool Result\n\n`;
        markdown += '```\n';
        const result = typeof data.content.result === 'string' 
          ? data.content.result 
          : JSON.stringify(data.content.result, null, 2);
        
        // 長い結果は切り詰める（設定値まで表示）
        if (result.length > config.maxResultLength) {
          markdown += result.slice(0, config.maxResultLength);
          markdown += '\n\n... (truncated - ' + (result.length - config.maxResultLength) + ' more characters)';
        } else {
          markdown += result;
        }
        markdown += '\n```\n';
      }
    } catch (e) {
      console.error('Error parsing line:', e.message);
    }
  }
  
  // ヘッダーを追加
  let header = '# Claude Code Conversation\n\n';
  if (metadata) {
    header += '## Metadata\n\n';
    header += `- **Session ID**: ${metadata.sessionId}\n`;
    header += `- **Started**: ${dayjs(metadata.timestamp).format('YYYY-MM-DD HH:mm:ss')}\n`;
    header += `- **Working Directory**: ${metadata.cwd}\n`;
    header += `- **Claude Version**: ${metadata.version}\n\n`;
    header += '---\n';
  }
  
  return header + markdown;
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  
  console.log(chalk.blue.bold('\n🤖 CC History\n'));
  
  // 設定ファイルを読み込む
  const config = await loadConfig();
  
  console.log(chalk.gray('Loading conversation history...\n'));
  
  const conversations = await loadConversations(config);
  
  if (conversations.length === 0) {
    console.log(chalk.yellow('No conversations found.'));
    process.exit(0);
  }
  
  console.log(chalk.green(`Found ${conversations.length} conversations.\n`));
  
  // リストモードの場合は一覧表示して終了
  if (listOnly) {
    conversations.slice(0, 20).forEach((conv, i) => {
      console.log(
        `${chalk.blue(i + 1 + '.')} ${chalk.cyan(dayjs(conv.timestamp).format('MM/DD HH:mm'))} | ` +
        `${chalk.yellow(conv.project)} | ${chalk.gray(conv.preview)}`
      );
    });
    if (conversations.length > 20) {
      console.log(chalk.gray(`\n... and ${conversations.length - 20} more conversations`));
    }
    process.exit(0);
  }
  
  // 選択肢を作成
  const choices = conversations.map(conv => ({
    name: `${chalk.cyan(dayjs(conv.timestamp).format('MM/DD HH:mm'))} | ${chalk.yellow(conv.project)} | ${chalk.gray(conv.preview)}`,
    value: conv
  }));
  
  // ユーザーに選択させる
  const { selectedConv } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedConv',
    message: 'Select a conversation to export:',
    choices: choices,
    pageSize: 10,
    loop: false  // リストのループを無効化
  }]);
  
  // 選択された会話を読み込む
  const content = await fs.readFile(selectedConv.filePath, 'utf-8');
  const markdown = convertToMarkdown(content, config);
  
  // 出力ファイル名を生成（設定ファイルから読み取ったディレクトリを使用）
  const outputDir = config.exportDir.startsWith('~') 
    ? path.join(homedir(), config.exportDir.slice(2))
    : config.exportDir;
  await fs.ensureDir(outputDir);
  
  const outputFile = path.join(
    outputDir, 
    `conversation_${dayjs(selectedConv.timestamp).format(config.dateFormat)}.md`
  );
  
  // マークダウンファイルを保存
  await fs.writeFile(outputFile, markdown, 'utf-8');
  
  console.log(chalk.green(`\n✅ Conversation exported successfully!`));
  console.log(chalk.blue(`📁 Output file: ${outputFile}`));
  
  // プレビューを表示
  console.log(chalk.gray('\n--- Preview (first 500 chars) ---\n'));
  console.log(markdown.slice(0, 500) + '...');
}

// エラーハンドリング
main().catch(error => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
