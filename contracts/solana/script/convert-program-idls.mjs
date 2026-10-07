import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const index=process.argv.indexOf('--tooling-dir');
const tooling=index<0?'.local/metadata-tooling':process.argv[index+1];
assert(tooling,'Provide a directory containing the pinned Codama tooling');
const require=createRequire(resolve(tooling,'package.json'));
const {rootNodeFromAnchor}=require('@codama/nodes-from-anchor');
const {createFromRoot}=require('codama');
for(const [name,program] of [
  ['nabungfi_multi','FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn'],
  ['nabungfi_multi_lz','G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d'],
]){
  const idl=JSON.parse(readFileSync(`contracts/solana/idl/${name}.json`,'utf8'));
  assert.equal(idl.address,program);
  for(const instruction of idl.instructions){
    const discriminator=createHash('sha256').update(`global:${instruction.name}`).digest().subarray(0,8);
    assert(Buffer.from(instruction.discriminator).equals(discriminator),instruction.name);
  }
  const output=`contracts/solana/idl/${name}.codama.json`;
  writeFileSync(output,createFromRoot(rootNodeFromAnchor(idl)).getJson()+'\n');
  console.log(`Converted ${name}: ${idl.instructions.length} instructions`);
}
