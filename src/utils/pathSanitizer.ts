import path from 'path';
import fs from 'fs';
import { homedir } from 'os';

/**
 * Sanitizes a file path to prevent path traversal attacks
 * @param configPath - The path to sanitize (may start with ~)
 * @param allowedBase - Optional base directory to restrict paths to (defaults to ~/Tools)
 * @returns The sanitized absolute path
 * @throws Error if the path is outside the allowed directory
 */
export function sanitizeOutputPath(configPath: string, allowedBase?: string): string {
  // Expand home directory if path starts with ~
  const expandedPath = configPath.startsWith('~')
    ? path.join(homedir(), configPath.slice(2))
    : configPath;
  
  // Resolve to absolute path
  const resolved = path.resolve(expandedPath);
  
  // Prevent symlink attacks by resolving symlinks to real paths
  let realPath: string;
  try {
    realPath = fs.realpathSync(resolved);
  } catch (error) {
    // If path doesn't exist yet, use the resolved path
    // (it will be created later)
    realPath = resolved;
  }
  
  // Ensure the path is within the allowed base directory
  const baseDir = allowedBase || path.join(homedir(), 'Tools');
  const expandedBase = baseDir.startsWith('~')
    ? path.join(homedir(), baseDir.slice(2))
    : baseDir;
  const resolvedBase = path.resolve(expandedBase);
  
  if (!realPath.startsWith(resolvedBase)) {
    // Don't include the actual path in error message (security)
    throw new Error(`Export directory must be within ${baseDir}/`);
  }
  
  return realPath;
}
