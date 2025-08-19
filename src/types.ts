// Type definitions for CC History CLI

export interface Config {
  exportDir: string;
  dateFormat: string;
  maxPreviewLength: number;
  maxResultLength: number;
  allowedBasePath?: string; // Optional base path for restricting exports
}

export interface Conversation {
  id: string;
  project: string;
  filePath: string;
  timestamp: string;
  startTime: string;
  messageCount: number;
  preview: string;
  sessionId: string;
}

export interface MessageContent {
  type: string;
  text?: string;
  content?: string | MessageContent[];
  // Additional properties for tool use and other message content types
  id?: string;
  name?: string;
  input?: unknown;
  result?: unknown;
  error?: string | boolean;
}

export interface ContentPart {
  type: string;
  content?: string | Record<string, unknown>;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface Message {
  type: 'user' | 'assistant' | 'system';
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  version?: string;
  message?: {
    content?: string | MessageContent[];
  };
  content?: ContentPart[];
  thinking?: string;
  // Additional message properties
  id?: string;
  role?: string;
  error?: string | boolean;
  result?: unknown;
}

export interface SessionMetadata {
  sessionId: string;
  timestamp: string;
  cwd: string;
  version: string;
}
