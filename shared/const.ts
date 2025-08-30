//COMMON CODES
export const ROOO_ID_MAX = 99999;
export const ROOM_ID_MIN = 10000;

//This code is communicated to client when its been removed by admin, thus
//client frontend can reset its retry mechanism and cleanup
export const CLIENT_BANNED_CODE = "101010";

//FRONTEND
export const MAX_ROOM_NAME_LENGTH = 16;
export const MAX_MESSAGE_LENGTH = 200;
export const MAX_USERNAME_LENGTH = 16;

export const MAX_MESSAGE_RETRY = 5;
export const MESSAGE_RETRY_INTERVAL_SEC = 5;

//BACKEND

export const CLIENT_ID_MIN = 10000;
export const CLIENT_ID_MAX = 99999;
//MAX TTL FOR REDIS TO PERSIST CLIENT METADATA
export const CLIENT_REDIS_TTL_SEC = 3600;
//MAX TTL FOR REDIS TO PERSIST ROOM METADATA
export const ROOM_REDIS_TTL_SEC = 4000;

//REDIS

export const MAX_REDIS_HEARTBEAT_RETRY = 5;
export const MAX_REDIS_HEARTBEAT_INTERVAL_SEC = 5;
export const SERVER_STAT_REDIS_TTL_SEC = 3600;
export const SERVER_STAT_UPDATE_INTERVAL_SEC = 30;

// GLOBAL RATE LIMIT

export const MAX_REQUEST_WITHIN_1_MIN = 20;
