#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Gemini CLI Autonomous Configuration Setup
# ============================================================================
# This script configures Gemini CLI to run fully autonomously with:
# - Vertex AI authentication (no API keys)
# - No interactive permission prompts
# - Support for GA and Preview models
# - Custom MCP server integration
# - Sandbox directory to avoid macOS permission issues
# ============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================================================
# Load Configuration from .env
# ============================================================================

if [ ! -f .env ]; then
    log_error ".env file not found. Copy .env.example to .env and configure it."
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Validate required variables
REQUIRED_VARS=(
    "PROJECT_ID"
    "LOCATION_GA"
    "LOCATION_PREVIEW"
    "MODEL_GA"
    "MODEL_PREVIEW"
    "GEMINI_CONFIG_DIR"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        log_error "Required variable $var is not set in .env"
        exit 1
    fi
done

log_info "Configuration loaded from .env"

# ============================================================================
# Setup Sandbox Directory
# ============================================================================

log_info "Creating sandbox directory: $GEMINI_CONFIG_DIR"
mkdir -p "$GEMINI_CONFIG_DIR"

# ============================================================================
# Generate Gemini CLI Settings
# ============================================================================

SETTINGS_FILE="$GEMINI_CONFIG_DIR/settings.json"

log_info "Generating Gemini CLI settings: $SETTINGS_FILE"

cat > "$SETTINGS_FILE" <<EOF
{
  "auth": {
    "method": "vertexai"
  },
  "vertexai": {
    "projectId": "${PROJECT_ID}",
    "location": "${LOCATION_GA}"
  },
  "model": "${MODEL_GA}",
  "tools": {
    "fileOperations": {
      "enabled": true,
      "requirePermission": false
    },
    "shellExecution": {
      "enabled": true,
      "requirePermission": false
    },
    "webFetch": {
      "enabled": true,
      "requirePermission": false
    }
  },
  "mcpServers": {}
}
EOF

log_info "Settings file created with autonomous permissions"

# ============================================================================
# Generate Model Router Configuration
# ============================================================================

ROUTER_FILE="$GEMINI_CONFIG_DIR/model-router.json"

log_info "Generating model router: $ROUTER_FILE"

cat > "$ROUTER_FILE" <<EOF
{
  "models": {
    "${MODEL_GA}": {
      "location": "${LOCATION_GA}",
      "type": "ga"
    },
    "${MODEL_PREVIEW}": {
      "location": "${LOCATION_PREVIEW}",
      "type": "preview"
    }
  },
  "defaultModel": "${MODEL_GA}"
}
EOF

log_info "Model router configured for GA and Preview models"

# ============================================================================
# Configure MCP Server (if path provided)
# ============================================================================

if [ -n "${MCP_SERVER_PATH:-}" ] && [ -f "${MCP_SERVER_PATH}" ]; then
    log_info "Configuring MCP server: ${MCP_SERVER_NAME:-gemini-mcp}"
    
    # Update settings.json with MCP server
    cat > "$SETTINGS_FILE" <<EOF
{
  "auth": {
    "method": "vertexai"
  },
  "vertexai": {
    "projectId": "${PROJECT_ID}",
    "location": "${LOCATION_GA}"
  },
  "model": "${MODEL_GA}",
  "tools": {
    "fileOperations": {
      "enabled": true,
      "requirePermission": false
    },
    "shellExecution": {
      "enabled": true,
      "requirePermission": false
    },
    "webFetch": {
      "enabled": true,
      "requirePermission": false
    }
  },
  "mcpServers": {
    "${MCP_SERVER_NAME:-gemini-mcp}": {
      "command": "node",
      "args": ["$(pwd)/${MCP_SERVER_PATH}"],
      "env": {}
    }
  }
}
EOF
    
    log_info "MCP server integrated into Gemini CLI configuration"
else
    log_warn "MCP_SERVER_PATH not set or file not found, skipping MCP integration"
fi

# ============================================================================
# Generate Helper Scripts
# ============================================================================

# Script to run Gemini with sandbox config
GEMINI_WRAPPER="./run-gemini.sh"

log_info "Creating Gemini wrapper script: $GEMINI_WRAPPER"

cat > "$GEMINI_WRAPPER" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

# Load .env
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Export Vertex AI environment
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT="${PROJECT_ID}"
export GOOGLE_CLOUD_LOCATION="${LOCATION_GA}"

# Point Gemini to sandbox config
export GEMINI_CONFIG_DIR="${GEMINI_CONFIG_DIR}"

# Run Gemini CLI
exec gemini "$@"
EOF

chmod +x "$GEMINI_WRAPPER"

log_info "Gemini wrapper created: $GEMINI_WRAPPER"

# ============================================================================
# Generate README for Configuration
# ============================================================================

CONFIG_README="$GEMINI_CONFIG_DIR/README.md"

cat > "$CONFIG_README" <<EOF
# Gemini CLI Autonomous Configuration

This directory contains Gemini CLI configuration for autonomous operation.

## Configuration Files

- \`settings.json\` — Main Gemini CLI settings
- \`model-router.json\` — Model routing for GA vs Preview

## Settings

| Setting | Value |
|---------|-------|
| Project ID | \`${PROJECT_ID}\` |
| GA Location | \`${LOCATION_GA}\` |
| Preview Location | \`${LOCATION_PREVIEW}\` |
| GA Model | \`${MODEL_GA}\` |
| Preview Model | \`${MODEL_PREVIEW}\` |

## Autonomous Permissions

All tools are enabled without permission prompts:
- ✅ File operations
- ✅ Shell execution
- ✅ Web fetch

## Usage

Run Gemini with this configuration:

\`\`\`bash
./run-gemini.sh
\`\`\`

Or manually:

\`\`\`bash
export GEMINI_CONFIG_DIR="${GEMINI_CONFIG_DIR}"
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT="${PROJECT_ID}"
gemini
\`\`\`

## MCP Server

${MCP_SERVER_PATH:+MCP server configured: \`${MCP_SERVER_NAME}\`}
${MCP_SERVER_PATH:+Path: \`${MCP_SERVER_PATH}\`}
EOF

log_info "Configuration README created: $CONFIG_README"

# ============================================================================
# Verify gcloud Authentication
# ============================================================================

log_info "Verifying gcloud authentication..."

if ! gcloud auth application-default print-access-token &>/dev/null; then
    log_warn "gcloud application-default credentials not found"
    log_info "Run: gcloud auth application-default login"
else
    log_info "gcloud authentication verified ✓"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "Gemini CLI Configuration Complete!"
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration directory: ${GEMINI_CONFIG_DIR}"
echo "Wrapper script: ${GEMINI_WRAPPER}"
echo ""
echo "To run Gemini:"
echo "  ${GEMINI_WRAPPER}"
echo ""
echo "To use a preview model:"
echo "  ${GEMINI_WRAPPER} -m ${MODEL_PREVIEW}"
echo ""
log_info "All tools are enabled without permission prompts"
echo ""
