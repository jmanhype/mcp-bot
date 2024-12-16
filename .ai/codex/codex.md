# AI Codex

## Usage

- Review: @codex.md (silent load, no output)
- Update: @learn.md
- File paths: Always use absolute paths from project root

## Errors

E000:

- Context: [Relevant project area or file]
- Error: [Precise description]
- Correction: [Exact fix]
- Prevention: [Specific strategy]
- Related: [IDs of related errors/learnings]

E001:

- Context: File path suggestions
- Error: Relative path used instead of absolute
- Correction: Use absolute paths from project root
- Prevention: Always prefix paths with '/'
- Related: None

E002:

- Context: '/src/index.ts'
- Error: Suggested CommonJS import syntax
- Correction: Use ES module import syntax
- Prevention: Verify `"type": "module"` in '/package.json' or '.mjs' extension
- Related: L002

## Learnings

L007:

- Context: /apps/www/src/pro/components/user-dropdown.tsx
- Insight: UserDropdown component uses useLogout hook and handles loading state
- Application: Implement logout functionality with loading indicator in user-related components
- Impact: Improved user experience with visual feedback during logout process
- Related: L008, L005

L008:

- Context: /apps/www/src/pro/components/user-dropdown.tsx
- Insight: Component uses 'use client' directive for client-side rendering
- Application: Use 'use client' directive for components that require client-side interactivity
- Impact: Proper integration with Next.js 13+ server components architecture
- Related: L007

L000:

- Context: [Relevant project area or file]
- Insight: [Concise description]
- Application: [How to apply this knowledge]
- Impact: [Potential effects on project]
- Related: [IDs of related errors/learnings]

L001:

- Context: @codex.md usage
- Insight: @codex.md is for context, not for direct modification
- Application: Use @codex.md for silent loading and context only; execute subsequent commands separately
- Impact: Improved accuracy in responding to user intentions
- Related: None

L002:

- Context: Project architecture
- Insight: Repository pattern for data access
- Application: '/src' is root, '/src/auth' for authentication, '/src/database' for data access
- Impact: Organized code structure, separation of concerns
- Related: None

L009:

- Context: Project Dependencies and Structure
- Insight: Project is a Slack bot application using Bolt.js with AI integration
- Application: Uses @slack/bolt, @anthropic-ai/sdk, and openai for AI-powered Slack interactions
- Impact: Enables building sophisticated Slack assistants with multiple AI provider options
- Related: L010, L011

L010:

- Context: /src/app.ts and /src/mcp-manager.ts
- Insight: Project implements Model Context Protocol (MCP) for AI interactions
- Application: Uses @modelcontextprotocol/sdk for standardized AI communication
- Impact: Consistent handling of AI interactions across different providers
- Related: L009

L011:

- Context: Project Configuration
- Insight: Uses TypeScript with strict configuration and Biome for linting
- Application: Modern TypeScript setup with proper type checking and code quality tools
- Impact: Improved code quality and developer experience
- Related: L009

L012:

- Context: /src/app.ts Bot Personality
- Insight: Bot implements a Microsoft-themed personality with MCP certification
- Application: Uses DEFAULT_SYSTEM_CONTENT to maintain consistent Microsoft-themed responses while using non-Microsoft tools
- Impact: Creates engaging user experience with consistent brand personality
- Related: L009, L013

L013:

- Context: /src/app.ts Message Processing
- Insight: Implements sophisticated message handling with thread context and channel history
- Application: Uses Slack's conversations API for thread management and history retrieval
- Impact: Enables contextual conversations and channel summarization capabilities
- Related: L012, L014

L014:

- Context: /src/mcp-manager.ts Architecture
- Insight: Implements a server manager pattern for Model Context Protocol
- Application: Manages multiple MCP servers with dynamic addition/removal capabilities
- Impact: Enables flexible integration of different AI models and tools
- Related: L010, L013

L015:

- Context: Project Code Style
- Insight: Uses Biome with specific formatting rules and organization
- Application: Enforces consistent code style with 2-space indentation and 100-char line width
- Impact: Maintains code quality and readability across the project
- Related: L011

E003:

- Context: /src/mcp-manager.ts
- Error: Missing proper cleanup in removeServer method
- Correction: Should implement proper client disconnect logic
- Prevention: Always implement cleanup methods for resource management
- Related: L014

L016:

- Context: /tsconfig.json Configuration
- Insight: Uses modern TypeScript configuration with strict mode and ES2020 target
- Application: Enables latest ECMAScript features while maintaining type safety
- Impact: Better development experience with modern JavaScript features and strong typing
- Related: L011, L015

L017:

- Context: /manifest.json Slack Configuration
- Insight: Implements Slack Assistant features with specific bot permissions
- Application: Uses socket mode with specific scopes for channel access and message handling
- Impact: Secure bot implementation with precise permission boundaries
- Related: L013, L009

E004:

- Context: /manifest.json
- Error: Interactivity is disabled which may limit some bot features
- Correction: Enable interactivity if interactive components are needed
- Prevention: Review required bot features and enable necessary settings upfront
- Related: L017

L018:

- Context: MCP/dspy-docs-server Integration
- Insight: Implements a DSPy documentation server using MCP protocol
- Application: Provides DSPy documentation access through get_dspy_docs tool
- Impact: Enables real-time access to DSPy documentation, examples, and API references
- Related: L010, L014

# Slack Bot Setup Guide

## Environment Setup

1. Required environment variables in `.env`:
```
SLACK_APP_TOKEN=xapp-...
SLACK_BOT_TOKEN=xoxb-...
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp-...  # Required for DSPy docs server
```

## TypeScript Configuration

The key to getting ESM modules working with TypeScript is proper configuration in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "Node16",
    "moduleResolution": "node16",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "baseUrl": ".",
    "paths": {
      "@modelcontextprotocol/sdk/*": ["node_modules/@modelcontextprotocol/sdk/dist/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Package.json Configuration

Essential settings in `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "npm run build && node dist/app.js"
  }
}
```

## Importing CommonJS Modules in ESM

When using CommonJS modules in an ESM environment, use this pattern:

```typescript
// Instead of:
// import { App, LogLevel, Assistant } from "@slack/bolt";

// Use:
import boltPkg from "@slack/bolt";
const { App, LogLevel, Assistant } = boltPkg;

// For type imports:
import type { WebClient as WebClientType } from "@slack/web-api";
```

## MCP SDK Integration

When using the Model Context Protocol SDK:

1. Import paths must include `.js` extension:
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
```

2. Server configuration with environment variables:
```typescript
const stringEnv: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) {
    stringEnv[key] = value;
  }
}

const transport = new StdioClientTransport({ 
  command, 
  args,
  env: stringEnv,
});
await client.connect(transport);
```

## Type Definitions

Essential interfaces for Slack message handling:

```typescript
interface ThreadMessage {
  bot_id?: string;
  text?: string;
  subtype?: string;
  user?: string;
}

interface SlackMessage {
  channel: string;
  thread_ts?: string;
  text?: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
}
```

## Running the Bot

1. Install dependencies:
```bash
npm install
```

2. Build and start:
```bash
npm start
```

The bot will connect to Slack using Socket Mode and be ready to handle messages.

## Common Issues and Solutions

1. **Module Resolution Errors**: Make sure `"type": "module"` is set in package.json and use proper import paths with `.js` extensions.

2. **Type Errors with CommonJS Modules**: Use the import pattern shown above for CommonJS modules.

3. **MCP SDK Import Issues**: Use the paths mapping in tsconfig.json to correctly resolve MCP SDK imports.

4. **Socket Mode Connection**: Ensure both `SLACK_APP_TOKEN` and `SLACK_BOT_TOKEN` are properly set and the app has necessary scopes.

## Required Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.1",
    "@modelcontextprotocol/sdk": "^1.0.3",
    "@slack/bolt": "^4.1.1",
    "dotenv": "~16.4.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.5",
    "typescript": "^5.3.3"
  }
}
```
