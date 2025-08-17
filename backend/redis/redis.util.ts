export class RedisUtil {
  private readonly CLIENT_KEY_INITIALIZER = "client:<id>";
  private readonly ROOM_KEY_INITIALIZER = "room:<id>";
  private readonly CHAT_ROOM_SET_KEY_INIT = "room:<id>:client";
  private readonly SERVER_SET_KEY="server:<id>";

  constructor() {}

  public getClientkey(key: number) {
    return this.CLIENT_KEY_INITIALIZER.replace("<id>", key.toString());
  }

  public getRoomkey(key: number) {
    return this.ROOM_KEY_INITIALIZER.replace("<id>", key.toString());
  }

  public getChatRoomKey(key: number) {
    return this.CHAT_ROOM_SET_KEY_INIT.replace("<id>", key.toString());
  }
  public getServerSetKey(key:string)
  {
    return this.SERVER_SET_KEY.replace("<id>",key);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public stringifyObject(obj: Record<string, any>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, String(v)]),
    );
  }
}
