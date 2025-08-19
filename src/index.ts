#!/usr/bin/env node

import { CLI } from './lib/CLI.js';

// メイン実行
(async () => {
  const cli = new CLI();
  try {
    await cli.run(process.argv.slice(2));
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
})();
