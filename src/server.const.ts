import {ChildProcess } from 'child_process';


export interface IlldbSession {
    process: ChildProcess;
    ready: boolean;
    id: string;
    target?: string;
    workingDir?: string;
}


export enum LLDB_Enum{
    LLDB_START = 'LLDB_START',
    LLDB_LOAD = 'LLDB_LOAD',
    LLDB_COMMAND = 'LLDB_COMMAND',
    LLDB_TERMINATE = 'LLDB_TERMINATE',
    LLDB_LIST_SESSIONS = 'LLDB_LIST_SESSIONS',
    LLDB_LOAD_CORE = 'LLDB_LOAD_CORE',
    LLDB_EXAMINE = 'LLDB_EXAMINE',
    LLDB_INFO_REGISTERS = 'LLDB_INFO_REGISTERS',
    LLDB_SET_BREAKPOINT = 'LLDB_SET_BREAKPOINT',
    LLDB_CONTINUE = 'LLDB_CONTINUE',
    LLDB_STEP = 'LLDB_STEP',
    LLDB_BACKTRACE = 'LLDB_BACKTRACE',
    LLDB_PRINT = 'LLDB_PRINT',
    LLDB_NEXT = 'LLDB_NEXT',
    LLDB_FINISH = 'LLDB_FINISH',
    LLDB_ATTACH = 'LLDB_ATTACH',
    LLDB_RUN = 'LLDB_RUN',
    LLDB_FRAME_INFO = 'LLDB_FRAME_INFO',
    LLDB_DISASSEMBLE = 'LLDB_DISASSEMBLE'
}

export const LLDB_TOOLS = [
  {
    name: LLDB_Enum.LLDB_START,
    description: 'Start a new LLDB session',
    inputSchema: {
      type: 'object',
      properties: {
        lldbPath: {
          type: 'string',
          description: 'Path to the LLDB executable (optional, defaults to "lldb")'
        },
        workingDir: {
          type: 'string',
          description: 'Working directory for LLDB (optional)'
        }
      }
    }
  },
  {
    name: LLDB_Enum.LLDB_ATTACH,
    description: 'Attach to a running process',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        pid: {
          type: 'number',
          description: 'Process ID to attach to'
        }
      },
      required: ['sessionId', 'pid']
    }
  },
  {
    name: LLDB_Enum.LLDB_LOAD,
    description: 'Load a program into LLDB',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        program: {
          type: 'string',
          description: 'Path to the program to debug'
        },
        arguments: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Command-line arguments for the program (optional)'
        }
      },
      required: ['sessionId', 'program']
    }
  },
  {
    name: LLDB_Enum.LLDB_COMMAND,
    description: 'Execute a LLDB command',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        command: {
          type: 'string',
          description: 'LLDB command to execute'
        }
      },
      required: ['sessionId', 'command']
    }
  },
  {
    name: LLDB_Enum.LLDB_TERMINATE,
    description: 'Terminate a LLDB session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: LLDB_Enum.LLDB_LIST_SESSIONS,
    description: 'List all active LLDB sessions',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: LLDB_Enum.LLDB_LOAD_CORE,
    description: 'Load a core dump file',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        program: {
          type: 'string',
          description: 'Path to the program executable'
        },
        corePath: {
          type: 'string',
          description: 'Path to the core dump file'
        }
      },
      required: ['sessionId', 'program', 'corePath']
    }
  },
  {
    name: LLDB_Enum.LLDB_SET_BREAKPOINT,
    description: 'Set a breakpoint',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        location: {
          type: 'string',
          description: 'Breakpoint location (e.g., function name, file:line)'
        },
        condition: {
          type: 'string',
          description: 'Breakpoint condition (optional)'
        }
      },
      required: ['sessionId', 'location']
    }
  },
  {
    name: LLDB_Enum.LLDB_CONTINUE,
    description: 'Continue program execution',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: LLDB_Enum.LLDB_STEP,
    description: 'Step program execution',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        instructions: {
          type: 'boolean',
          description: 'Step by instructions instead of source lines (optional)'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: LLDB_Enum.LLDB_NEXT,
    description: 'Step over function calls',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        instructions: {
          type: 'boolean',
          description: 'Step by instructions instead of source lines (optional)'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: LLDB_Enum.LLDB_FINISH,
    description: 'Execute until the current function returns',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: LLDB_Enum.LLDB_BACKTRACE,
    description: 'Show call stack',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        full: {
          type: 'boolean',
          description: 'Show variables in each frame (optional)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of frames to show (optional)'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: LLDB_Enum.LLDB_PRINT,
    description: 'Print value of expression',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        expression: {
          type: 'string',
          description: 'Expression to evaluate'
        }
      },
      required: ['sessionId', 'expression']
    }
  },
  {
    name: LLDB_Enum.LLDB_EXAMINE,
    description: 'Examine memory',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        expression: {
          type: 'string',
          description: 'Memory address or expression'
        },
        format: {
          type: 'string',
          description: 'Display format (e.g., "x" for hex, "i" for instruction)'
        },
        count: {
          type: 'number',
          description: 'Number of units to display'
        }
      },
      required: ['sessionId', 'expression']
    }
  },
  {
    name: LLDB_Enum.LLDB_INFO_REGISTERS,
    description: 'Display registers',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        register: {
          type: 'string',
          description: 'Specific register to display (optional)'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: LLDB_Enum.LLDB_RUN,
    description: 'Run the program',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: LLDB_Enum.LLDB_FRAME_INFO,
    description: 'Display frame information',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        frameIndex: {
          type: 'number',
          description: 'Frame index'
        }
      },
      required: ['sessionId', 'frameIndex']
    }
  },
  {
    name: LLDB_Enum.LLDB_DISASSEMBLE,
    description: 'Disassemble code of a function',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'LLDB session ID'
        },
        address: {
          type: 'string',
          description: 'Address to disassemble'
        }
      },
      required: ['sessionId', 'address']
    }
  }
];