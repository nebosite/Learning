import express, { Request, Response } from 'express';
import express_ws from 'express-ws';
import { handleSocket } from '../handleSocket';
import { ILogger } from '../helpers/logger';
import { safeSend } from '../helpers/SafeSend';
import { ServerModel } from '../models/ServerModel';

// ---------------------------------------------------------------------------------
// Set up Rest and Socket APIs
// ---------------------------------------------------------------------------------
export function setupApis(app: any, logger: ILogger, serverModel: ServerModel)
{
    const makeResponder = (getData: (req: Request) => Promise<any> ) => {
        return async (req: Request, res: Response) => {
            await safeSend(res, logger, req.url, async () => {
                return await getData(req);
            })   
        }
    }

    app.use(express.text({type: "application/json"}));

    app.get("/api/ping", makeResponder(() => serverModel.ping()));

    const app_ws = express_ws(app);
    app_ws.app.ws('/sockets/subscribe', (req, res) => handleSocket(req, res, logger)); 
}