use anchor_lang::prelude::*;

// Application domains, NOT EVM chain IDs or LayerZero endpoint IDs.
pub const SOLANA_DOMAIN: u32 = 1;
pub const BASE_DOMAIN: u32 = 2;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum Phase {
    Locked,
    Preparing,
    Aborting,
    Achieved,
}

#[account]
#[derive(InitSpace, Debug)]
pub struct Goal {
    pub owner: Pubkey,
    pub goal_id: [u8; 32],
    pub config_hash: [u8; 32],
    pub target: u64,
    pub remote_owner: [u8; 32],
    pub remote_vault: [u8; 32],
    pub linked: bool,
    pub remote_net_assets: u64,
    pub remote_progress_sequence: u64,
    pub remote_observation: u64,
    pub remote_observed_at: u64,
    pub remote_received_at: u64,
    pub principal: u64,
    pub claimed: u64,
    pub round: u64,
    pub inbound_sequence: u64,
    pub outbound_sequence: u64,
    pub local_reserved: u64,
    pub local_ready_slot: u64,
    pub remote_reserved: u64,
    pub achieved_total: u64,
    pub local_ready: bool,
    pub remote_ready: bool,
    pub phase: Phase,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RemoteReport {
    pub goal_id: [u8; 32],
    pub config_hash: [u8; 32],
    pub round: u64,
    pub sequence: u64,
    pub source_domain: u32,
    pub source_vault: [u8; 32],
    pub amount: u64,
    pub observation: u64,
}

impl Goal {
    pub fn record_deposit(&mut self, amount: u64) -> Result<()> {
        require!(self.linked, NabungError::GoalNotRegistered);
        require!(self.phase == Phase::Locked, NabungError::WrongPhase);
        require!(amount > 0, NabungError::ZeroAmount);
        self.principal = self
            .principal
            .checked_add(amount)
            .ok_or(NabungError::Overflow)?;
        Ok(())
    }

    pub fn begin_prepare(&mut self) -> Result<()> {
        require!(self.linked, NabungError::GoalNotRegistered);
        require!(self.phase == Phase::Locked, NabungError::WrongPhase);
        let round = self.round.checked_add(1).ok_or(NabungError::Overflow)?;
        let sequence = self
            .outbound_sequence
            .checked_add(1)
            .ok_or(NabungError::Overflow)?;
        self.round = round;
        self.outbound_sequence = sequence;
        self.local_reserved = 0;
        self.remote_reserved = 0;
        self.local_ready = false;
        self.remote_ready = false;
        self.phase = Phase::Preparing;
        Ok(())
    }

    /// Only the handler passes actual token-account amounts to this function.
    pub fn reserve_local(
        &mut self,
        idle_usdc: u64,
        remaining_shares: u64,
        slot: u64,
    ) -> Result<()> {
        require!(self.phase == Phase::Preparing, NabungError::WrongPhase);
        require!(!self.local_ready, NabungError::AlreadyReady);
        require!(remaining_shares == 0, NabungError::StrategyNotExited);
        self.local_reserved = idle_usdc;
        self.local_ready_slot = slot;
        self.local_ready = true;
        Ok(())
    }

    fn validate_report(&self, report: &RemoteReport) -> Result<()> {
        require!(self.linked, NabungError::GoalNotRegistered);
        require!(report.goal_id == self.goal_id, NabungError::WrongGoal);
        require!(
            report.config_hash == self.config_hash,
            NabungError::WrongConfig
        );
        require!(report.source_domain == BASE_DOMAIN, NabungError::WrongPeer);
        require!(
            report.source_vault == self.remote_vault,
            NabungError::WrongPeer
        );
        require!(report.round == self.round, NabungError::WrongRound);
        require!(report.observation > 0, NabungError::InvalidObservation);
        let next = self
            .inbound_sequence
            .checked_add(1)
            .ok_or(NabungError::Overflow)?;
        require!(report.sequence == next, NabungError::WrongSequence);
        Ok(())
    }

    /// Called exclusively behind the transport-program PDA signer check.
    pub fn accept_remote_ready(&mut self, report: &RemoteReport) -> Result<()> {
        self.validate_report(report)?;
        require!(
            self.phase == Phase::Preparing || self.phase == Phase::Aborting,
            NabungError::WrongPhase
        );
        // A READY already in flight when ABORT was committed must be consumable
        // without restoring funds; otherwise strict sequencing blocks ABORT_ACK.
        if self.phase == Phase::Preparing {
            require!(!self.remote_ready, NabungError::AlreadyReady);
            self.remote_reserved = report.amount;
            self.remote_ready = true;
        }
        self.inbound_sequence = report.sequence;
        Ok(())
    }

    pub fn achieve(&mut self, actual_idle: u64, remaining_shares: u64, slot: u64) -> Result<()> {
        require!(self.phase == Phase::Preparing, NabungError::WrongPhase);
        require!(
            self.local_ready && self.remote_ready,
            NabungError::MissingReady
        );
        require!(
            slot > self.local_ready_slot,
            NabungError::ReadinessTooRecent
        );
        require!(remaining_shares == 0, NabungError::StrategyNotExited);
        require!(
            actual_idle >= self.local_reserved,
            NabungError::ReserveReduced
        );
        let total = self
            .local_reserved
            .checked_add(self.remote_reserved)
            .ok_or(NabungError::Overflow)?;
        require!(total >= self.target, NabungError::TargetNotMet);
        let sequence = self
            .outbound_sequence
            .checked_add(1)
            .ok_or(NabungError::Overflow)?;
        self.achieved_total = total;
        self.outbound_sequence = sequence;
        self.phase = Phase::Achieved;
        Ok(())
    }

    pub fn begin_abort(&mut self) -> Result<()> {
        require!(self.phase == Phase::Preparing, NabungError::WrongPhase);
        let sequence = self
            .outbound_sequence
            .checked_add(1)
            .ok_or(NabungError::Overflow)?;
        self.outbound_sequence = sequence;
        self.phase = Phase::Aborting;
        // Keep all local funds unavailable until the remote reset is acknowledged.
        Ok(())
    }

    pub fn accept_abort_ack(&mut self, report: &RemoteReport) -> Result<()> {
        self.validate_report(report)?;
        require!(self.phase == Phase::Aborting, NabungError::WrongPhase);
        require!(report.amount == 0, NabungError::InvalidAbortAck);
        self.inbound_sequence = report.sequence;
        self.local_reserved = 0;
        self.remote_reserved = 0;
        self.local_ready = false;
        self.remote_ready = false;
        self.phase = Phase::Locked;
        Ok(())
    }

    pub fn record_claim(&mut self, amount: u64, actual_idle: u64) -> Result<()> {
        require!(self.phase == Phase::Achieved, NabungError::StillLocked);
        require!(amount > 0, NabungError::ZeroAmount);
        require!(amount <= actual_idle, NabungError::InsufficientFunds);
        self.claimed = self
            .claimed
            .checked_add(amount)
            .ok_or(NabungError::Overflow)?;
        // Achievement never changes after claims, including a full local claim.
        Ok(())
    }
}

#[error_code]
pub enum NabungError {
    #[msg("Operation is not permitted in this lifecycle phase")]
    WrongPhase,
    #[msg("Amount must be positive")]
    ZeroAmount,
    #[msg("Integer overflow")]
    Overflow,
    #[msg("Goal is already ready for this round")]
    AlreadyReady,
    #[msg("All strategy shares must be redeemed before readiness")]
    StrategyNotExited,
    #[msg("Wrong goal identity")]
    WrongGoal,
    #[msg("Wrong immutable configuration hash")]
    WrongConfig,
    #[msg("Unregistered source domain or vault")]
    WrongPeer,
    #[msg("Wrong completion round")]
    WrongRound,
    #[msg("Duplicate, stale or out-of-order sequence")]
    WrongSequence,
    #[msg("Observation reference must be nonzero")]
    InvalidObservation,
    #[msg("Both registered vaults must acknowledge readiness")]
    MissingReady,
    #[msg("Reserved local USDC is no longer available")]
    ReserveReduced,
    #[msg("Realized reserved funds do not meet the target")]
    TargetNotMet,
    #[msg("Abort acknowledgement must have zero amount")]
    InvalidAbortAck,
    #[msg("Funds remain locked until global achievement")]
    StillLocked,
    #[msg("Not enough local USDC")]
    InsufficientFunds,
    #[msg("Invalid immutable goal configuration")]
    InvalidConfig,
    #[msg("Wrong token mint or token program")]
    WrongMint,
    #[msg("Selected Kamino reserve does not match its expected configuration")]
    WrongReserve,
    #[msg("Selected reserve is unavailable for new supplies")]
    ReserveUnavailable,
    #[msg("Token movement did not satisfy the minimum result")]
    MinimumNotReceived,
    #[msg("Token movement did not match the requested amount")]
    UnexpectedTokenMovement,
    #[msg("Transport receiver is not the registered program-derived signer")]
    InvalidTransport,
    #[msg("Local reserve must remain prepared across a slot boundary")]
    ReadinessTooRecent,
    #[msg("Malformed or unsupported crosschain packet")]
    InvalidPacket,
    #[msg("Authenticated registration of the goal pair is not complete")]
    GoalNotRegistered,
    #[msg("Yield strategy is disabled in the cash-only Devnet profile")]
    StrategyDisabled,
}
