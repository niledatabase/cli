import { theme } from './colors';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

export interface LoggerOptions {
  debug?: boolean;
  quiet?: boolean;
}

let globalOptions: LoggerOptions = { debug: false, quiet: false };

export function setLoggerOptions(options: LoggerOptions): void {
  globalOptions = { ...globalOptions, ...options };
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (globalOptions.debug) {
      console.log(theme.dim(`[DEBUG] ${message}`), ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (!globalOptions.quiet) {
      console.log(theme.info(message), ...args);
    }
  },

  success(message: string, ...args: unknown[]): void {
    if (!globalOptions.quiet) {
      console.log(theme.success(message), ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (!globalOptions.quiet) {
      console.warn(theme.warning(message), ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    console.error(theme.error(message), ...args);
  },

  dim(message: string, ...args: unknown[]): void {
    if (!globalOptions.quiet) {
      console.log(theme.dim(message), ...args);
    }
  },

  table(data: unknown[]): void {
    if (!globalOptions.quiet) {
      console.table(data);
    }
  },

  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  },

  csv(headers: string[], rows: unknown[][]): void {
    console.log(headers.join(','));
    rows.forEach(row => {
      console.log(row.join(','));
    });
  },

  newLine(): void {
    if (!globalOptions.quiet) {
      console.log();
    }
  }
};

export function createLogger(options: LoggerOptions): typeof logger {
  return {
    ...logger,
    debug: (message: string, ...args: unknown[]) => {
      if (options.debug) {
        console.log(theme.dim(`[DEBUG] ${message}`), ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (!options.quiet) {
        console.log(theme.info(message), ...args);
      }
    },
    success: (message: string, ...args: unknown[]) => {
      if (!options.quiet) {
        console.log(theme.success(message), ...args);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (!options.quiet) {
        console.warn(theme.warning(message), ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(theme.error(message), ...args);
    },
    dim: (message: string, ...args: unknown[]) => {
      if (!options.quiet) {
        console.log(theme.dim(message), ...args);
      }
    },
    table: (data: unknown[]) => {
      if (!options.quiet) {
        console.table(data);
      }
    },
    json: (data: unknown) => {
      console.log(JSON.stringify(data, null, 2));
    },
    csv: (headers: string[], rows: unknown[][]) => {
      console.log(headers.join(','));
      rows.forEach(row => {
        console.log(row.join(','));
      });
    },
    newLine: () => {
      if (!options.quiet) {
        console.log();
      }
    }
  };
}