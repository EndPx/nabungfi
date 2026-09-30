use crate::wire::{self, Packet};
use anchor_lang::prelude::*;

pub fn eid_for_domain(domain: u32) -> Result<u32> {
    match domain {
        2 => Ok(40245),
        3 => Ok(40231),
        4 => Ok(40161),
        _ => err!(NabungError::WrongPeer),
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum Phase {
    Locked,
    Preparing,
    Aborting,
    Achieved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct Participant {
    pub domain: u32,
    pub eid: u32,
    pub asset: [u8; 32],
    pub router: [u8; 32],
    pub vault: [u8; 32],
    pub owner: [u8; 32],
    pub config_hash: [u8; 32],
    pub linked: bool,
    pub net_assets: u64,
    pub progress_sequence: u64,
    pub observation: u64,
    pub observed_at: u64,
    pub received_at: u64,
    pub inbound_sequence: u64,
    pub reserved: u64,
    pub ready: bool,
    pub abort_ack: bool,
}

#[account]
#[derive(InitSpace, Debug)]
pub struct Goal {
    pub owner: Pubkey,
    pub goal_id: [u8; 32],
    pub target: u64,
    pub principal: u64,
    pub claimed: u64,
    pub round: u64,
    pub outbound_sequence: u64,
    pub local_reserved: u64,
    pub local_ready_slot: u64,
    pub achieved_total: u64,
    pub local_ready: bool,
    pub phase: Phase,
    pub bump: u8,
    #[max_len(3)]
    pub participants: Vec<Participant>,
}

impl Goal {
    pub fn all_linked(&self) -> bool {
        !self.participants.is_empty() && self.participants.iter().all(|p| p.linked)
    }
    pub fn participant_index(&self, domain: u32) -> Result<usize> {
        self.participants
            .iter()
            .position(|p| p.domain == domain)
            .ok_or_else(|| error!(NabungError::WrongPeer))
    }
    pub fn record_deposit(&mut self, amount: u64) -> Result<()> {
        require!(self.all_linked(), NabungError::GoalNotRegistered);
        require!(self.phase == Phase::Locked, NabungError::WrongPhase);
        require!(amount > 0, NabungError::ZeroAmount);
        self.principal = self
            .principal
            .checked_add(amount)
            .ok_or(NabungError::Overflow)?;
        Ok(())
    }
    pub fn begin_prepare(&mut self) -> Result<()> {
        require!(self.all_linked(), NabungError::GoalNotRegistered);
        require!(self.phase == Phase::Locked, NabungError::WrongPhase);
        let round = self.round.checked_add(1).ok_or(NabungError::Overflow)?;
        let sequence = self
            .outbound_sequence
            .checked_add(1)
            .ok_or(NabungError::Overflow)?;
        self.round = round;
        self.outbound_sequence = sequence;
        self.local_reserved = 0;
        self.local_ready = false;
        for p in &mut self.participants {
            p.ready = false;
            p.reserved = 0;
            p.abort_ack = false;
        }
        self.phase = Phase::Preparing;
        Ok(())
    }
    pub fn reserve_local(&mut self, actual: u64, slot: u64) -> Result<()> {
        require!(self.phase == Phase::Preparing, NabungError::WrongPhase);
        require!(!self.local_ready, NabungError::AlreadyReady);
        self.local_reserved = actual;
        self.local_ready_slot = slot;
        self.local_ready = true;
        Ok(())
    }
    pub fn validate_incoming(&self, packet: &Packet, key: Pubkey) -> Result<usize> {
        packet.validate()?;
        require!(packet.goal_id == self.goal_id, NabungError::WrongGoal);
        let index = self.participant_index(packet.source_domain)?;
        let p = &self.participants[index];
        require!(
            packet.destination == key.to_bytes()
                && packet.destination_domain == 1
                && packet.source == p.vault
                && packet.evm_owner == p.owner,
            NabungError::WrongPeer
        );
        require!(
            packet.config_hash == p.config_hash,
            NabungError::WrongConfig
        );
        Ok(index)
    }
    pub fn receive_packet(&mut self, packet: &Packet, key: Pubkey, now: u64) -> Result<()> {
        let index = self.validate_incoming(packet, key)?;
        if packet.kind == wire::REGISTERED {
            require!(packet.amount == self.target, NabungError::InvalidConfig);
            self.participants[index].linked = true;
            return Ok(());
        }
        require!(
            self.participants[index].linked,
            NabungError::GoalNotRegistered
        );
        if packet.kind == wire::PROGRESS {
            let p = &mut self.participants[index];
            if packet.sequence <= p.progress_sequence {
                return Ok(());
            }
            p.net_assets = packet.amount;
            p.progress_sequence = packet.sequence;
            p.observation = packet.observation;
            p.observed_at = packet.observed_at;
            p.received_at = now;
            return Ok(());
        }
        let p = &self.participants[index];
        if packet.sequence <= p.inbound_sequence {
            return Ok(());
        }
        require!(
            packet.sequence
                == p.inbound_sequence
                    .checked_add(1)
                    .ok_or(NabungError::Overflow)?,
            NabungError::WrongSequence
        );
        require!(packet.round == self.round, NabungError::WrongRound);
        match packet.kind {
            wire::READY => {
                require!(
                    self.phase == Phase::Preparing || self.phase == Phase::Aborting,
                    NabungError::WrongPhase
                );
                let p = &mut self.participants[index];
                if self.phase == Phase::Preparing {
                    require!(!p.ready, NabungError::AlreadyReady);
                    p.ready = true;
                    p.reserved = packet.amount;
                }
                p.inbound_sequence = packet.sequence;
            }
            wire::ABORT_ACK => {
                require!(self.phase == Phase::Aborting, NabungError::WrongPhase);
                let p = &mut self.participants[index];
                require!(!p.abort_ack, NabungError::InvalidAbortAck);
                p.abort_ack = true;
                p.inbound_sequence = packet.sequence;
                if self.participants.iter().all(|p| p.abort_ack) {
                    self.local_reserved = 0;
                    self.local_ready = false;
                    for p in &mut self.participants {
                        p.reserved = 0;
                        p.ready = false;
                        p.abort_ack = false;
                    }
                    self.phase = Phase::Locked;
                }
            }
            _ => return err!(NabungError::InvalidPacket),
        };
        Ok(())
    }
    pub fn achieve(&mut self, actual: u64, slot: u64) -> Result<()> {
        require!(self.phase == Phase::Preparing, NabungError::WrongPhase);
        require!(
            self.local_ready && self.participants.iter().all(|p| p.ready),
            NabungError::MissingReady
        );
        require!(
            slot > self.local_ready_slot,
            NabungError::ReadinessTooRecent
        );
        require!(actual >= self.local_reserved, NabungError::ReserveReduced);
        let total = self
            .participants
            .iter()
            .try_fold(self.local_reserved, |sum, p| {
                sum.checked_add(p.reserved).ok_or(NabungError::Overflow)
            })?;
        require!(total >= self.target, NabungError::TargetNotMet);
        let seq = self
            .outbound_sequence
            .checked_add(1)
            .ok_or(NabungError::Overflow)?;
        self.achieved_total = total;
        self.outbound_sequence = seq;
        self.phase = Phase::Achieved;
        Ok(())
    }
    pub fn begin_abort(&mut self) -> Result<()> {
        require!(self.phase == Phase::Preparing, NabungError::WrongPhase);
        self.outbound_sequence = self
            .outbound_sequence
            .checked_add(1)
            .ok_or(NabungError::Overflow)?;
        self.phase = Phase::Aborting;
        Ok(())
    }
    pub fn record_claim(&mut self, amount: u64, actual: u64) -> Result<()> {
        require!(self.phase == Phase::Achieved, NabungError::StillLocked);
        require!(amount > 0, NabungError::ZeroAmount);
        require!(amount <= actual, NabungError::InsufficientFunds);
        self.claimed = self
            .claimed
            .checked_add(amount)
            .ok_or(NabungError::Overflow)?;
        Ok(())
    }
    pub fn packet(
        &self,
        key: Pubkey,
        domain: u32,
        sequence: u64,
        observation: u64,
        now: u64,
    ) -> Result<Packet> {
        let p = &self.participants[self.participant_index(domain)?];
        let kind = if sequence == 0 {
            wire::REGISTER
        } else {
            require!(self.all_linked(), NabungError::GoalNotRegistered);
            let current = sequence == self.outbound_sequence;
            let previous = sequence.checked_add(1) == Some(self.outbound_sequence);
            match self.phase {
                Phase::Preparing if current => wire::PREPARE,
                Phase::Aborting | Phase::Achieved if previous => wire::PREPARE,
                Phase::Aborting if current => wire::ABORT,
                Phase::Achieved if current => wire::COMMIT,
                _ => return err!(NabungError::WrongSequence),
            }
        };
        let packet = Packet {
            kind,
            source_domain: 1,
            destination_domain: domain,
            goal_id: self.goal_id,
            config_hash: p.config_hash,
            source: key.to_bytes(),
            destination: p.vault,
            evm_owner: p.owner,
            round: if sequence == 0 { 0 } else { self.round },
            sequence,
            amount: if sequence == 0 {
                self.target
            } else if kind == wire::COMMIT {
                p.reserved
            } else {
                0
            },
            aggregate: if kind == wire::COMMIT {
                self.achieved_total
            } else {
                0
            },
            observation,
            observed_at: now,
        };
        packet.validate()?;
        Ok(packet)
    }
}

#[error_code]
pub enum NabungError {
    #[msg("Wrong lifecycle phase")]
    WrongPhase,
    #[msg("Amount must be positive")]
    ZeroAmount,
    #[msg("Integer overflow")]
    Overflow,
    #[msg("Already ready")]
    AlreadyReady,
    #[msg("Wrong goal")]
    WrongGoal,
    #[msg("Wrong immutable configuration")]
    WrongConfig,
    #[msg("Wrong registered peer")]
    WrongPeer,
    #[msg("Wrong round")]
    WrongRound,
    #[msg("Out of order lifecycle sequence")]
    WrongSequence,
    #[msg("Every participant must be ready")]
    MissingReady,
    #[msg("Reserved balance reduced")]
    ReserveReduced,
    #[msg("Target not met")]
    TargetNotMet,
    #[msg("Invalid abort acknowledgement")]
    InvalidAbortAck,
    #[msg("Funds remain locked")]
    StillLocked,
    #[msg("Not enough local USDC")]
    InsufficientFunds,
    #[msg("Invalid immutable configuration")]
    InvalidConfig,
    #[msg("Wrong token mint")]
    WrongMint,
    #[msg("Unexpected token movement")]
    UnexpectedTokenMovement,
    #[msg("Unauthorized transport signer")]
    InvalidTransport,
    #[msg("Readiness must cross a slot boundary")]
    ReadinessTooRecent,
    #[msg("Invalid v2 packet")]
    InvalidPacket,
    #[msg("Every participant must be registered")]
    GoalNotRegistered,
}
