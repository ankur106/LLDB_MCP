import {ChildProcess } from 'child_process';

import * as readline from 'readline';

export interface IlldbSession {
    process: ChildProcess;
    rl: readline.Interface;
    ready: boolean;
    id: string;
    target?: string;
    workingDir?: string;
}


export enum LLDB_Enum{
    LLDB_
}