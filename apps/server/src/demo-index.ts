import {resolve} from 'node:path';
import {DemoStore} from './store.js';
import {demoServer} from './server.js';
const portFlag=process.argv.indexOf('--port');
const port=Number(portFlag>=0?process.argv[portFlag+1]:(process.env.NABUNGFI_DEMO_PORT??3002));
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid demo port');
const store=await DemoStore.open(process.env.NABUNGFI_DEMO_STATE??resolve(import.meta.dirname,'../../../.local/demo-state.json'));
demoServer(store).listen(port,'127.0.0.1',()=>console.log('NabungFi explicitly separate local-demo API (sample funds).'));
