import { snapshot } from './simulation.mjs';
export function acknowledgeEvents(session,ack){
 if(Number.isSafeInteger(ack)&&ack>=session.eventAck&&ack<=session.eventSent)session.eventAck=ack;
}
export function deliverySnapshot(room,session){
 const base=room.eventJournal[0]?.id??room.eventId+1;
 const events=room.eventJournal.filter(e=>e.id>session.eventAck).slice(0,64);
 session.eventSent=Math.max(session.eventSent,events.at(-1)?.id??session.eventAck);
 return {...snapshot(room),events,eventAck:session.eventAck,eventBase:base,eventHead:room.eventId,eventGap:session.eventAck<base-1};
}
