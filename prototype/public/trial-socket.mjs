// Deliberately separate from the production WebSocket transport.
export class TrialSocket {
  constructor(){
    this.readyState=0;
    this.worker=new Worker(new URL('./trial-worker.mjs',import.meta.url),{type:'module'});
    this.worker.onmessage=event=>{
      if(event.data.type==='worker-ready'){this.readyState=1;this.onopen?.();}
      else this.onmessage?.({data:JSON.stringify(event.data)});
    };
    this.worker.onerror=event=>{this.onerror?.(event);this.close();};
  }
  send(raw){if(this.readyState!==1)throw Error('试玩尚未就绪');this.worker.postMessage(JSON.parse(raw));}
  close(){if(this.readyState===3)return;this.readyState=3;this.worker.terminate();this.onclose?.();}
}
