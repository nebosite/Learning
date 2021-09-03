import { ILogger } from "../helpers/logger";

export class MockLogger implements ILogger
{
    loggedText = "";
    errorText = "";

    logLine(text: string): void {
        this.loggedText += text;
    }

    logError(text: string): void {
        this.errorText += text;
    }  
} 