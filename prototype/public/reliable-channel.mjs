export class ReliableCommands {
 constructor(transmit,idFactory){this.transmit=transmit;this.idFactory=idFactory;this.reset();}
 reset(){this.next=0;this.pending=[];this.available=false;}
 enqueue(data){if(this.pending.length>=32)return false;this.pending.push({...data,commandSequence:this.next++,requestId:this.idFactory()});this.flush();return true;}
 synchronize(lastSequence,{resume=false}={}){if(!resume){this.pending=[];this.next=lastSequence+1;}else this.next=Math.max(this.next,lastSequence+1);this.available=true;this.flush();}
 flush(){if(this.available&&this.pending.length)this.transmit(this.pending[0]);}
 receive(result){const first=this.pending[0];if(!first||result.requestId!==first.requestId||result.commandSequence!==first.commandSequence)return false;this.pending.shift();this.flush();return true;}
 suspend(){this.available=false;}
}
export function consumeEvents(state,cursor,handler){
 let next=cursor;
 if(state.eventGap&&next<state.eventBase-1)next=state.eventBase-1;
 for(const event of state.events){if(event.id<=next)continue;if(event.id!==next+1)break;handler(event);next=event.id;}
 return next;
}
