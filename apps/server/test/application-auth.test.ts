import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {verifyAccessToken} from '@privy-io/node';
import {authoritativeWallets,requireGoalWallets,privyAuthentication} from '../src/auth.js';
import {loadAppConfig} from '../src/config.js';
import {parseGoalTarget} from '@nabungfi/shared/application';
import {migrationChecksum} from '../src/database.js';

test('Privy SDK verifies actual ES256 signatures and rejects wrong issuer/audience/expiry/key',async()=>{
 const key=await generateKeyPair('ES256'),other=await generateKeyPair('ES256');
 const now=Math.floor(Date.now()/1000);
 const sign=(claims:Record<string,unknown>={})=>new SignJWT({sid:'session',sub:'did:privy:verified',iss:'privy.io',aud:'test-app',iat:now,exp:now+300,...claims}).setProtectedHeader({alg:'ES256',typ:'JWT'}).sign(key.privateKey);
 const verify=async(token:string,pub=key.publicKey)=>verifyAccessToken({access_token:token,app_id:'test-app',verification_key:pub});
 assert.equal((await verify(await sign())).user_id,'did:privy:verified');
 for(const claims of [{iss:'attacker'},{aud:'other-app'},{exp:now-120},{sid:null},{sub:null},{iat:null}])await assert.rejects(()=>sign(claims).then(token=>verify(token)));
 await assert.rejects(()=>sign().then(token=>verify(token,other.publicKey)));
 const token=await sign();await assert.rejects(()=>verify(token.slice(0,-8)+'abcdefgh'));
});
test('authentication fails closed for absent and malformed bearer tokens without network calls',async()=>{
 const auth=privyAuthentication('test-app','test-secret');
 for(const value of [undefined,'','Bearer fake','Basic abc','Bearer a.b.c\n'])await assert.rejects(()=>auth.authenticate(value),{code:'UNAUTHENTICATED'});
});
test('goal owners must be authoritative linked wallets, not arbitrary request addresses',()=>{
 const sol='AMoZFFdhUaNq8qyVRE4RrdW7rBc5Jssc6b7MyERMB7s8',evm='0xc82f469Aa95a2f7792300c8d11230e9023A98600';
 const wallets=authoritativeWallets({id:'did:privy:a',linked_accounts:[{type:'wallet',chain_type:'solana',address:sol},{type:'wallet',chain_type:'ethereum',address:evm},{type:'email',chain_type:'ethereum',address:'0x'+'1'.repeat(40)},{type:'wallet',chain_type:'ethereum',address:'0x'+'0'.repeat(40)},{type:'wallet',chain_type:'solana',address:'invalid'},{type:'wallet',chain_type:'ethereum',address:evm.toLowerCase()}]});
 assert.equal(wallets.length,2);requireGoalWallets({subject:'did:privy:a',wallets},{solana:sol,evm});
 assert.throws(()=>requireGoalWallets({subject:'did:privy:a',wallets},{solana:sol,evm:'0x'+'1'.repeat(40)}),{code:'WALLET_OWNERSHIP_REQUIRED'});
});
test('targets use exact six-decimal raw units with u64 ceiling',()=>{
 assert.equal(parseGoalTarget('10000.000001'),'10000000001');assert.equal(parseGoalTarget('18446744073709.551615'),'18446744073709551615');
 for(const v of [0,10,'0','0.000000','1e3','1.0000001','-1','01','18446744073709.551616'])assert.throws(()=>parseGoalTarget(v));
});
test('production requires explicit HTTPS origins and credential-bearing Neon settings stay server-side',()=>{
 const values={PRIVY_APP_ID:'app',PRIVY_APP_SECRET:'secret',DATABASE_URL:'postgresql://test:test@ep-test.neon.tech/test?sslmode=require'};
 assert.ok(loadAppConfig(values).origins.includes('http://127.0.0.1:4173'));
 assert.throws(()=>loadAppConfig({...values,NODE_ENV:'production'}));
 assert.deepEqual(loadAppConfig({...values,NODE_ENV:'production',NABUNGFI_WEB_ORIGIN:'https://app.example.com'}).origins,['https://app.example.com']);
 assert.equal(loadAppConfig({...values,NODE_ENV:'production',NABUNGFI_WEB_ORIGIN:'https://app.example.com',PORT:'8080',NABUNGFI_API_PORT:'3001'}).port,8080);
 assert.throws(()=>loadAppConfig({...values,DATABASE_URL:'postgresql://localhost/test'}));
 try{loadAppConfig({...values,DATABASE_URL:'malformed-PRIVATE-CREDENTIAL'});assert.fail('Malformed URL accepted');}catch(error){assert.ok(error instanceof Error);assert.equal(error.message.includes('PRIVATE-CREDENTIAL'),false);assert.equal('input' in error,false);}
});
test('migration checksums agree across LF/CRLF fresh checkouts while detecting SQL changes',()=>{
 const sql='CREATE TABLE test (id integer);\nSELECT 1;\n';assert.equal(migrationChecksum(sql),migrationChecksum(sql.replace(/\n/g,'\r\n')));assert.notEqual(migrationChecksum(sql),migrationChecksum(sql+'SELECT 2;\n'));
});
