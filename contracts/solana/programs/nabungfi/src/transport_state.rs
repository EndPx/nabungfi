use crate::{state::*, wire::*};
use anchor_lang::prelude::*;

impl Goal {
    fn validate_packet_goal(&self, packet: &Packet, goal_key: Pubkey) -> Result<()> {
        packet.validate()?;
        require!(packet.goal_id == self.goal_id, NabungError::WrongGoal);
        require!(
            packet.config_hash == self.config_hash,
            NabungError::WrongConfig
        );
        require!(
            packet.source_domain == BASE_DOMAIN
                && packet.source == self.remote_vault
                && packet.destination == goal_key.to_bytes()
                && packet.base_owner == self.remote_owner,
            NabungError::WrongPeer
        );
        Ok(())
    }

    pub fn accept_registration(&mut self, packet: &Packet, goal_key: Pubkey) -> Result<()> {
        self.validate_packet_goal(packet, goal_key)?;
        require!(
            packet.kind == REGISTERED && packet.amount == self.target,
            NabungError::InvalidConfig
        );
        self.linked = true;
        Ok(())
    }

    pub fn accept_progress(
        &mut self,
        packet: &Packet,
        goal_key: Pubkey,
        received_at: u64,
    ) -> Result<()> {
        self.validate_packet_goal(packet, goal_key)?;
        require!(self.linked, NabungError::GoalNotRegistered);
        require!(packet.kind == PROGRESS, NabungError::InvalidPacket);
        if packet.sequence <= self.remote_progress_sequence {
            return Ok(());
        }
        // Absolute snapshots may decrease after losses or claims; never add or max them.
        self.remote_net_assets = packet.amount;
        self.remote_progress_sequence = packet.sequence;
        self.remote_observation = packet.observation;
        self.remote_observed_at = packet.observed_at;
        self.remote_received_at = received_at;
        Ok(())
    }

    pub fn registration_packet(&self, goal_key: Pubkey, observation: u64, now: u64) -> Packet {
        Packet {
            kind: REGISTER,
            source_domain: SOLANA_DOMAIN,
            destination_domain: BASE_DOMAIN,
            goal_id: self.goal_id,
            config_hash: self.config_hash,
            source: goal_key.to_bytes(),
            destination: self.remote_vault,
            base_owner: self.remote_owner,
            round: 0,
            sequence: 0,
            amount: self.target,
            aggregate: 0,
            observation,
            observed_at: now,
        }
    }

    /// PREPARE remains reproducible during ABORT/COMMIT, preserving an unsent predecessor.
    /// ABORT_ACK proves delivery of the aborted round before a new round may begin.
    pub fn command_packet(
        &self,
        goal_key: Pubkey,
        sequence: u64,
        observation: u64,
        now: u64,
    ) -> Result<Packet> {
        require!(self.linked, NabungError::GoalNotRegistered);
        let current = sequence == self.outbound_sequence;
        let previous = sequence.checked_add(1) == Some(self.outbound_sequence);
        let kind = match self.phase {
            Phase::Preparing if current => PREPARE,
            Phase::Aborting | Phase::Achieved if previous => PREPARE,
            Phase::Aborting if current => ABORT,
            Phase::Achieved if current => COMMIT,
            _ => return err!(NabungError::WrongSequence),
        };
        let mut packet = self.registration_packet(goal_key, observation, now);
        packet.kind = kind;
        packet.round = self.round;
        packet.sequence = sequence;
        packet.amount = if kind == COMMIT {
            self.remote_reserved
        } else {
            0
        };
        packet.aggregate = if kind == COMMIT {
            self.achieved_total
        } else {
            0
        };
        packet.validate()?;
        Ok(packet)
    }
}
