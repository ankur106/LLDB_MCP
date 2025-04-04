# MCP LLDB Server

A Model Context Protocol (MCP) server that provides LLDB debugging functionality for use with Claude or other AI assistants.



![Example with claude](/example/example.png)

## Features

- Start and manage LLDB debugging sessions
- Load programs and core dumps for analysis
- Set breakpoints, step through code, and examine memory
- View call stacks, variables, and registers
- Execute arbitrary LLDB commands

## Installation

```bash
# Clone the repository
git clone git@github.com:ankur106/LLDB_MCP.git

cd LLDB_MCP

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Using with Claude or other MCP-enabled assistants

1. Configure the MCP settings in the Claude desktop app or browser extension to include this server:

```json
{
  "mcpServers": {
    "lldb": {
      "command": "node",
      "args": ["/path/to/LLDB_MCP/build/index.js"],
      "disabled": false
    }
  }
}
```

2. Restart Claude or refresh the page.

3. Now you can use the LLDB tools in your conversations with Claude.


## Supported LLDB Commands

- `lldb_start`: Start a new LLDB session
- `lldb_load`: Load a program into LLDB
- `lldb_command`: Execute an arbitrary LLDB command
- `lldb_terminate`: Terminate an LLDB session
- `lldb_list_sessions`: List all active LLDB sessions
- `lldb_attach`: Attach to a running process
- `lldb_load_core`: Load a core dump file
- `lldb_examine`: Examine memory
- `lldb_info_registers`: Display registers
- `lldb_set_breakpoint`: Set a breakpoint
- `lldb_continue`: Continue program execution
- `lldb_step`: Step program execution
- `lldb_backtrace`: Show call stack
- `lldb_print`: Print value of expression
- `lldb_next`: Step over function calls
- `lldb_finish`: Execute until the current function returns
- `lldb_run`: Run the program
- `lldb_frame_info`: Get information about the current stack frame
- `lldb_disassemble`: Disassemble the current function