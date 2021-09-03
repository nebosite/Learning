import fetch from 'cross-fetch';

// -------------------------------------------------------------------
// Interface for storing locally somehow
// -------------------------------------------------------------------
export interface ILocalStorage {
    loadObject: <T>(key: string) => Promise<T | null>;
    saveObject: (key: string, saveMe: object) => Promise<void>;
    removeObject: (key: string) => Promise<void>;
    clear: () => Promise<void>;
};

//------------------------------------------------------------------------------
// HttpResponse definition
//------------------------------------------------------------------------------
interface HttpResponse
{
    status: number;
    statusText: string;
    headers: any;
    url: string;
    text: () => Promise<string>
}

//------------------------------------------------------------------------------
// RestHelper interface - useful for testing
//------------------------------------------------------------------------------
export interface IRestHelper
{
    apiRoot: string;
    addHeader: (name: string, value:string) => void;
    restGet: <T>(query: string, shouldCache?: boolean) => Promise<T | null>;
    restGetText: (query: string, shouldCache?: boolean) => Promise<string | null>;
    restPost: <T>(query: string, jsonBody:string) => Promise<T | null>;
    removeFromCache: (query: string) => Promise<void>;
}

//------------------------------------------------------------------------------
// Class to assist with REST calling
//------------------------------------------------------------------------------
export class RestHelper implements IRestHelper
{
    _headers: string[][] = [];
    apiRoot: string;
    _cache: ILocalStorage | undefined;

    // Prefix all http requests with this prefix text
    _callPrefix: string | undefined;

    //------------------------------------------------------------------------------
    // helper for rest calls
    //
    // callPrefix is used to append special text to the beginning of all request urls.
    // this is helpful for servers that use prefix text to reroute calls
    //------------------------------------------------------------------------------
    constructor(apiRoot: string, cache?: ILocalStorage, callPrefix: string = "")
    {
        this._cache = cache;
        this.apiRoot = apiRoot
        this._callPrefix = callPrefix;
        this.addHeader("Content-Type", "application/json")
    }

    //------------------------------------------------------------------------------
    // Add a header to use on all of the calls
    //------------------------------------------------------------------------------
    addHeader(name: string, value:string)
    {
        this._headers.push([name, value]);
    }

    //------------------------------------------------------------------------------
    // Attempt a json conversions and throw useful text if there is an error
    //------------------------------------------------------------------------------
    jsonConvert<T>(query:string, jsonBody: string)
    {
        try{ 
            const parsed = JSON.parse(jsonBody);
            return (parsed as T)
        }
        catch(err)
        {
            if(this._cache)
            {
                this._cache.removeObject(query);
            }
            console.log(`Non-Json body returned on ${this.apiRoot}${query}\nResponse: ${jsonBody}\nStack:\n${(err as any).stack}` ) ;
            return {} as T;
        }
    }

    //------------------------------------------------------------------------------
    // Get an object
    //------------------------------------------------------------------------------
    async restGet<T>(query: string, shouldCache: boolean = true): Promise<T | null> {
        const jsonReturn = await this.restCall("GET", query, undefined, shouldCache);
        if(jsonReturn) return this.jsonConvert<T>(query, jsonReturn);
        else return null; 
    }

    //------------------------------------------------------------------------------
    // PUT command
    //------------------------------------------------------------------------------
    async restPut(query: string, jsonBody: string = undefined) {
        return this.restCall("PUT", query, jsonBody, false);
    }

    //------------------------------------------------------------------------------
    // get a string
    //------------------------------------------------------------------------------
    async restGetText(query: string, shouldCache: boolean = true): Promise<string | null> {
        return await this.restCall("GET", query, undefined, shouldCache);
    }

    //------------------------------------------------------------------------------
    // helper for rest calls
    //------------------------------------------------------------------------------
    async restPost<T>(query: string, jsonBody:string): Promise<T | null> {
        const jsonReturn = await this.restCall("POST", query, jsonBody, false);
        if(jsonReturn) return this.jsonConvert<T>(query, jsonReturn);
        else return null; 
    }
    
    //------------------------------------------------------------------------------
    // helper for rest calls
    // returns null on 404
    //------------------------------------------------------------------------------
    async restCall(method: string, query: string, jsonBody:string | undefined, shouldCache: boolean): Promise<string | null> {
        const url = `${this._callPrefix ?? ""}${this.apiRoot}${query}`;
        //console.log("URL: " + url);

        if(shouldCache && method === "GET" && this._cache)
        {
            const cachedString = await this._cache.loadObject<{data: string}>(query);
            if(cachedString) return cachedString.data;
        }
        if(!shouldCache && this._cache) {
            this._cache.removeObject(query);
        }

        const request = { method: method, body: jsonBody, headers: this._headers };

        //console.log("REQUEST: " + JSON.stringify(request));

        return fetch(url, request)
            .then(async(response: HttpResponse) => {
                if(response.status === 301)
                {
                    throw new Error(`Got a 301 error.  The requesting URL (${url}) is wrong.  it should be: ${response.headers["location"]}`)
                } 

                if(response.status === 404) // Not found
                {
                    return null;
                }

                if(response.status === 204) // no content
                {
                    return null;
                }
                
                if(response.status === 200 // OK
                    || response.status === 410  // Gone or empty.  for JSON replies, this means "{}"
                    )
                {
                    const text = await response.text();
                    if(shouldCache && method === "GET" && this._cache) {
                        this._cache.saveObject(query, {data: text});
                    }
                    return text;
                }
                else {
                    throw Error(`Unexpected response: ${response.status}: ${await response.text()}`)
                } 
            })
            .catch((error: any) => {
                throw Error(`Error on URL: ${url}\n: ${error}`)
            });
    }

    //------------------------------------------------------------------------------
    // remove the item from the cache if it is there
    //------------------------------------------------------------------------------
    async removeFromCache (query: string) 
    {
        return this._cache?.removeObject(query);
    }
}