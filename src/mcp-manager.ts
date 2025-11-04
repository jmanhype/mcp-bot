import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  client?: Client;
}

class MCPServerManager {
  private servers: Map<string, MCPServer> = new Map();
  
  /**
   * Add and connect to a new MCP server
   * @param name - Unique identifier for the server
   * @param command - Command to execute (e.g., 'node', 'python')
   * @param args - Command arguments (e.g., path to script)
   * @param env - Environment variables to pass to the server
   * @throws {Error} If server name already exists or connection fails
   */
  async addServer(
    name: string,
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv = process.env
  ): Promise<void> {
    if (this.servers.has(name)) {
      throw new Error(`Server ${name} already exists`);
    }

    // Convert environment variables to strings
    const stringEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        stringEnv[key] = value;
      }
    }

    try {
      const client = new Client(
        {
          name: `mcp-client-${name}`,
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      const transport = new StdioClientTransport({
        command,
        args,
        env: stringEnv,
      });

      await client.connect(transport);
      this.servers.set(name, { name, command, args, env: stringEnv, client });
    } catch (error) {
      throw new Error(`Failed to connect to MCP server '${name}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Remove and disconnect from an MCP server
   * @param name - Identifier of the server to remove
   * @throws {Error} If server is not found
   */
  async removeServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (!server) {
      throw new Error(`Server ${name} not found`);
    }

    try {
      if (server.client) {
        await server.client.close();
      }
    } catch (error) {
      console.error(`Error disconnecting from server ${name}:`, error);
    }

    this.servers.delete(name);
  }

  /**
   * Get the MCP client for a specific server
   * @param name - Server identifier
   * @returns The client instance or undefined if not found
   */
  getClient(name: string): Client | undefined {
    return this.servers.get(name)?.client;
  }

  /**
   * Get all registered MCP servers
   * @returns Array of all server configurations
   */
  getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }
}

export const mcpManager = new MCPServerManager(); 