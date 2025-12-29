<p align="center">
  <img src="https://img.shields.io/badge/MCP-Protocol-7c3aed?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQxIDAtOC0zLjU5LTgtOHMzLjU5LTggOC04IDggMy41OSA4IDgtMy41OSA4LTggOHoiLz48L3N2Zz4=" alt="MCP Protocol">
  <img src="https://img.shields.io/badge/Google-Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 20+">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

<h1 align="center">
  <br>
  ✦ gemini-cli-mcp
  <br>
</h1>

<h4 align="center">
  Bridge Google's Gemini CLI to any MCP-compatible AI assistant
</h4>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-tools">Tools</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-how-it-works">How It Works</a>
</p>

<br>

<div align="center">

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Claude / Cursor / Any MCP Client                              │
│                    │                                            │
│                    ▼                                            │
│   ┌─────────────────────────────────────┐                       │
│   │        gemini-cli-mcp               │                       │
│   │   ┌─────────┐ ┌─────────┐ ┌───────┐ │                       │
│   │   │ prompt  │ │ models  │ │  raw  │ │   ◄── MCP Tools       │
│   │   └────┬────┘ └────┬────┘ └───┬───┘ │                       │
│   └────────┼───────────┼─────────┼──────┘                       │
│            │           │         │                              │
│            └───────────┼─────────┘                              │
│                        ▼                                        │
│            ┌───────────────────────┐                            │
│            │    Gemini CLI         │   ◄── Your existing auth   │
│            │    (gemini binary)    │       & configuration      │
│            └───────────────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

</div>

<br>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔌 Zero Configuration
Uses your existing Gemini CLI installation and authentication. No API keys to manage, no duplicate auth flows.

### 🚀 Universal Access
Register once, use Gemini from Claude, Cursor, Windsurf, or any MCP-compatible client.

</td>
<td width="50%">

### ⚡ Production Ready
Health checks, graceful shutdown, 5-minute timeouts, proper signal handling. Built for reliability.

### 🛠️ Three Powerful Tools
Prompt execution, model listing, and raw CLI access for advanced use cases.

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install Gemini CLI globally
npm install -g @google/gemini-cli

# Authenticate (run once)
gemini
```

### Run the MCP Server

```bash
npx gemini-cli-mcp
```

That's it. The server starts and waits for MCP connections via stdio.

---

## 🔧 Tools

### `gemini_prompt`

Send a prompt to Gemini and get a response.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | ✅ | The prompt to send |
| `model` | string | ❌ | Model override (e.g., `gemini-2.5-flash`) |

### `gemini_models`

List all available Gemini models.

*No parameters required.*

### `gemini_raw`

Execute any Gemini CLI command with raw arguments.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `args` | string[] | ✅ | CLI arguments array |

**Example:** `["--version"]` or `["-p", "Hello", "-m", "gemini-2.5-pro"]`

---

## 📋 Usage

### With Claude Desktop

Add to your Claude configuration (`~/.claude/config.json`):

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["gemini-cli-mcp"]
    }
  }
}
```

### With Claude CLI

```bash
claude mcp add gemini -- npx gemini-cli-mcp
```

### With Cursor / Windsurf

Add to your MCP settings:

```json
{
  "gemini": {
    "command": "npx",
    "args": ["gemini-cli-mcp"]
  }
}
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_CLI_PATH` | Override the Gemini binary location |
| `GEMINI_API_KEY` | Gemini API key (if not using OAuth) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account credentials path |

### Inherited Configuration

The server inherits your full environment, so existing Gemini configuration works automatically:

```
~/.config/gemini/          ← CLI configuration
~/.gemini/settings.json    ← Gemini settings
GEMINI_* env vars          ← All Gemini environment variables
gcloud auth                ← Application default credentials
```

---

## 🔬 How It Works

```
┌──────────────┐     stdio      ┌─────────────────┐     spawn     ┌─────────────┐
│  MCP Client  │ ◄────────────► │  gemini-cli-mcp │ ◄───────────► │ gemini CLI  │
│  (Claude)    │   JSON-RPC     │    (Node.js)    │   child proc  │  (binary)   │
└──────────────┘                └─────────────────┘               └─────────────┘
```

1. **MCP Client** sends JSON-RPC requests over stdio
2. **gemini-cli-mcp** translates MCP tool calls to Gemini CLI commands
3. **Gemini CLI** executes with your existing auth & config
4. Response flows back through the same path

The server is a thin translation layer—all heavy lifting happens in Gemini CLI.

---

## 🏗️ Architecture

```
gemini-cli-mcp/
├── src/
│   └── index.js      # MCP server (single file, ~300 lines)
├── package.json      # npm package with bin entry
└── README.md
```

**Design Principles:**
- Single responsibility: translate MCP ↔ Gemini CLI
- Zero global state
- Fail fast with clear errors
- Minimal dependencies (`@modelcontextprotocol/sdk`, `zod`)

---

## 🐛 Troubleshooting

### "Gemini CLI not found"

```bash
# Ensure gemini is installed and in PATH
which gemini

# Or set the path explicitly
export GEMINI_CLI_PATH=/path/to/gemini
```

### "Auth method not set"

```bash
# Option 1: Run Gemini CLI once to authenticate
gemini

# Option 2: Set API key
export GEMINI_API_KEY=your-api-key
```

### Server not responding

Check stderr output for health check results:
```
[gemini-mcp] Gemini CLI: /usr/local/bin/gemini (0.22.4)
```

---

## 📄 License

MIT © 2024

---

<p align="center">
  <sub>Built with ❤️ for the MCP ecosystem</sub>
</p>
