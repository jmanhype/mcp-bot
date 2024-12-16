#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { marked } from 'marked';

class DspyDocsServer {
  private server: Server;
  private githubApiInstance;
  private pypiApiInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'dspy-docs-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    this.githubApiInstance = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${githubToken}`,
      },
    });

    this.pypiApiInstance = axios.create({
      baseURL: 'https://pypi.org/pypi',
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_dspy_docs',
          description: 'Get the latest DSPy documentation and package information',
          inputSchema: {
            type: 'object',
            properties: {
              section: {
                type: 'string',
                description: 'Optional specific documentation section to fetch (e.g., "README", "examples", "api")',
                enum: ['README', 'examples', 'api'],
              },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'get_dspy_docs') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      try {
        // Get PyPI package info
        const pypiResponse = await this.pypiApiInstance.get('/dspy-ai/json');
        const packageInfo = pypiResponse.data.info;

        // Get docs based on section
        const section = request.params.arguments?.section || 'README';
        let docsContent = '';

        switch (section) {
          case 'README':
            const readmeResponse = await this.githubApiInstance.get(
              '/repos/stanfordnlp/dspy/readme',
              {
                headers: { Accept: 'application/vnd.github.raw' },
              }
            );
            docsContent = readmeResponse.data;
            break;

          case 'examples':
            docsContent = `# DSPy Examples (v${packageInfo.version})

DSPy provides several example use cases and tutorials that demonstrate its powerful capabilities:

## 1. Basic Examples

### Question Answering
- Simple QA with dspy.Predict
- Chain-of-Thought reasoning with dspy.ChainOfThought
- Multi-step decomposition with dspy.Module

### Retrieval-Augmented Generation (RAG)
- Basic RAG pipeline with dspy.Retrieve
- Advanced RAG with dspy.ColBERTv2
- Contextual compression and reranking

### Text Classification
- Binary and multi-class classification
- Zero-shot classification
- Few-shot learning with examples

### Summarization
- Single document summarization
- Multi-document summarization
- Extractive vs abstractive approaches

## 2. Advanced Features

### Teleprompter
- Automatic prompt optimization
- Parameter tuning
- Custom metric integration

### Multi-stage Reasoning
- Complex task decomposition
- Step-by-step verification
- Error handling and recovery

### Custom Metrics
- Defining custom evaluation metrics
- Metric-guided optimization
- Performance monitoring

## 3. Real-world Applications

### Conversational Agents
- Building chatbots
- Context management
- Response generation

### Knowledge Base Construction
- Information extraction
- Fact verification
- Knowledge graph population

### Document Processing
- Document parsing
- Information extraction
- Content transformation

For detailed tutorials and code examples, visit:
- Documentation: https://dspy.ai
- GitHub Repository: https://github.com/stanfordnlp/dspy
- Discord Community: https://discord.gg/XCGy2WDCQB

Note: DSPy is actively developed, with new examples and features being added regularly. Check the documentation site for the most up-to-date examples and best practices.`;
            break;

          case 'api':
            // Fetch API documentation from docs directory
            const apiResponse = await this.githubApiInstance.get(
              '/repos/stanfordnlp/dspy/contents/docs/api.md',
              {
                headers: { Accept: 'application/vnd.github.raw' },
              }
            );
            docsContent = apiResponse.data;
            break;
        }

        // Convert markdown to plain text
        const plainText = marked.parse(docsContent);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                package_info: {
                  version: packageInfo.version,
                  author: packageInfo.author,
                  description: packageInfo.summary,
                  homepage: packageInfo.home_page,
                  license: packageInfo.license,
                },
                documentation: plainText,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error fetching DSPy docs: ${
                  error.response?.data?.message || error.message
                }`,
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DSPy Docs MCP server running on stdio');
  }
}

const server = new DspyDocsServer();
server.run().catch(console.error);
