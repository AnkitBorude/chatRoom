
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface clientType extends Record<string,any>{
    id:number,
    name:string,
    createdAt:Date,
    roomId:number
}