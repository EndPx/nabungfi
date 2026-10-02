import {
  address,
  getAddressEncoder,
  getCompiledTransactionMessageDecoder,
  getProgramDerivedAddress,
  getTransactionDecoder,
} from "@solana/kit";
import {
  SOLANA_DEPLOYMENT as SOL,
  EVM_DEPLOYMENTS,
  assertGoalBinding,
  rawAmount,
  type ChainPlan,
  type GoalBinding,
} from "@nabungfi/shared/chain";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SYSTEM = "11111111111111111111111111111111";
const text = new TextEncoder();
const hex = (value: Iterable<number>) =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const solBytes = (value: string) =>
  new Uint8Array(getAddressEncoder().encode(address(value)));
const hexBytes = (value: string) => {
  if (!/^0x[0-9a-f]{64}$/i.test(value))
    throw new Error("Invalid goal or configuration ID.");
  return Uint8Array.from(value.slice(2).match(/../g)!, (byte) =>
    Number.parseInt(byte, 16),
  );
};
const evmWord = (value: string) => {
  if (!/^0x[0-9a-f]{40}$/i.test(value)) throw new Error("Invalid EVM address.");
  return value.slice(2).toLowerCase().padStart(64, "0");
};
const evmBytes = (value: string) =>
  Uint8Array.from(evmWord(value).match(/../g)!, (byte) =>
    Number.parseInt(byte, 16),
  );
const uintWord = (value: string) =>
  rawAmount(value, true).toString(16).padStart(64, "0");
const uint64 = (value: string) => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, rawAmount(value, true), true);
  return bytes;
};
const uint32 = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff)
    throw new Error("Invalid participant domain.");
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
};
function join(...values: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    values.reduce((length, value) => length + value.length, 0),
  );
  let cursor = 0;
  for (const value of values) {
    result.set(value, cursor);
    cursor += value.length;
  }
  return result;
}
const hash = async (value: Uint8Array) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(value)));
const discriminator = async (name: string) =>
  (await hash(text.encode(`global:${name}`))).slice(0, 8);

export async function validateCanonicalBinding(
  binding: GoalBinding,
): Promise<{ ownerAta: string }> {
  assertGoalBinding(binding);
  const [goal] = await getProgramDerivedAddress({
    programAddress: address(SOL.core),
    seeds: [
      text.encode("goal"),
      solBytes(binding.owner.solana),
      hexBytes(binding.goalId),
    ],
  });
  const [cash] = await getProgramDerivedAddress({
    programAddress: address(SOL.core),
    seeds: [text.encode("usdc"), solBytes(goal)],
  });
  if (goal !== binding.solanaGoal || cash !== binding.solanaCash)
    throw new Error(
      "The savings coordinator or cash account does not match the goal and its owner.",
    );
  const [ownerAta] = await getProgramDerivedAddress({
    programAddress: address(ATA),
    seeds: [
      solBytes(binding.owner.solana),
      solBytes(TOKEN),
      solBytes(SOL.mint),
    ],
  });
  await Promise.all(
    binding.participants.map(async (participant) => {
      if (participant.vault) {
        const preimage = join(
          text.encode("NABUNGFI_MULTICHAIN_CONFIG_V2"),
          solBytes(SOL.core),
          solBytes(goal),
          solBytes(binding.owner.solana),
          hexBytes(binding.goalId),
          uint64(binding.targetRaw),
          uint32(participant.domain),
          uint32(participant.eid),
          solBytes(SOL.mint),
          evmBytes(participant.asset),
          evmBytes(participant.router),
          evmBytes(participant.vault),
          evmBytes(binding.owner.evm),
          solBytes(SOL.transport),
        );
        if (participant.configHash !== `0x${hex(await hash(preimage))}`)
          throw new Error(
            "The vault configuration does not match this goal and its selected chain.",
          );
      }
    }),
  );
  return { ownerAta };
}

export function expectedEvmCalldata(
  binding: GoalBinding,
  plan: ChainPlan,
): string {
  if (plan.network === "solana")
    throw new Error("EVM call requires an EVM network.");
  const participant = binding.participants.find(
    (item) => item.network === plan.network,
  );
  if (!participant) throw new Error("The chain is not selected for this goal.");
  if (plan.action === "create-vault")
    return (
      "0x00f16bd1" +
      binding.goalId.slice(2).toLowerCase() +
      hex(solBytes(binding.owner.solana)) +
      hex(solBytes(binding.solanaGoal)) +
      uintWord(binding.targetRaw) +
      uintWord("0")
    );
  const amount = rawAmount(plan.amountRaw).toString();
  if (plan.action === "approve" && participant.vault)
    return "0x095ea7b3" + evmWord(participant.vault) + uintWord(amount);
  if (plan.action === "deposit") return "0xb6b55f25" + uintWord(amount);
  if (plan.action === "claim") return "0x379607f5" + uintWord(amount);
  throw new Error("The wallet action is not supported on this chain.");
}

type ExpectedInstruction = {
  program: string;
  accounts: { address: string; writable: boolean }[];
  data: Uint8Array;
};
const account = (value: string, writable = false) => ({
  address: value,
  writable,
});
async function expectedSolanaInstructions(
  binding: GoalBinding,
  plan: ChainPlan,
  ownerAta: string,
  includeAta: boolean,
): Promise<ExpectedInstruction[]> {
  const owner = binding.owner.solana;
  let instruction: ExpectedInstruction;
  if (plan.action === "initialize") {
    if (
      binding.participants.some(
        (participant) => !participant.vault || !participant.configHash,
      )
    )
      throw new Error(
        "Create and verify all selected vaults before initialization.",
      );
    instruction = {
      program: SOL.core,
      accounts: [
        account(owner, true),
        account(binding.solanaGoal, true),
        account(SOL.mint),
        account(binding.solanaCash, true),
        account(TOKEN),
        account(SYSTEM),
      ],
      data: join(
        await discriminator("initialize"),
        hexBytes(binding.goalId),
        uint64(binding.targetRaw),
        uint32(binding.participants.length),
        ...binding.participants.map((participant) =>
          join(
            uint32(participant.domain),
            uint32(participant.eid),
            evmBytes(participant.asset),
            evmBytes(participant.router),
            evmBytes(participant.vault!),
            evmBytes(binding.owner.evm),
          ),
        ),
      ),
    };
  } else if (plan.action === "deposit" || plan.action === "claim") {
    const amount = rawAmount(plan.amountRaw).toString();
    instruction = {
      program: SOL.core,
      accounts: [
        account(owner, true),
        account(binding.solanaGoal, true),
        account(SOL.mint),
        ...(plan.action === "deposit"
          ? [account(ownerAta, true), account(binding.solanaCash, true)]
          : [account(binding.solanaCash, true), account(ownerAta, true)]),
        account(TOKEN),
      ],
      data: join(await discriminator(plan.action), uint64(amount)),
    };
  } else if (plan.action === "prepare" || plan.action === "abort")
    instruction = {
      program: SOL.core,
      accounts: [account(owner, true), account(binding.solanaGoal, true)],
      data: await discriminator(
        plan.action === "prepare" ? "begin_prepare" : "begin_abort",
      ),
    };
  else throw new Error("The wallet action is not supported on Solana.");
  if (!includeAta) return [instruction];
  if (plan.action !== "claim")
    throw new Error("Unexpected extra Solana instruction.");
  return [
    {
      program: ATA,
      accounts: [
        account(owner, true),
        account(ownerAta, true),
        account(owner, true),
        account(SOL.mint),
        account(SYSTEM),
        account(TOKEN),
      ],
      data: Uint8Array.of(1),
    },
    instruction,
  ];
}

export async function validateTransactionSemantics(
  binding: GoalBinding,
  plan: ChainPlan,
): Promise<void> {
  const { ownerAta } = await validateCanonicalBinding(binding);
  if (plan.transaction.kind === "evm") {
    if (plan.network === "solana") throw new Error("Wrong transaction family.");
    const deployment = EVM_DEPLOYMENTS[plan.network];
    const participant = binding.participants.find(
      (item) => item.network === plan.network,
    );
    const expectedTo =
      plan.action === "create-vault"
        ? deployment.router
        : plan.action === "approve"
          ? deployment.asset
          : participant?.vault;
    if (
      !expectedTo ||
      plan.transaction.to.toLowerCase() !== expectedTo.toLowerCase() ||
      plan.transaction.chainId !== deployment.chainId ||
      BigInt(plan.transaction.value) !== 0n ||
      plan.transaction.data.toLowerCase() !== expectedEvmCalldata(binding, plan)
    )
      throw new Error(
        "The wallet calldata does not match the exact goal, token, vault and amount you selected.",
      );
    return;
  }
  const wire = Uint8Array.from(atob(plan.transaction.base64), (character) =>
    character.charCodeAt(0),
  );
  if (wire.length > 1232)
    throw new Error(
      "The Solana transaction is outside the supported wire size.",
    );
  const transaction = getTransactionDecoder().decode(wire);
  const message = getCompiledTransactionMessageDecoder().decode(
    transaction.messageBytes,
  );
  if (message.version !== 0 || (message.addressTableLookups?.length ?? 0) !== 0)
    throw new Error("Only explicit v0 Solana accounts are supported.");
  if (
    message.lifetimeToken !== plan.transaction.blockhash ||
    !Number.isSafeInteger(plan.transaction.lastValidBlockHeight) ||
    plan.transaction.lastValidBlockHeight <= 0
  )
    throw new Error("The Solana transaction lifetime was substituted.");
  if (
    message.header.numSignerAccounts !== 1 ||
    message.header.numReadonlySignerAccounts !== 0 ||
    message.staticAccounts[0] !== binding.owner.solana
  )
    throw new Error(
      "Only the selected owner may sign and pay for this transaction.",
    );
  const signatures = Object.entries(transaction.signatures);
  if (
    signatures.length !== 1 ||
    signatures[0][0] !== binding.owner.solana ||
    signatures.some(
      ([, signature]) => signature && [...signature].some((byte) => byte !== 0),
    )
  )
    throw new Error("The server must return an unsigned owner transaction.");
  const expected = await expectedSolanaInstructions(
    binding,
    plan,
    ownerAta,
    message.instructions.length === 2,
  );
  if (message.instructions.length !== expected.length)
    throw new Error("Unexpected Solana instruction count.");
  const allAccounts = new Set<string>([binding.owner.solana]);
  const writable = new Set<string>([binding.owner.solana]);
  expected.forEach((instruction) => {
    allAccounts.add(instruction.program);
    instruction.accounts.forEach((item) => {
      allAccounts.add(item.address);
      if (item.writable) writable.add(item.address);
    });
  });
  if (
    message.staticAccounts.length !== allAccounts.size ||
    new Set(message.staticAccounts).size !== allAccounts.size ||
    message.staticAccounts.some((value) => !allAccounts.has(value))
  )
    throw new Error(
      "The Solana message contains substituted or extra accounts.",
    );
  message.staticAccounts.forEach((value, index) => {
    const isWritable =
      index < message.header.numSignerAccounts
        ? index <
          message.header.numSignerAccounts -
            message.header.numReadonlySignerAccounts
        : index <
          message.staticAccounts.length -
            message.header.numReadonlyNonSignerAccounts;
    if (isWritable !== writable.has(value))
      throw new Error("The Solana account permissions were changed.");
  });
  expected.forEach((wanted, index) => {
    const actual = message.instructions[index];
    const accounts = (actual.accountIndices ?? []).map(
      (accountIndex) => message.staticAccounts[accountIndex],
    );
    if (
      message.staticAccounts[actual.programAddressIndex] !== wanted.program ||
      hex(actual.data ?? []) !== hex(wanted.data) ||
      accounts.length !== wanted.accounts.length ||
      accounts.some(
        (value, accountIndex) =>
          value !== wanted.accounts[accountIndex].address,
      )
    )
      throw new Error(
        "The Solana instruction does not match the exact goal, mint, vault, destination and amount.",
      );
  });
}
