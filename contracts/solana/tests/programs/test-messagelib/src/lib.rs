#![allow(unexpected_cfgs)]
//! TEST ONLY. Fixed-price SBF library for Endpoint CPI/fee/packet tests, not a DVN or ULN.
//! Never wire this program into a funded public route.
use anchor_lang::{
    prelude::*,
    system_program::{self, Transfer},
};
use messagelib_interface::{MessagingFee, QuoteParams, SendParams};

declare_id!("4HvzfJA1PjENpgoofQxNyogKQeBqsEX54w8r8quvbgwG");
const ENDPOINT: Pubkey = pubkey!("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6");
pub const TEST_FEE: u64 = 10_000;

#[program]
pub mod nabungfi_test_messagelib {
    use super::*;

    pub fn quote(_ctx: Context<Quote>, params: QuoteParams) -> Result<MessagingFee> {
        require!(!params.pay_in_lz_token, TestError::UnsupportedToken);
        Ok(MessagingFee {
            native_fee: TEST_FEE,
            lz_token_fee: 0,
        })
    }

    pub fn send(ctx: Context<Send>, params: SendParams) -> Result<(MessagingFee, Vec<u8>)> {
        require!(params.native_fee >= TEST_FEE, TestError::InsufficientFee);
        require!(
            params.packet.message.len() <= 222,
            TestError::OversizedPacket
        );
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.record.to_account_info(),
                },
            ),
            TEST_FEE,
        )?;
        ctx.accounts.record.sender = params.packet.sender;
        ctx.accounts.record.receiver = params.packet.receiver;
        ctx.accounts.record.destination_eid = params.packet.dst_eid;
        ctx.accounts.record.nonce = params.packet.nonce;
        ctx.accounts.record.message = params.packet.message.clone();
        Ok((
            MessagingFee {
                native_fee: TEST_FEE,
                lz_token_fee: 0,
            },
            params.packet.message,
        ))
    }
}

#[derive(Accounts)]
pub struct Quote<'info> {
    #[account(address = endpoint_signer())]
    pub endpoint: Signer<'info>,
}

#[derive(Accounts)]
pub struct Send<'info> {
    #[account(address = endpoint_signer())]
    pub endpoint: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"test-record"], bump)]
    pub record: Account<'info, Record>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Record {
    pub sender: Pubkey,
    pub receiver: [u8; 32],
    pub destination_eid: u32,
    pub nonce: u64,
    #[max_len(222)]
    pub message: Vec<u8>,
}

fn endpoint_signer() -> Pubkey {
    let library = Pubkey::find_program_address(&[b"MessageLib"], &crate::ID).0;
    Pubkey::find_program_address(&[b"MessageLib", library.as_ref()], &ENDPOINT).0
}

#[error_code]
pub enum TestError {
    UnsupportedToken,
    InsufficientFee,
    OversizedPacket,
}
