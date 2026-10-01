import { Connection } from '@solana/web3.js';
import { EVM_DEPLOYMENTS, SOLANA_DEPLOYMENT, ChainValidationError, type EvmNetwork } from '@nabungfi/shared/chain';
export interface RpcTransport {
    call<T = unknown>(network: EvmNetwork, method: string, params: unknown[]): Promise<T>;
    batch(network: EvmNetwork, calls: {
        to: string;
        data: string;
    }[], block: string): Promise<string[]>;
    solana: Connection;
}
const readMethods = new Set(['eth_call', 'eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getBalance', 'eth_getCode', 'eth_estimateGas', 'eth_gasPrice']);
export class ReadOnlyRpc implements RpcTransport {
    readonly solana: Connection;
    private readonly urls: Record<EvmNetwork, string>;
    constructor(environment: NodeJS.ProcessEnv = process.env) { this.urls = { base: environment.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org', arbitrum: environment.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc', ethereum: environment.ETHEREUM_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com' }; this.solana = new Connection(environment.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com', { commitment: 'confirmed', fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20000) }) }); }
    private async request<T>(network: EvmNetwork, payload: unknown): Promise<T> {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const response = await fetch(this.urls[network], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
                if (!response.ok)
                    throw new Error();
                const result = await response.json() as {
                    error?: unknown;
                };
                if (result.error || Array.isArray(result) && result.some(r => r.error))
                    throw new Error();
                return result as T;
            }
            catch {
                if (attempt === 2)
                    throw new ChainValidationError('CHAIN_UNAVAILABLE', `${network} RPC is unavailable; preserve the original transaction hash.`);
                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
        }
        throw new ChainValidationError('CHAIN_UNAVAILABLE', 'Chain data is unavailable.');
    }
    async call<T = unknown>(network: EvmNetwork, method: string, params: unknown[]): Promise<T> {
        if (!readMethods.has(method))
            throw new ChainValidationError('READ_ONLY_RPC', 'The application server does not submit transactions.');
        const r = await this.request<{
            result: T;
        }>(network, { jsonrpc: '2.0', id: 1, method, params });
        return r.result;
    }
    async batch(network: EvmNetwork, calls: {
        to: string;
        data: string;
    }[], block: string): Promise<string[]> {
        const response = await this.request<{
            id: number;
            result: string;
        }[]>(network, calls.map((tx, index) => ({ jsonrpc: '2.0', id: index + 1, method: 'eth_call', params: [tx, block] })));
        if (!Array.isArray(response) || response.length !== calls.length)
            throw new ChainValidationError('CHAIN_UNAVAILABLE', 'Incomplete chain snapshot.');
        return calls.map((_, i) => {
            const result = response.find(r => r.id === i + 1)?.result;
            if (typeof result !== 'string' || !/^0x[0-9a-f]*$/i.test(result))
                throw new ChainValidationError('CHAIN_UNAVAILABLE', 'Invalid chain snapshot.');
            return result;
        });
    }
    async validate(): Promise<void> {
        if (await this.solana.getGenesisHash() !== SOLANA_DEPLOYMENT.genesis)
            throw new ChainValidationError('WRONG_CHAIN', 'Expected Solana Devnet.');
        for (const network of Object.keys(this.urls) as EvmNetwork[])
            if (BigInt(await this.call<string>(network, 'eth_chainId', [])) !== BigInt(EVM_DEPLOYMENTS[network].chainId))
                throw new ChainValidationError('WRONG_CHAIN', `Expected ${network} testnet.`);
    }
}
