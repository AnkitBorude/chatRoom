
import { sendMessage } from "./socket.client.js";
import { ElementType,ChatMessage} from "./types.client.js";

export type messagePending={
    message:ChatMessage,
    timeout:NodeJS.Timeout,
    retry:number
}

export const incomingMessageEvent=new EventTarget();
export const oldState:Map<ElementType,string | number>=new Map();
export const currentState:Map<ElementType,string | number>=new Map();
export const pendingMessages:Map<string,messagePending>=new Map();

export function retryMessage(id:string,message:ChatMessage)
{
    sendMessage(message);
    const pedingMessageMetadata=pendingMessages.get(id);
    if(!pedingMessageMetadata){console.log("Message sent already no metadat found");return;}

    if(pedingMessageMetadata.retry<=0)
    {
        console.log("Cancelling message sending retried 5 times");
        clearTimeout(pedingMessageMetadata.timeout);
        pendingMessages.delete(id);
        return;
    }
    console.log("Retrying message sending "+id +" time "+pedingMessageMetadata.retry);

    pendingMessages.set(id,{
        message,
        retry:pedingMessageMetadata.retry-1,
        timeout:setTimeout(()=>{
            retryMessage(id,message);
        },5000)
    })
    sendMessage(message);
}
export function clearPendingACKMessages()
{
    for(const [key,value] of pendingMessages)
    {
        clearTimeout(value.timeout);
        pendingMessages.delete(key);
    }
}
export function trackPendingMessageACK(id:string,message:ChatMessage)
{
    const metadata:messagePending={
        message,
        retry:5,
        timeout:setTimeout(()=>{
            retryMessage(id,message);
        },5000)
    }
    pendingMessages.set(id,metadata);
}