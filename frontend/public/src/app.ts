import { attachButtonHandlers, bindInputBoxes,initializeState } from "./dom.client.js";
import { connectWebSocket } from "./socket.client.js";

const hostname=window.location.host;
//initialize state
initializeState();

//attach Handlers
document.addEventListener("DOMContentLoaded", () => {
  attachButtonHandlers();
  bindInputBoxes();
});

const websocketHost=hostname.split(':')[0]+':3000';
//connect with websocket 
connectWebSocket(websocketHost);