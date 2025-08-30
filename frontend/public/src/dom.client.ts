import {
  CLIENT_BANNED_CODE,
  MAX_MESSAGE_LENGTH,
  MAX_ROOM_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  ROOM_ID_MIN,
  ROOO_ID_MAX,
} from "@shared/const.js";
import {
  createRoom,
  leaveRoom,
  renameUser,
  sendMessage,
} from "./socket.client.js";
import { joinRoom } from "./socket.client.js";
import {
  currentState,
  oldState,
  incomingMessageEvent,
  trackPendingMessageACK,
  pendingMessages,
  clearPendingACKMessages,
} from "./state.js";
import {
  ButtonHandlerMap,
  ElementType,
  InputBoxTypes,
} from "./types.client.js";

import {
  CreateMessage,
  ChatMessage,
  ConnectionMessage,
  JoinMessage,
  LeaveMessage,
  RenameMessage,
  RoomNotificationMessage,
} from "@shared/message.type.js";
import { RequestType } from "@shared/request.enum.js";
const MESSAGE_BOX = document.getElementById("messageBox");
const USERNAME_INPUT_DIV: HTMLInputElement = document.getElementById(
  "usernameInputDiv",
) as HTMLInputElement;
const elementMap: Record<ElementType, HTMLElement | null> = {
  roomId: document.getElementById("roomId"),
  roomName: document.getElementById("roomName"),
  activeMember: document.getElementById("activeMember"),
  username: document.getElementById("username"),
  userId: document.getElementById("userId"),
};

const InputelementMap: Record<InputBoxTypes, HTMLInputElement | null> = {
  JOIN_ROOM_INPUT: document.getElementById(
    "join-roomId-input",
  ) as HTMLInputElement,
  CREATE_ROOM_INPUT: document.getElementById(
    "create-room-input",
  ) as HTMLInputElement,
  MESSAGE_INPUT: document.getElementById("message-input") as HTMLInputElement,
  USERNAME_INPUT: document.getElementById("username-input") as HTMLInputElement,
};
const buttonHandlerMap: ButtonHandlerMap = {
  joinRoomBtn: JoinRoombtnHandler,
  createRoomBtn: CreateRoombtnHandler,
  sendMessageBtn: SendMessagebtnHandler,
  updateUsernamebtn: RenamebtnHandler,
  leaveRoomBtn: LeaveRoombtnHandler,
};

let changeUsernameBtn: HTMLElement;
const notificationSound = new Audio("/assets/notification.mp3");
export function bindInputBoxes() {
  const isAllBinded = Object.values(InputelementMap).every((element) => {
    return element ? true : false;
  });

  if (!isAllBinded) {
    console.error(
      "Problem with inputBox Binding check correct ids is assigned",
    );
  }
}

export function appendRecievedMessageBubble(
  senderName: string,
  messageText: string,
) {
  if (!MESSAGE_BOX) {
    console.error("[appendMessageBubble] messageBox not found in DOM");
    return;
  }

  const time = new Date();
  const formattedTime = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const wrapper = document.createElement("div");
  wrapper.className =
    "flex flex-col w-full max-w-[450px] leading-1.5 ps-2 p-1 border-2 border-white/20 bg-transparent rounded-e-xl rounded-es-xl";

  wrapper.innerHTML = `
    <div class="flex items-center space-x-2">
      <span class="text-sm font-semibold text-white">${senderName}</span>
      <span class="text-sm font-normal text-gray-200">${formattedTime}</span>
    </div>
    <p class="text-sm font-normal text-white">${messageText}</p>
  `;
  wrapper.scrollIntoView();
  MESSAGE_BOX.appendChild(wrapper);
  MESSAGE_BOX.scrollTop = MESSAGE_BOX.scrollHeight;
  notificationSound.play();
}

export function appendOwnMessageBubble(messageText: string) {
  if (!MESSAGE_BOX) {
    console.error("[appendOwnMessageBubble] messageBox not found in DOM");
    return;
  }

  const time = new Date();
  const formattedTime = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const wrapper = document.createElement("div");
  wrapper.className =
    "flex flex-col w-full max-w-[400px] ps-2 p-1 leading-1.5 border-2 border-white/20 bg-transparent rounded-s-xl rounded-ee-xl self-end";

  wrapper.innerHTML = `
    <p class="text-sm font-normal text-white">${messageText}</p>
    <span class="text-sm font-normal text-gray-200 self-end pe-2">${formattedTime}</span>
  `;
  wrapper.focus();
  MESSAGE_BOX.appendChild(wrapper);
  wrapper.scrollIntoView({ behavior: "smooth" });
  MESSAGE_BOX.scrollTop = MESSAGE_BOX.scrollHeight;
}

export function appendInfoAlert(message: string) {
  const messageBox = document.getElementById("messageBox");
  if (!messageBox) {
    console.error("[appendInfoAlert] messageBox not found in DOM");
    return;
  }

  const time = new Date();
  const formattedTime = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const alertDiv = document.createElement("div");
  alertDiv.className =
    "p-2 text-sm rounded-lg text-white bg-white/10 backdrop-blur-lg border border-white/20 self-center font-semibold";
  alertDiv.setAttribute("role", "alert");

  alertDiv.innerHTML = `
    <span class="font-bold"></span> ${message}
    <span class="text-sm font-normal text-gray-300 pe-2">${formattedTime}</span>
  `;

  messageBox.appendChild(alertDiv);
  messageBox.scrollTop = messageBox.scrollHeight;
  notificationSound.volume=0.5;
  notificationSound.play();
  notificationSound.volume=1;
}

export function updateRoomDetailsElementValue(
  type: ElementType,
  value: string | number,
) {
  const el = elementMap[type];
  if (!el) {
    console.warn(`[updateElementValue] Element not found for type: ${type}`);
    return;
  }
  //update state
  currentState.set(type, value);

  el.textContent = value + "";

  // Animate using Tailwind utility classes
  el.classList.add(
    "transition",
    "duration-300",
    "ease-in-out",
    "scale-110",
    "opacity-0",
  );

  // Force reflow so animation restarts
  void el.offsetWidth;

  el.classList.remove("opacity-0");

  // Reset scale back after animation ends
  setTimeout(() => {
    el.classList.remove("scale-110");
  }, 300);
}

export function JoinRoombtnHandler() {
  const roomId: string | undefined = InputelementMap.JOIN_ROOM_INPUT?.value;
  if (!roomId) {
    alert("Please enter a room Id");
    return;
  }
  const sRoomId = +sanitizeNumber(roomId);
  if (sRoomId <= ROOM_ID_MIN || sRoomId >= ROOO_ID_MAX) {
    alert("Room Id should be between 1 to 1000");
    return;
  }
  const payload: Partial<JoinMessage> = {
    type: RequestType.JOIN,
    roomId: sRoomId,
  };
  joinRoom(payload);
  const inputBox = InputelementMap.JOIN_ROOM_INPUT;
  if (inputBox) {
    inputBox.value = "";
  }
}

export function CreateRoombtnHandler() {
  console.log("Create room button clicked");
  const roomName = InputelementMap!.CREATE_ROOM_INPUT?.value;
  if (!roomName) {
    alert("Please enter a Room Name");
    return;
  }
  const sRoomName = sanitizeText(roomName);
  if (sRoomName.length > MAX_ROOM_NAME_LENGTH) {
    alert("Room name cannot be greater than " + MAX_ROOM_NAME_LENGTH);
    return;
  }
  const payload: Partial<CreateMessage> = {
    type: RequestType.CREATE,
    roomName: sRoomName,
  };
  createRoom(payload);
  const inputBox = InputelementMap.CREATE_ROOM_INPUT;
  if (inputBox) {
    inputBox.value = "";
  }
}

export function SendMessagebtnHandler() {
  console.log("Send message button clicked");

  const message = InputelementMap.MESSAGE_INPUT?.value.trim();
  if (!message) {
    alert("Enter a message to send");
    return;
  }
  //message should not greter than 200Words

  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    alert(`Message could not be greter than ${MAX_MESSAGE_LENGTH} words`);
  }

  const randomMessageId = Math.round(Math.random() * 1000).toString();
  const sanitizedMessage = sanitizeText(message);
  const payload: Partial<ChatMessage> = {
    message: sanitizedMessage,
    type: RequestType.MESSAGE,
    id: randomMessageId,
  };
  //in case if no tracking required (bad practice ) then
  if (currentState.get("roomId") !== 0) {
    trackPendingMessageACK(randomMessageId, payload);
    //tracking the request if the room is joined otherwise do not
    //track this is temporary solution do not
  }

  sendMessage(payload);
  if (InputelementMap.MESSAGE_INPUT) {
    InputelementMap.MESSAGE_INPUT.value = "";
  }
}

export function RenamebtnHandler() {
  const btn = document.getElementById("updateUsernamebtn");

  if (btn && USERNAME_INPUT_DIV) {
    btn.classList.add("opacity-0", "invisible");
    btn.classList.add("hidden");

    USERNAME_INPUT_DIV.classList.remove("hidden");
    USERNAME_INPUT_DIV.classList.remove("opacity-0", "invisible");
    USERNAME_INPUT_DIV.classList.add("opacity-100", "visible");

    USERNAME_INPUT_DIV.focus();
  }
}

export function LeaveRoombtnHandler() {
  const roomId = currentState.get("roomId");
  if (!roomId || +roomId <= 0) {
    alert("You are not a part of any room");
    return;
  }
  const sRoomId = +sanitizeNumber(roomId + "");

  const payload: Partial<LeaveMessage> = {
    type: RequestType.LEAVE,
    roomId: sRoomId,
  };
  leaveRoom(payload);
  console.log(payload);
}

export function attachButtonHandlers() {
  Object.entries(buttonHandlerMap).forEach(([id, handler]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener("click", handler);

      if (id === "updateUsernamebtn") {
        changeUsernameBtn = btn;
      }
    } else {
      console.warn(`[attachButtonHandlers] Button with id '${id}' not found.`);
    }
  });
}

export function initializeState() {
  currentState.set("activeMember", 0);
  currentState.set("roomId", 0);
  currentState.set("roomName", "Not Joined any Room Yet");
  currentState.set("username", "Ananymous");
  currentState.set("userId", 0);
  runChangeDetectioninState();
}
incomingMessageEvent.addEventListener(
  RequestType.CREATE,
  withCustomDetail<CreateMessage>((message) => {
    appendInfoAlert(message.message ?? "");
    currentState.set("roomId", message.roomId ?? 0);
    currentState.set("roomName", message.roomName);
    runChangeDetectioninState();
  }),
);

incomingMessageEvent.addEventListener(
  RequestType.NOTIFY,
  withCustomDetail<RoomNotificationMessage>((message) => {
    if (message.notificationOf == RequestType.JOIN) {
      currentState.set(
        "activeMember",
        +(currentState.get("activeMember") ?? 0) + 1,
      );
      runChangeDetectioninState();
    } else if (message.notificationOf == RequestType.LEAVE) {
      currentState.set(
        "activeMember",
        +(currentState.get("activeMember") ?? 0) - 1,
      );
      runChangeDetectioninState();
    } else if (message.notificationOf == RequestType.MESSAGE) {
      //ack received for the message
      const messageId = message.additional?.messageId;
      if (messageId) {
        if (messageId !== "0" && messageId !== CLIENT_BANNED_CODE) {
          const metadata = pendingMessages.get(messageId);
          if (metadata) {
            clearTimeout(metadata.timeout);
            appendOwnMessageBubble(metadata.message.message ?? "No Message");
            pendingMessages.delete(messageId);
            return;
          }
          //this means the message id is received of a message which is been
          //retried multiple times and backoffed or duplicate ack recieved
        } else if (messageId === CLIENT_BANNED_CODE) {
          console.log(
            "Client removed from the server received cleaning pending list",
          );
          appendInfoAlert(message.message);
          clearPendingACKMessages();
        }

        //untracked message received which is already appended in UI
      }
      return;
    }

    appendInfoAlert(message.message);
  }),
);

incomingMessageEvent.addEventListener(
  RequestType.CONNECT,
  withCustomDetail<ConnectionMessage>((message) => {
    appendInfoAlert(message.message);
    currentState.set("username", message.username);
    currentState.set("userId", message.id);
    runChangeDetectioninState();
  }),
);

incomingMessageEvent.addEventListener(
  RequestType.JOIN,
  withCustomDetail<JoinMessage>((message) => {
    appendInfoAlert(message.message ?? "");
    if (Number(message.roomId) !== 404) {
      currentState.set("activeMember", message.activeUsers ?? 0);
      currentState.set("roomId", message.roomId);
      currentState.set("roomName", message.roomName ?? "NA");
      runChangeDetectioninState();
    }
  }),
);

incomingMessageEvent.addEventListener(
  RequestType.RENAME,
  withCustomDetail<RenameMessage>((message) => {
    appendInfoAlert(message.message ?? "");
    currentState.set("username", message.username);
    runChangeDetectioninState();
  }),
);

incomingMessageEvent.addEventListener(
  RequestType.LEAVE,
  withCustomDetail<LeaveMessage>((message) => {
    appendInfoAlert(message.message ?? "");
    currentState.set("roomId", 0);
    currentState.set("roomName", "Not Joined any Room Yet");
    currentState.set("activeMember", 0);
    runChangeDetectioninState();
  }),
);

incomingMessageEvent.addEventListener(
  RequestType.MESSAGE,
  withCustomDetail<ChatMessage>((message) => {
    appendRecievedMessageBubble(message.sender ?? "Anonymous", message.message);
  }),
);
function runChangeDetectioninState() {
  currentState.forEach((value, key) => {
    if (oldState.get(key) !== value || !oldState.get(key)) {
      oldState.set(key, value);
      updateRoomDetailsElementValue(key, value);
    }
  });
}

function withCustomDetail<T>(
  callback: (detail: T) => void,
): (event: Event) => void {
  return (event: Event) => {
    const customEvent = event as CustomEvent<T>;
    callback(customEvent.detail);
  };
}

function sanitizeText(input: string): string {
  const temp = document.createElement("div");
  temp.textContent = input;
  return temp.innerHTML.trim(); // Escaped HTML (prevents XSS)
}

function sanitizeNumber(input: string): string {
  return input.replace(/[^\d]/g, "");
}

//adding enter button event on change username
USERNAME_INPUT_DIV.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const userName = InputelementMap!.USERNAME_INPUT?.value;
    if (!userName) {
      console.log("No username");
    } else {
      const susername = sanitizeText(userName);
      if (susername.length > MAX_USERNAME_LENGTH) {
        alert("New Username cannot be greater than " + MAX_USERNAME_LENGTH);
      } else {
        const payload: Partial<RenameMessage> = {
          type: RequestType.RENAME,
          username: susername,
        };
        renameUser(payload);
        console.log(payload);
      }
    }
    USERNAME_INPUT_DIV.classList.add("opacity-0", "invisible");
    USERNAME_INPUT_DIV.classList.remove("opacity-100", "visible");
    USERNAME_INPUT_DIV.classList.add("hidden");

    changeUsernameBtn.classList.remove("hidden");
    changeUsernameBtn.classList.remove("opacity-0", "invisible");
    changeUsernameBtn.classList.add("opacity-100", "visible");
  }
});
InputelementMap.CREATE_ROOM_INPUT?.addEventListener("keydown", (e) => {
  if (e.key == "Enter") {
    CreateRoombtnHandler();
  }
});

InputelementMap.JOIN_ROOM_INPUT?.addEventListener("keydown", (e) => {
  if (e.key == "Enter") {
    JoinRoombtnHandler();
  }
});

InputelementMap.MESSAGE_INPUT?.addEventListener("keydown", (e) => {
  if (e.key == "Enter") {
    SendMessagebtnHandler();
  }
});
