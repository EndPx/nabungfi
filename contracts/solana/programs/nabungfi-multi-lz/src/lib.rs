#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use endpoint::instructions::{
    ClearParams, QuoteParams, RegisterOAppParams, SendParams, SetDelegateParams,
};
use nabungfi_multi::{
    state::{eid_for_domain, Goal},
    wire::Packet,
};
use oapp::{
    common::{AccountMetaRef, AddressLocator, EXECUTION_CONTEXT_VERSION_1},
    endpoint::{self, ConstructCPIContext, MessagingFee, MessagingReceipt},
    endpoint_cpi,
    lz_receive_types_v2::{
        self, LzReceiveTypesV2Accounts, LzReceiveTypesV2Result, LZ_RECEIVE_TYPES_VERSION,
    },
    LzReceiveParams, LZ_RECEIVE_TYPES_SEED,
};

declare_id!("G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d");
pub const STORE_SEED: &[u8] = b"Store";
pub const PEER_SEED: &[u8] = b"Peer";

#[program]
pub mod nabungfi_multi_lz {
    use super::*;
    pub fn initialize<'info>(ctx: Context<'_, '_, '_, 'info, Initialize<'info>>) -> Result<()> {
        require!(
            ctx.remaining_accounts.len() >= endpoint::cpi::accounts::RegisterOApp::MIN_ACCOUNTS_LEN,
            TransportError::MissingEndpointAccounts
        );
        ctx.accounts.store.set_inner(Store {
            administrator: ctx.accounts.administrator.key(),
            endpoint: endpoint::ID,
            route_sealed: false,
            peer_mask: 0,
            bump: ctx.bumps.store,
        });
        ctx.accounts
            .receive_types
            .set_inner(LzReceiveTypesAccounts {
                store: ctx.accounts.store.key(),
                bump: ctx.bumps.receive_types,
            });
        let bump = [ctx.bumps.store];
        endpoint_cpi::register_oapp(
            endpoint::ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            &[STORE_SEED, &bump],
            RegisterOAppParams {
                delegate: ctx.accounts.administrator.key(),
            },
        )
    }
    pub fn initialize_peer(ctx: Context<InitializePeer>, args: PeerArgs) -> Result<()> {
        require!(
            !ctx.accounts.store.route_sealed,
            TransportError::SealedRoute
        );
        require!(
            eid_for_domain(args.domain)? == args.eid
                && nabungfi_multi::wire::evm_address(&args.router),
            TransportError::InvalidPeer
        );
        let bit = 1u8
            .checked_shl(args.domain - 2)
            .ok_or(TransportError::InvalidPeer)?;
        require!(
            ctx.accounts.store.peer_mask & bit == 0,
            TransportError::InvalidPeer
        );
        ctx.accounts.peer.set_inner(PeerConfig {
            domain: args.domain,
            eid: args.eid,
            router: args.router,
            bump: ctx.bumps.peer,
        });
        ctx.accounts.store.peer_mask |= bit;
        Ok(())
    }
    pub fn seal_route<'info>(ctx: Context<'_, '_, '_, 'info, SealRoute<'info>>) -> Result<()> {
        require!(
            !ctx.accounts.store.route_sealed && ctx.accounts.store.peer_mask == 7,
            TransportError::MissingPeer
        );
        require!(
            ctx.remaining_accounts.len() >= endpoint::cpi::accounts::SetDelegate::MIN_ACCOUNTS_LEN,
            TransportError::MissingEndpointAccounts
        );
        let bump = [ctx.accounts.store.bump];
        endpoint_cpi::set_delegate(
            endpoint::ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            &[STORE_SEED, &bump],
            SetDelegateParams {
                delegate: ctx.accounts.store.key(),
            },
        )?;
        ctx.accounts.store.route_sealed = true;
        Ok(())
    }
    pub fn quote<'info>(
        ctx: Context<'_, '_, '_, 'info, ReadGoal<'info>>,
        domain: u32,
        sequence: u64,
        options: Vec<u8>,
    ) -> Result<MessagingFee> {
        require!(
            ctx.remaining_accounts.len() >= endpoint::cpi::accounts::Quote::MIN_ACCOUNTS_LEN,
            TransportError::MissingEndpointAccounts
        );
        let message = outgoing(
            &ctx.accounts.goal,
            ctx.accounts.goal.key(),
            &ctx.accounts.peer,
            domain,
            sequence,
        )?
        .encode()?;
        endpoint_cpi::quote(
            endpoint::ID,
            ctx.remaining_accounts,
            QuoteParams {
                sender: ctx.accounts.store.key(),
                dst_eid: ctx.accounts.peer.eid,
                receiver: ctx.accounts.peer.router,
                message,
                options,
                pay_in_lz_token: false,
            },
        )
    }
    pub fn send<'info>(
        ctx: Context<'_, '_, '_, 'info, SendGoal<'info>>,
        domain: u32,
        sequence: u64,
        native_fee: u64,
        options: Vec<u8>,
    ) -> Result<MessagingReceipt> {
        require!(
            ctx.remaining_accounts.len() >= endpoint::cpi::accounts::Send::MIN_ACCOUNTS_LEN,
            TransportError::MissingEndpointAccounts
        );
        require!(
            ctx.remaining_accounts
                .iter()
                .any(|a| a.key() == ctx.accounts.payer.key() && a.is_signer),
            TransportError::MissingFeePayer
        );
        let message = outgoing(
            &ctx.accounts.goal,
            ctx.accounts.goal.key(),
            &ctx.accounts.peer,
            domain,
            sequence,
        )?
        .encode()?;
        let bump = [ctx.accounts.store.bump];
        let receipt = endpoint_cpi::send(
            endpoint::ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            &[STORE_SEED, &bump],
            SendParams {
                dst_eid: ctx.accounts.peer.eid,
                receiver: ctx.accounts.peer.router,
                message,
                options,
                native_fee,
                lz_token_fee: 0,
            },
        )?;
        emit!(MessageSubmitted {
            goal: ctx.accounts.goal.key(),
            domain,
            sequence,
            guid: receipt.guid
        });
        Ok(receipt)
    }
    pub fn lz_receive<'info>(
        ctx: Context<'_, '_, '_, 'info, LzReceive<'info>>,
        params: LzReceiveParams,
    ) -> Result<()> {
        let packet = Packet::decode(&params.message)?;
        validate_incoming(
            &ctx.accounts.peer,
            &ctx.accounts.goal,
            ctx.accounts.goal.key(),
            &params,
            &packet,
        )?;
        require!(
            ctx.remaining_accounts.len() == endpoint::cpi::accounts::Clear::MIN_ACCOUNTS_LEN,
            TransportError::MissingEndpointAccounts
        );
        let bump = [ctx.accounts.store.bump];
        endpoint_cpi::clear(
            endpoint::ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            &[STORE_SEED, &bump],
            ClearParams {
                receiver: ctx.accounts.store.key(),
                src_eid: params.src_eid,
                sender: params.sender,
                nonce: params.nonce,
                guid: params.guid,
                message: params.message,
            },
        )?;
        let goal_key = ctx.accounts.goal.key();
        let receiver_bump = [ctx.bumps.receiver];
        let seeds: &[&[u8]] = &[b"nabung-receiver", goal_key.as_ref(), &receiver_bump];
        let accounts = nabungfi_multi::cpi::accounts::AuthenticatedPacket {
            goal: ctx.accounts.goal.to_account_info(),
            receiver: ctx.accounts.receiver.to_account_info(),
            transport_program: ctx.accounts.transport_program.to_account_info(),
        };
        nabungfi_multi::cpi::receive_packet(
            CpiContext::new_with_signer(
                ctx.accounts.core_program.to_account_info(),
                accounts,
                &[seeds],
            ),
            packet,
        )
    }
    pub fn lz_receive_types_info(
        ctx: Context<ReceiveTypesInfo>,
        params: LzReceiveParams,
    ) -> Result<(u8, LzReceiveTypesV2Accounts)> {
        let packet = Packet::decode(&params.message)?;
        require!(
            eid_for_domain(packet.source_domain)? == params.src_eid,
            TransportError::InvalidPeer
        );
        let peer = Pubkey::find_program_address(
            &[
                PEER_SEED,
                ctx.accounts.oapp_account.key().as_ref(),
                &params.src_eid.to_be_bytes(),
            ],
            &crate::ID,
        )
        .0;
        Ok((
            LZ_RECEIVE_TYPES_VERSION,
            LzReceiveTypesV2Accounts {
                accounts: vec![
                    ctx.accounts.oapp_account.key(),
                    peer,
                    Pubkey::new_from_array(packet.destination),
                ],
            },
        ))
    }
    pub fn lz_receive_types_v2(
        ctx: Context<ReadGoal>,
        params: LzReceiveParams,
    ) -> Result<LzReceiveTypesV2Result> {
        let packet = Packet::decode(&params.message)?;
        validate_incoming(
            &ctx.accounts.peer,
            &ctx.accounts.goal,
            ctx.accounts.goal.key(),
            &params,
            &packet,
        )?;
        Ok(receive_plan(
            ctx.accounts.store.key(),
            ctx.accounts.peer.key(),
            ctx.accounts.goal.key(),
            &params,
        ))
    }
}

pub fn validate_goal_peer(goal: &Goal, peer: &PeerConfig) -> Result<()> {
    let p = &goal.participants[goal.participant_index(peer.domain)?];
    require!(
        p.eid == peer.eid && p.router == peer.router && eid_for_domain(peer.domain)? == peer.eid,
        TransportError::InvalidPeer
    );
    Ok(())
}
pub fn validate_incoming(
    peer: &PeerConfig,
    goal: &Goal,
    key: Pubkey,
    params: &LzReceiveParams,
    packet: &Packet,
) -> Result<()> {
    validate_goal_peer(goal, peer)?;
    require!(
        params.src_eid == peer.eid
            && params.sender == peer.router
            && packet.source_domain == peer.domain,
        TransportError::InvalidPeer
    );
    goal.validate_incoming(packet, key)?;
    Ok(())
}
fn outgoing(
    goal: &Goal,
    key: Pubkey,
    peer: &PeerConfig,
    domain: u32,
    sequence: u64,
) -> Result<Packet> {
    require!(domain == peer.domain, TransportError::InvalidPeer);
    validate_goal_peer(goal, peer)?;
    let clock = Clock::get()?;
    let now = u64::try_from(clock.unix_timestamp).map_err(|_| TransportError::InvalidPacket)?;
    goal.packet(key, domain, sequence, clock.slot, now)
}
pub fn receive_plan(
    store: Pubkey,
    peer: Pubkey,
    goal: Pubkey,
    params: &LzReceiveParams,
) -> LzReceiveTypesV2Result {
    let receiver = Pubkey::find_program_address(&[b"nabung-receiver", goal.as_ref()], &crate::ID).0;
    let mut accounts = vec![
        AccountMetaRef {
            pubkey: AddressLocator::Payer,
            is_writable: true,
        },
        AccountMetaRef {
            pubkey: store.into(),
            is_writable: false,
        },
        AccountMetaRef {
            pubkey: peer.into(),
            is_writable: false,
        },
        AccountMetaRef {
            pubkey: goal.into(),
            is_writable: true,
        },
        AccountMetaRef {
            pubkey: receiver.into(),
            is_writable: false,
        },
        AccountMetaRef {
            pubkey: nabungfi_multi::ID.into(),
            is_writable: false,
        },
        AccountMetaRef {
            pubkey: crate::ID.into(),
            is_writable: false,
        },
    ];
    accounts.extend(lz_receive_types_v2::get_accounts_for_clear(
        endpoint::ID,
        &store,
        params.src_eid,
        &params.sender,
        params.nonce,
    ));
    LzReceiveTypesV2Result {
        context_version: EXECUTION_CONTEXT_VERSION_1,
        alts: vec![],
        instructions: vec![lz_receive_types_v2::Instruction::LzReceive { accounts }],
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PeerArgs {
    pub domain: u32,
    pub eid: u32,
    pub router: [u8; 32],
}
#[account]
#[derive(InitSpace)]
pub struct Store {
    pub administrator: Pubkey,
    pub endpoint: Pubkey,
    pub route_sealed: bool,
    pub peer_mask: u8,
    pub bump: u8,
}
#[account]
#[derive(InitSpace, Debug)]
pub struct PeerConfig {
    pub domain: u32,
    pub eid: u32,
    pub router: [u8; 32],
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct LzReceiveTypesAccounts {
    pub store: Pubkey,
    pub bump: u8,
}
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub administrator: Signer<'info>,
    #[account(address=crate::ID)]
    pub program: Program<'info, crate::program::NabungfiMultiLz>,
    #[account(constraint=program.programdata_address()?==Some(program_data.key()) @ TransportError::BootstrapAuthority,constraint=program_data.upgrade_authority_address==Some(administrator.key()) @ TransportError::BootstrapAuthority)]
    pub program_data: Account<'info, ProgramData>,
    #[account(init,payer=administrator,space=8+Store::INIT_SPACE,seeds=[STORE_SEED],bump)]
    pub store: Account<'info, Store>,
    #[account(init,payer=administrator,space=8+LzReceiveTypesAccounts::INIT_SPACE,seeds=[LZ_RECEIVE_TYPES_SEED,store.key().as_ref()],bump)]
    pub receive_types: Account<'info, LzReceiveTypesAccounts>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(args:PeerArgs)]
pub struct InitializePeer<'info> {
    #[account(mut)]
    pub administrator: Signer<'info>,
    #[account(mut,seeds=[STORE_SEED],bump=store.bump,has_one=administrator)]
    pub store: Account<'info, Store>,
    #[account(init,payer=administrator,space=8+PeerConfig::INIT_SPACE,seeds=[PEER_SEED,store.key().as_ref(),&args.eid.to_be_bytes()],bump)]
    pub peer: Account<'info, PeerConfig>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct SealRoute<'info> {
    pub administrator: Signer<'info>,
    #[account(mut,seeds=[STORE_SEED],bump=store.bump,has_one=administrator)]
    pub store: Account<'info, Store>,
}
#[derive(Accounts)]
pub struct ReadGoal<'info> {
    #[account(seeds=[STORE_SEED],bump=store.bump,constraint=store.route_sealed @ TransportError::UnsealedRoute)]
    pub store: Account<'info, Store>,
    #[account(seeds=[PEER_SEED,store.key().as_ref(),&peer.eid.to_be_bytes()],bump=peer.bump)]
    pub peer: Account<'info, PeerConfig>,
    #[account(seeds=[b"goal",goal.owner.as_ref(),&goal.goal_id],seeds::program=nabungfi_multi::ID,bump=goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
}
#[derive(Accounts)]
pub struct SendGoal<'info> {
    pub payer: Signer<'info>,
    #[account(seeds=[STORE_SEED],bump=store.bump,constraint=store.route_sealed @ TransportError::UnsealedRoute)]
    pub store: Account<'info, Store>,
    #[account(seeds=[PEER_SEED,store.key().as_ref(),&peer.eid.to_be_bytes()],bump=peer.bump)]
    pub peer: Account<'info, PeerConfig>,
    #[account(seeds=[b"goal",goal.owner.as_ref(),&goal.goal_id],seeds::program=nabungfi_multi::ID,bump=goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
}
#[derive(Accounts)]
pub struct LzReceive<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds=[STORE_SEED],bump=store.bump,constraint=store.route_sealed @ TransportError::UnsealedRoute)]
    pub store: Account<'info, Store>,
    #[account(seeds=[PEER_SEED,store.key().as_ref(),&peer.eid.to_be_bytes()],bump=peer.bump)]
    pub peer: Account<'info, PeerConfig>,
    #[account(mut,seeds=[b"goal",goal.owner.as_ref(),&goal.goal_id],seeds::program=nabungfi_multi::ID,bump=goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    /// CHECK: derived signer is supplied solely by this transport's CPI.
    #[account(seeds=[b"nabung-receiver",goal.key().as_ref()],bump)]
    pub receiver: UncheckedAccount<'info>,
    pub core_program: Program<'info, nabungfi_multi::program::NabungfiMulti>,
    /// CHECK: fixed executable transport identity required by the core.
    #[account(address=crate::ID,executable)]
    pub transport_program: UncheckedAccount<'info>,
}
#[derive(Accounts)]
pub struct ReceiveTypesInfo<'info> {
    #[account(seeds=[STORE_SEED],bump=oapp_account.bump)]
    pub oapp_account: Account<'info, Store>,
    #[account(seeds=[LZ_RECEIVE_TYPES_SEED,oapp_account.key().as_ref()],bump=receive_types.bump,constraint=receive_types.store==oapp_account.key())]
    pub receive_types: Account<'info, LzReceiveTypesAccounts>,
}
#[event]
pub struct MessageSubmitted {
    pub goal: Pubkey,
    pub domain: u32,
    pub sequence: u64,
    pub guid: [u8; 32],
}
#[error_code]
pub enum TransportError {
    #[msg("Only upgrade authority may bootstrap")]
    BootstrapAuthority,
    #[msg("Invalid fixed peer")]
    InvalidPeer,
    #[msg("Every global peer must be initialized")]
    MissingPeer,
    #[msg("Route has been sealed")]
    SealedRoute,
    #[msg("Route not sealed")]
    UnsealedRoute,
    #[msg("Wrong Endpoint account list")]
    MissingEndpointAccounts,
    #[msg("Signed fee payer missing")]
    MissingFeePayer,
    #[msg("Invalid v2 packet")]
    InvalidPacket,
}
#[cfg(test)]
mod tests;
