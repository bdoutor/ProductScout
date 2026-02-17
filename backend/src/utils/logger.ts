import fs from 'fs';
import path from 'path';
import { format } from 'util';

class Logger {
    private logFile: string;
    private debugEnabled: boolean;

    constructor() {
        const logDir = path.resolve(process.cwd(), 'logs');
        this.logFile = path.join(logDir, 'backend-current.log');
        this.debugEnabled = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

        // Ensure log directory exists
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // Log startup
        this.info('Logger initialized. Debug enabled: %s', this.debugEnabled);

        // Ensure log directory exists
        const dir = path.dirname(this.logFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private write(level: string, message: string, ...args: any[]) {
        const timestamp = new Date().toISOString();
        const formattedMsg = format(message, ...args);
        const logEntry = `[${timestamp}] ${level}: ${formattedMsg}\n`;

        // Always write to file
        fs.appendFileSync(this.logFile, logEntry);

        // Console output
        if (level === 'ERROR' || level === 'WARN' || this.debugEnabled) {
            console.log(logEntry);
        }
    }

    debug(message: string, ...args: any[]) {
        this.write('DEBUG', message, ...args);
    }

    info(message: string, ...args: any[]) {
        this.write('INFO', message, ...args);
    }

    warn(message: string, ...args: any[]) {
        this.write('WARN', message, ...args);
    }

    error(message: string | Error, ...args: any[]) {
        if (message instanceof Error) {
            this.write('ERROR', message.stack || message.message, ...args);
        } else {
            this.write('ERROR', message, ...args);
        }
    }

    // Specific para o fluxo Auger
    auger(message: string, ...args: any[]) {
        this.write('AUGER', message, ...args);
    }
}

export const logger = new Logger();