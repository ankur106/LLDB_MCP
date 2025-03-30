import {IlldbSession} from './server.const';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { LLDB_Enum } from './server.const';


const activeSessions = new Map<string, IlldbSession>();

export class LldbServer {
private server: Server;
  constructor() {

    this.server = new Server(
        {
          name: 'mcp-gdb-server',
          version: '0.1.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );
  
      this.setupToolHandlers();
      
      // Error handling
      this.server.onerror = (error) => console.error('[MCP Error]', error);
      process.on('SIGINT', async () => {
        // Clean up all active GDB sessions
        for (const [id, session] of activeSessions.entries()) {
          await this.terminateSession(id);
        }
        await this.server.close();
        process.exit(0);
      });
    
  }


  private setupToolHandlers() {

  }


  private async terminateSession(sessionId: string): Promise<void> {
    if (!activeSessions.has(sessionId)) {
      throw new Error(`No active session with sessionId: ${sessionId}`);
    }
    
    const session = activeSessions.get(sessionId)!;
    
    // Send quit command to LLDB
    try {
      await this.executeLldbCommand(session, 'quit');
    } catch (error) {
      // Ignore errors from quit command, we'll force kill if needed
    }
    
    // Force kill the process if it's still running
    if (!session.process.killed) {
      session.process.kill();
    }
    
    // Close the readline interface
    session.rl.close();
    
    // Remove from active sessions
    activeSessions.delete(sessionId);
  }

  private async executeLldbCommand(session: IlldbSession, command: string): Promise<void> {
    session.rl.write(`${command}\n`);
  }
}
