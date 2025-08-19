# CC History

Claude Codeの会話履歴をブラウズして、マークダウンファイルにエクスポートするCLIツールです。

## インストール

### 🚀 自動インストール（推奨）

```bash
git clone https://github.com/yourusername/cchistory.git
cd cchistory
./install.sh
```

このスクリプトは以下を自動で行います：
- npm依存関係のインストール
- TypeScriptのビルド
- シェルへのエイリアス追加（zsh/bash対応）
- オプション：グローバルコマンドの設定

### 手動インストール

```bash
git clone https://github.com/yourusername/cchistory.git
cd cchistory
npm install
npm run build

# エイリアスを設定（zshの場合）
echo "alias cchistory='node $(pwd)/dist/index.js'" >> ~/.zshrc
source ~/.zshrc

# またはグローバルにインストール
npm link
```

### アンインストール

```bash
cd /path/to/cchistory
./uninstall.sh
```

## 使い方

### 基本的な使い方

```bash
# 会話を選択してエクスポート
cchistory
```

またはプロジェクトディレクトリから直接実行:

```bash
cd /path/to/cchistory
node dist/index.js
```

### 機能

- 🔍 Claude Codeの全会話履歴を一覧表示（新しい順）
- 🎯 インタラクティブな選択UI（矢印キーで選択、Ctrl+Cでキャンセル）
- 📝 選択した会話をマークダウン形式でエクスポート
- 🏷️ タイムスタンプ、プロジェクト名、会話のプレビューを表示
- 🔒 パストラバーサル攻撃を防ぐセキュアなパス処理
- 📦 継続セッションサマリーを折りたたみ可能な形式で出力
- 🛡️ TypeScriptによる完全な型安全性

### 設定ファイル

設定ファイルは `~/.config/cchistory/config.json` に自動生成されます。

```json
{
  "exportDir": "~/Documents/claude-exports",     // エクスポート先ディレクトリ
  "dateFormat": "YYYY/MM/DD HH:mm:ss",           // 日付表示形式
  "maxPreviewLength": 100,                        // 一覧表示時のプレビュー文字数
  "maxResultLength": 3000,                        // ツール結果の最大表示文字数
  "allowedBasePath": "~/Documents"                // エクスポート先の制限ディレクトリ（オプション）
}
```

**デフォルト設定**:
- `exportDir`: `[プロジェクトディレクトリ]/exports` （自動検出）
- `allowedBasePath`: `~/Tools` （デフォルト制限、変更可能）

環境変数`CCHISTORY_EXPORT_DIR`を設定することで、デフォルトのエクスポート先を変更することもできます。

設定を変更したい場合は、このファイルを編集してください。

### エクスポート先

エクスポートされたマークダウンファイルは設定ファイルで指定したディレクトリに保存されます。

**デフォルト**: `[cchistoryディレクトリ]/exports/`

設定ファイルで`exportDir`と`allowedBasePath`を変更して、任意の場所にエクスポートできます。

### マークダウン形式

エクスポートされるマークダウンには以下の情報が含まれます：

- 📊 セッションメタデータ（ID、開始時刻、作業ディレクトリ、バージョン）
- 💬 ユーザーとアシスタントのメッセージ
- 🤔 **Thinking** - Claudeの内部思考プロセス（引用ブロック形式）
- 🔧 **Tool Use** - ツール使用情報（JSONコードブロック）
- 📤 **Tool Result** - ツール実行結果（コードブロック、3000文字まで）
- 📋 **継続セッション** - 長い要約を折りたたみ可能な形式で表示
- 💡 **コマンド実行** - /コマンドを見やすくフォーマット
- ⚠️ **エラー出力** - 長いエラーは最初の数行+残り行数を表示
- 各メッセージのタイムスタンプ

#### 特別な機能

- **内部メタデータの自動削除**: `user-prompt-submit-hook`などの内部タグを自動削除
- **空メッセージのスキップ**: 内容のないメッセージセクションを自動的に除外
- **折りたたみ可能なセクション**: 長い継続セッションサマリーを`<details>`タグで折りたたみ

## 必要条件

- Node.js 18以上
- npm
- Claude Codeがインストールされ、会話履歴が存在すること

## 開発

このプロジェクトはTypeScriptで書かれています。ビルド済みのJavaScriptファイルがdistディレクトリに含まれているため、ユーザーはビルドなしですぐに使用できます。

### 開発コマンド

```bash
# TypeScriptをビルド
npm run build

# ウォッチモードでビルド
npm run build:watch

# ビルドして実行
npm run dev

# distディレクトリをクリーン（ゴミ箱へ移動）
npm run clean

# テスト実行
npm test

# テストカバレッジ
npm run test:coverage

# テストUI
npm run test:ui
```

### プロジェクト構造

```
cchistory/
├── src/                      # TypeScriptソースコード
│   ├── index.ts              # メインエントリーポイント
│   ├── types.ts              # 型定義
│   ├── lib/                  # コアライブラリ
│   │   ├── CLI.ts            # CLIインターフェース
│   │   ├── ConfigManager.ts  # 設定管理
│   │   ├── ConversationManager.ts # 会話データ管理
│   │   └── MarkdownExporter.ts    # マークダウンエクスポート
│   └── utils/                # ユーティリティ
│       └── pathSanitizer.ts  # パス安全性チェック
├── dist/                     # ビルド済みJavaScript（Gitに含まれる）
│   └── index.js              # 実行可能ファイル
├── exports/                  # エクスポートされたマークダウン
├── package.json              # npm設定
├── tsconfig.json             # TypeScript設定
└── vitest.config.ts          # テスト設定
```

### テスト

このプロジェクトは包括的なテストスイートを備えています：

- 単体テスト: 全コンポーネントをカバー
- 85個以上のテストケース
- モック化された外部依存関係
- セキュリティテスト（パストラバーサル攻撃など）

## セキュリティ機能

- **パストラバーサル攻撃防止**: エクスポートパスを指定ディレクトリ内に制限
- **シンボリックリンク対策**: リンクを解決して実パスを検証
- **安全なファイル削除**: `rm -rf`の代わりに`mv ~/.Trash/`を使用
- **設定可能な制限パス**: `allowedBasePath`オプションで制限ディレクトリをカスタマイズ可能

## トラブルシューティング

### 会話が見つからない場合

Claude Codeの会話履歴は `~/.claude/projects/` ディレクトリに保存されています。
このディレクトリが存在し、`.jsonl`ファイルが含まれていることを確認してください。

### パーミッションエラー

スクリプトに実行権限を付与してください：

```bash
cd /path/to/cchistory
chmod +x dist/index.js
chmod +x install.sh
chmod +x uninstall.sh
```

## 変更履歴

### v1.1.0 (2025-08-19)

- 🔒 セキュリティ強化: `rm -rf`を`mv ~/.Trash/`に変更
- 📦 パッケージを最新版に更新（inquirer v12対応）
- 🎯 TypeScript型安全性の向上（any型の削除）
- 📝 マークダウンエクスポートの改善
  - 継続セッションサマリーを折りたたみ可能に
  - コマンドタグの特別フォーマット
  - 空メッセージの自動スキップ
  - 長いエラーの短縮表示
- 🗑️ `--list`オプションを削除（使用されていないため）
- ⚙️ 設定可能な制限パス（`allowedBasePath`オプション）
- 🧪 包括的なテストスイート（85テスト）

### v1.0.0 (2025-08-18)

- 初回リリース
- TypeScript移行完了
- 基本的なエクスポート機能

## ライセンス

MIT
