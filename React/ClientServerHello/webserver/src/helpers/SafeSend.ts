import { ILogger } from "./logger";

export interface RestResult 
{
    data?: any
    errorMessage?: string
}

// ---------------------------------------------------------------------------------
// UserError - throw a UserError if you want the error text to make it back to the user
// ---------------------------------------------------------------------------------
export class UserError {
    message:string; 
    constructor(message: string)
    {
        this.message = message;
    }
}

// ---------------------------------------------------------------------------------
// AuthorizationError - throw an AuthorizationError for auth problems
// ---------------------------------------------------------------------------------
export class AuthorizationError {
    message:string; 
    constructor(message: string)
    {
        this.message = message;
    }
}

// ---------------------------------------------------------------------------------
// Easily mockable response interface
// ---------------------------------------------------------------------------------
export interface SimpleResponse
{
    send:(message:string) => SimpleResponse;
    status: (statusCode: number) => SimpleResponse;
}

// ---------------------------------------------------------------------------------
// For Testing
// ---------------------------------------------------------------------------------
export class MockResponse implements SimpleResponse
{
    messagesSent = "";
    myStatus = 0;

    send = (message:string) => {
        this.messagesSent += message;
        return this;
    }

    status = (statusCode: number) => {
        this.myStatus = statusCode;
        return this;
    }
}

export class PageResponse {
    responseCode = 400
    content: string

    constructor(content: string)
    {
        this.content = content;
    }

    static Redirect(url: string)
    {
        return new PageResponse(`<head><meta http-equiv="Refresh" content="0; URL=${url}"></head>`)
    }
}

// ---------------------------------------------------------------------------------
// Pack up the data and send it back
// ---------------------------------------------------------------------------------
export async function safeSend(res: SimpleResponse, logger: ILogger, label: string, getData: ()=>Promise<any>)
{
    try {
        const data = await getData();
        if(data instanceof PageResponse) {
            res.status(data.responseCode).send(data.content) 
        }
        else {
            res.send(JSON.stringify({data}));
        }
    }
    catch(err) {
        if(err instanceof UserError){
            res.send(JSON.stringify({errorMessage: (err as UserError).message}))
        }
        else {
             const timecode = Date.now();
             logger.logError(`Error at timecode ${timecode} on ${label}: ${err} ${JSON.stringify(err)}`)
             res.send(JSON.stringify({errorMessage: `There was a server error in ${label}.  Reference timecode ${timecode}`}))
         }
     }
}

