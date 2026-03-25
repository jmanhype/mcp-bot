# mcp-bot

Slack bot that uses Claude 3.5 Sonnet as the LLM backend and dynamically discovers tools from MCP servers. The bot runs in Socket Mode as a Slack Assistant and can manage MCP server connections at runtime.

## What It Does

Listens in Slack threads via the Bolt.js Assistant API. When a user sends a message, the bot:
1. Collects thread history
2. Queries connected MCP servers for available tools
3. Sends the message + tools to Claude 3.5 Sonnet
4. Executes any tool calls against the originating MCP server
5. Returns the final response in-thread

Also supports channel summarization (fetches last 50 messages and passes them to Claude).

The bot has a "Microsoft Certified Professional" persona — it references Clippy and Teams but otherwise works normally.

## Status

| Area | State |
|------|-------|
| Slack transport | Socket Mode (bolt.js ^4.1.1) |
| LLM | Claude 3.5 Sonnet via Anthropic SDK |
| MCP client | `@modelcontextprotocol/sdk` ^1.0.3 |
| Language | TypeScript |
| License | MIT |
| CI | Biome linting via GitHub Actions |

## Architecture

```
src/
  app.ts          — Bolt.js app, Assistant handler, tool dispatch loop
  mcp-manager.ts  — Manages MCP server lifecycle (add/remove/list)
MCP/
  dspy-docs-server/ — Bundled MCP server for DSPy documentation
```

The bot maintains a `toolToServerMap` that tracks which MCP server provides each tool. When Claude returns a `tool_use` block, the bot routes the call to the correct server.

## MCP Server Management

Three built-in tools let you manage servers from within Slack:

| Command | What it does |
|---------|-------------|
| `add_mcp_server` | Registers a new MCP server by name, command, and args |
| `remove_mcp_server` | Disconnects and removes a server |
| `list_mcp_servers` | Returns all registered servers |

Servers communicate over stdio. One server (`dspy-docs`) is added by default on startup.

## Setup

```bash
npm install
npm run build
npm start
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | Yes | `xoxb-` bot token |
| `SLACK_APP_TOKEN` | Yes | `xapp-` app-level token for Socket Mode |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |

### Slack App Configuration

1. Create app at https://api.slack.com/apps
2. Enable Socket Mode
3. Add bot scopes: `chat:write`, `channels:history`, `groups:history`, `assistant:write`
4. Install to workspace
5. Copy tokens to `.env`

## Limitations

- Tool call loop is single-pass: if Claude returns multiple tool calls, each gets a separate follow-up LLM call rather than batching results
- Thread context is rebuilt from Slack API on every message (no local cache)
- The hardcoded `dspy-docs` server path points to a local filesystem path (`/Users/speed/mcp-bot/MCP/...`)
- No retry logic for MCP server connections
- No rate limiting on Anthropic API calls
- Channel summarization is capped at 50 messages

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@slack/bolt` | ^4.1.1 | Slack app framework |
| `@anthropic-ai/sdk` | ^0.32.1 | Claude API client |
| `@modelcontextprotocol/sdk` | ^1.0.3 | MCP client transport |
| `openai` | ^4.74.0 | Listed but unused in current code |
| `typescript` | ^5.3.3 | Build toolchain |

## License

MIT
