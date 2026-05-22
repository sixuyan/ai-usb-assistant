// Type declarations for modules without types

// Crypto global (Node 19+)
interface Crypto {
  randomUUID(): string;
}
declare var crypto: Crypto;

// WebSocket global (Node 22+)
interface WebSocket extends EventTarget {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
}
declare var WebSocket: {
  prototype: WebSocket;
  new(url: string): WebSocket;
  readonly CONNECTING: 0;
  readonly OPEN: 1;
  readonly CLOSING: 2;
  readonly CLOSED: 3;
};

declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
    export(): Uint8Array;
  }
  export interface Statement {
    run(params?: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    all(params?: unknown[]): unknown[];
    get(params?: unknown[]): unknown;
    bind(params?: unknown[]): void;
    free(): void;
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
}
