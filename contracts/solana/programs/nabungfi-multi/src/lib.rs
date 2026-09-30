#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};
use solana_sha256_hasher::hashv;
pub mod state;
pub mod wire;
use state::*;

declare_id!("FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn");
pub const TRANSPORT_PROGRAM: Pubkey = pubkey!("G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d");
pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

#[program]
pub mod nabungfi_multi {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        validate_participants(&args)?;
        require!(ctx.accounts.usdc_mint.decimals == 6, NabungError::WrongMint);
        let owner = ctx.accounts.owner.key();
        let goal = ctx.accounts.goal.key();
        let participants = args
            .participants
            .iter()
            .map(|p| Participant {
                domain: p.domain,
                eid: p.eid,
                asset: p.asset,
                router: p.router,
                vault: p.vault,
                owner: p.owner,
                config_hash: leaf_hash(
                    crate::ID,
                    TRANSPORT_PROGRAM,
                    goal,
                    owner,
                    args.goal_id,
                    args.target,
                    p,
                ),
                linked: false,
                net_assets: 0,
                progress_sequence: 0,
                observation: 0,
                observed_at: 0,
                received_at: 0,
                inbound_sequence: 0,
                reserved: 0,
                ready: false,
                abort_ack: false,
            })
            .collect();
        ctx.accounts.goal.set_inner(Goal {
            owner,
            goal_id: args.goal_id,
            target: args.target,
            principal: 0,
            claimed: 0,
            round: 0,
            outbound_sequence: 0,
            local_reserved: 0,
            local_ready_slot: 0,
            achieved_total: 0,
            local_ready: false,
            phase: Phase::Locked,
            bump: ctx.bumps.goal,
            participants,
        });
        emit!(GoalCreated {
            goal,
            owner,
            target: args.target,
            participants: args.participants.len() as u8
        });
        Ok(())
    }
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.goal.record_deposit(amount)?;
        let before = ctx.accounts.cash.amount;
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.source.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.cash.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
            6,
        )?;
        ctx.accounts.cash.reload()?;
        require!(
            ctx.accounts.cash.amount.checked_sub(before) == Some(amount),
            NabungError::UnexpectedTokenMovement
        );
        Ok(())
    }
    pub fn begin_prepare(ctx: Context<OwnerGoal>) -> Result<()> {
        ctx.accounts.goal.begin_prepare()
    }
    pub fn begin_abort(ctx: Context<OwnerGoal>) -> Result<()> {
        ctx.accounts.goal.begin_abort()
    }
    pub fn mark_local_ready(ctx: Context<LocalBalance>) -> Result<()> {
        ctx.accounts
            .goal
            .reserve_local(ctx.accounts.cash.amount, Clock::get()?.slot)
    }
    pub fn achieve(ctx: Context<LocalBalance>) -> Result<()> {
        ctx.accounts
            .goal
            .achieve(ctx.accounts.cash.amount, Clock::get()?.slot)
    }
    pub fn receive_packet(ctx: Context<AuthenticatedPacket>, packet: wire::Packet) -> Result<()> {
        let key = ctx.accounts.goal.key();
        let expected =
            Pubkey::find_program_address(&[b"nabung-receiver", key.as_ref()], &TRANSPORT_PROGRAM).0;
        require_keys_eq!(
            ctx.accounts.receiver.key(),
            expected,
            NabungError::InvalidTransport
        );
        let now =
            u64::try_from(Clock::get()?.unix_timestamp).map_err(|_| NabungError::InvalidPacket)?;
        ctx.accounts.goal.receive_packet(&packet, key, now)
    }
    pub fn claim(ctx: Context<Claim>, amount: u64) -> Result<()> {
        ctx.accounts
            .goal
            .record_claim(amount, ctx.accounts.cash.amount)?;
        let goal = &ctx.accounts.goal;
        let bump = [goal.bump];
        let seeds: &[&[u8]] = &[b"goal", goal.owner.as_ref(), &goal.goal_id, &bump];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.cash.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: goal.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            6,
        )?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ParticipantArgs {
    pub domain: u32,
    pub eid: u32,
    pub asset: [u8; 32],
    pub router: [u8; 32],
    pub vault: [u8; 32],
    pub owner: [u8; 32],
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct InitializeArgs {
    pub goal_id: [u8; 32],
    pub target: u64,
    pub participants: Vec<ParticipantArgs>,
}
pub fn validate_participants(args: &InitializeArgs) -> Result<()> {
    require!(
        args.target > 0
            && args.goal_id != [0; 32]
            && !args.participants.is_empty()
            && args.participants.len() <= 3,
        NabungError::InvalidConfig
    );
    let mut last = 1;
    for p in &args.participants {
        require!(
            p.domain > last && eid_for_domain(p.domain)? == p.eid,
            NabungError::WrongPeer
        );
        require!(
            [p.asset, p.router, p.vault, p.owner]
                .iter()
                .all(wire::evm_address),
            NabungError::InvalidConfig
        );
        last = p.domain;
    }
    Ok(())
}
pub fn leaf_hash(
    core: Pubkey,
    transport: Pubkey,
    goal: Pubkey,
    owner: Pubkey,
    id: [u8; 32],
    target: u64,
    p: &ParticipantArgs,
) -> [u8; 32] {
    hashv(&[
        b"NABUNGFI_MULTICHAIN_CONFIG_V2",
        core.as_ref(),
        goal.as_ref(),
        owner.as_ref(),
        &id,
        &target.to_le_bytes(),
        &p.domain.to_le_bytes(),
        &p.eid.to_le_bytes(),
        USDC_MINT.as_ref(),
        &p.asset,
        &p.router,
        &p.vault,
        &p.owner,
        transport.as_ref(),
    ])
    .to_bytes()
}

#[derive(Accounts)]
#[instruction(args:InitializeArgs)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init,payer=owner,space=8+Goal::INIT_SPACE,seeds=[b"goal",owner.key().as_ref(),&args.goal_id],bump)]
    pub goal: Box<Account<'info, Goal>>,
    #[account(address=USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(init,payer=owner,seeds=[b"usdc",goal.key().as_ref()],bump,token::mint=usdc_mint,token::authority=goal)]
    pub cash: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct OwnerGoal<'info> {
    pub owner: Signer<'info>,
    #[account(mut,has_one=owner,seeds=[b"goal",goal.owner.as_ref(),&goal.goal_id],bump=goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
}
#[derive(Accounts)]
pub struct Deposit<'info> {
    pub owner: Signer<'info>,
    #[account(mut,has_one=owner,seeds=[b"goal",goal.owner.as_ref(),&goal.goal_id],bump=goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    #[account(address=USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut,token::mint=usdc_mint,token::authority=owner)]
    pub source: Account<'info, TokenAccount>,
    #[account(mut,seeds=[b"usdc",goal.key().as_ref()],bump,token::mint=usdc_mint,token::authority=goal)]
    pub cash: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct LocalBalance<'info> {
    #[account(mut,seeds=[b"goal",goal.owner.as_ref(),&goal.goal_id],bump=goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    #[account(seeds=[b"usdc",goal.key().as_ref()],bump,token::authority=goal,constraint=cash.mint==USDC_MINT @ NabungError::WrongMint)]
    pub cash: Account<'info, TokenAccount>,
}
#[derive(Accounts)]
pub struct AuthenticatedPacket<'info> {
    #[account(mut,seeds=[b"goal",goal.owner.as_ref(),&goal.goal_id],bump=goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    pub receiver: Signer<'info>,
    /// CHECK: fixed executable transport identity, paired with the receiver PDA signer.
    #[account(address=TRANSPORT_PROGRAM,executable)]
    pub transport_program: UncheckedAccount<'info>,
}
#[derive(Accounts)]
pub struct Claim<'info> {
    pub owner: Signer<'info>,
    #[account(mut,has_one=owner,seeds=[b"goal",goal.owner.as_ref(),&goal.goal_id],bump=goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    #[account(address=USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut,seeds=[b"usdc",goal.key().as_ref()],bump,token::mint=usdc_mint,token::authority=goal)]
    pub cash: Account<'info, TokenAccount>,
    #[account(mut,token::mint=usdc_mint,token::authority=owner)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
#[event]
pub struct GoalCreated {
    pub goal: Pubkey,
    pub owner: Pubkey,
    pub target: u64,
    pub participants: u8,
}

#[cfg(test)]
mod tests;
