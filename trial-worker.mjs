import {LocalTrial} from './local-trial.mjs';
import {SIMULATION_HZ,SNAPSHOT_HZ} from './shared/protocol.mjs';
const trial=new LocalTrial(data=>postMessage(data));
onmessage=event=>trial.receive(event.data);
setInterval(()=>trial.step(),1000/SIMULATION_HZ);
setInterval(()=>trial.broadcast(),1000/SNAPSHOT_HZ);
postMessage({type:'worker-ready'});
