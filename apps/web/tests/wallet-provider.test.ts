import {test} from "node:test";
import assert from "node:assert/strict";
import {prepareEvmProvider} from "../src/wallet-provider";
import type {EIP1193Provider} from "@privy-io/react-auth";
const owner = "0x" + "2".repeat(40);

test("a React-stale embedded provider is configured on the requested chain before signing", async () => {
  let chain = 84532; const calls:string[] = [];
  const provider = {request:async ({method,params}:any) => {
    calls.push(method);
    if(method === "eth_chainId") return "0x" + chain.toString(16);
    if(method === "wallet_switchEthereumChain") {chain = Number(params[0].chainId);return null;}
    if(method === "eth_accounts") return [owner.toUpperCase()];
    throw new Error("Unexpected signing call");
  }} as EIP1193Provider;
  const result = await prepareEvmProvider({switchChain:async()=>{},getEthereumProvider:async()=>provider},owner,11155111);
  assert.equal(result,provider); assert.equal(chain,11155111);
  assert(calls.includes("wallet_switchEthereumChain"));assert(!calls.includes("eth_sendTransaction"));
});
test("network refusal and a substituted owner cannot reach wallet signing", async () => {
  for (const wrongOwner of [false,true]) {
    const provider = {request:async({method}:any)=>method === "eth_chainId" ? (wrongOwner?"0xaa36a7":"0x14a34") : method === "eth_accounts" ? ["0x"+"3".repeat(40)] : null} as EIP1193Provider;
    await assert.rejects(prepareEvmProvider({switchChain:async()=>{},getEthereumProvider:async()=>provider},owner,11155111));
  }
});
