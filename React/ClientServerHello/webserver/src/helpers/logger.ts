
const pad2 = (n: number) => n.toString().padStart(2,'0');
const pad3 = (n: number) => n.toString().padStart(3,'0');

export interface ILogger 
{
    logLine(text: string): void;
    logError(text: string): void;
}
export class Logger implements ILogger
{
    constructor() {
        console.error(this.getCurrentDateString() + "] ##################################################################################");
    }

    // ---------------------------------------------------------------------------------
    // Get now formatted as YYYY/MM/DD HH:MM:SS.fff
    // ---------------------------------------------------------------------------------
    getCurrentDateString()
    {
        var d = new Date();

        return `${d.getUTCFullYear()}`
            + `/${pad2(d.getUTCMonth()+1)}`
            + `/${pad2(d.getUTCDate())}`
            + ` ${pad2(d.getUTCHours())}`
            + `:${pad2(d.getUTCMinutes())}`
            + `:${pad2(d.getUTCSeconds())}`
            + `.${pad3(d.getUTCMilliseconds())}`
    }

    // ---------------------------------------------------------------------------------
    // Log a line prepended with date
    // ---------------------------------------------------------------------------------
    logLine(text: string) {
        console.log(this.getCurrentDateString() + '] ' + text);
    }

    // ---------------------------------------------------------------------------------
    // Log error with prepended date
    // ---------------------------------------------------------------------------------
    logError(text: string)
    {
        console.error(this.getCurrentDateString() + '] ERROR!: ' + text);
    }

}


export class LoggerPrefixer implements ILogger
{
    rootLogger: ILogger;
    prefix: string;

    constructor(rootLogger: ILogger, prefix: string)
    {
        this.rootLogger = rootLogger;
        this.prefix = prefix;  
    }

    logLine(text: string): void { this.rootLogger.logLine(`${this.prefix}: ${text}`) }
    logError(text: string): void {this.rootLogger.logError(`${this.prefix}: ${text}`) }
}