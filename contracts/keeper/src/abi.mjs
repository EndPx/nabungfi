import{createRequire}from'node:module';
const require=createRequire(new URL('../../solana/package.json',import.meta.url));const{keccak_256}=require('@noble/hashes/sha3.js');
export const keccak=hex=>`0x${Buffer.from(keccak_256(Buffer.from(hex.replace(/^0x/,''),'hex'))).toString('hex')}`;
export const selector=name=>`0x${Buffer.from(keccak_256(Buffer.from(name))).subarray(0,4).toString('hex')}`;
export const word=n=>BigInt(n).toString(16).padStart(64,'0');
export const addressWord=a=>a.replace(/^0x/,'').toLowerCase().padStart(64,'0');
export function bytesCall(name,address,sequence,options){const raw=options.replace(/^0x/,''),length=raw.length/2,head=sequence===undefined?[addressWord(address),word(64)]:[addressWord(address),word(sequence),word(96)];return`${selector(name)}${head.join('')}${word(length)}${raw.padEnd(Math.ceil(length/32)*64,'0')}`;}
export const solReceiveOptions=(compute,value)=>{const gas=word(compute).slice(-32),lamports=word(value).slice(-32);return`0x000301002101${gas}${lamports}`;};
export const evmReceiveOptions=gas=>Buffer.from(`000301001101${word(gas).slice(-32)}`,'hex');
