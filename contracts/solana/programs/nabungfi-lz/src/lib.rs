#![allow(unexpected_cfgs)]
//! LayerZero V2 OApp transport. Source integration is not a deployed pathway.
use anchor_lang::prelude::*;
use endpoint::instructions::{
    ClearParams, QuoteParams, RegisterOAppParams, SendParams, SetDelegateParams,
};
use nabungfi::{
    state::{Goal, RemoteReport},
    wire::{self, Packet},
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

// Local development identity; it matches nabungfi::TRANSPORT_PROGRAM. No key/deployment is supplied.
declare_id!("6Ckm2BrnXxsSjyG5b17kQQRjoECVrts92RKXVGT8XeqS");
pub const STORE_SEED: &[u8] = b"Store";
pub const PEER_SEED: &[u8] = b"Peer";

#[program]
pub mod nabungfi_lz {
    use super::*;

    pub fn initialize<'info>(
        ctx: Context<'_, '_, '_, 'info, Initialize<'info>>,
        args: InitializeArgs,
    ) -> Result<()> {
        require!(
            args.base_eid > 0 && wire::evm_address(&args.base_peer),
            TransportError::InvalidPeer
        );
        require!(
            ctx.remaining_accounts.len() >= endpoint::cpi::accounts::RegisterOApp::MIN_ACCOUNTS_LEN,
            TransportError::MissingEndpointAccounts
        );
        ctx.accounts.store.set_inner(Store {
            administrator: ctx.accounts.administrator.key(),
            endpoint: endpoint::ID,
            base_eid: args.base_eid,
            route_sealed: false,
            bump: ctx.bumps.store,
        });
        ctx.accounts.peer.set_inner(PeerConfig {
            peer_address: args.base_peer,
            bump: ctx.bumps.peer,
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

    /// Seal after explicit endpoint library/DVN/nonce configuration. The delegate becomes this PDA.
    pub fn seal_route<'info>(ctx: Context<'_, '_, '_, 'info, SealRoute<'info>>) -> Result<()> {
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

    /// sequence=0 publishes registration; positive values select an actual coordinator command.
    pub fn quote<'info>(
        ctx: Context<'_, '_, '_, 'info, ReadGoal<'info>>,
        sequence: u64,
        options: Vec<u8>,
    ) -> Result<MessagingFee> {
        require!(
            ctx.remaining_accounts.len() >= endpoint::cpi::accounts::Quote::MIN_ACCOUNTS_LEN,
            TransportError::MissingEndpointAccounts
        );
        let message = outgoing(&ctx.accounts.goal, ctx.accounts.goal.key(), sequence)?.encode()?;
        endpoint_cpi::quote(
            endpoint::ID,
            ctx.remaining_accounts,
            QuoteParams {
                sender: ctx.accounts.store.key(),
                dst_eid: ctx.accounts.store.base_eid,
                receiver: ctx.accounts.peer.peer_address,
                message,
                options,
                pay_in_lz_token: false,
            },
        )
    }

    pub fn send<'info>(
        ctx: Context<'_, '_, '_, 'info, SendGoal<'info>>,
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
        let message = outgoing(&ctx.accounts.goal, ctx.accounts.goal.key(), sequence)?.encode()?;
        let bump = [ctx.accounts.store.bump];
        let receipt = endpoint_cpi::send(
            endpoint::ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            &[STORE_SEED, &bump],
            SendParams {
                dst_eid: ctx.accounts.store.base_eid,
                receiver: ctx.accounts.peer.peer_address,
                message,
                options,
                native_fee,
                lz_token_fee: 0,
            },
        )?;
        emit!(MessageSubmitted {
            goal: ctx.accounts.goal.key(),
            application_sequence: sequence,
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
            &ctx.accounts.store,
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
        let store_bump = [ctx.accounts.store.bump];
        // Clear verifies the endpoint's committed payload and replay protection before any core CPI.
        endpoint_cpi::clear(
            endpoint::ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            &[STORE_SEED, &store_bump],
            ClearParams {
                receiver: ctx.accounts.store.key(),
                src_eid: params.src_eid,
                sender: params.sender,
                nonce: params.nonce,
                guid: params.guid,
                message: params.message,
            },
        )?;
        if matches!(packet.kind, wire::READY | wire::ABORT_ACK)
            && packet.sequence <= ctx.accounts.goal.inbound_sequence
        {
            return Ok(());
        }
        let key = ctx.accounts.goal.key();
        let receiver_bump = [ctx.bumps.receiver];
        let seeds: &[&[u8]] = &[b"nabung-receiver", key.as_ref(), &receiver_bump];
        let cpi = nabungfi::cpi::accounts::AuthenticatedReport {
            goal: ctx.accounts.goal.to_account_info(),
            receiver: ctx.accounts.receiver.to_account_info(),
            transport_program: ctx.accounts.transport_program.to_account_info(),
        };
        let signer = &[seeds];
        let cpi =
            CpiContext::new_with_signer(ctx.accounts.core_program.to_account_info(), cpi, signer);
        match packet.kind {
            wire::REGISTERED => nabungfi::cpi::receive_registered(cpi, packet),
            wire::PROGRESS => nabungfi::cpi::receive_progress(cpi, packet),
            wire::READY | wire::ABORT_ACK => {
                let report = RemoteReport {
                    goal_id: packet.goal_id,
                    config_hash: packet.config_hash,
                    round: packet.round,
                    sequence: packet.sequence,
                    source_domain: packet.source_domain,
                    source_vault: packet.source,
                    amount: packet.amount,
                    observation: packet.observation,
                };
                if packet.kind == wire::READY {
                    nabungfi::cpi::receive_ready(cpi, report)
                } else {
                    nabungfi::cpi::receive_abort_ack(cpi, report)
                }
            }
            _ => err!(TransportError::InvalidPacket),
        }
    }

    pub fn lz_receive_types_info(
        ctx: Context<ReceiveTypesInfo>,
        params: LzReceiveParams,
    ) -> Result<(u8, LzReceiveTypesV2Accounts)> {
        let packet = Packet::decode(&params.message)?;
        require!(
            params.src_eid == ctx.accounts.oapp_account.base_eid,
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
            &ctx.accounts.store,
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

fn outgoing(goal: &Goal, key: Pubkey, sequence: u64) -> Result<Packet> {
    let clock = Clock::get()?;
    let now = u64::try_from(clock.unix_timestamp).map_err(|_| TransportError::InvalidPacket)?;
    let packet = if sequence == 0 {
        goal.registration_packet(key, clock.slot, now)
    } else {
        goal.command_packet(key, sequence, clock.slot, now)?
    };
    packet.validate()?;
    Ok(packet)
}

pub fn validate_incoming(
    store: &Store,
    peer: &PeerConfig,
    goal: &Goal,
    goal_key: Pubkey,
    params: &LzReceiveParams,
    packet: &Packet,
) -> Result<()> {
    require!(
        store.route_sealed && store.endpoint == endpoint::ID,
        TransportError::UnsealedRoute
    );
    require!(
        params.src_eid == store.base_eid && params.sender == peer.peer_address,
        TransportError::InvalidPeer
    );
    require!(
        packet.source_domain == 2
            && packet.destination_domain == 1
            && packet.source == goal.remote_vault
            && packet.destination == goal_key.to_bytes()
            && packet.goal_id == goal.goal_id
            && packet.config_hash == goal.config_hash
            && packet.base_owner == goal.remote_owner,
        TransportError::InvalidPacket
    );
    Ok(())
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
            pubkey: nabungfi::ID.into(),
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
pub struct InitializeArgs {
    pub base_eid: u32,
    pub base_peer: [u8; 32],
}

#[account]
#[derive(InitSpace)]
pub struct Store {
    pub administrator: Pubkey,
    pub endpoint: Pubkey,
    pub base_eid: u32,
    pub route_sealed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PeerConfig {
    pub peer_address: [u8; 32],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LzReceiveTypesAccounts {
    pub store: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(args: InitializeArgs)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub administrator: Signer<'info>,
    #[account(address = crate::ID)]
    pub program: Program<'info, crate::program::NabungfiLz>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ TransportError::BootstrapAuthority,
        constraint = program_data.upgrade_authority_address == Some(administrator.key()) @ TransportError::BootstrapAuthority)]
    pub program_data: Account<'info, ProgramData>,
    #[account(init, payer = administrator, space = 8 + Store::INIT_SPACE, seeds = [STORE_SEED], bump)]
    pub store: Account<'info, Store>,
    #[account(init, payer = administrator, space = 8 + PeerConfig::INIT_SPACE,
        seeds = [PEER_SEED, store.key().as_ref(), &args.base_eid.to_be_bytes()], bump)]
    pub peer: Account<'info, PeerConfig>,
    #[account(init, payer = administrator, space = 8 + LzReceiveTypesAccounts::INIT_SPACE,
        seeds = [LZ_RECEIVE_TYPES_SEED, store.key().as_ref()], bump)]
    pub receive_types: Account<'info, LzReceiveTypesAccounts>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SealRoute<'info> {
    pub administrator: Signer<'info>,
    #[account(mut, seeds = [STORE_SEED], bump = store.bump, has_one = administrator)]
    pub store: Account<'info, Store>,
}

#[derive(Accounts)]
pub struct ReadGoal<'info> {
    #[account(seeds = [STORE_SEED], bump = store.bump, constraint = store.route_sealed @ TransportError::UnsealedRoute)]
    pub store: Account<'info, Store>,
    #[account(seeds = [PEER_SEED, store.key().as_ref(), &store.base_eid.to_be_bytes()], bump = peer.bump)]
    pub peer: Account<'info, PeerConfig>,
    #[account(seeds = [b"goal", goal.owner.as_ref(), &goal.goal_id], seeds::program = nabungfi::ID, bump = goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
}

#[derive(Accounts)]
pub struct SendGoal<'info> {
    pub payer: Signer<'info>,
    #[account(seeds = [STORE_SEED], bump = store.bump, constraint = store.route_sealed @ TransportError::UnsealedRoute)]
    pub store: Account<'info, Store>,
    #[account(seeds = [PEER_SEED, store.key().as_ref(), &store.base_eid.to_be_bytes()], bump = peer.bump)]
    pub peer: Account<'info, PeerConfig>,
    #[account(seeds = [b"goal", goal.owner.as_ref(), &goal.goal_id], seeds::program = nabungfi::ID, bump = goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
}

#[derive(Accounts)]
pub struct LzReceive<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [STORE_SEED], bump = store.bump, constraint = store.route_sealed @ TransportError::UnsealedRoute)]
    pub store: Account<'info, Store>,
    #[account(seeds = [PEER_SEED, store.key().as_ref(), &store.base_eid.to_be_bytes()], bump = peer.bump)]
    pub peer: Account<'info, PeerConfig>,
    #[account(mut, seeds = [b"goal", goal.owner.as_ref(), &goal.goal_id], seeds::program = nabungfi::ID, bump = goal.bump)]
    pub goal: Box<Account<'info, Goal>>,
    /// CHECK: Only this transport program can supply the derived signer to the core CPI.
    #[account(seeds = [b"nabung-receiver", goal.key().as_ref()], bump)]
    pub receiver: UncheckedAccount<'info>,
    pub core_program: Program<'info, nabungfi::program::Nabungfi>,
    /// CHECK: Fixed executable transport identity required by the core program.
    #[account(address = crate::ID, executable)]
    pub transport_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ReceiveTypesInfo<'info> {
    #[account(seeds = [STORE_SEED], bump = oapp_account.bump)]
    pub oapp_account: Account<'info, Store>,
    #[account(seeds = [LZ_RECEIVE_TYPES_SEED, oapp_account.key().as_ref()], bump = receive_types.bump,
        constraint = receive_types.store == oapp_account.key())]
    pub receive_types: Account<'info, LzReceiveTypesAccounts>,
}

#[event]
pub struct MessageSubmitted {
    pub goal: Pubkey,
    pub application_sequence: u64,
    pub guid: [u8; 32],
}

#[error_code]
pub enum TransportError {
    #[msg("Only the program upgrade authority can initialize the transport")]
    BootstrapAuthority,
    #[msg("LayerZero peer or source endpoint is not registered")]
    InvalidPeer,
    #[msg("Route configuration is not sealed")]
    UnsealedRoute,
    #[msg("Wrong endpoint account list")]
    MissingEndpointAccounts,
    #[msg("The signed fee payer must be present in the endpoint account list")]
    MissingFeePayer,
    #[msg("Packet does not match the registered goal")]
    InvalidPacket,
}

#[cfg(test)]
mod tests;
