import express from 'express';
import { ServerModel } from './models/ServerModel';
import { VERSION } from './GLOBALS';
import { Logger } from './helpers/logger';
import { setupHosting } from './setup/setupHosting';
import { setupApis } from './setup/setupApis';
import { listen } from './setup/listen';

const logger = new Logger();
logger.logLine("##################################################################################")
logger.logLine("## Starting Server  v" + VERSION)

export const app = express();
export const serverModel = new ServerModel(logger);

setupApis(app, logger, serverModel)
setupHosting(app, logger);
listen(4444, app, logger);


