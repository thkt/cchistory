# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CC History (cchistory) is a Node.js CLI tool for browsing and exporting Claude Code conversation history to Markdown files. The tool provides an interactive interface to select conversations and export them with proper formatting.

## Commands

### Installation & Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/cchistory.git
cd cchistory

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run installer (recommended - sets up aliases and builds)
./install.sh

# Or manual global install
npm link
```

### Development & Testing
```bash
# Build TypeScript
npm run build

# Build in watch mode
npm run build:watch

# Run the CLI tool
node dist/index.js

# Run via npm script
npm start

# Development mode (build + run)
npm run dev
```

### Uninstall
```bash
./uninstall.sh
```

## Architecture

### Core Structure
- **src/index.ts**: TypeScript source - Main entry point with type safety
  - Loads config from `~/.config/cchistory/config.json`
  - Reads conversations from `~/.claude/projects/`
  - Provides interactive selection UI using inquirer
  - Exports selected conversations to markdown
  
- **src/types.ts**: Type definitions for all data structures

- **dist/index.js**: Compiled JavaScript - ESM module with shebang for CLI execution
  - Auto-generated from TypeScript source
  - Included in Git for immediate use without building

### Configuration
- Default export directory: `[project-root]/exports/`
- Default allowed base path: `~/Tools`
- Both can be customized via config file
- Environment variable `CCHISTORY_EXPORT_DIR` overrides default export directory

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
- Source: Project root directory (wherever you clone it)
- Config: `~/.config/cchistory/config.json`
- Exports: `[project-root]/exports/` (default, configurable)
- Claude data: `~/.claude/projects/`

## Development Notes

### TypeScript
This project is written in TypeScript for type safety and better IDE support. The compiled JavaScript is included in the repository for immediate use.

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
Modify the `convertToMarkdown()` function in src/index.ts to support additional output formats. Remember to rebuild after changes.

### Change Default Configuration
Update `DEFAULT_CONFIG` object in src/index.ts and document in README.md. Run `npm run build` after changes.

### Debug Conversation Loading
Check `loadConversations()` function - add console.log for troubleshooting parsing issues.

### Extend CLI Options
Add new options in the main execution block (bottom of src/index.ts) using process.argv parsing.

### Type Updates
When adding new data structures, update src/types.ts with proper TypeScript interfaces.
