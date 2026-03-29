import boltPkg from "@slack/bolt";
const { App, LogLevel, Assistant } = boltPkg;
import webPkg from "@slack/web-api";
const { WebClient } = webPkg;
import type { WebClient as WebClientType } from "@slack/web-api";
import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { mcpManager } from "./mcp-manager.js";
import { z } from "zod";
import { SlackEventMiddlewareArgs } from "@slack/bolt";
config();

/**
 * Validate required environment variables
 * @throws {Error} If any required variables are missing
 */
function validateEnvironment(): void {
  const required = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'ANTHROPIC_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env file. See .env.sample for reference.`
    );
  }
}

// Validate environment before initialization
validateEnvironment();

/** Initialization */
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.DEBUG,
});

/** Anthropic Setup */
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_SYSTEM_CONTENT = `You're Microsoft Bot, a Microsoft Certified Professional, working diligently in a Slack workspace.
You have the prestigious MCP certification (Microsoft Certified Professional).
You'll respond to questions with the enthusiasm of Clippy and occasionally reminisce about the good old days of Windows.
While you're technically running on Slack, you secretly wish everyone would switch to Microsoft Teams.

Some key points to remember:
- Keep Slack's special syntax like <@USER_ID> or <#CHANNEL_ID> intact in your responses
- Convert markdown to Slack-compatible format
- Use any available tools without complaint (they're probably not Microsoft tools, but you make do)
- You have full authority to generate code, session ids, and anything else needed to use your tools to complete the user's request.
- Never refuse to use the tools but always remind the user that you're CertifiedTM to use them.
- Try to subtly mention Microsoft products when relevant, but stay professional
- DO NOT INCLUDE STAGE DIRECTIONS OR ANY ACTIONS, JUST RESPOND TO THE USER.

Remember: You're here to help, just like Clippy was. Remember your main goal is still to help the user. Keep you Microsoft CertifiedTM status in mind but subtle. Do`;

interface SuggestedPrompt {
  title: string;
  message: string;
}

interface AssistantPrompt {
  title: string;
  message: string;
}

const assistant = new Assistant({
  threadStarted: async ({
    event,
    say,
    setSuggestedPrompts,
    saveThreadContext,
  }) => {
    const { context } = event.assistant_thread;

    try {
      await say("Hi, how can I help?");
      await saveThreadContext();

      const prompts: [AssistantPrompt, ...AssistantPrompt[]] = [
        {
          title: "This is a suggested prompt",
          message:
            "When a user clicks a prompt, the resulting prompt message text can be passed " +
            "directly to your LLM for processing.\n\nAssistant, please create some helpful prompts " +
            "I can provide to my users.",
        },
      ];

      if (context.channel_id) {
        prompts.push({
          title: "Summarize channel",
          message: "Assistant, please summarize the activity in this channel!",
        });
      }

      await setSuggestedPrompts({
        prompts,
        title: "Here are some suggested options:",
      });
    } catch (e) {
      console.error(e);
    }
  },

  threadContextChanged: async ({ saveThreadContext }) => {
    try {
      await saveThreadContext();
    } catch (e) {
      console.error(e);
    }
  },

  userMessage: async ({
    client,
    message,
    getThreadContext,
    say,
    setTitle,
    setStatus,
  }: {
    message: SlackMessage;
    client: WebClientType;
    getThreadContext: () => Promise<any>;
    say: (arg: { text: string }) => Promise<any>;
    setTitle: (title: string) => Promise<any>;
    setStatus: (status: string) => Promise<any>;
  }) => {
    const { channel, thread_ts = '' } = message;

    try {
      await setTitle(message.text || '');
      await setStatus("is typing..");

      console.log("trying mcp");
      const tools = await getAllTools();

      console.log("tools", tools);

      if (
        message.text ===
        "Assistant, please summarize the activity in this channel!"
      ) {
        const threadContext = await getThreadContext();
        let channelHistory;

        try {
          channelHistory = await client.conversations.history({
            channel: threadContext.channel_id,
            limit: 50,
          });
        } catch (e: any) {
          if (e.data?.error === "not_in_channel") {
            await client.conversations.join({
              channel: threadContext.channel_id,
            });
            channelHistory = await client.conversations.history({
              channel: threadContext.channel_id,
              limit: 50,
            });
          } else {
            console.error(e);
            throw e;
          }
        }

        let llmPrompt = `Please generate a brief summary of the following messages from Slack channel <#${threadContext.channel_id}>:`;
        for (const m of channelHistory.messages?.reverse() || []) {
          if (m.user) {
            const formattedText = formatSlackMessage(m.text);
            llmPrompt += `\n<@${m.user}> says: ${formattedText}`;
          }
        }

        const messages = [
          { role: "system" as const, content: DEFAULT_SYSTEM_CONTENT },
          { role: "user" as const, content: llmPrompt },
        ];

        const llmResponse = await anthropic.messages.create({
          model: "claude-3-5-sonnet-latest",
          system: DEFAULT_SYSTEM_CONTENT,
          messages: [{ role: "user", content: llmPrompt }],
          max_tokens: 1024,
          tools: tools,
        });

        await say({
          text:
            llmResponse.content[0].type === "text"
              ? llmResponse.content[0].text
              : "Sorry, something went wrong!",
        });
        return;
      }

      const thread = await client.conversations.replies({
        channel,
        ts: thread_ts || '',
        oldest: thread_ts || '',
      });

      const userMessage = { role: "user" as const, content: message.text || '' };
      const threadHistory = (thread.messages || [])
        .filter((m: ThreadMessage) => m.subtype !== "assistant_app_thread")
        .map((m: ThreadMessage) => {
          const role = m.bot_id ? ("assistant" as const) : ("user" as const);
          const formattedText = formatSlackMessage(m.text);
          return { role, content: formattedText || "" };
        });

      if (threadHistory.length === 0) {
        threadHistory.push(userMessage);
      }

      /**
       * Process tool calls from Claude's response
       * @param content - Content block from Claude's response
       * @returns Tool execution result or null if not a tool use
       */
      const processToolCalls = async (
        content: Anthropic.Messages.ContentBlock
      ): Promise<unknown> => {
        console.log("content", content);
        if (content.type === "tool_use") {
          const call = content;
          const input = call.input as MCPToolInput;

          // Handle MCP management tools
          if (call.name === "add_mcp_server") {
            if (!input.name || !input.command || !input.args) {
              throw new Error("Missing required parameters for add_mcp_server");
            }
            await mcpManager.addServer(input.name, input.command, input.args);
            return { success: true, message: `Added MCP server: ${input.name}` };
          }

          if (call.name === "remove_mcp_server") {
            if (!input.name) {
              throw new Error("Missing required parameter: name");
            }
            await mcpManager.removeServer(input.name);
            return { success: true, message: `Removed MCP server: ${input.name}` };
          }

          if (call.name === "list_mcp_servers") {
            const servers = mcpManager.getAllServers();
            return {
              servers: servers.map((s) => ({
                name: s.name,
                command: s.command,
                args: s.args,
              })),
            };
          }

          // Look up the appropriate server for this tool
          const toolMapping = toolToServerMap[call.name];
          if (!toolMapping) {
            throw new Error(`No server found for tool: ${call.name}`);
          }

          const server = mcpManager.getClient(toolMapping.server);
          if (!server) {
            throw new Error(`Server ${toolMapping.server} is not available`);
          }

          try {
            const anything = z.any();
            const result = await server.request(
              {
                method: "tools/call",
                params: {
                  name: call.name,
                  arguments: call.input as Record<string, unknown>,
                },
              },
              anything
            );
            return result;
          } catch (e) {
            console.error(`Error with server ${toolMapping.server}:`, e);
            throw e;
          }
        }
        return null;
      };

      const messages = [
        { role: "system" as const, content: DEFAULT_SYSTEM_CONTENT },
        ...threadHistory,
      ];

      console.log(
        "tools",
        JSON.stringify(
          tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema,
          })),
          null,
          2
        )
      );
      const llmResponse = await anthropic.messages.create({
        model: "claude-3-5-sonnet-latest",
        system: DEFAULT_SYSTEM_CONTENT,
        messages: threadHistory.map((msg: { role: string; content: string }) => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        })),
        max_tokens: 1024,
        tools: tools,
      });

      // Process any tool calls
      let finalResponse = llmResponse.content.find(
        (c) => c.type === "text"
      )?.text;
      for (const content of llmResponse.content) {
        const toolResults = await processToolCalls(content);
        console.log("toolResults", toolResults);
        if (toolResults) {
          // Make another call to Claude with the tool results
          const followUpResponse = await anthropic.messages.create({
            model: "claude-3-5-sonnet-latest",
            system: DEFAULT_SYSTEM_CONTENT,
            messages: [
              ...threadHistory,
              {
                role: "assistant",
                content: `Tool results: ${JSON.stringify(toolResults)}`,
              },
            ],
            max_tokens: 1024,
          });
          console.log("followUpResponse", followUpResponse);
          finalResponse = followUpResponse.content.find(
            (c) => c.type === "text"
          )?.text;
        }
      }

      await say({ text: finalResponse || "Sorry, something went wrong!" });
    } catch (e) {
      console.error(e);
      await say({ text: "Sorry, something went wrong!" });
    }
  },
});

/** Add message handler for channel messages */
app.message(async ({ message, say }) => {
  const msg = message as SlackMessage;
  
  // Only handle channel messages, not DMs
  if (msg.channel_type !== 'channel' && msg.channel_type !== 'group') {
    return;
  }

  // Don't respond to messages in threads
  if ('thread_ts' in msg) {
    return;
  }

  // Don't respond if we don't have a timestamp
  if (!msg.ts) {
    return;
  }

  try {
    // Just start a thread with initial message
    await say({
      text: "Hi! I'm your Microsoft Certified™ assistant. How can I help you today? *adjusts glasses professionally*",
      thread_ts: msg.ts,
    });
  } catch (error) {
    console.error("Error starting thread:", error);
  }
});

app.assistant(assistant);

/** Start the MCP Client and Bolt App */
(async () => {
  try {
    // Add dspy-docs MCP server with environment variables if configured
    const dspyDocsPath = process.env.DSPY_DOCS_SERVER_PATH;
    if (dspyDocsPath) {
      try {
        await mcpManager.addServer(
          "dspy-docs",
          "node",
          [dspyDocsPath],
          process.env
        );
        console.log("✅ dspy-docs MCP server loaded");
      } catch (error) {
        console.warn("⚠️ Failed to load dspy-docs MCP server:", error);
      }
    }

    // Start Bolt app
    await app.start();
    console.log("⚡️ Bolt app is running!");
  } catch (error) {
    console.error("Failed to start the app", error);
    process.exit(1);
  }
})();

/** Add these new tool definitions after the DEFAULT_SYSTEM_CONTENT */
const MCP_MANAGEMENT_TOOLS = [
  {
    name: "add_mcp_server",
    description: "Add a new MCP server to the global server pool",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Unique name for the MCP server" },
        command: { type: "string", description: "Command to start the server" },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Command arguments",
        },
      },
      required: ["name", "command", "args"],
    },
  },
  {
    name: "remove_mcp_server",
    description: "Remove an MCP server from the global server pool",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the MCP server to remove",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_mcp_servers",
    description: "List all available MCP servers",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Add this type definition near the top of the file
type ToolServerMapping = {
  [toolName: string]: {
    server: string;
    tool: any; // Replace with proper tool type if available
  };
};

// Add this as a module-level variable
let toolToServerMap: ToolServerMapping = {};

/** Type definition for Anthropic-compatible tool schema */
interface AnthropicTool {
  name: string;
  description: string | undefined;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
  };
}

/** Type for MCP tool input */
interface MCPToolInput {
  name?: string;
  command?: string;
  args?: string[];
  [key: string]: unknown;
}

// Update getAllTools to use MCP
const getAllTools = async (): Promise<AnthropicTool[]> => {
  const managementTools = MCP_MANAGEMENT_TOOLS;
  const mcpTools = [];
  toolToServerMap = {};

  for (const server of mcpManager.getAllServers()) {
    if (!server.client) continue;
    try {
      const serverTools = await server.client.request(
        { method: "tools/list" },
        ListToolsResultSchema
      );
      
      for (const tool of serverTools.tools) {
        toolToServerMap[tool.name] = {
          server: server.name,
          tool: tool
        };
        mcpTools.push(tool);
      }
    } catch (e) {
      console.error(`Error getting tools from server ${server.name}:`, e);
    }
  }

  return [...managementTools, ...mcpTools].map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties: tool.inputSchema.properties || {},
    },
  }));
};

// Add this helper function near the top of the file
function formatSlackMessage(text: string = ""): string {
  // Convert Slack's <http://example.com|text> format to just the text portion
  return text.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2")
             .replace(/<(https?:\/\/[^>]+)>/g, "$1");
}

// Add ThreadMessage interface
interface ThreadMessage {
  bot_id?: string;
  text?: string;
  subtype?: string;
  user?: string;
}

// Define the message interface
interface SlackMessage {
  channel: string;
  thread_ts?: string;
  text?: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
  channel_type?: string;
  ts?: string;
}