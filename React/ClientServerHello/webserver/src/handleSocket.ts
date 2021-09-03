
import * as WebSocket from 'ws';
import { Request } from "express";
import { ILogger } from './helpers/logger';


export interface IListener{
    name: string    
    close():void;
    send(data: any): Promise<void>
}

const CLOSECODE_POLICY_VIOLATION = 1008;

let listenerCount = 0;
class WebSocketListener implements IListener
{
    name: string
    private _socket: WebSocket
    private _onClose: () => void
    private _closed = false;
    private _logger: ILogger;

    //------------------------------------------------------------------------------------------
    // ctor
    //------------------------------------------------------------------------------------------
    constructor(name: string, socket: WebSocket, logger: ILogger, onClose: ()=> void) {
        this._socket = socket;
        this.name = name;
        this._onClose = onClose;
        this._logger = logger;
    }

    //------------------------------------------------------------------------------------------
    // close
    //------------------------------------------------------------------------------------------
    close() {
        this._closed = true;
        if(this._socket) this._logger.logLine(`Closing socket: ${this.name}`)
        this._onClose();
    }

    //------------------------------------------------------------------------------------------
    // send
    //------------------------------------------------------------------------------------------
    async send(data: any) {
        if(this._closed) return;
        this._socket.send(JSON.stringify(data))
    }
}

// ---------------------------------------------------------------------------------
// Set up incoming socket request
// ---------------------------------------------------------------------------------
export function handleSocket(socket: WebSocket, req: Request, logger: ILogger) {
    try {
        logger.logLine(`New Socket Request`)
        const name = `listener_${listenerCount++}`

        const onClose = () => {} // TODO: Put code here to clean up the socket
        const listener = new WebSocketListener(name, socket, logger, onClose);

        // TODO:  Probably have the serverModel remember the listener

        socket.on('message', function (msgRaw:any) {
            try {
                const jsonText = msgRaw.toString();
                const msgParsed = JSON.parse(jsonText);
                logger.logLine(`Got a message: ${msgParsed}`)
            
                // TODO: Handle the message, probably from the serverModel
                // const returnMessage = serverModel.handleMessage(msgParsed);
                // if(returnMessage) {
                //     listener.send(returnMessage);
                // }
            }
            catch(err)
            {
                logger.logError(`Messaging error: ${err}`)
            }
        });
        
        socket.on('close', (reason) => { listener.close(); });
    } catch (e) {
        logger.logError(e as string)
        socket.close(CLOSECODE_POLICY_VIOLATION);
        return;
    }
};