import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface MCPServer {
  name: string;
  command: string;
  args: string[];
  client?: Client;
}

class MCPServerManager {
  private servers: Map<string, MCPServer> = new Map();
  
  async addServer(name: string, command: string, args: string[]): Promise<void> {
    if (this.servers.has(name)) {
      throw new Error(`Server ${name} already exists`);
    }

    const client = new Client(
      {
        name: `mcp-client-${name}`,
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    const transport = new StdioClientTransport({ command, args });
    await client.connect(transport);

    this.servers.set(name, { name, command, args, client });
  }

  async removeServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (!server) {
      throw new Error(`Server ${name} not found`);
    }
    
    if (server.client) {
      // Add disconnect logic if needed
      delete server.client;
    }
    
    this.servers.delete(name);
  }

  getClient(name: string): Client | undefined {
    return this.servers.get(name)?.client;
  }

  getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }
}

export const mcpManager = new MCPServerManager(); 