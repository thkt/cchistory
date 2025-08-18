# CC History

Claude Codeの会話履歴をブラウズして、マークダウンファイルにエクスポートするCLIツールです。

## インストール

### 🚀 自動インストール（推奨）

```bash
cd ~/Tools/cli/cchistory
./install.sh
```

このスクリプトは以下を自動で行います：
- npm依存関係のインストール  
- シェルへのエイリアス追加（zsh/bash対応）
- オプション：グローバルコマンドの設定

### 手動インストール

```bash
cd ~/Tools/cli/cchistory
npm install
# zshの場合
echo "alias cchistory='node ~/Tools/cli/cchistory/index.js'" >> ~/.zshrc
source ~/.zshrc
```

### アンインストール

```bash
cd ~/Tools/cli/cchistory
./uninstall.sh
```

## 使い方

### 基本的な使い方

```bash
# インタラクティブモード（会話を選択してエクスポート）
node ~/Tools/cli/cchistory/index.js

# リストモード（会話一覧を表示するだけ）
node ~/Tools/cli/cchistory/index.js --list
```

または、npm linkでグローバルにインストールして使用:

```bash
cd ~/Tools/cli/cchistory
npm link
cchistory
```

### 機能

- Claude Codeの全会話履歴を一覧表示（新しい順）
- インタラクティブな選択UI（矢印キーで選択、ループなし）
- 選択した会話をマークダウン形式でエクスポート
- タイムスタンプ、プロジェクト名、会話のプレビューを表示
- `--list`オプションで会話一覧の確認のみ

### 設定ファイル

設定ファイルは `~/.config/cchistory/config.json` に自動生成されます。

```json
{
  "exportDir": "~/Tools/cli/cchistory/exports",  // エクスポート先ディレクトリ
  "dateFormat": "YYYY-MM-DD_HHmmss",             // ファイル名の日付形式
  "maxPreviewLength": 100,                        // 一覧表示時のプレビュー文字数
  "maxResultLength": 3000                         // ツール結果の最大表示文字数
}
```

設定を変更したい場合は、このファイルを編集してください。

### エクスポート先

エクスポートされたマークダウンファイルは設定ファイルで指定したディレクトリに保存されます（デフォルト： `~/Tools/cli/cchistory/exports/`）

### マークダウン形式

エクスポートされるマークダウンには以下の情報が含まれます：

- セッションメタデータ（ID、開始時刻、作業ディレクトリ、バージョン）
- ユーザーとアシスタントのメッセージ
- 🤔 Thinking - Claudeの内部思考プロセス（引用ブロック形式）
- 🔧 Tool Use - ツール使用情報（JSONコードブロック）
- 📤 Tool Result - ツール実行結果（コードブロック、3000文字まで）
- 各メッセージのタイムスタンプ

## 必要条件

- Node.js 18以上
- npm
- Claude Codeがインストールされ、会話履歴が存在すること

## トラブルシューティング

### 会話が見つからない場合

Claude Codeの会話履歴は `~/.claude/projects/` ディレクトリに保存されています。
このディレクトリが存在し、`.jsonl`ファイルが含まれていることを確認してください。

### パーミッションエラー

スクリプトに実行権限を付与してください：

```bash
chmod +x ~/Tools/cli/cchistory/index.js
```

## ライセンス

MIT
