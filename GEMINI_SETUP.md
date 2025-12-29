# Gemini CLI Autonomous Setup

Automated configuration for running Gemini CLI with Vertex AI authentication and no interactive prompts.

## Quick Start

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your values:**
   ```bash
   PROJECT_ID=your-gcp-project-id
   LOCATION_GA=us-central1
   LOCATION_PREVIEW=global
   MODEL_GA=gemini-2.0-flash-001
   MODEL_PREVIEW=gemini-2.0-flash-exp-001
   ```

3. **Authenticate with gcloud:**
   ```bash
   gcloud auth application-default login
   ```

4. **Run setup:**
   ```bash
   ./setup-gemini.sh
   ```

5. **Use Gemini:**
   ```bash
   ./run-gemini.sh
   ```

## What It Does

- ✅ Configures Vertex AI authentication (no API keys)
- ✅ Disables all permission prompts (autonomous mode)
- ✅ Routes GA models to regional endpoints
- ✅ Routes Preview models to global endpoint
- ✅ Integrates local MCP server
- ✅ Uses sandbox directory to avoid macOS permission issues

## Configuration Files

After running `setup-gemini.sh`:

```
sandbox/.gemini/
├── settings.json         # Main Gemini CLI config
├── model-router.json     # Model routing rules
└── README.md            # Configuration details
```

## Autonomous Permissions

All tools enabled without prompts:
- File operations (read/write/delete)
- Shell command execution
- Web fetching

## Model Selection

**GA Model (regional):**
```bash
./run-gemini.sh -m gemini-2.0-flash-001
```

**Preview Model (global):**
```bash
./run-gemini.sh -m gemini-2.0-flash-exp-001
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PROJECT_ID` | GCP project ID | `my-project-123` |
| `LOCATION_GA` | Region for GA models | `us-central1` |
| `LOCATION_PREVIEW` | Location for preview | `global` |
| `MODEL_GA` | Default GA model | `gemini-2.0-flash-001` |
| `MODEL_PREVIEW` | Preview model | `gemini-2.0-flash-exp-001` |
| `GEMINI_CONFIG_DIR` | Config directory | `./sandbox/.gemini` |
| `MCP_SERVER_PATH` | Local MCP server | `./src/index.js` |

## Troubleshooting

**Authentication error:**
```bash
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

**Permission denied:**
```bash
chmod +x setup-gemini.sh run-gemini.sh
```

**MCP server not found:**
Check `MCP_SERVER_PATH` in `.env` points to valid file.

## Security Notes

- `.env` contains sensitive data (gitignored)
- Uses gcloud application-default credentials
- No API keys stored in config files
- Sandbox directory isolated from system config
