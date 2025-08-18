#!/bin/bash

# CC History CLI - アンインストールスクリプト

INSTALL_DIR="$HOME/Tools/cli/cchistory"
ALIAS_NAME="cchistory"

echo "🤖 CC History アンインストーラー"
echo "======================================"
echo ""

# シェルの検出
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
        echo "⚠️  シェル設定ファイルが見つかりません"
        ;;
esac

# エイリアスの削除
if [ -n "$RC_FILE" ] && [ -f "$RC_FILE" ]; then
    echo "🔧 エイリアスを削除中..."
    # CC History CLI関連の行を削除
    sed -i.bak "/# CC History CLI/d" "$RC_FILE" 2>/dev/null || sed -i '' "/# CC History CLI/d" "$RC_FILE"
    sed -i.bak "/alias $ALIAS_NAME=/d" "$RC_FILE" 2>/dev/null || sed -i '' "/alias $ALIAS_NAME=/d" "$RC_FILE"
    echo "✅ エイリアスを削除しました"
fi

# npm unlinkの実行（グローバルインストールの場合）
if command -v cchistory &> /dev/null; then
    echo "🔗 グローバルコマンドを削除中..."
    cd "$INSTALL_DIR" && npm unlink 2>/dev/null || true
    echo "✅ グローバルコマンドを削除しました"
fi

# エクスポートフォルダの確認
EXPORT_DIR="$INSTALL_DIR/exports"
if [ -d "$EXPORT_DIR" ] && [ "$(ls -A $EXPORT_DIR 2>/dev/null)" ]; then
    echo ""
    echo "📁 エクスポートされたファイルが見つかりました："
    ls -la "$EXPORT_DIR"/*.md 2>/dev/null | tail -5
    echo ""
    echo -n "これらのファイルも削除しますか？ (y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        rm -rf "$EXPORT_DIR"
        echo "✅ エクスポートファイルを削除しました"
    else
        echo "ℹ️  エクスポートファイルは保持されます"
    fi
fi

echo ""
echo "✨ アンインストール完了！"
echo ""
echo "⚠️  重要: 変更を反映するには、以下のコマンドを実行してください："
if [ -n "$RC_FILE" ]; then
    echo "   source $RC_FILE"
fi
echo ""
echo "プロジェクトフォルダ ($INSTALL_DIR) は削除されていません。"
echo "完全に削除する場合は以下を実行してください："
echo "   rm -rf $INSTALL_DIR"
