//! Direct cToken lending (no borrowing), built with Kamino's pinned official
//! interface. This is compiled integration code, not proof of executed CPI.
use super::*;
use anchor_lang::solana_program::instruction::Instruction;
use klend_interface::instructions::{deposit, withdraw};

pub fn validate(accounts: &KaminoPosition, for_supply: bool) -> Result<()> {
    let data = accounts.reserve.try_borrow_data()?;
    let reserve = klend_interface::from_account_data::<klend_interface::state::Reserve>(&data)
        .map_err(|_| error!(NabungError::WrongReserve))?;
    require_keys_eq!(
        reserve.lending_market,
        KAMINO_MARKET,
        NabungError::WrongReserve
    );
    require_keys_eq!(
        reserve.liquidity.mint_pubkey,
        USDC_MINT,
        NabungError::WrongMint
    );
    require_keys_eq!(
        reserve.liquidity.token_program,
        token::ID,
        NabungError::WrongMint
    );
    require_keys_eq!(
        reserve.collateral.mint_pubkey,
        accounts.collateral_mint.key(),
        NabungError::WrongReserve
    );
    require_keys_eq!(
        reserve.liquidity.supply_vault,
        accounts.reserve_liquidity_supply.key(),
        NabungError::WrongReserve
    );
    require!(reserve.mint_decimals() == 6, NabungError::WrongMint);
    if for_supply {
        require!(
            reserve.status() == 0 && !reserve.is_emergency_mode(),
            NabungError::ReserveUnavailable
        );
        require!(
            reserve.config.block_ctoken_usage == 0,
            NabungError::ReserveUnavailable
        );
        require!(
            reserve.config.debt_maturity_timestamp == 0 && reserve.config.debt_term_seconds == 0,
            NabungError::ReserveUnavailable
        );
        // Permissioned markets need a separate reviewed integration, not opaque
        // remaining accounts passed through by the keeper.
        require!(
            reserve.config.permissioned_ops == 0,
            NabungError::ReserveUnavailable
        );
    }
    Ok(())
}

pub fn deposit_instruction(accounts: &KaminoPosition, amount: u64) -> Instruction {
    deposit::deposit_reserve_liquidity(
        deposit::DepositReserveLiquidityAccounts {
            owner: accounts.goal.key(),
            reserve: accounts.reserve.key(),
            lending_market: accounts.lending_market.key(),
            lending_market_authority: accounts.lending_market_authority.key(),
            reserve_liquidity_mint: accounts.usdc_mint.key(),
            reserve_liquidity_supply: accounts.reserve_liquidity_supply.key(),
            reserve_collateral_mint: accounts.collateral_mint.key(),
            user_source_liquidity: accounts.usdc_vault.key(),
            user_destination_collateral: accounts.shares.key(),
            liquidity_token_program: token::ID,
        },
        amount,
    )
}

pub fn redeem_instruction(accounts: &KaminoPosition, shares: u64) -> Instruction {
    withdraw::redeem_reserve_collateral(
        withdraw::RedeemReserveCollateralAccounts {
            owner: accounts.goal.key(),
            lending_market: accounts.lending_market.key(),
            reserve: accounts.reserve.key(),
            lending_market_authority: accounts.lending_market_authority.key(),
            reserve_liquidity_mint: accounts.usdc_mint.key(),
            reserve_collateral_mint: accounts.collateral_mint.key(),
            reserve_liquidity_supply: accounts.reserve_liquidity_supply.key(),
            user_source_collateral: accounts.shares.key(),
            user_destination_liquidity: accounts.usdc_vault.key(),
            liquidity_token_program: token::ID,
        },
        shares,
    )
}

pub fn invoke<'info>(accounts: &KaminoPosition<'info>, instruction: Instruction) -> Result<()> {
    let bump = [accounts.goal.bump];
    let seeds: &[&[u8]] = &[
        b"goal",
        accounts.goal.owner.as_ref(),
        &accounts.goal.goal_id,
        &bump,
    ];
    invoke_signed(
        &instruction,
        &[
            accounts.goal.to_account_info(),
            accounts.reserve.to_account_info(),
            accounts.lending_market.to_account_info(),
            accounts.lending_market_authority.to_account_info(),
            accounts.usdc_mint.to_account_info(),
            accounts.reserve_liquidity_supply.to_account_info(),
            accounts.collateral_mint.to_account_info(),
            accounts.usdc_vault.to_account_info(),
            accounts.shares.to_account_info(),
            accounts.token_program.to_account_info(),
            accounts.instructions_sysvar.to_account_info(),
            accounts.kamino_program.to_account_info(),
        ],
        &[seeds],
    )?;
    Ok(())
}
