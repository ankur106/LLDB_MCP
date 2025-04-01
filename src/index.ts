import { IlldbSession, LLDB_TOOLS } from './server.const';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError
} from '@modelcontextprotocol/sdk/types.js';
import { LLDB_Enum } from './server.const';
import { spawn } from 'child_process';
import * as readline from 'readline';
import * as path from 'path';


const activeSessions = new Map<string, IlldbSession>();

export class LldbServer {
    private server: Server;
    constructor() {

        this.server = new Server(
            {
                name: 'mcp-LLDB-server',
                version: '0.1.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers();

        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            for (const [id, session] of activeSessions.entries()) {
                await this.terminateSession(id);
            }
            await this.server.close();
            process.exit(0);
        });

    }

    private setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: LLDB_TOOLS
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            // Route the tool call to the appropriate handler based on the tool name
            switch (request.params.name) {
                case LLDB_Enum.LLDB_START:
                    return await this.handleLldbStart(request.params.arguments);
                case LLDB_Enum.LLDB_LOAD:
                    return await this.handleLldbLoad(request.params.arguments);
                case LLDB_Enum.LLDB_COMMAND:
                    return await this.handleLldbCommand(request.params.arguments);
                case LLDB_Enum.LLDB_TERMINATE:
                    return await this.handleLldbTerminate(request.params.arguments);
                case LLDB_Enum.LLDB_LIST_SESSIONS:
                    return await this.handleLldbListSessions();
                case LLDB_Enum.LLDB_LOAD_CORE:
                    return await this.handleLldbLoadCore(request.params.arguments);
                case LLDB_Enum.LLDB_SET_BREAKPOINT:
                    return await this.handleLldbSetBreakpoint(request.params.arguments);
                case LLDB_Enum.LLDB_CONTINUE:
                    return await this.handleLldbContinue(request.params.arguments);
                case LLDB_Enum.LLDB_STEP:
                    return await this.handleLldbStep(request.params.arguments);
                case LLDB_Enum.LLDB_NEXT:
                    return await this.handleLldbNext(request.params.arguments);
                case LLDB_Enum.LLDB_FINISH:
                    return await this.handleLldbFinish(request.params.arguments);
                case LLDB_Enum.LLDB_BACKTRACE:
                    return await this.handleLldbBacktrace(request.params.arguments);
                case LLDB_Enum.LLDB_PRINT:
                    return await this.handleLldbPrint(request.params.arguments);
                case LLDB_Enum.LLDB_EXAMINE:
                    return await this.handleLldbExamine(request.params.arguments);
                case LLDB_Enum.LLDB_INFO_REGISTERS:
                    return await this.handleLldbInfoRegisters(request.params.arguments);
                default:
                    throw new McpError(
                        ErrorCode.MethodNotFound,
                        `Unknown tool: ${request.params.name}`
                    );
            }
        });
    }


   private async handleLldbStart(args: any) {
        const lldbPath = args.lldbPath || 'lldb';
        const workingDir = args.workingDir || process.cwd();
        
        // Create a unique session ID
        const sessionId = Date.now().toString();
        
        try {
          // Start LLDB process
          const lldbProcess = spawn(lldbPath, [], {
            cwd: workingDir,
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          // Create readline interface for reading LLDB output
          const rl = readline.createInterface({
            input: lldbProcess.stdout,
            terminal: false
          });
          
          // Create new LLDB session
          const session: IlldbSession = {
            process: lldbProcess,
            rl,
            ready: false,
            id: sessionId,
            workingDir
          };
          
          // Store session in active sessions map
          activeSessions.set(sessionId, session);
          
          // Collect LLDB output until ready
          let outputBuffer = '';
          
          // Wait for LLDB to be ready (when it outputs the initial prompt)
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('LLDB start timeout'));
            }, 10000); // 10 second timeout
            
            rl.on('line', (line) => {
              // Append line to output buffer
              outputBuffer += line + '\n';
              
              // Check if LLDB is ready (outputs prompt)
              if (line.includes('(lldb)')) {
                clearTimeout(timeout);
                session.ready = true;
                resolve();
              }
            });
            
            lldbProcess.stderr.on('data', (data) => {
              outputBuffer += `[stderr] ${data.toString()}\n`;
            });
            
            lldbProcess.on('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });
            
            lldbProcess.on('exit', (code) => {
              clearTimeout(timeout);
              if (!session.ready) {
                reject(new Error(`LLDB process exited with code ${code}`));
              }
            });
            
            // Send initial command to trigger output
            lldbProcess.stdin.write('version\n');
          });
          
          return {
            content: [
              {
                type: 'text',
                text: `LLDB session started with ID: ${sessionId}\n\nOutput:\n${outputBuffer}`
              }
            ]
          };
        } catch (error) {
          // Clean up if an error occurs
          if (activeSessions.has(sessionId)) {
            const session = activeSessions.get(sessionId)!;
            session.process.kill();
            session.rl?.close();
            activeSessions.delete(sessionId);
          }
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text',
                text: `Failed to start LLDB: ${errorMessage}`
              }
            ],
            isError: true
          };
        }
      }

    private async handleLldbLoad(args: any) {
        const { sessionId, program, arguments: programArgs = [] } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            const normalizedPath = session.workingDir && !path.isAbsolute(program)
                ? path.resolve(session.workingDir, program)
                : program;

            session.target = normalizedPath;

            const loadCommand = `file "${normalizedPath}"`;
            const loadOutput = await this.executeLldbCommand(session, loadCommand);

            let argsOutput = '';
            if (programArgs.length > 0) {
                const argsCommand = `settings set -- target.run-args ${programArgs.join(' ')}`;
                argsOutput = await this.executeLldbCommand(session, argsCommand);
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Program loaded: ${normalizedPath}\n\nOutput:\n${loadOutput}${argsOutput ? '\n' + argsOutput : ''}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to load program: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbCommand(args: any) {
        const { sessionId, command } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            const output = await this.executeLldbCommand(session, command);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Command: ${command}\n\nOutput:\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to execute command: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbTerminate(args: any) {
        const { sessionId } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        try {
            await this.terminateSession(sessionId);

            return {
                content: [
                    {
                        type: 'text',
                        text: `LLDB session terminated: ${sessionId}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to terminate LLDB session: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbListSessions() {
        const sessions = Array.from(activeSessions.entries()).map(([id, session]) => ({
            id,
            target: session.target || 'No program loaded',
            workingDir: session.workingDir || process.cwd()
        }));

        return {
            content: [
                {
                    type: 'text',
                    text: `Active LLDB Sessions (${sessions.length}):\n\n${JSON.stringify(sessions, null, 2)}`
                }
            ]
        };
    }

    private async handleLldbLoadCore(args: any) {
        const { sessionId, program, corePath } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            // First load the program
            const fileOutput = await this.executeLldbCommand(session, `target core "${program}"`);

            // Then load the core file
            const coreOutput = await this.executeLldbCommand(session, `target core "${corePath}"`);

            // Get backtrace to show initial state
            const backtraceOutput = await this.executeLldbCommand(session, "backtrace");

            return {
                content: [
                    {
                        type: 'text',
                        text: `Core file loaded: ${corePath}\n\nOutput:\n${fileOutput}\n${coreOutput}\n\nBacktrace:\n${backtraceOutput}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to load core file: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbSetBreakpoint(args: any) {
        const { sessionId, location, condition } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            // Set breakpoint
            let command = location.includes(':')
                ? `breakpoint set -f ${location.split(':')[0]} -l ${location.split(':')[1]}`
                : `breakpoint set --name ${location}`;
            const output = await this.executeLldbCommand(session, command);

            // Set condition if provided
            let conditionOutput = '';
            if (condition) {
                // Extract breakpoint number from output (assumes format like "Breakpoint 1 at...")
                const match = output.match(/Breakpoint (\d+)/);
                if (match && match[1]) {
                    const bpNum = match[1];
                    const conditionCommand = `breakpoint modify -c '${condition}' ${bpNum}`;
                    conditionOutput = await this.executeLldbCommand(session, conditionCommand);
                }
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Breakpoint set at: ${location}${condition ? ` with condition: ${condition}` : ''}\n\nOutput:\n${output}${conditionOutput ? '\n' + conditionOutput : ''}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to set breakpoint: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbContinue(args: any) {
        const { sessionId } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            const output = await this.executeLldbCommand(session, "continue");

            return {
                content: [
                    {
                        type: 'text',
                        text: `Continued execution\n\nOutput:\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to continue execution: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbStep(args: any) {
        const { sessionId, instructions = false } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            // Use stepi for instruction-level stepping, otherwise step
            const command = instructions ? "stepi" : "step";
            const output = await this.executeLldbCommand(session, command);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Stepped ${instructions ? 'instruction' : 'line'}\n\nOutput:\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to step: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbNext(args: any) {
        const { sessionId, instructions = false } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            // Use nexti for instruction-level stepping, otherwise next
            const command = instructions ? "nexti" : "next";
            const output = await this.executeLldbCommand(session, command);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Stepped over ${instructions ? 'instruction' : 'function call'}\n\nOutput:\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to step over: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbFinish(args: any) {
        const { sessionId } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            const output = await this.executeLldbCommand(session, "finish");

            return {
                content: [
                    {
                        type: 'text',
                        text: `Finished current function\n\nOutput:\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to finish function: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbBacktrace(args: any) {
        const { sessionId, full = false, limit } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            // Build backtrace command with options
            let command = full ? "backtrace full" : "backtrace";
            if (typeof limit === 'number') {
                command += ` ${limit}`;
            }

            const output = await this.executeLldbCommand(session, command);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Backtrace${full ? ' (full)' : ''}${limit ? ` (limit: ${limit})` : ''}:\n\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to get backtrace: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbPrint(args: any) {
        const { sessionId, expression } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            const output = await this.executeLldbCommand(session, `print ${expression}`);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Print ${expression}:\n\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to print expression: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbExamine(args: any) {
        const { sessionId, expression, format = 'x', count = 1 } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            // Format examine command: x/[count][format] [expression]
            let sizeChar = 'b'; // default byte size
            let formatChar = 'x'; // default hex format
            if (format.length > 0) {
                if (['b', 'h', 'w', 'g'].includes(format[0])) {
                    sizeChar = format[0];
                    if (format.length > 1) formatChar = format[1];
                } else {
                    formatChar = format[0];
                }
            }
            // Map size characters to byte counts
            const sizeMap: { [key: string]: number } = { 'b': 1, 'h': 2, 'w': 4, 'g': 8 };
            const size = sizeMap[sizeChar] || 1;
            // Map format characters
            const formatMap: { [key: string]: string } = {
                'x': 'hex', 'd': 'decimal', 'u': 'unsigned',
                'o': 'octal', 't': 'binary', 'f': 'float',
                'c': 'char', 'i': 'instruction', 's': 'string'
            };
            const lldbFormat = formatMap[formatChar] || 'hex';
            const command = `memory read -s${size} -f${lldbFormat} -c${count} ${expression}`;
            const output = await this.executeLldbCommand(session, command);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Examine ${expression} (format: ${format}, count: ${count}):\n\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to examine memory: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbInfoRegisters(args: any) {
        const { sessionId, register } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active LLDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            const command = register ? `register read ${register}` : `register read`;
            const output = await this.executeLldbCommand(session, command);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Register info${register ? ` for ${register}` : ''}:\n\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to get register info: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }


    private executeLldbCommand(session: IlldbSession, command: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (!session.process || session.process.exitCode !== null) {
                const exitCodeInfo = session.process?.exitCode !== null ? `exit code ${session.process.exitCode}` : 'process missing';
                reject(new Error(`LLDB session is not ready or process has terminated (${exitCodeInfo})`));
                return;
            }
            if (!session.ready) {
                 console.warn(`Executing LLDB command "${command}" while session marked as not ready.`);
            }

            let stdoutBuffer = '';
            let stderrOutput = '';
            const promptPattern = '(lldb) ';   
            let commandEchoSeen = false;
            let timeoutId: NodeJS.Timeout | null = null;

            // --- Listener Functions ---
            const cleanupListeners = () => {
                if (timeoutId) clearTimeout(timeoutId);
                session.process!.stdout?.removeListener('data', stdoutListener);
                session.process!.stderr?.removeListener('data', stderrListener);
                session.process!.removeListener('exit', exitListener);
                session.process!.removeListener('error', errorListener);
            };

            const stdoutListener = (data: Buffer) => {
                const chunk = data.toString();
                stdoutBuffer += chunk;
                // console.debug(`[LLDB STDOUT] Received chunk: ${chunk.substring(0,100)}...`); // Verbose logging
                // console.debug(`[LLDB STDOUT] Buffer now: ${stdoutBuffer.substring(stdoutBuffer.length-100)}...`); // Verbose logging

                 // Attempt to filter command echo (simple check). Needs to happen before prompt check.
                 if (!commandEchoSeen) {
                    const firstLine = stdoutBuffer.split('\n')[0].trim();
                    if (firstLine === command.trim()) {
                        // console.debug('[LLDB STDOUT] Detected command echo.');
                        commandEchoSeen = true;
                        // Remove the echoed command line from buffer
                        const lines = stdoutBuffer.split('\n');
                        stdoutBuffer = lines.slice(1).join('\n');
                        // Check immediately if the prompt followed the echo
                        if (stdoutBuffer.includes(promptPattern)) {
                            // console.debug('[LLDB STDOUT] Found prompt immediately after echo removal.');
                            const promptIndex = stdoutBuffer.indexOf(promptPattern);
                            const result = stdoutBuffer.substring(0, promptIndex).trim();
                            cleanupListeners();
                            resolve(result + (stderrOutput ? `\n[stderr]:\n${stderrOutput}` : ''));
                            return;
                        }
                    } else if (stdoutBuffer.trim().length > 0 && stdoutBuffer.trim() !== command.trim()) {
                         // If we received significant data different from the command, assume no echo or missed.
                         // console.debug('[LLDB STDOUT] Significant data received, assuming no/missed echo.');
                         commandEchoSeen = true;
                    }
                 }

                // Check if the buffer contains the prompt pattern
                const promptIndex = stdoutBuffer.indexOf(promptPattern);
                if (promptIndex !== -1) {
                    // console.debug(`[LLDB STDOUT] Found prompt at index ${promptIndex}. Resolving.`);
                    cleanupListeners();
                    const result = stdoutBuffer.substring(0, promptIndex).trim(); // Content before the prompt
                    resolve(result + (stderrOutput ? `\n[stderr]:\n${stderrOutput}` : ''));
                }
            };

            const stderrListener = (data: Buffer) => {
                const errorText = data.toString();
                // console.debug(`[LLDB STDERR] Received: ${errorText}`); // Verbose logging
                stderrOutput += errorText;
            };

            const exitListener = (code: number | null, signal: string | null) => {
                // console.warn(`[LLDB PROCESS] Exited with code: ${code}, signal: ${signal}`);
                cleanupListeners();
                const finalOutput = stdoutBuffer.trim() + (stderrOutput ? `\n[stderr]:\n${stderrOutput}` : '');
                // Resolve with output + error, as process terminated during command execution
                resolve(finalOutput + `\n[LLDB process exited during command with code: ${code ?? 'unknown'}, signal: ${signal ?? 'unknown'}]`);
            };

             const errorListener = (err: Error) => {
                // console.error(`[LLDB PROCESS] Error: ${err.message}`);
                cleanupListeners();
                reject(new Error(`LLDB process error: ${err.message}\nOutput so far:\n${stdoutBuffer}\nStderr:\n${stderrOutput}`));
            };

            // --- Setup and Execution ---

            // Set a timeout
            timeoutId = setTimeout(() => {
                // console.warn(`[LLDB TIMEOUT] Command "${command}" timed out after 10s.`);
                cleanupListeners();
                const finalOutput = stdoutBuffer.trim() + (stderrOutput ? `\n[stderr]:\n${stderrOutput}` : '');
                // Resolve with timeout message appended, providing partial output
                resolve(finalOutput + `\n[Timeout waiting for LLDB response after 10 seconds for command: ${command}]`);
            }, 10000); // 10 second timeout

            // Add listeners BEFORE writing the command
            session.process!.stdout?.on('data', stdoutListener);
            session.process!.stderr?.on('data', stderrListener);
            session.process!.once('exit', exitListener); // Use once for exit
            session.process!.once('error', errorListener); // Listen for process errors

            // Write command to LLDB's stdin
            // console.debug(`[LLDB STDIN] Writing command: ${command}`);
            session.process!.stdin?.write(command + '\n', (err) => {
                if (err) {
                    // console.error(`[LLDB STDIN] Error writing command: ${err.message}`);
                    cleanupListeners();
                    reject(new Error(`Failed to write to LLDB stdin: ${err.message}`));
                }
            });
        });
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
        session.rl?.close();

        // Remove from active sessions
        activeSessions.delete(sessionId);
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('LLDB MCP server running on stdio');
    }

}


// Create and run the server
const server = new LldbServer();
server.run().catch((error) => {
    console.error('Failed to start LLDB MCP server:', error);
    process.exit(1);
});
