import { PublicKey, TransactionMessage, VersionedTransaction, type MessageV0 } from '@solana/web3.js';
import { decodeFunctionData, decodeEventLog, encodeFunctionData, parseAbi, type Hex } from 'viem';
import { ChainValidationError, type ChainPlan } from '@nabungfi/shared/chain';
import type { RpcTransport } from './rpc.js';
import type { EvmReceipt, EvmTransaction } from './receipt.js';

export const ENTRY_POINT = '0x0000000071727de22e5e9d8baf0edac6f37da032';
const DELEGATES = new Set(['0x77021100bd87b7008e5e1989d0eb38555d0d0000', '0x69007702764179f14f51cdce752f4f775d74e139']);
export const USER_OP_TUPLE = '(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)';
export const ENTRY_ABI = parseAbi([
  `function handleOps(${USER_OP_TUPLE}[] ops,address beneficiary)`,
  `function getUserOpHash(${USER_OP_TUPLE} userOp) view returns (bytes32)`,
  'event UserOperationEvent(bytes32 indexed userOpHash,address indexed sender,address indexed paymaster,uint256 nonce,bool success,uint256 actualGasCost,uint256 actualGasUsed)',
  'event BeforeExecution()',
]);
export const ACCOUNT_ABI = parseAbi([
  'function execute(address target,uint256 value,bytes data)',
  'function executeBatch((address target,uint256 value,bytes data)[] calls)',
  `function executeUserOp(${USER_OP_TUPLE} userOp,bytes32 userOpHash)`,
]);
function bad(): never { throw new ChainValidationError('TRANSACTION_SUBSTITUTION', 'The sponsored operation does not prove this exact owner action.'); }

/** ERC-4337 v0.7 + Alchemy's canonical 7702 account. Unsupported envelopes fail closed.
 * Sources: eth-infinitism/account-abstraction v0.7.0; alchemyplatform/modular-account v2.0.2. */
export async function sponsoredEvmReceipt(rpc: RpcTransport, plan: ChainPlan, tx: EvmTransaction, receipt: EvmReceipt): Promise<{receipt:EvmReceipt;userOperationHash:string;success:boolean}> {
  if (plan.gasPayment !== 'privy-testnet' || plan.transaction.kind !== 'evm' || plan.network === 'solana'
    || tx.to?.toLowerCase() !== ENTRY_POINT || BigInt(tx.value) !== 0n || tx.chainId === undefined || BigInt(tx.chainId) !== BigInt(plan.transaction.chainId)
    || receipt.status !== '0x1' || receipt.logs.some(log => log.removed)) bad();
  const code = (await rpc.call<string>(plan.network, 'eth_getCode', [plan.owner, receipt.blockNumber])).toLowerCase();
  if (!code.startsWith('0xef0100') || code.length !== 48 || !DELEGATES.has('0x' + code.slice(8))) bad();
  const decoded = decodeFunctionData({abi:ENTRY_ABI,data:tx.input as Hex});
  if (decoded.functionName !== 'handleOps' || encodeFunctionData({abi:ENTRY_ABI,...decoded}).toLowerCase() !== tx.input.toLowerCase()) bad();
  const ops = decoded.args[0];
  const matches = ops.filter(op => op.sender.toLowerCase() === plan.owner.toLowerCase());
  if (matches.length !== 1) bad();
  const op = matches[0]!;
  if (op.initCode !== '0x' || op.signature === '0x' || op.paymasterAndData.length < 106 || BigInt(op.paymasterAndData.slice(0,42)) === 0n) bad();
  // executeUserOp is a four-byte prefix followed by the inner execute/executeBatch calldata, not an ABI tuple here.
  const prefix = encodeFunctionData({abi:ACCOUNT_ABI,functionName:'executeUserOp',args:[op,'0x'+'0'.repeat(64) as Hex]}).slice(0,10);
  const data = (op.callData.slice(0,10).toLowerCase() === prefix.toLowerCase() ? '0x' + op.callData.slice(10) : op.callData) as Hex;
  const execution = decodeFunctionData({abi:ACCOUNT_ABI,data});
  if (execution.functionName === 'executeUserOp' || encodeFunctionData({abi:ACCOUNT_ABI,...execution}).toLowerCase() !== data.toLowerCase()) bad();
  const calls = execution.functionName === 'execute' ? [{target:execution.args[0],value:execution.args[1],data:execution.args[2]}] : execution.args[0];
  const call = calls[0];
  if (calls.length !== 1 || !call || call.target.toLowerCase() !== plan.transaction.to.toLowerCase() || call.value !== BigInt(plan.transaction.value) || call.data.toLowerCase() !== plan.transaction.data.toLowerCase()) bad();
  const userOperationHash = (await rpc.call<string>(plan.network, 'eth_call', [{to:ENTRY_POINT,data:encodeFunctionData({abi:ENTRY_ABI,functionName:'getUserOpHash',args:[op]})},receipt.blockNumber])).toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(userOperationHash)) bad();
  // Validation logs precede BeforeExecution; only this operation's execution/postOp logs can prove its effects.
  let start = -1, found: {end:number;success:boolean} | undefined, events = 0;
  let returnSegment: EvmReceipt['logs'] = [];
  for (let i=0;i<receipt.logs.length;i++) {
    const log = receipt.logs[i]!;
    if (log.address.toLowerCase() !== ENTRY_POINT) continue;
    let event; try { event = decodeEventLog({abi:ENTRY_ABI,data:log.data as Hex,topics:log.topics as [Hex,...Hex[]],strict:true}); } catch { continue; }
    if (event.eventName === 'BeforeExecution') { if (start !== -1) bad(); start=i; }
    if (event.eventName === 'UserOperationEvent') {
      if (start < 0) bad(); events++;
      if (event.args.userOpHash.toLowerCase() === userOperationHash) {
        if (found || event.args.sender.toLowerCase() !== plan.owner.toLowerCase() || event.args.nonce !== op.nonce || event.args.paymaster.toLowerCase() !== op.paymasterAndData.slice(0,42).toLowerCase()) bad();
        found={end:i,success:event.args.success};
        // Snapshot the segment now; later operations must not enlarge it.
        returnSegment = receipt.logs.slice(start+1,i);
      }
      start=i;
    }
  }
  if (!found || events !== ops.length) bad();
  return {receipt:{...receipt,logs:returnSegment},userOperationHash,success:found.success};
  // Assigned only when the unique matching canonical event is encountered.
}

/** Recompile the same instruction/account permissions with only a replacement payer and blockhash.
 * Extra instructions, altered owner signer, lookup tables, amounts and recipients are rejected. */
export function assertSponsoredSolanaMessage(plan: ChainPlan, actual: MessageV0): void {
  if (plan.gasPayment !== 'privy-testnet' || plan.transaction.kind !== 'solana' || actual.addressTableLookups.length) bad();
  const original = VersionedTransaction.deserialize(Buffer.from(plan.transaction.base64,'base64'));
  const payer = actual.staticAccountKeys[0];
  if (!payer || payer.toBase58() === plan.owner || !actual.isAccountSigner(0)) bad();
  const decompiled = TransactionMessage.decompile(original.message);
  const expected = new TransactionMessage({payerKey:payer,recentBlockhash:actual.recentBlockhash,instructions:decompiled.instructions}).compileToV0Message();
  const ownerIndex = actual.staticAccountKeys.findIndex(key => key.equals(new PublicKey(plan.owner)));
  if (ownerIndex < 0 || !actual.isAccountSigner(ownerIndex)) bad();
  if (Buffer.from(expected.serialize()).equals(Buffer.from(actual.serialize()))) return;
  // The original fee payer is implicitly writable. Recompiling may remove that implicit privilege
  // when the owner becomes a non-payer. This only narrows permission; all actual instructions remain identical.
  const narrowed = decompiled.instructions.map(instruction => ({...instruction,keys:instruction.keys.map(key => key.pubkey.toBase58() === plan.owner ? {...key,isWritable:false} : key)}));
  const expectedNarrowed = new TransactionMessage({payerKey:payer,recentBlockhash:actual.recentBlockhash,instructions:narrowed}).compileToV0Message();
  if (!Buffer.from(expectedNarrowed.serialize()).equals(Buffer.from(actual.serialize()))) bad();
}
