import { ILogger } from "../helpers/logger";

export function listen(defaultPort: number, app: any, logger: ILogger)
{
    const listening_port = process.env.PORT || defaultPort

    const handleShutdown = async (signal: any) => { 
        logger.logLine(`B'Bye: ${signal} `)
        logger.logLine("Attempting to shut down gracefully...   ")
        // TODO flush buffers here
        logger.logLine("Done ------------------------------------------")
        process.exit(0);
    }
    
    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
    process.on('SIGHUP', handleShutdown);
    process.on('SIGUSR2', handleShutdown);
    
    // ---------------------------------------------------------------------------------
    // Listen up!
    // ---------------------------------------------------------------------------------
    
    app.listen(listening_port, () => {
        logger.logLine('listening on ' + listening_port);
    });
}