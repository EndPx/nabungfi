use super::*;
use anchor_lang::{
    solana_program::{program_error::ProgramError, program_option::COption, program_pack::Pack},
    AccountDeserialize,
};
use anchor_spl::token::spl_token::state::Mint as SplMint;

#[test]
fn inert_mint_requires_zero_supply_and_revoked_authorities() {
    for (supply, mint_authority, freeze_authority, valid) in [
        (0, COption::None, COption::None, true),
        (1, COption::None, COption::None, false),
        (0, COption::Some(Pubkey::new_unique()), COption::None, false),
        (0, COption::None, COption::Some(Pubkey::new_unique()), false),
    ] {
        let mut bytes = vec![0; SplMint::LEN];
        SplMint::pack(
            SplMint {
                mint_authority,
                supply,
                decimals: 6,
                is_initialized: true,
                freeze_authority,
            },
            &mut bytes,
        )
        .unwrap();
        let mint = Mint::try_deserialize(&mut bytes.as_slice()).unwrap();
        assert_eq!(validate_inert_collateral(&mint).is_ok(), valid);
    }
    assert_ne!(KAMINO_COLLATERAL_MINT, USDC_MINT);
    assert_eq!(KAMINO_MARKET, KAMINO_COLLATERAL_MINT);
    assert_eq!(KAMINO_RESERVE, KAMINO_COLLATERAL_MINT);
    assert_eq!(KAMINO_LIQUIDITY_SUPPLY, KAMINO_COLLATERAL_MINT);
}

#[test]
fn actual_strategy_entrypoints_reject_without_mutating_goal_even_with_zero_arguments() {
    let mut g = goal();
    let (key, bump) =
        Pubkey::find_program_address(&[b"goal", g.owner.as_ref(), &g.goal_id], &crate::ID);
    g.bump = bump;
    for amount in [0, 1, u64::MAX] {
        for ix in [
            crate::instruction::SupplyKamino {
                amount,
                min_shares: amount,
            }
            .data(),
            crate::instruction::RedeemKamino {
                shares: amount,
                min_usdc: amount,
            }
            .data(),
        ] {
            let accounts = Box::leak(
                vec![
                    host_account(g.owner, Pubkey::default(), vec![], true, false, false),
                    host_account(key, crate::ID, snapshot(&g), false, false, false),
                ]
                .into_boxed_slice(),
            );
            let before = accounts[1].data.borrow().to_vec();
            assert_eq!(
                crate::entry(&crate::ID, accounts, &ix),
                Err(ProgramError::Custom(
                    6000 + NabungError::StrategyDisabled as u32
                ))
            );
            assert_eq!(accounts[1].data.borrow().to_vec(), before);
        }
    }
}

#[test]
fn cash_only_completion_preserves_strict_lock_and_persistent_claim_state() {
    let mut g = goal();
    g.target = 100;
    g.record_deposit(60).unwrap();
    assert_error(g.record_claim(1, 60), NabungError::StillLocked);
    g.begin_prepare().unwrap();
    g.reserve_local(60, 0, 100).unwrap();
    g.accept_remote_ready(&ready_report(&g, 40)).unwrap();
    g.achieve(60, 0, 101).unwrap();
    g.record_claim(60, 60).unwrap();
    assert_eq!(g.phase, Phase::Achieved);
    assert_eq!(g.achieved_total, 100);
    assert_eq!(g.remote_reserved, 40);
}
