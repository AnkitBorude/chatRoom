import { appendInfoAlert } from "./dom.client.js";
import {
  BaseMessage,
  CreateMessage,
  JoinMessage,
  LeaveMessage,
  RenameMessage,
  ChatMessage,
} from "./types.client.js";
import { incomingMessageEvent } from "./state.js";

let socket: WebSocket;

export function connectWebSocket(hostname: string): WebSocket {
  try {
    socket = new WebSocket("ws://" + hostname);
  } catch (error) {
    console.log(error);
    appendInfoAlert((error as Error).message);
  }
  socket.addEventListener("open", () => {
    console.log("[Socket] Connected!");
  });
  socket.addEventListener("message", (event) => {
    incomingMessageHandler(event.data);
  });

  socket.addEventListener("close", () => {
    console.log("[Socket] Disconnected");
  });

  socket.addEventListener("error", (event) => {
    console.log("[Socket] Message:", event);
  });

  socket.onerror = (err) => console.error("Error:", err);

  return socket;
}

export function createRoom(payload: CreateMessage) {
  if (isSocketOpen()) {
    //Send message to server
    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      appendInfoAlert("Problem while creating room client side error");
      console.log(error);
    }
    return;
  }

  appendInfoAlert("Problem during connection : SOCKET CLOSED");
}

export function renameUser(payload: RenameMessage) {
  if (isSocketOpen()) {
    //Send message to server
    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      appendInfoAlert("Problem while modifying usernmae : client side error");
      console.log(error);
    }
    return;
  }
  appendInfoAlert("Problem during connection : SOCKET CLOSED");
}

export function joinRoom(payload: JoinMessage) {
  if (isSocketOpen()) {
    //Send message to server
    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      appendInfoAlert("Problem while joining room client side error");
      console.log(error);
    }
    return;
  }
  appendInfoAlert("Problem during connection : SOCKET CLOSED");
}

export function leaveRoom(payload: LeaveMessage) {
  if (isSocketOpen()) {
    //Send message to server
    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      appendInfoAlert("Problem while leaving the room client side error");
      console.log(error);
    }
    return;
  }
  appendInfoAlert("Problem during connection : SOCKET CLOSED");
}

export function sendMessage(payload: ChatMessage) {
  if (isSocketOpen()) {
    //Send message to server
    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      appendInfoAlert("Problem while sending message");
      console.log(error);
    }
    return;
  }
  appendInfoAlert("Problem during connection : SOCKET CLOSED");
}
function isSocketOpen(): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn(`Socket is not open or connected`);
    //Implement retrying logic here (setTimeout)
    return false;
  }
  return true;
}

function incomingMessageHandler(message: string) {
  let messageObject: BaseMessage;
  try {
    messageObject = JSON.parse(message);
  } catch (error) {
    console.error("Invalid JSON STRING" + error);
    return;
  }
  incomingMessageEvent.dispatchEvent(
    new CustomEvent<BaseMessage>(messageObject.type, { detail: messageObject }),
  );
}
