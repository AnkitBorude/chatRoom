import {
  attachButtonHandlers,
  bindInputBoxes,
  initializeState,
} from "./dom.client.js";
import { connectWebSocket } from "./socket.client.js";

const hostname = window.location.host;

console.log("hostname");
//initialize state
initializeState();

//attach Handlers
document.addEventListener("DOMContentLoaded", () => {
  attachButtonHandlers();
  bindInputBoxes();
});

const websocketHost = hostname+"/ws";
//connect with websocket

console.log(websocketHost);
connectWebSocket(websocketHost);
