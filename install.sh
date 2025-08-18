#!/bin/bash

# Claude History CLI - インストールスクリプト

set -e

INSTALL_DIR="$HOME/Tools/cli/cchistory"
ALIAS_NAME="cchistory"

echo "🤖 CC History インストーラー"
echo "================================="
echo ""

# Node.jsの確認
if ! command -v node &> /dev/null; then
    echo "❌ Node.js が見つかりません。先にNode.jsをインストールしてください。"
    exit 1
fi

echo "✅ Node.js: $(node -v)"

# インストールディレクトリの確認
if [ ! -d "$INSTALL_DIR" ]; then
    echo "❌ インストールディレクトリが見つかりません: $INSTALL_DIR"
    exit 1
fi

cd "$INSTALL_DIR"

# npm install
echo ""
echo "📦 依存関係をインストール中..."
npm install --silent

# 実行権限を付与
chmod +x index.js

# シェルの検出と設定
SHELL_NAME=$(basename "$SHELL")
RC_FILE=""

case "$SHELL_NAME" in
    zsh)
        RC_FILE="$HOME/.zshrc"
        ;;
    bash)
        RC_FILE="$HOME/.bashrc"
        ;;
    fish)
        RC_FILE="$HOME/.config/fish/config.fish"
        ;;
    *)
        echo "⚠️  サポートされていないシェル: $SHELL_NAME"
        echo "手動でエイリアスを追加してください："
        echo "alias $ALIAS_NAME='node $INSTALL_DIR/index.js'"
        exit 1
        ;;
esac

echo ""
echo "🔧 シェル設定を更新中 ($RC_FILE)..."

# エイリアスの追加（重複チェック付き）
ALIAS_CMD="alias $ALIAS_NAME='node $INSTALL_DIR/index.js'"

if grep -q "alias $ALIAS_NAME=" "$RC_FILE" 2>/dev/null; then
    echo "ℹ️  エイリアスは既に設定されています"
else
    echo "" >> "$RC_FILE"
    echo "# CC History CLI" >> "$RC_FILE"
    echo "$ALIAS_CMD" >> "$RC_FILE"
    echo "✅ エイリアスを追加しました"
fi

# PATH設定（オプション）
echo ""
echo "📝 オプション: グローバルコマンドとして設定しますか？"
echo "   (npm link を使用して、どこからでも 'cchistory' で実行可能にします)"
echo -n "   設定する？ (y/N): "
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "🔗 npm link を実行中..."
    npm link
    echo "✅ グローバルコマンドとして設定されました"
    echo ""
    echo "使い方:"
    echo "  cchistory        # グローバルコマンド"
else
    echo ""
    echo "使い方:"
    echo "  $ALIAS_NAME        # エイリアス"
fi

echo ""
echo "✨ インストール完了！"
echo ""
echo "⚠️  重要: 新しいターミナルを開くか、以下のコマンドを実行してください："
echo "   source $RC_FILE"
echo ""
echo "📚 使用方法:"
echo "   $ALIAS_NAME           # 会話を選択してエクスポート"
echo "   $ALIAS_NAME --list    # 会話一覧を表示"
echo ""
echo "エクスポート先: ~/Tools/cli/cchistory/exports/"
