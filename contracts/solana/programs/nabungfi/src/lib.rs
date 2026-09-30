#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
#[cfg(not(feature = "devnet"))]
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};
use solana_sha256_hasher::hashv;

#[cfg(not(feature = "devnet"))]
pub mod kamino;
pub mod state;
pub mod transport_state;
pub mod wire;
use state::*;

// Local development identity only; no deployment has been made with this ID.
#[cfg(not(feature = "devnet"))]
declare_id!("Fg6PaFpoGXkYsidMpWxqSWY6W2BeZ7FEfcYkgMQHGKqF");
#[cfg(feature = "devnet")]
declare_id!("3tPb29y74ycYSHa6Pz1tsUTsnaD6Xh9HPEzFKtWnwXM4");

#[cfg(not(feature = "devnet"))]
pub const USDC_MINT: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
#[cfg(feature = "devnet")]
pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
#[cfg(not(feature = "devnet"))]
pub const KAMINO_MARKET: Pubkey = pubkey!("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF");
#[cfg(not(feature = "devnet"))]
pub const KAMINO_RESERVE: Pubkey = pubkey!("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");
// These are recorded in this legacy reserve. The current SDK's derived-PDA
// convenience helpers produce different addresses and must not be used here.
#[cfg(not(feature = "devnet"))]
pub const KAMINO_COLLATERAL_MINT: Pubkey = pubkey!("B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D");
#[cfg(not(feature = "devnet"))]
pub const KAMINO_LIQUIDITY_SUPPLY: Pubkey = pubkey!("Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6");
// Cash-only Devnet profile: an unmintable, zero-supply SPL mint is an inert
// commitment for all strategy fields. These addresses are NOT Kamino accounts.
#[cfg(feature = "devnet")]
pub const KAMINO_COLLATERAL_MINT: Pubkey = pubkey!("2qBnsAsYjJ1cBaWQ28kChUo4dtMkYynetMY8FUTe4p3E");
#[cfg(feature = "devnet")]
pub const KAMINO_MARKET: Pubkey = KAMINO_COLLATERAL_MINT;
#[cfg(feature = "devnet")]
pub const KAMINO_RESERVE: Pubkey = KAMINO_COLLATERAL_MINT;
#[cfg(feature = "devnet")]
pub const KAMINO_LIQUIDITY_SUPPLY: Pubkey = KAMINO_COLLATERAL_MINT;
// Local development identity of programs/nabungfi-lz; no public deployment is claimed.
// Replace both program identities/configuration before a reviewed network deployment.
#[cfg(not(feature = "devnet"))]
pub const TRANSPORT_PROGRAM: Pubkey = Pubkey::new_from_array([77; 32]);
#[cfg(feature = "devnet")]
pub const TRANSPORT_PROGRAM: Pubkey = pubkey!("Fez821Y7EAC8rLNqG1WeVmVAcSZPKtd3QuQxFuAiCc5A");

#[program]
pub mod nabungfi {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        require!(
            args.target > 0 && args.goal_id != [0; 32],
            NabungError::InvalidConfig
        );
        require!(
            valid_evm_address(args.remote_vault) && valid_evm_address(args.remote_owner),
            NabungError::InvalidConfig
        );
        require!(ctx.accounts.usdc_mint.decimals == 6, NabungError::WrongMint);
        #[cfg(feature = "devnet")]
        validate_inert_collateral(&ctx.accounts.collateral_mint)?;
        let owner = ctx.accounts.owner.key();
        let key = ctx.accounts.goal.key();
        let config_hash = configuration_hash(key, owner, &args);
        ctx.accounts.goal.set_inner(Goal {
            owner,
            goal_id: args.goal_id,
            config_hash,
            target: args.target,
            remote_owner: args.remote_owner,
            remote_vault: args.remote_vault,
            linked: false,
            remote_net_assets: 0,
            remote_progress_sequence: 0,
            remote_observation: 0,
            remote_observed_at: 0,
            remote_received_at: 0,
            principal: 0,
            claimed: 0,
            round: 0,
            inbound_sequence: 0,
            outbound_sequence: 0,
            local_reserved: 0,
            local_ready_slot: 0,
            remote_reserved: 0,
            achieved_total: 0,
            local_ready: false,
            remote_ready: false,
            phase: Phase::Locked,
            bump: ctx.bumps.goal,
        });
        emit!(GoalCreated {
            goal: key,
            config_hash,
            target: args.target,
            owner
        });
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.goal.record_deposit(amount)?;
        let before = ctx.accounts.usdc_vault.amount;
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.source.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.usdc_vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
            6,
        )?;
        ctx.accounts.usdc_vault.reload()?;
        require!(
            ctx.accounts.usdc_vault.amount.checked_sub(before) == Some(amount),
            NabungError::UnexpectedTokenMovement
        );
        emit!(Deposited {
            goal: ctx.accounts.goal.key(),
            amount,
            principal: ctx.accounts.goal.principal
        });
        Ok(())
    }

    /// Owner initiates a round; estimates are not treated as authority to unlock.
    pub fn begin_prepare(ctx: Context<OwnerGoal>) -> Result<()> {
        ctx.accounts.goal.begin_prepare()?;
        emit_command(&ctx.accounts.goal, 1);
        Ok(())
    }

    /// Permissionless: the amounts come from PDA-owned token accounts, not inputs.
    pub fn mark_local_ready(ctx: Context<LocalBalances>) -> Result<()> {
        ctx.accounts.goal.reserve_local(
            ctx.accounts.usdc_vault.amount,
            ctx.accounts.shares.amount,
            Clock::get()?.slot,
        )?;
        emit!(LocalReady {
            goal: ctx.accounts.goal.key(),
            round: ctx.accounts.goal.round,
            amount: ctx.accounts.goal.local_reserved,
            slot: Clock::get()?.slot
        });
        Ok(())
    }

    pub fn receive_ready(ctx: Context<AuthenticatedReport>, report: RemoteReport) -> Result<()> {
        authenticate_transport(ctx.accounts.goal.key(), ctx.accounts.receiver.key())?;
        ctx.accounts.goal.accept_remote_ready(&report)
    }

    pub fn receive_registered(
        ctx: Context<AuthenticatedReport>,
        packet: wire::Packet,
    ) -> Result<()> {
        authenticate_transport(ctx.accounts.goal.key(), ctx.accounts.receiver.key())?;
        let goal_key = ctx.accounts.goal.key();
        ctx.accounts.goal.accept_registration(&packet, goal_key)
    }

    pub fn receive_progress(ctx: Context<AuthenticatedReport>, packet: wire::Packet) -> Result<()> {
        authenticate_transport(ctx.accounts.goal.key(), ctx.accounts.receiver.key())?;
        let goal_key = ctx.accounts.goal.key();
        let now = u64::try_from(Clock::get()?.unix_timestamp)
            .map_err(|_| NabungError::InvalidObservation)?;
        ctx.accounts.goal.accept_progress(&packet, goal_key, now)
    }

    /// Permissionless finalization; all amounts must already be reserved.
    pub fn achieve(ctx: Context<LocalBalances>) -> Result<()> {
        ctx.accounts.goal.achieve(
            ctx.accounts.usdc_vault.amount,
            ctx.accounts.shares.amount,
            Clock::get()?.slot,
        )?;
        emit_command(&ctx.accounts.goal, 2);
        Ok(())
    }

    pub fn begin_abort(ctx: Context<OwnerGoal>) -> Result<()> {
        ctx.accounts.goal.begin_abort()?;
        emit_command(&ctx.accounts.goal, 3);
        Ok(())
    }

    pub fn receive_abort_ack(
        ctx: Context<AuthenticatedReport>,
        report: RemoteReport,
    ) -> Result<()> {
        authenticate_transport(ctx.accounts.goal.key(), ctx.accounts.receiver.key())?;
        ctx.accounts.goal.accept_abort_ack(&report)
    }

    pub fn claim(ctx: Context<Claim>, amount: u64) -> Result<()> {
        ctx.accounts
            .goal
            .record_claim(amount, ctx.accounts.usdc_vault.amount)?;
        let goal = &ctx.accounts.goal;
        let bump = [goal.bump];
        let seeds: &[&[u8]] = &[b"goal", goal.owner.as_ref(), &goal.goal_id, &bump];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.usdc_vault.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: goal.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            6,
        )?;
        emit!(Claimed {
            goal: goal.key(),
            amount,
            claimed: goal.claimed
        });
        Ok(())
    }

    /// No automatic yield allocation policy is implied: the owner explicitly
    /// signs the amount and minimum cToken output while the goal is locked.
    pub fn supply_kamino(ctx: Context<KaminoPosition>, amount: u64, min_shares: u64) -> Result<()> {
        #[cfg(feature = "devnet")]
        {
            let _ = (ctx, amount, min_shares);
            err!(NabungError::StrategyDisabled)
        }
        #[cfg(not(feature = "devnet"))]
        {
            require!(ctx.accounts.goal.linked, NabungError::GoalNotRegistered);
            require_keys_eq!(
                ctx.accounts.caller.key(),
                ctx.accounts.goal.owner,
                NabungError::InvalidConfig
            );
            require!(
                ctx.accounts.goal.phase == Phase::Locked,
                NabungError::WrongPhase
            );
            require!(amount > 0 && min_shares > 0, NabungError::ZeroAmount);
            require!(
                amount <= ctx.accounts.usdc_vault.amount,
                NabungError::InsufficientFunds
            );
            kamino::validate(ctx.accounts, true)?;
            let before_usdc = ctx.accounts.usdc_vault.amount;
            let before_shares = ctx.accounts.shares.amount;
            let ix = kamino::deposit_instruction(ctx.accounts, amount);
            kamino::invoke(ctx.accounts, ix)?;
            ctx.accounts.usdc_vault.reload()?;
            ctx.accounts.shares.reload()?;
            require!(
                before_usdc.checked_sub(ctx.accounts.usdc_vault.amount) == Some(amount),
                NabungError::UnexpectedTokenMovement
            );
            let received = ctx
                .accounts
                .shares
                .amount
                .checked_sub(before_shares)
                .ok_or(NabungError::UnexpectedTokenMovement)?;
            require!(received >= min_shares, NabungError::MinimumNotReceived);
            emit!(StrategyMovement {
                goal: ctx.accounts.goal.key(),
                supply: true,
                usdc: amount,
                shares: received
            });
            Ok(())
        }
    }

    /// The owner may recall funds while locked. During preparation, anyone can
    /// help redeem; all proceeds return to this goal's locked USDC account.
    pub fn redeem_kamino(ctx: Context<KaminoPosition>, shares: u64, min_usdc: u64) -> Result<()> {
        #[cfg(feature = "devnet")]
        {
            let _ = (ctx, shares, min_usdc);
            err!(NabungError::StrategyDisabled)
        }
        #[cfg(not(feature = "devnet"))]
        {
            let goal = &ctx.accounts.goal;
            require!(
                goal.phase == Phase::Locked || goal.phase == Phase::Preparing,
                NabungError::WrongPhase
            );
            require!(!goal.local_ready, NabungError::AlreadyReady);
            if goal.phase == Phase::Locked {
                require_keys_eq!(
                    ctx.accounts.caller.key(),
                    goal.owner,
                    NabungError::InvalidConfig
                );
            }
            require!(shares > 0 && min_usdc > 0, NabungError::ZeroAmount);
            require!(
                shares <= ctx.accounts.shares.amount,
                NabungError::InsufficientFunds
            );
            kamino::validate(ctx.accounts, false)?;
            let before_usdc = ctx.accounts.usdc_vault.amount;
            let before_shares = ctx.accounts.shares.amount;
            let ix = kamino::redeem_instruction(ctx.accounts, shares);
            kamino::invoke(ctx.accounts, ix)?;
            ctx.accounts.usdc_vault.reload()?;
            ctx.accounts.shares.reload()?;
            require!(
                before_shares.checked_sub(ctx.accounts.shares.amount) == Some(shares),
                NabungError::UnexpectedTokenMovement
            );
            let received = ctx
                .accounts
                .usdc_vault
                .amount
                .checked_sub(before_usdc)
                .ok_or(NabungError::UnexpectedTokenMovement)?;
            require!(received >= min_usdc, NabungError::MinimumNotReceived);
            emit!(StrategyMovement {
                goal: ctx.accounts.goal.key(),
                supply: false,
                usdc: received,
                shares
            });
            Ok(())
        }
    }
}

#[cfg(feature = "devnet")]
fn validate_inert_collateral(mint: &Mint) -> Result<()> {
    require!(
        mint.supply == 0 && mint.mint_authority.is_none() && mint.freeze_authority.is_none(),
        NabungError::WrongMint
    );
    Ok(())
}

fn valid_evm_address(address: [u8; 32]) -> bool {
    address[..12] == [0; 12] && address[12..] != [0; 20]
}

pub fn configuration_hash(goal: Pubkey, owner: Pubkey, args: &InitializeArgs) -> [u8; 32] {
    hashv(&[
        b"NABUNGFI_SOLANA_CONFIG_V1",
        crate::ID.as_ref(),
        goal.as_ref(),
        owner.as_ref(),
        &args.goal_id,
        &args.target.to_le_bytes(),
        &args.remote_owner,
        &args.remote_vault,
        &BASE_DOMAIN.to_le_bytes(),
        USDC_MINT.as_ref(),
        KAMINO_MARKET.as_ref(),
        KAMINO_RESERVE.as_ref(),
        KAMINO_COLLATERAL_MINT.as_ref(),
        KAMINO_LIQUIDITY_SUPPLY.as_ref(),
        TRANSPORT_PROGRAM.as_ref(),
    ])
    .to_bytes()
}

pub fn authenticate_transport(goal: Pubkey, signer: Pubkey) -> Result<()> {
    let expected =
        Pubkey::find_program_address(&[b"nabung-receiver", goal.as_ref()], &TRANSPORT_PROGRAM).0;
    require_keys_eq!(signer, expected, NabungError::InvalidTransport);
    Ok(())
}

fn emit_command(goal: &Account<Goal>, kind: u8) {
    emit!(OutboundCommand {
        goal_id: goal.goal_id,
        config_hash: goal.config_hash,
        source_domain: SOLANA_DOMAIN,
        source_coordinator: goal.key().to_bytes(),
        destination_domain: BASE_DOMAIN,
        destination_vault: goal.remote_vault,
        round: goal.round,
        sequence: goal.outbound_sequence,
        kind,
        local_prepared_reserve: if kind == 2 { goal.remote_reserved } else { 0 },
        aggregate_reserved: if kind == 2 { goal.achieved_total } else { 0 },
    });
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeArgs {
    pub goal_id: [u8; 32],
    pub target: u64,
    pub remote_owner: [u8; 32],
    pub remote_vault: [u8; 32],
}

#[derive(Accounts)]
#[instruction(args: InitializeArgs)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = 8 + Goal::INIT_SPACE,
        seeds = [b"goal", owner.key().as_ref(), &args.goal_id], bump)]
    pub goal: Box<Account<'info, Goal>>,
    #[account(address = USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(address = KAMINO_COLLATERAL_MINT)]
    pub collateral_mint: Account<'info, Mint>,
    #[account(init, payer = owner, seeds = [b"usdc", goal.key().as_ref()], bump,
        token::mint = usdc_mint, token::authority = goal)]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(init, payer = owner, seeds = [b"shares", goal.key().as_ref()], bump,
        token::mint = collateral_mint, token::authority = goal)]
    pub shares: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerGoal<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner, seeds = [b"goal", goal.owner.as_ref(), &goal.goal_id], bump = goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner, seeds = [b"goal", goal.owner.as_ref(), &goal.goal_id], bump = goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    #[account(address = USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut, token::mint = usdc_mint, token::authority = owner)]
    pub source: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"usdc", goal.key().as_ref()], bump,
        token::mint = usdc_mint, token::authority = goal)]
    pub usdc_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LocalBalances<'info> {
    #[account(mut, seeds = [b"goal", goal.owner.as_ref(), &goal.goal_id], bump = goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    #[account(seeds = [b"usdc", goal.key().as_ref()], bump,
        constraint = usdc_vault.mint == USDC_MINT @ NabungError::WrongMint,
        token::authority = goal)]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(seeds = [b"shares", goal.key().as_ref()], bump, token::authority = goal,
        constraint = shares.mint == KAMINO_COLLATERAL_MINT @ NabungError::WrongMint)]
    pub shares: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct AuthenticatedReport<'info> {
    #[account(mut, seeds = [b"goal", goal.owner.as_ref(), &goal.goal_id], bump = goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    // A PDA signer can only be supplied by CPI from its owning derivation program.
    pub receiver: Signer<'info>,
    /// CHECK: Fixed executable identity of the LayerZero transport program.
    #[account(address = TRANSPORT_PROGRAM, executable)]
    pub transport_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner, seeds = [b"goal", goal.owner.as_ref(), &goal.goal_id], bump = goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    #[account(address = USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"usdc", goal.key().as_ref()], bump,
        token::mint = usdc_mint, token::authority = goal)]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = usdc_mint, token::authority = owner)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[cfg(not(feature = "devnet"))]
pub struct KaminoPosition<'info> {
    pub caller: Signer<'info>,
    #[account(seeds = [b"goal", goal.owner.as_ref(), &goal.goal_id], bump = goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    #[account(mut, seeds = [b"usdc", goal.key().as_ref()], bump,
        token::mint = usdc_mint, token::authority = goal)]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"shares", goal.key().as_ref()], bump,
        token::mint = collateral_mint, token::authority = goal)]
    pub shares: Account<'info, TokenAccount>,
    #[account(address = USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut, address = KAMINO_COLLATERAL_MINT)]
    pub collateral_mint: Account<'info, Mint>,
    /// CHECK: Fixed reserve; owner/discriminator and contents are verified in kamino::validate.
    #[account(mut, address = KAMINO_RESERVE, owner = klend_interface::KLEND_PROGRAM_ID)]
    pub reserve: UncheckedAccount<'info>,
    /// CHECK: Fixed market, owned by the fixed Kamino program.
    #[account(address = KAMINO_MARKET, owner = klend_interface::KLEND_PROGRAM_ID)]
    pub lending_market: UncheckedAccount<'info>,
    /// CHECK: Canonical Kamino authority PDA.
    #[account(address = klend_interface::pda::lending_market_authority(&klend_interface::KLEND_PROGRAM_ID, &KAMINO_MARKET).0)]
    pub lending_market_authority: UncheckedAccount<'info>,
    #[account(mut, address = KAMINO_LIQUIDITY_SUPPLY,
        token::mint = usdc_mint, token::authority = lending_market_authority)]
    pub reserve_liquidity_supply: Account<'info, TokenAccount>,
    /// CHECK: Fixed program and executable check prevent arbitrary external invocation.
    #[account(address = klend_interface::KLEND_PROGRAM_ID, executable)]
    pub kamino_program: UncheckedAccount<'info>,
    /// CHECK: Exact instructions sysvar expected by the official instruction builder.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

/// Devnet strategy entrypoints reject explicitly without requiring unavailable
/// Kamino reserve accounts. The goal still has the same owner/PDA checks.
#[cfg(feature = "devnet")]
#[derive(Accounts)]
pub struct KaminoPosition<'info> {
    pub caller: Signer<'info>,
    #[account(seeds = [b"goal", goal.owner.as_ref(), &goal.goal_id], bump = goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
}

#[event]
pub struct GoalCreated {
    pub goal: Pubkey,
    pub config_hash: [u8; 32],
    pub target: u64,
    pub owner: Pubkey,
}
#[event]
pub struct Deposited {
    pub goal: Pubkey,
    pub amount: u64,
    pub principal: u64,
}
#[event]
pub struct LocalReady {
    pub goal: Pubkey,
    pub round: u64,
    pub amount: u64,
    pub slot: u64,
}
#[event]
pub struct Claimed {
    pub goal: Pubkey,
    pub amount: u64,
    pub claimed: u64,
}
#[event]
pub struct StrategyMovement {
    pub goal: Pubkey,
    pub supply: bool,
    pub usdc: u64,
    pub shares: u64,
}
#[event]
pub struct OutboundCommand {
    pub goal_id: [u8; 32],
    pub config_hash: [u8; 32],
    pub source_domain: u32,
    pub source_coordinator: [u8; 32],
    pub destination_domain: u32,
    pub destination_vault: [u8; 32],
    pub round: u64,
    pub sequence: u64,
    /// 1 = PREPARE, 2 = COMMIT, 3 = ABORT.
    pub kind: u8,
    pub local_prepared_reserve: u64,
    pub aggregate_reserved: u64,
}

#[cfg(test)]
mod tests;
