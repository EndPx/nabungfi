//! Fixed-width big-endian messages. Never forward Anchor/Borsh bytes as EVM ABI.
use crate::state::NabungError;
use anchor_lang::prelude::*;

pub const LENGTH: usize = 222;
pub const PREPARE: u8 = 1;
pub const COMMIT: u8 = 2;
pub const ABORT: u8 = 3;
pub const READY: u8 = 4;
pub const ABORT_ACK: u8 = 5;
pub const PROGRESS: u8 = 6;
pub const REGISTER: u8 = 7;
pub const REGISTERED: u8 = 8;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct Packet {
    pub kind: u8,
    pub source_domain: u32,
    pub destination_domain: u32,
    pub goal_id: [u8; 32],
    pub config_hash: [u8; 32],
    pub source: [u8; 32],
    pub destination: [u8; 32],
    pub evm_owner: [u8; 32],
    pub round: u64,
    pub sequence: u64,
    pub amount: u64,
    pub aggregate: u64,
    pub observation: u64,
    pub observed_at: u64,
}

pub fn evm_address(value: &[u8; 32]) -> bool {
    value[..12] == [0; 12] && value[12..] != [0; 20]
}

impl Packet {
    pub fn validate(&self) -> Result<()> {
        let from_solana = self.source_domain == 1 && (2..=4).contains(&self.destination_domain);
        let from_base = (2..=4).contains(&self.source_domain) && self.destination_domain == 1;
        require!(from_solana || from_base, NabungError::InvalidPacket);
        require!(
            self.goal_id != [0; 32]
                && self.config_hash != [0; 32]
                && self.source != [0; 32]
                && self.destination != [0; 32]
                && evm_address(&self.evm_owner)
                && evm_address(if from_base {
                    &self.source
                } else {
                    &self.destination
                }),
            NabungError::InvalidPacket
        );
        require!(
            (from_solana && matches!(self.kind, PREPARE | COMMIT | ABORT | REGISTER))
                || (from_base && matches!(self.kind, READY | ABORT_ACK | PROGRESS | REGISTERED)),
            NabungError::InvalidPacket
        );
        match self.kind {
            REGISTER | REGISTERED => require!(
                self.round == 0 && self.sequence == 0 && self.amount > 0 && self.aggregate == 0,
                NabungError::InvalidPacket
            ),
            PROGRESS => require!(
                self.round == 0 && self.sequence > 0 && self.aggregate == 0,
                NabungError::InvalidPacket
            ),
            _ => {
                require!(
                    self.round > 0 && self.sequence > 0,
                    NabungError::InvalidPacket
                );
                if self.kind == COMMIT {
                    require!(
                        self.aggregate > 0 && self.aggregate >= self.amount,
                        NabungError::InvalidPacket
                    );
                } else {
                    require!(self.aggregate == 0, NabungError::InvalidPacket);
                }
                if matches!(self.kind, PREPARE | ABORT | ABORT_ACK) {
                    require!(self.amount == 0, NabungError::InvalidPacket);
                }
            }
        }
        require!(
            self.observation > 0 && self.observed_at > 0,
            NabungError::InvalidPacket
        );
        Ok(())
    }

    pub fn encode(&self) -> Result<Vec<u8>> {
        self.validate()?;
        let mut raw = Vec::with_capacity(LENGTH);
        raw.extend_from_slice(b"NBFG");
        raw.extend_from_slice(&[2, self.kind]);
        raw.extend_from_slice(&self.source_domain.to_be_bytes());
        raw.extend_from_slice(&self.destination_domain.to_be_bytes());
        for field in [
            self.goal_id,
            self.config_hash,
            self.source,
            self.destination,
            self.evm_owner,
        ] {
            raw.extend_from_slice(&field);
        }
        for field in [
            self.round,
            self.sequence,
            self.amount,
            self.aggregate,
            self.observation,
            self.observed_at,
        ] {
            raw.extend_from_slice(&field.to_be_bytes());
        }
        Ok(raw)
    }

    pub fn decode(raw: &[u8]) -> Result<Self> {
        require!(raw.len() == LENGTH, NabungError::InvalidPacket);
        require!(
            &raw[..4] == b"NBFG" && raw[4] == 2,
            NabungError::InvalidPacket
        );
        // The fixed-length check above makes these conversions total.
        let field = |start: usize| -> [u8; 32] { raw[start..start + 32].try_into().unwrap() };
        let number = |start: usize| u64::from_be_bytes(raw[start..start + 8].try_into().unwrap());
        let packet = Self {
            kind: raw[5],
            source_domain: u32::from_be_bytes(raw[6..10].try_into().unwrap()),
            destination_domain: u32::from_be_bytes(raw[10..14].try_into().unwrap()),
            goal_id: field(14),
            config_hash: field(46),
            source: field(78),
            destination: field(110),
            evm_owner: field(142),
            round: number(174),
            sequence: number(182),
            amount: number(190),
            aggregate: number(198),
            observation: number(206),
            observed_at: number(214),
        };
        packet.validate()?;
        Ok(packet)
    }
}
