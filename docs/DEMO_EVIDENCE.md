# Product demo: a 10-USDC goal, funded and collected

**Recorded on 11 October 2026.** [Watch the 2:37 demo](https://youtu.be/IL7THrY67Gk) · [Open the app](https://nabungfi.endpx.cloud/app).

The deployed Privy browser workspace created a new **Dream car** goal with a **10-USDC testnet target**, selecting **Solana Devnet and Base Sepolia**. Every owner action used the application's review and wallet confirmation flow. The eight original operations reached `confirmed` through the application's receipt verifier.

| Operation | Network | USDC | Original transaction |
| --- | --- | ---: | --- |
| Create vault | Base Sepolia | — | [Receipt](https://sepolia.basescan.org/tx/0x2e4136a9b40d5c7efd9bbed23facbca8cdae430a75f5e4ab1d362af8af62359f) |
| Initialize goal | Solana Devnet | — | [Receipt](https://explorer.solana.com/tx/3dxjz9PhMM9xnfjiyvoWN6CfzsuV7U5WTLpRmvCcSFEeEEuK88rGqbHUFoRab8svFPbiWELhvNGkcQqmCXCq6Syj?cluster=devnet) |
| Deposit | Solana Devnet | 5 | [Receipt](https://explorer.solana.com/tx/4hQ4MfdK3ivHnESa7pAruw9y6UrSxV2vKgfAtnKMavzHhi3tFGM2gFpo6xgqNGAai5fDKtSMxZekPgTfNFBkvtWB?cluster=devnet) |
| Exact approval | Base Sepolia | 5 | [Receipt](https://sepolia.basescan.org/tx/0xd47142c7d59344dbb1c0e9278d27160ae4a76bdf4cc72c14194258a3e7119cfe) |
| Deposit | Base Sepolia | 5 | [Receipt](https://sepolia.basescan.org/tx/0x1067697db59c0470fe3ec401818e89af64db57dd51ba1f857566c4ba7e66a729) |
| Prepare completion | Solana Devnet | — | [Receipt](https://explorer.solana.com/tx/3KMJ24VAmGSve6AybWXV4mYYzvwPQjz8TJcmv4Mwzw6g2272Ln2koCQ8EPx3ptAGYgw9dJP3FfRTzP7zyTtDtcEF?cluster=devnet) |
| Claim | Solana Devnet | 5 | [Receipt](https://explorer.solana.com/tx/sftiitDoyotQDAXX5EWaG3JbvFmk5i4KKUfZU1nDWK3pBXSNVYHCuWT1Afr75WPfzQh2tGFugiGV7hGDDBtE7jr?cluster=devnet) |
| Claim | Base Sepolia | 5 | [Receipt](https://sepolia.basescan.org/tx/0x25030e9971bfdace055dbd5ca89971bd242da5b51a083502d4ab3219ce9d6dce) |

## What the recording establishes

- The first 5-USDC deposit funded **50%** of this goal and **50 build pieces**.
- The second 5-USDC deposit funded the target, with a **50% / 50%** chain allocation.
- Assembly stopped at **99 pieces** while the final piece awaited verified achievement.
- Both chain positions became unlocked before the final piece was assembled and claims were recorded.
- The owner collected **10 USDC in total**. The final application read showed **zero USDC remaining in each vault**.
- Owner USDC balances returned to their starting **22 USDC on each participating network**, and the dashboard retained the completed 100-piece build.

Exact atomic amounts and original hashes are available in [the curated transaction record](../contracts/deployments/backend/demo-2026-10-11.json). No private authentication identifiers, keys, cookies or account email are included.

## Editing and verification scope

The video uses real application recordings, with Remotion framing/transitions, English captions and an ElevenLabs Albary voice-over. Waiting time is condensed, and account email is redacted. The visual edit does not synthesize balances or transaction outcomes.

An unsigned Solana completion plan required recovery before the wallet opened. The original server step remained planned without a hash, was refreshed through the application, and its eventual transaction confirmed. The video omits that waiting/recovery interval. No database mutation was used to force a successful outcome.

The exported video was checked at 18 scene points and decoded successfully, with 1920×1080 video at 30 fps and audio mastered near -16 LUFS. This recording is a **Base + Solana cash-vault testnet lifecycle**. It does not add a new four-network execution or realized strategy-yield result. [Earlier four-network evidence](BROWSER_E2E_ACCEPTANCE.md) and [source/strategy evidence](EVIDENCE_HISTORY.md) are documented separately.
