

export class RedisUtil{
    private CLIENT_KEY_INITIALIZER = "client:<id>";

    constructor()
    {

    }

    public getClientkey(key: number) {
    return this.CLIENT_KEY_INITIALIZER.replace("<id>", key.toString());
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public stringifyObject(obj:Record<string,any>):Record<string,string>{
        return Object.fromEntries(
      Object.entries(obj).map(([k,v])=>[k, String(v)])
        );
    }
}