const fingerprint=data=>JSON.stringify(Object.fromEntries(Object.keys(data).filter(k=>!['eventAck','protocolVersion','rulesVersion'].includes(k)).sort().map(k=>[k,data[k]])));
export class CommandLedger {
 constructor(){this.lastSequence=-1;this.receipts=new Map();}
 execute(data,operation){
  const result={type:'commandResult',command:data.type,requestId:data.requestId,commandSequence:data.commandSequence};
  const fail=(code,message)=>({...result,ok:false,code,message});
  if(!Number.isSafeInteger(data.commandSequence)||data.commandSequence<0||typeof data.requestId!=='string'||!/^[-\w]{1,64}$/.test(data.requestId))return fail('COMMAND_INVALID','操作编号无效');
  const key=fingerprint(data),previous=this.receipts.get(data.commandSequence);
  if(previous)return previous.key===key?previous.result:fail('COMMAND_CONFLICT','重复编号对应了不同操作');
  if(data.commandSequence<=this.lastSequence)return fail('COMMAND_EXPIRED','操作回执已过期，请同步当前状态');
  if(data.commandSequence!==this.lastSequence+1)return fail('COMMAND_ORDER','操作顺序不一致，请先确认之前的操作');
  let receipt;
  try{operation();receipt={...result,ok:true};}catch(e){receipt=fail(e.code??'REQUEST_REJECTED',e.message);}
  this.lastSequence=data.commandSequence;this.receipts.set(data.commandSequence,{key,result:receipt});
  if(this.receipts.size>128)this.receipts.delete(this.receipts.keys().next().value);
  return receipt;
 }
}
