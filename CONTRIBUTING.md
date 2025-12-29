# Contributing to gemini-cli-mcp

Thanks for your interest in contributing!

## Development

```bash
# Clone
git clone <repo-url>
cd gemini-cli-mcp

# Install dependencies
npm install

# Link for local testing
npm link

# Run
gemini-cli-mcp
```

## Testing

```bash
# Test MCP protocol compliance
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node src/index.js
```

## Pull Requests

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit PR

## Code Style

- ESM modules
- No external linting (keep it simple)
- stderr for logs, stdout for MCP protocol
