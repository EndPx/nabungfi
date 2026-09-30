use super::*;
use anchor_lang::{AccountSerialize, InstructionData};

mod multi_goal;
mod transport;

fn goal() -> Goal {
    Goal {
        owner: Pubkey::new_unique(),
        goal_id: [1; 32],
        config_hash: [2; 32],
        target: 10_000_000_000,
        remote_owner: [3; 32],
        remote_vault: [4; 32],
        linked: true,
        remote_net_assets: 0,
        remote_progress_sequence: 0,
        remote_observation: 0,
        remote_observed_at: 0,
        remote_received_at: 0,
        principal: 0,
        claimed: 0,
        round: 0,
        inbound_sequence: 0,
        outbound_sequence: 0,
        local_reserved: 0,
        local_ready_slot: 0,
        remote_reserved: 0,
        achieved_total: 0,
        local_ready: false,
        remote_ready: false,
        phase: Phase::Locked,
        bump: 0,
    }
}

fn ready_report(goal: &Goal, amount: u64) -> RemoteReport {
    RemoteReport {
        goal_id: goal.goal_id,
        config_hash: goal.config_hash,
        round: goal.round,
        sequence: goal.inbound_sequence + 1,
        source_domain: BASE_DOMAIN,
        source_vault: goal.remote_vault,
        amount,
        observation: 123,
    }
}

fn snapshot(goal: &Goal) -> Vec<u8> {
    let mut data = vec![];
    goal.try_serialize(&mut data).unwrap();
    data
}

fn assert_error<T>(result: Result<T>, expected: NabungError) {
    match result {
        Err(anchor_lang::error::Error::AnchorError(error)) => {
            assert_eq!(error.error_code_number, 6000 + expected as u32);
        }
        Err(other) => panic!("unexpected error: {other:?}"),
        Ok(_) => panic!("expected failure"),
    }
}

#[test]
fn principal_and_realized_yield_are_not_counted_twice() {
    let mut g = goal();
    g.record_deposit(6_000_000_000).unwrap();
    g.begin_prepare().unwrap();
    g.reserve_local(6_120_000_000, 0, 100).unwrap();
    g.accept_remote_ready(&ready_report(&g, 3_880_000_000))
        .unwrap();
    g.achieve(6_120_000_000, 0, 101).unwrap();
    assert_eq!(g.achieved_total, 10_000_000_000);
    assert_eq!(g.principal, 6_000_000_000);
    assert_eq!(g.phase, Phase::Achieved);
}

#[test]
fn one_micro_usdc_short_does_not_unlock_and_error_does_not_mutate() {
    let mut g = goal();
    g.begin_prepare().unwrap();
    g.reserve_local(6_000_000_000, 0, 100).unwrap();
    g.accept_remote_ready(&ready_report(&g, 3_999_999_999))
        .unwrap();
    let before = snapshot(&g);
    assert_error(g.achieve(6_000_000_000, 0, 101), NabungError::TargetNotMet);
    assert_eq!(snapshot(&g), before);
}

#[test]
fn displayed_or_projected_total_cannot_substitute_for_reserves() {
    let mut g = goal();
    g.record_deposit(10_000_000_000).unwrap();
    g.begin_prepare().unwrap();
    assert_error(g.achieve(10_000_000_000, 0, 101), NabungError::MissingReady);
    g.reserve_local(10_000_000_000, 0, 100).unwrap();
    assert_error(g.achieve(10_000_000_000, 0, 101), NabungError::MissingReady);
    g.accept_remote_ready(&ready_report(&g, 0)).unwrap();
    g.achieve(10_000_000_000, 0, 101).unwrap();
}

#[test]
fn even_one_remaining_ctoken_blocks_readiness() {
    let mut g = goal();
    g.begin_prepare().unwrap();
    assert_error(
        g.reserve_local(g.target, 1, 100),
        NabungError::StrategyNotExited,
    );
    assert!(!g.local_ready);
}

#[test]
fn reserve_reduction_and_reintroduced_strategy_exposure_block_commit() {
    let mut g = goal();
    g.begin_prepare().unwrap();
    g.reserve_local(g.target, 0, 100).unwrap();
    g.accept_remote_ready(&ready_report(&g, 0)).unwrap();
    assert_error(g.achieve(g.target - 1, 0, 101), NabungError::ReserveReduced);
    assert_error(g.achieve(g.target, 1, 101), NabungError::StrategyNotExited);
}

#[test]
fn atomic_flash_funding_cannot_prepare_and_achieve_in_same_slot() {
    let mut g = goal();
    g.begin_prepare().unwrap();
    g.reserve_local(g.target, 0, 100).unwrap();
    g.accept_remote_ready(&ready_report(&g, 0)).unwrap();
    assert_error(g.achieve(g.target, 0, 100), NabungError::ReadinessTooRecent);
    g.achieve(g.target, 0, 101).unwrap();
}

#[test]
fn early_claims_never_work_including_during_abort() {
    let mut g = goal();
    assert_error(g.record_claim(1, g.target), NabungError::StillLocked);
    g.begin_prepare().unwrap();
    assert_error(g.record_claim(1, g.target), NabungError::StillLocked);
    g.begin_abort().unwrap();
    assert_error(g.record_claim(1, g.target), NabungError::StillLocked);
}

#[test]
fn independent_partial_and_full_claims_preserve_global_achievement() {
    let mut g = goal();
    g.begin_prepare().unwrap();
    g.reserve_local(6_000_000_000, 0, 100).unwrap();
    g.accept_remote_ready(&ready_report(&g, 4_000_000_000))
        .unwrap();
    g.achieve(6_000_000_000, 0, 101).unwrap();
    g.record_claim(1_000_000_000, 6_000_000_000).unwrap();
    g.record_claim(5_000_000_000, 5_000_000_000).unwrap();
    assert_eq!(g.claimed, 6_000_000_000);
    assert_eq!(g.achieved_total, g.target);
    assert_eq!(g.phase, Phase::Achieved);
    assert_error(g.record_claim(1, 0), NabungError::InsufficientFunds);
    assert_error(g.begin_abort(), NabungError::WrongPhase);
    assert_error(g.begin_prepare(), NabungError::WrongPhase);
    assert_error(g.record_deposit(1), NabungError::WrongPhase);
}

#[test]
fn duplicate_and_out_of_order_reports_cannot_change_totals() {
    let mut g = goal();
    g.begin_prepare().unwrap();
    let valid = ready_report(&g, 5_000_000_000);
    let mut later = valid.clone();
    later.sequence += 1;
    assert_error(g.accept_remote_ready(&later), NabungError::WrongSequence);
    g.accept_remote_ready(&valid).unwrap();
    let before = snapshot(&g);
    assert_error(g.accept_remote_ready(&valid), NabungError::WrongSequence);
    assert_eq!(snapshot(&g), before);
    assert_error(
        g.accept_remote_ready(&ready_report(&g, 9_000_000_000)),
        NabungError::AlreadyReady,
    );
}

#[test]
fn cross_goal_config_peer_round_and_observation_replays_are_rejected() {
    let mut g = goal();
    g.begin_prepare().unwrap();
    let valid = ready_report(&g, g.target);
    let mut wrong = valid.clone();
    wrong.goal_id = [9; 32];
    assert_error(g.accept_remote_ready(&wrong), NabungError::WrongGoal);
    let mut wrong = valid.clone();
    wrong.config_hash = [9; 32];
    assert_error(g.accept_remote_ready(&wrong), NabungError::WrongConfig);
    let mut wrong = valid.clone();
    wrong.source_domain = SOLANA_DOMAIN;
    assert_error(g.accept_remote_ready(&wrong), NabungError::WrongPeer);
    let mut wrong = valid.clone();
    wrong.source_vault = [9; 32];
    assert_error(g.accept_remote_ready(&wrong), NabungError::WrongPeer);
    let mut wrong = valid.clone();
    wrong.round += 1;
    assert_error(g.accept_remote_ready(&wrong), NabungError::WrongRound);
    let mut wrong = valid.clone();
    wrong.observation = 0;
    assert_error(
        g.accept_remote_ready(&wrong),
        NabungError::InvalidObservation,
    );
    assert_eq!(g.inbound_sequence, 0);
}

#[test]
fn abort_requires_peer_ack_and_consumes_in_flight_ready_without_revival() {
    let mut g = goal();
    g.begin_prepare().unwrap();
    g.reserve_local(7_000_000_000, 0, 100).unwrap();
    let in_flight_ready = ready_report(&g, 3_000_000_000);
    g.begin_abort().unwrap();
    assert_error(g.begin_prepare(), NabungError::WrongPhase);
    assert_error(g.record_deposit(1), NabungError::WrongPhase);
    g.accept_remote_ready(&in_flight_ready).unwrap();
    assert_eq!(g.remote_reserved, 0);
    assert!(!g.remote_ready);
    assert_error(g.achieve(7_000_000_000, 0, 101), NabungError::WrongPhase);
    let ack = ready_report(&g, 0);
    g.accept_abort_ack(&ack).unwrap();
    assert_eq!(g.phase, Phase::Locked);
    assert_error(
        g.accept_remote_ready(&in_flight_ready),
        NabungError::WrongSequence,
    );
    g.begin_prepare().unwrap();
    assert_eq!(g.round, 2);
    assert_error(
        g.accept_remote_ready(&in_flight_ready),
        NabungError::WrongRound,
    );
}

#[test]
fn abort_ack_cannot_unlock_or_precede_abort() {
    let mut g = goal();
    g.begin_prepare().unwrap();
    assert_error(
        g.accept_abort_ack(&ready_report(&g, 0)),
        NabungError::WrongPhase,
    );
    g.begin_abort().unwrap();
    assert_error(
        g.accept_abort_ack(&ready_report(&g, 1)),
        NabungError::InvalidAbortAck,
    );
    g.accept_abort_ack(&ready_report(&g, 0)).unwrap();
    assert_error(g.record_claim(1, g.target), NabungError::StillLocked);
}

#[test]
fn overflow_never_wraps_target_sum_principal_or_round() {
    let mut g = goal();
    g.principal = u64::MAX;
    assert_error(g.record_deposit(1), NabungError::Overflow);
    g.begin_prepare().unwrap();
    g.reserve_local(u64::MAX, 0, 100).unwrap();
    g.accept_remote_ready(&ready_report(&g, 1)).unwrap();
    assert_error(g.achieve(u64::MAX, 0, 101), NabungError::Overflow);
    let mut g = goal();
    g.round = u64::MAX;
    assert_error(g.begin_prepare(), NabungError::Overflow);
    assert_eq!(g.phase, Phase::Locked);
}

#[test]
fn zero_deposits_claims_and_arbitrary_transport_signers_are_rejected() {
    let mut g = goal();
    assert_error(g.record_deposit(0), NabungError::ZeroAmount);
    let goal_key = Pubkey::new_unique();
    assert_error(
        authenticate_transport(goal_key, g.owner),
        NabungError::InvalidTransport,
    );
    let expected =
        Pubkey::find_program_address(&[b"nabung-receiver", goal_key.as_ref()], &TRANSPORT_PROGRAM)
            .0;
    assert!(!expected.is_on_curve());
    authenticate_transport(goal_key, expected).unwrap();
    assert_error(
        authenticate_transport(Pubkey::new_unique(), expected),
        NabungError::InvalidTransport,
    );
}

#[test]
fn registered_evm_addresses_must_be_canonical_nonzero_bytes32() {
    assert!(!valid_evm_address([0; 32]));
    assert!(!valid_evm_address([1; 32]));
    let mut address = [0; 32];
    address[31] = 1;
    assert!(valid_evm_address(address));
}

#[test]
fn account_allocation_matches_actual_serialized_goal() {
    assert_eq!(snapshot(&goal()).len(), 8 + Goal::INIT_SPACE);
}

/// Runs Anchor's actual instruction dispatcher/account validation on native
/// AccountInfos. This is NOT an SVM/CPI transaction test.
#[test]
fn anchor_rejects_expected_receiver_without_signature_and_wrong_signed_receiver() {
    let mut g = goal();
    let (key, bump) =
        Pubkey::find_program_address(&[b"goal", g.owner.as_ref(), &g.goal_id], &crate::ID);
    g.bump = bump;
    g.begin_prepare().unwrap();
    let report = ready_report(&g, g.target);
    let expected =
        Pubkey::find_program_address(&[b"nabung-receiver", key.as_ref()], &TRANSPORT_PROGRAM).0;
    for (receiver, is_signer) in [(expected, false), (Pubkey::new_unique(), true)] {
        let mut data = snapshot(&g);
        let mut goal_lamports = 1_000_000;
        let mut receiver_data = [];
        let mut receiver_lamports = 1;
        let mut transport_data = [];
        let mut transport_lamports = 1;
        let loader = Pubkey::new_unique();
        let accounts = vec![
            AccountInfo::new(
                &key,
                false,
                true,
                &mut goal_lamports,
                &mut data,
                &crate::ID,
                false,
                0,
            ),
            AccountInfo::new(
                &receiver,
                is_signer,
                false,
                &mut receiver_lamports,
                &mut receiver_data,
                &TRANSPORT_PROGRAM,
                false,
                0,
            ),
            AccountInfo::new(
                &TRANSPORT_PROGRAM,
                false,
                false,
                &mut transport_lamports,
                &mut transport_data,
                &loader,
                true,
                0,
            ),
        ];
        let ix = crate::instruction::ReceiveReady {
            report: report.clone(),
        }
        .data();
        assert!(crate::entry(&crate::ID, &accounts, &ix).is_err());
    }
}

#[test]
fn all_small_reserved_splits_require_every_registered_vault_and_exact_target() {
    for target in 1..=20 {
        for local in 0..=20 {
            for remote in 0..=20 {
                let mut g = goal();
                g.target = target;
                g.begin_prepare().unwrap();
                g.reserve_local(local, 0, 100).unwrap();
                assert!(g.achieve(local, 0, 101).is_err());
                g.accept_remote_ready(&ready_report(&g, remote)).unwrap();
                assert_eq!(g.achieve(local, 0, 101).is_ok(), local + remote >= target);
            }
        }
    }
}

#[test]
fn pinned_official_kamino_layout_matches_the_dated_public_reserve_snapshot() {
    // Read-only bytes captured at 2026-09-28 06:01:26 UTC; not current liquidity.
    #[repr(align(8))]
    struct Aligned([u8; 8624]);
    let bytes = Aligned(*include_bytes!("../testdata/reserve-2026-09-28.bin"));
    let reserve =
        klend_interface::from_account_data::<klend_interface::state::Reserve>(&bytes.0).unwrap();
    assert_eq!(reserve.lending_market, KAMINO_MARKET);
    assert_eq!(reserve.liquidity.mint_pubkey, USDC_MINT);
    assert_eq!(reserve.mint_decimals(), 6);
    assert_eq!(reserve.liquidity.token_program, token::ID);
    assert_eq!(reserve.available_liquidity(), 8_267_246_684_723);
    assert_eq!(reserve.config.block_ctoken_usage, 0);
    assert_eq!(reserve.config.permissioned_ops, 0);
    assert_eq!(reserve.collateral.mint_pubkey, KAMINO_COLLATERAL_MINT);
    assert_eq!(reserve.liquidity.supply_vault, KAMINO_LIQUIDITY_SUPPLY);
    // Regression: these helpers do not describe this historical reserve.
    assert_ne!(
        reserve.collateral.mint_pubkey,
        klend_interface::pda::reserve_collateral_mint(
            &klend_interface::KLEND_PROGRAM_ID,
            &KAMINO_RESERVE
        )
        .0
    );
    assert_ne!(
        reserve.liquidity.supply_vault,
        klend_interface::pda::reserve_liquidity_supply(
            &klend_interface::KLEND_PROGRAM_ID,
            &KAMINO_RESERVE
        )
        .0
    );
}

#[test]
fn coordinator_command_and_base_report_sequence_trace_survives_an_abort() {
    // Mirrors the actual EVM lifecycle: PREPARE(1), READY(1) in flight,
    // ABORT(2), ABORT_ACK(2), PREPARE(3), READY(3), COMMIT(4).
    // EVM ProgressReported has a separate progressSequence and is excluded.
    let mut g = goal();
    g.begin_prepare().unwrap();
    assert_eq!((g.round, g.outbound_sequence), (1, 1));
    let late_ready = ready_report(&g, 4_000_000_000);
    g.begin_abort().unwrap();
    assert_eq!(g.outbound_sequence, 2);
    g.accept_remote_ready(&late_ready).unwrap();
    g.accept_abort_ack(&ready_report(&g, 0)).unwrap();
    assert_eq!(g.inbound_sequence, 2);
    g.begin_prepare().unwrap();
    assert_eq!((g.round, g.outbound_sequence), (2, 3));
    g.reserve_local(6_000_000_000, 0, 100).unwrap();
    g.accept_remote_ready(&ready_report(&g, 4_000_000_000))
        .unwrap();
    assert_eq!(g.inbound_sequence, 3);
    g.achieve(6_000_000_000, 0, 101).unwrap();
    assert_eq!(g.outbound_sequence, 4);
    assert_eq!(g.phase, Phase::Achieved);
}

fn host_account(
    key: Pubkey,
    owner: Pubkey,
    data: Vec<u8>,
    signer: bool,
    writable: bool,
    executable: bool,
) -> AccountInfo<'static> {
    AccountInfo::new(
        Box::leak(Box::new(key)),
        signer,
        writable,
        Box::leak(Box::new(10_000_000)),
        Box::leak(data.into_boxed_slice()),
        Box::leak(Box::new(owner)),
        executable,
        0,
    )
}

#[test]
fn actual_anchor_claim_handler_rejects_early_owner_and_forged_owner() {
    use anchor_lang::solana_program::{program_option::COption, program_pack::Pack};
    use anchor_spl::token::spl_token::state::{
        Account as SplAccount, AccountState, Mint as SplMint,
    };
    let mut g = goal();
    let (key, bump) =
        Pubkey::find_program_address(&[b"goal", g.owner.as_ref(), &g.goal_id], &crate::ID);
    g.bump = bump;
    let vault = Pubkey::find_program_address(&[b"usdc", key.as_ref()], &crate::ID).0;
    let mut mint_bytes = vec![0; SplMint::LEN];
    SplMint::pack(
        SplMint {
            mint_authority: COption::None,
            supply: g.target,
            decimals: 6,
            is_initialized: true,
            freeze_authority: COption::None,
        },
        &mut mint_bytes,
    )
    .unwrap();
    let token_data = |authority: Pubkey, amount: u64| {
        let mut bytes = vec![0; SplAccount::LEN];
        SplAccount::pack(
            SplAccount {
                mint: USDC_MINT,
                owner: authority,
                amount,
                delegate: COption::None,
                state: AccountState::Initialized,
                is_native: COption::None,
                delegated_amount: 0,
                close_authority: COption::None,
            },
            &mut bytes,
        )
        .unwrap();
        bytes
    };
    for claimant in [g.owner, Pubkey::new_unique()] {
        let accounts = vec![
            host_account(claimant, Pubkey::default(), vec![], true, false, false),
            host_account(key, crate::ID, snapshot(&g), false, true, false),
            host_account(
                USDC_MINT,
                token::ID,
                mint_bytes.clone(),
                false,
                false,
                false,
            ),
            host_account(
                vault,
                token::ID,
                token_data(key, g.target),
                false,
                true,
                false,
            ),
            host_account(
                Pubkey::new_unique(),
                token::ID,
                token_data(claimant, 0),
                false,
                true,
                false,
            ),
            host_account(token::ID, Pubkey::new_unique(), vec![], false, false, true),
        ];
        let ix = crate::instruction::Claim { amount: 1 }.data();
        let accounts = Box::leak(accounts.into_boxed_slice());
        let result = crate::entry(&crate::ID, accounts, &ix);
        if claimant == g.owner {
            assert_eq!(
                result,
                Err(
                    anchor_lang::solana_program::program_error::ProgramError::Custom(
                        6000 + NabungError::StillLocked as u32
                    )
                )
            );
        } else {
            assert!(result.is_err());
        }
    }
}
