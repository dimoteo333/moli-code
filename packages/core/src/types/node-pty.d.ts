/**
 * Type declarations for @lydell/node-pty
 */
declare module '@lydell/node-pty' {
  export interface IPty {
    pid: number;
    cols: number;
    rows: number;
    write(data: string | Buffer): void;
    kill(signal?: string): void;
    resize(columns: number, rows: number): void;
    onData: IEvent<string>;
    onExit: IEvent<{ exitCode: number; signal?: number }>;
  }

  export interface IEvent<T> {
    (listener: (e: T) => void): IDisposable;
  }

  export interface IDisposable {
    dispose(): void;
  }

  export interface IProcessEnv {
    [key: string]: string | undefined;
  }

  export interface IPtyForkOptions {
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: IProcessEnv;
    encoding?: string;
    name?: string;
  }

  export function spawn(
    file: string,
    args: string[] | string,
    options?: IPtyForkOptions,
  ): IPty;
}
