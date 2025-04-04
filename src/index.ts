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
                case LLDB_Enum.LLDB_ATTACH:
                    return await this.handleLldbAttach(request.params.arguments);
                case LLDB_Enum.LLDB_RUN:
                    return await this.handleLldbRun(request.params.arguments);
                case LLDB_Enum.LLDB_FRAME_INFO:
                    return await this.handleLldbFrameInfo(request.params.arguments);
                case LLDB_Enum.LLDB_DISASSEMBLE:
                    return await this.handleLldbDisassemble(request.params.arguments);
                default:
                    throw new McpError(
                        ErrorCode.MethodNotFound,
                        `Unknown tool: ${request.params.name}`
                    );
            }
        });
    }
    private async handleLldbDisassemble(args: any) {
        const { sessionId } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active GDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            const disassemble_output = await this.executeLldbCommand(session, `disassemble --name ${args.address}`);
            return {
                content: [
                    {
                        type: 'text',
                        text: disassemble_output
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbFrameInfo(args: any) {
        const { sessionId } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active GDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            const frame_output = await this.executeLldbCommand(session, `frame info ${args.frameIndex}`);
            const vars_output = await this.executeLldbCommand(session, `frame variable`);

            const source_output = await this.executeLldbCommand(session, `source list`);



            return {
                content: [
                    {
                        type: 'text',
                        text: `Command: Frame info \n\nOutput:\n${frame_output}\n\nCommand: Frame variable \n\nOutput:\n${vars_output}\n\nCommand: Source list \n\nOutput:\n${source_output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to run the program: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }


    private async handleLldbRun(args: any) {
        const { sessionId } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active GDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            const output = await this.executeLldbCommand(session, `run`);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Command: Run \n\nOutput:\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to run the program: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    private async handleLldbAttach(args: any) {
        const { sessionId, pid } = args;

        if (!activeSessions.has(sessionId)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No active GDB session with ID: ${sessionId}`
                    }
                ],
                isError: true
            };
        }

        const session = activeSessions.get(sessionId)!;

        try {
            const output = await this.executeLldbCommand(session, `process attach -p ${pid}`);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Attached to process ${pid}\n\nOutput:\n${output}`
                    }
                ]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to attach to process: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }


    private async handleLldbStart(args: any) {
        const lldbPath = args.lldbPath || 'lldb';
        const workingDir = args.workingDir || process.cwd();

        const sessionId = Date.now().toString();

        try {
            const lldbProcess = spawn(lldbPath, [], {
                cwd: workingDir,
                env: process.env,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let session: IlldbSession = {
                process: lldbProcess,
                ready: false,
                id: sessionId,
                workingDir
            };

            activeSessions.set(sessionId, session);

            let outputBuffer = '';
            lldbProcess.stdin.write('version\n');


            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('LLDB start timeout'));
                }, 10000); 


                lldbProcess.stdout.on('data', (data) => {
                    outputBuffer += data.toString() + '\n';
                });
                setTimeout(() => {
                    if (outputBuffer.toString().includes('(lldb)')) {
                        clearTimeout(timeout);
                        session.ready = true;
                        resolve();
                    }
                }, 2000); 

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
            const fileOutput = await this.executeLldbCommand(session, `file "${program}"`);

            const coreOutput = await this.executeLldbCommand(session, `target core "${corePath}"`);

            const backtraceOutput = await this.executeLldbCommand(session, "bt");

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
            let command = full ? "bt full" : "bt";
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
            let sizeChar = 'b'; 
            let formatChar = 'x';
            if (format.length > 0) {
                if (['b', 'h', 'w', 'g'].includes(format[0])) {
                    sizeChar = format[0];
                    if (format.length > 1) formatChar = format[1];
                } else {
                    formatChar = format[0];
                }
            }
            const sizeMap: { [key: string]: number } = { 'b': 1, 'h': 2, 'w': 4, 'g': 8 };
            const size = sizeMap[sizeChar] || 1;
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


    private async executeLldbCommand(session: IlldbSession, command: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (!session.process) {
                reject(new Error("LLDB session is not ready: process is missing"));
                return;
            }
            if (session.process.exitCode !== null || session.process.stdin?.writable === false) {
                const exitCodeInfo = session.process.exitCode !== null ? `exit code ${session.process.exitCode}` : 'stdin not writable';
                reject(new Error(`LLDB session is not ready or process has terminated (${exitCodeInfo})`));
                return;
            }

            let stdoutBuffer = '';
            let stderrOutput = '';
            const promptPattern = '(lldb)';
            const commandTimeoutMs = 10000;
            let timeoutId: NodeJS.Timeout | null = null;
            let listenersAttached = false;

            const cleanupListeners = () => {
                if (!listenersAttached) return;
                listenersAttached = false;

                if (timeoutId) clearTimeout(timeoutId);
                timeoutId = null;

                session.process?.stdout?.removeListener('data', stdoutListener);
                session.process?.stderr?.removeListener('data', stderrListener);
                session.process?.removeListener('exit', exitListener);
                session.process?.removeListener('error', errorListener);
            };

            const stdoutListener = (data: Buffer) => {
                const chunk = data.toString('utf-8');
                stdoutBuffer += chunk;

                let check = false;

                if (!check) {
                    check = true;
                    setTimeout(() => {
                        if (stdoutBuffer.trimEnd().startsWith(promptPattern)) {
                            cleanupListeners();
                            const result = stdoutBuffer + (stderrOutput ? `\n[stderr]:\n${stderrOutput}` : '');
                            resolve(result);
                        }
                    }, 1000);
                }

            };

            const stderrListener = (data: Buffer) => {
                const errorText = data.toString('utf-8');
                stderrOutput += errorText;
            };

            const exitListener = (code: number | null, signal: string | null) => {
                cleanupListeners();
                const finalOutput = stdoutBuffer + (stderrOutput ? `\n[stderr]:\n${stderrOutput}` : '');
                resolve(finalOutput + `\n[LLDB process exited during command execution. Code: ${code ?? 'unknown'}, Signal: ${signal ?? 'unknown'}]`);
            };

            const errorListener = (err: Error) => {
                cleanupListeners();
                reject(new Error(`LLDB process error: ${err.message}\nOutput so far:\n${stdoutBuffer}\nStderr:\n${stderrOutput}`));
            };

            timeoutId = setTimeout(() => {
                cleanupListeners();
                const finalOutput = stdoutBuffer + (stderrOutput ? `\n[stderr]:\n${stderrOutput}` : '');

                resolve(finalOutput + `\n[Timeout waiting for LLDB response after ${commandTimeoutMs / 1000} seconds for command: ${command}]`);
            }, commandTimeoutMs);

            if (!session.process.stdout || !session.process.stderr || !session.process.stdin) {
                cleanupListeners(); // Clear timeout if set
                reject(new Error("LLDB process stdout, stderr, or stdin stream is missing."));
                return;
            }

            session.process.stdout.on('data', stdoutListener);
            session.process.stderr.on('data', stderrListener);
            session.process.once('exit', exitListener);
            session.process.once('error', errorListener);
            listenersAttached = true;


            session.process.stdin.write(command + '\n', 'utf-8', (err) => {
                if (err) {
                    cleanupListeners();
                    reject(new Error(`Failed to write command to LLDB stdin: ${err.message}`));
                }
            });
        });
    }



    private async terminateSession(sessionId: string): Promise<void> {
        if (!activeSessions.has(sessionId)) {
            throw new Error(`No active session with sessionId: ${sessionId}`);
        }

        const session = activeSessions.get(sessionId)!;

        try {
            await this.executeLldbCommand(session, 'quit');
        } catch (error) {
            console.error(error)
        }

        if (!session.process.killed) {
            session.process.kill();
        }
        activeSessions.delete(sessionId);
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }

}


const server = new LldbServer();
server.run().catch((error) => {
    process.exit(1);
});
