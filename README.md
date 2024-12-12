# Microsoft Bot - AI Assistant with MCP Integration

A Slack AI assistant powered by Claude 3.5 Sonnet that combines Microsoft's enthusiasm with modern AI capabilities. The bot integrates the Model Context Protocol (MCP) to enable dynamic tool usage and extensibility.

## Features

- 🤖 Microsoft-themed AI assistant with Claude 3.5 Sonnet integration
- 🔧 Dynamic tool management through MCP (Model Context Protocol)
- 📊 Channel summarization capabilities
- 💬 Threaded conversations with context awareness
- 🛠️ Extensible tool system with runtime server management

## Prerequisites

- Slack workspace with admin permissions
- Anthropic API key
- Node.js installed
- (Optional) Python with uv installed for Python-based tools

## Environment Variables

Create a `.env` file with the following:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
ANTHROPIC_API_KEY=your-anthropic-key
```

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create and configure your Slack app:
   - Create a new Slack app at https://api.slack.com/apps
   - Add necessary bot scopes (messages, channels, etc.)
   - Install the app to your workspace
   - Copy the bot and app tokens to your `.env` file

## MCP Server Integration

The bot supports dynamic integration with MCP servers. Two example servers are included:

1. Amazon Fresh Server
2. Python Local Server

You can add new MCP servers at runtime using the bot's commands:

```
add_mcp_server [name] [command] [args...]
remove_mcp_server [name]
list_mcp_servers
```

## Running the Bot

```bash
npm start
```

## Features in Detail

### Channel Summarization
Users can request a summary of recent channel activity using the command:
```
Assistant, please summarize the activity in this channel!
```

### Conversation Context
The bot maintains conversation context within threads and can:
- Process message history
- Handle tool calls dynamically
- Maintain consistent Microsoft-themed personality
- Format messages appropriately for Slack

### Tool Integration
- Dynamic tool discovery from MCP servers
- Runtime server management
- Tool call processing with result handling
- Automatic server reconnection

## Development

### Project Structure
- `src/app.ts`: Main application logic
- `src/mcp-manager.ts`: MCP server management
- Tool servers: Separate processes that provide additional functionality

### Adding New Tools
1. Create a new MCP-compatible server
2. Add the server using the bot's `add_mcp_server` command
3. Tools will be automatically discovered and made available

## License

[Add your license information here]