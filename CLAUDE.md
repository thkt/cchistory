# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CC History (cchistory) is a Node.js CLI tool for browsing and exporting Claude Code conversation history to Markdown files. The tool provides an interactive interface to select conversations and export them with proper formatting.

## Commands

### Installation & Setup
```bash
# Install dependencies
npm install

# Run installer (recommended - sets up aliases)
./install.sh

# Manual global install
npm link
```

### Development & Testing
```bash
# Run the CLI tool
node index.js

# Run with list mode
node index.js --list

# Run via npm script
npm start
```

### Uninstall
```bash
./uninstall.sh
```

## Architecture

### Core Structure
- **index.js**: Main entry point - ESM module with shebang for CLI execution
  - Loads config from `~/.config/cchistory/config.json`
  - Reads conversations from `~/.claude/projects/`
  - Provides interactive selection UI using inquirer
  - Exports selected conversations to markdown

### Key Components

1. **Configuration System**
   - Auto-creates config at `~/.config/cchistory/config.json`
   - Configurable export directory, date format, preview lengths
   - Falls back to defaults if config unavailable

2. **Conversation Loading**
   - Scans `~/.claude/projects/` for `.jsonl` files
   - Parses each conversation with error handling
   - Sorts by timestamp (newest first)
   - Extracts preview from first user message

3. **Markdown Conversion**
   - Handles multiple content formats (string, array, object)
   - Special formatting for thinking blocks, tool use, and results
   - Truncates long results to 3000 characters
   - Preserves session metadata

### Dependencies
- **inquirer**: Interactive CLI prompts
- **chalk**: Terminal string styling
- **fs-extra**: Enhanced file system operations
- **dayjs**: Date formatting

### File Locations
- Source: `~/Tools/cli/cchistory/`
- Config: `~/.config/cchistory/config.json`
- Exports: `~/Tools/cli/cchistory/exports/` (default)
- Claude data: `~/.claude/projects/`

## Development Notes

### ES Modules
This project uses ES modules (`"type": "module"` in package.json). Always use `import` statements, not `require()`.

### Error Handling
The code includes robust error handling for:
- Invalid JSON lines in conversation files
- Missing directories or permissions issues
- Malformed message content

### Content Format Handling
The tool handles multiple Claude message formats:
- Legacy string content
- Array-based content with type indicators
- Tool results and thinking blocks

### Shell Compatibility
Install/uninstall scripts support:
- zsh (primary)
- bash
- fish (basic support)

## Common Tasks

### Add New Export Format
Modify the `convertToMarkdown()` function in index.js to support additional output formats.

### Change Default Configuration
Update `DEFAULT_CONFIG` object in index.js and document in README.md.

### Debug Conversation Loading
Check `loadConversations()` function - add console.log for troubleshooting parsing issues.

### Extend CLI Options
Add new options in the main execution block (bottom of index.js) using process.argv parsing.
