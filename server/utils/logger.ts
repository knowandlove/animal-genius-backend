// Enhanced logging utility
// import { WSErrorCode } from '../../shared/error-codes'; // Commented out - WebSocket features removed

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  userId?: string | number;
  action?: string;
  errorCode?: string;
  [key: string]: any;
}

class Logger {
  private level: LogLevel;
  
  constructor() {
    // Set log level based on environment
    this.level = process.env.NODE_ENV === 'production' 
      ? LogLevel.INFO 
      : LogLevel.DEBUG;
  }
  
  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }
  
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message, context));
    }
  }
  
  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message, context));
    }
  }
  
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }
  
  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorDetails = error ? { 
        name: error.name, 
        message: error.message, 
        stack: error.stack 
      } : undefined;
      
      console.error(this.formatMessage('ERROR', message, {
        ...context,
        error: errorDetails
      }));
    }
  }
  
  // WebSocket specific logging methods - commented out as WebSocket features are removed
  // wsConnection(event: 'connect' | 'disconnect' | 'error', context: LogContext): void {
  //   const message = `WebSocket ${event}`;
  //   if (event === 'error') {
  //     this.error(message, undefined, context);
  //   } else {
  //     this.info(message, context);
  //   }
  // }
  
  // wsMessage(type: string, direction: 'in' | 'out', context: LogContext): void {
  //   this.debug(`WS ${direction}: ${type}`, context);
  // }
  
  // wsError(code: WSErrorCode, context: LogContext): void {
  //   this.warn(`WebSocket error: ${code}`, { ...context, errorCode: code });
  // }
  
  // gameEvent(event: string, context: LogContext): void {
  //   this.info(`Game event: ${event}`, context);
  // }
  
  // Performance logging
  startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`${label} completed in ${duration}ms`);
    };
  }
}

// Export singleton instance
export const logger = new Logger();