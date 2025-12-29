#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Configuration
const EXECUTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50MB

// Track running processes for cleanup
const runningProcesses = new Map();
let processIdCounter = 0;

/**
 * Log to stderr only (MCP uses stdout for protocol messages)
 */
function log(message) {
  process.stderr.write(`[gemini-mcp] ${message}\n`);
}

/**
 * Discover the Gemini CLI binary path.
 */
async function discoverGeminiCli() {
  // Check for explicit override
  if (process.env.GEMINI_CLI_PATH) {
    return process.env.GEMINI_CLI_PATH;
  }

  // Try to find 'gemini' in PATH
  try {
    const { stdout } = await execFileAsync('which', ['gemini'], { timeout: 5000 });
    const path = stdout.trim();
    if (path) return path;
  } catch {
    // 'which' failed
  }

  // Try common installation paths
  const commonPaths = [
    '/usr/local/bin/gemini',
    '/opt/homebrew/bin/gemini',
    `${process.env.HOME}/.local/bin/gemini`,
    `${process.env.HOME}/.npm-global/bin/gemini`,
    `${process.env.HOME}/.nvm/versions/node/v20.19.6/bin/gemini`,
  ];

  for (const p of commonPaths) {
    try {
      await execFileAsync(p, ['--version'], { timeout: 5000 });
      return p;
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Health check - verify Gemini CLI works
 */
async function healthCheck(geminiPath) {
  try {
    const { stdout } = await execFileAsync(geminiPath, ['--version'], {
      timeout: 10000,
      env: process.env,
    });
    return { ok: true, version: stdout.trim() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Execute Gemini prompt with streaming
 */
function executeGeminiPrompt(geminiPath, prompt, model) {
  return new Promise((resolve) => {
    const args = ['-p', prompt];
    if (model) args.push('-m', model);

    const proc = spawn(geminiPath, args, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const id = ++processIdCounter;
    runningProcesses.set(id, proc);

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Timeout handler
    const timeout = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, EXECUTION_TIMEOUT_MS);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      runningProcesses.delete(id);

      if (killed) {
        resolve({ success: false, error: 'Execution timeout (5 minutes)', stderr });
      } else if (code === 0) {
        resolve({ success: true, text: stdout, stderr: stderr || null });
      } else {
        resolve({ success: false, error: `Exit code ${code}`, stderr, code });
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timeout);
      runningProcesses.delete(id);
      resolve({ success: false, error: error.message, stderr });
    });
  });
}

/**
 * List available Gemini models
 */
async function executeGeminiModels(geminiPath) {
  try {
    const { stdout, stderr } = await execFileAsync(geminiPath, ['models', 'list'], {
      env: process.env,
      timeout: 30000,
      maxBuffer: MAX_BUFFER_SIZE,
    });

    // Parse model list - each line is typically a model name
    const lines = stdout.trim().split('\n').filter(Boolean);
    const models = lines.map((line) => {
      // Try to parse structured output if available
      const trimmed = line.trim();
      return { name: trimmed };
    });

    return { success: true, models, raw: stdout };
  } catch (error) {
    return { success: false, error: error.message, stderr: error.stderr };
  }
}

/**
 * Execute raw Gemini CLI command
 */
function executeGeminiRaw(geminiPath, args) {
  return new Promise((resolve) => {
    // Basic safety: no shell injection possible since we use spawn with array args
    const proc = spawn(geminiPath, args, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const id = ++processIdCounter;
    runningProcesses.set(id, proc);

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, EXECUTION_TIMEOUT_MS);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      runningProcesses.delete(id);

      if (killed) {
        resolve({ success: false, error: 'Execution timeout', stdout, stderr, code: null });
      } else {
        resolve({ success: code === 0, stdout, stderr, code });
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timeout);
      runningProcesses.delete(id);
      resolve({ success: false, error: error.message, stdout, stderr, code: null });
    });
  });
}

/**
 * Kill all running processes
 */
function killAllProcesses() {
  for (const [id, proc] of runningProcesses) {
    try {
      proc.kill('SIGTERM');
    } catch {
      // Process may already be dead
    }
    runningProcesses.delete(id);
  }
}

/**
 * Tool definitions
 */
const TOOLS = [
  {
    name: 'gemini_prompt',
    description: 'Send a prompt to Google Gemini CLI. Uses the locally installed and authenticated Gemini CLI.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to Gemini',
        },
        model: {
          type: 'string',
          description: 'Optional model to use (e.g., "gemini-2.5-flash"). Uses CLI default if not specified.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'gemini_models',
    description: 'List available Gemini models via the CLI.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'gemini_raw',
    description: 'Execute raw Gemini CLI command with arbitrary arguments. Use with caution.',
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of CLI arguments to pass to gemini command',
        },
      },
      required: ['args'],
    },
  },
];

/**
 * Main server entry point
 */
async function main() {
  // Discover Gemini CLI
  const geminiPath = await discoverGeminiCli();

  if (!geminiPath) {
    log('FATAL: Gemini CLI not found.');
    log('Install: npm install -g @google/gemini-cli');
    log('Or set GEMINI_CLI_PATH=/path/to/gemini');
    process.exit(1);
  }

  // Health check
  const health = await healthCheck(geminiPath);
  if (!health.ok) {
    log(`FATAL: Gemini CLI health check failed: ${health.error}`);
    process.exit(1);
  }

  log(`Gemini CLI: ${geminiPath} (${health.version})`);

  // Create MCP server
  const server = new Server(
    { name: 'gemini-cli-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // Handle tools/list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tools/call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'gemini_prompt': {
          const prompt = args?.prompt;
          const model = args?.model;

          if (!prompt || typeof prompt !== 'string') {
            return {
              content: [{ type: 'text', text: 'Error: prompt is required and must be a string' }],
              isError: true,
            };
          }

          const result = await executeGeminiPrompt(geminiPath, prompt, model);

          if (result.success) {
            return {
              content: [{ type: 'text', text: result.text }],
              isError: false,
            };
          }

          return {
            content: [{ type: 'text', text: `Error: ${result.error}\n${result.stderr || ''}` }],
            isError: true,
          };
        }

        case 'gemini_models': {
          const result = await executeGeminiModels(geminiPath);

          if (result.success) {
            return {
              content: [{ type: 'text', text: result.raw }],
              isError: false,
            };
          }

          return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        case 'gemini_raw': {
          const rawArgs = args?.args;

          if (!Array.isArray(rawArgs)) {
            return {
              content: [{ type: 'text', text: 'Error: args must be an array of strings' }],
              isError: true,
            };
          }

          const result = await executeGeminiRaw(geminiPath, rawArgs);

          const output = [
            result.stdout ? `stdout:\n${result.stdout}` : '',
            result.stderr ? `stderr:\n${result.stderr}` : '',
            result.code !== null ? `exit code: ${result.code}` : '',
          ].filter(Boolean).join('\n\n');

          return {
            content: [{ type: 'text', text: output || '(no output)' }],
            isError: !result.success,
          };
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Unexpected error: ${error.message}` }],
        isError: true,
      };
    }
  });

  // Signal handling for graceful shutdown
  const shutdown = () => {
    log('Shutting down...');
    killAllProcesses();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});
