import { RestHelper } from "helpers/RestHelper";
import { action, makeObservable, observable } from "mobx";

interface PingResponse {
    errorMessage?: string;
    data?: {version: string, uptime_days: number}
}

// -------------------------------------------------------------------
// The AppModel
// -------------------------------------------------------------------
export class AppModel {
    @observable pingResult: string

    private _api = new RestHelper("/api/");

    // -------------------------------------------------------------------
    // ctor 
    // -------------------------------------------------------------------
    constructor()
    {
        makeObservable(this);
    }

    // -------------------------------------------------------------------
    // ping 
    // -------------------------------------------------------------------
    async ping() {
        const response = await this._api.restGet<PingResponse>("ping");

        action(() => {
            if(response?.data) {
                this.pingResult = `Server at v${response.data.version}, uptime ${response.data.uptime_days.toFixed(5)} days`
            }
        })()
    }

}

