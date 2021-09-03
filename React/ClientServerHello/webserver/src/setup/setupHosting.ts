import * as path from 'path';
import { ILogger } from '../helpers/logger';
import express, { Request, Response } from 'express';

export function setupHosting(app: any, logger: ILogger)
{
    const clientAppRoot = path.join(__dirname, "../../clientapp/build/")

    logger.logLine(`Client root = ${clientAppRoot}`)

    app.get('', (req: Request, res: Response) => { res.sendFile(`${clientAppRoot}/index.html`); })
    app.use('/', express.static(clientAppRoot));
    app.get('/*', (req: Request, res: Response) => { res.sendFile(`${clientAppRoot}/index.html`); })

}