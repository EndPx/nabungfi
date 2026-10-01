import {createServer} from 'node:http';
import {installShutdownHandlers} from '../../src/server-runtime.js';
const server=createServer((_req,res)=>{res.writeHead(200);res.write('active');});
installShutdownHandlers(server,async()=>{const connections=await new Promise<number>((done,fail)=>server.getConnections((error,n)=>error?fail(error):done(n)));console.log(JSON.stringify({cleaned:true,connections}));},180);
// Windows does not deliver POSIX SIGTERM to Node; exercise the exact registered handler through IPC.
process.on('message',message=>{if(message==='test-sigterm')process.emit('SIGTERM');});
server.listen(0,'127.0.0.1',()=>{const address=server.address();if(address&&typeof address!=='string')process.send?.({port:address.port});});
