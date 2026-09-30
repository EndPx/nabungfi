//! Native model and actual Anchor account-validation tests, not SVM/CPI execution.
use super::*;
use anchor_lang::solana_program::{
    program_error::ProgramError, program_option::COption, program_pack::Pack,
};
use anchor_spl::token::spl_token::state::{Account as SplAccount, AccountState, Mint as SplMint};

const USDC: u64 = 1_000_000;

fn same_owner_goals() -> [Goal; 3] {
    let owner = Pubkey::new_unique();
    std::array::from_fn(|i| {
        let mut g = goal();
        g.owner = owner;
        g.goal_id = [11 + i as u8; 32];
        g.config_hash = [21 + i as u8; 32];
        g.target = [10_000, 2_000, 100_000][i] * USDC;
        g.remote_owner = [0; 32];
        g.remote_owner[12..].fill(5);
        g.remote_vault = [0; 32];
        g.remote_vault[12..].fill(41 + i as u8);
        g.bump = goal_key(&g).1;
        g
    })
}

fn goal_key(g: &Goal) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"goal", g.owner.as_ref(), &g.goal_id], &crate::ID)
}

fn position_key(seed: &[u8], g: &Goal) -> Pubkey {
    Pubkey::find_program_address(&[seed, goal_key(g).0.as_ref()], &crate::ID).0
}

fn token_data(mint: Pubkey, authority: Pubkey, amount: u64) -> Vec<u8> {
    let mut data = vec![0; SplAccount::LEN];
    SplAccount::pack(
        SplAccount {
            mint,
            owner: authority,
            amount,
            delegate: COption::None,
            state: AccountState::Initialized,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        },
        &mut data,
    )
    .unwrap();
    data
}

fn mint_data() -> Vec<u8> {
    let mut data = vec![0; SplMint::LEN];
    SplMint::pack(
        SplMint {
            mint_authority: COption::None,
            supply: 1_000_000 * USDC,
            decimals: 6,
            is_initialized: true,
            freeze_authority: COption::None,
        },
        &mut data,
    )
    .unwrap();
    data
}

#[test]
fn same_owner_has_distinct_goal_cash_receipt_and_receiver_addresses() {
    let goals = same_owner_goals();
    let mut addresses = std::collections::HashSet::new();
    for g in &goals {
        let key = goal_key(g).0;
        assert!(addresses.insert(key));
        assert!(addresses.insert(position_key(b"usdc", g)));
        assert!(addresses.insert(position_key(b"shares", g)));
        let receiver =
            Pubkey::find_program_address(&[b"nabung-receiver", key.as_ref()], &TRANSPORT_PROGRAM).0;
        assert!(addresses.insert(receiver));
    }
    assert_eq!(addresses.len(), 12);
}

#[test]
fn laptop_achievement_and_claims_preserve_car_and_house_exactly() {
    let [mut car, mut laptop, mut house] = same_owner_goals();
    car.record_deposit(6_000 * USDC).unwrap();
    laptop.record_deposit(1_100 * USDC).unwrap();
    house.record_deposit(12_000 * USDC).unwrap();
    let car_before = snapshot(&car);
    let house_before = snapshot(&house);
    laptop.begin_prepare().unwrap();
    laptop.reserve_local(1_200 * USDC, 0, 100).unwrap();
    laptop
        .accept_remote_ready(&ready_report(&laptop, 800 * USDC))
        .unwrap();
    laptop.achieve(1_200 * USDC, 0, 101).unwrap();
    laptop.record_claim(500 * USDC, 1_200 * USDC).unwrap();
    laptop.record_claim(700 * USDC, 700 * USDC).unwrap();
    assert_eq!(laptop.phase, Phase::Achieved);
    assert_eq!(laptop.claimed, 1_200 * USDC);
    assert_eq!(laptop.achieved_total, 2_000 * USDC);
    assert_eq!(snapshot(&car), car_before);
    assert_eq!(snapshot(&house), house_before);
}

#[test]
fn another_goals_reserves_cannot_cover_the_cars_target_shortfall() {
    let [mut car, mut laptop, mut house] = same_owner_goals();
    for (g, local, remote) in [
        (&mut car, 6_000, 1_000),
        (&mut laptop, 1_200, 800),
        (&mut house, 12_000, 0),
    ] {
        g.begin_prepare().unwrap();
        g.reserve_local(local * USDC, 0, 100).unwrap();
        g.accept_remote_ready(&ready_report(g, remote * USDC))
            .unwrap();
    }
    let portfolio = car.local_reserved
        + car.remote_reserved
        + laptop.local_reserved
        + laptop.remote_reserved
        + house.local_reserved;
    assert!(portfolio > car.target);
    let before = snapshot(&car);
    assert_error(car.achieve(6_000 * USDC, 0, 101), NabungError::TargetNotMet);
    assert_eq!(snapshot(&car), before);
    laptop.achieve(1_200 * USDC, 0, 101).unwrap();
    assert_eq!(snapshot(&car), before);
}

#[test]
fn same_owner_reports_and_abort_sequences_are_scoped_to_each_goal() {
    let [mut car, mut laptop, house] = same_owner_goals();
    car.begin_prepare().unwrap();
    laptop.begin_prepare().unwrap();
    let car_before = snapshot(&car);
    let laptop_before = snapshot(&laptop);
    let house_before = snapshot(&house);
    let mut wrong = ready_report(&laptop, 800 * USDC);
    assert_error(car.accept_remote_ready(&wrong), NabungError::WrongGoal);
    wrong.goal_id = car.goal_id;
    assert_error(car.accept_remote_ready(&wrong), NabungError::WrongConfig);
    wrong.config_hash = car.config_hash;
    assert_error(car.accept_remote_ready(&wrong), NabungError::WrongPeer);
    assert_eq!(snapshot(&car), car_before);
    assert_eq!(snapshot(&laptop), laptop_before);

    car.begin_abort().unwrap();
    car.accept_abort_ack(&ready_report(&car, 0)).unwrap();
    car.begin_prepare().unwrap();
    laptop.reserve_local(1_200 * USDC, 0, 100).unwrap();
    laptop
        .accept_remote_ready(&ready_report(&laptop, 800 * USDC))
        .unwrap();
    laptop.achieve(1_200 * USDC, 0, 101).unwrap();
    assert_eq!((car.round, car.outbound_sequence), (2, 3));
    assert_eq!((laptop.round, laptop.outbound_sequence), (1, 2));
    assert_eq!(car.inbound_sequence, 1);
    assert_eq!(laptop.inbound_sequence, 1);
    assert_eq!(snapshot(&house), house_before);
}

#[test]
fn anchor_rejects_other_goals_cash_account_even_for_the_same_owner() {
    let goals = same_owner_goals();
    for (i, destination) in goals.iter().enumerate() {
        for (j, source) in goals.iter().enumerate() {
            if i == j {
                continue;
            }
            let mut g = goal();
            g.owner = destination.owner;
            g.goal_id = destination.goal_id;
            g.bump = destination.bump;
            g.phase = Phase::Achieved;
            let accounts = vec![
                host_account(g.owner, Pubkey::default(), vec![], true, false, false),
                host_account(goal_key(&g).0, crate::ID, snapshot(&g), false, true, false),
                host_account(USDC_MINT, token::ID, mint_data(), false, false, false),
                host_account(
                    position_key(b"usdc", source),
                    token::ID,
                    token_data(USDC_MINT, goal_key(source).0, 500 * USDC),
                    false,
                    true,
                    false,
                ),
                host_account(
                    Pubkey::new_unique(),
                    token::ID,
                    token_data(USDC_MINT, g.owner, 0),
                    false,
                    true,
                    false,
                ),
                host_account(token::ID, Pubkey::new_unique(), vec![], false, false, true),
            ];
            let accounts = Box::leak(accounts.into_boxed_slice());
            let before = accounts[1].data.borrow().to_vec();
            let ix = crate::instruction::Claim { amount: USDC }.data();
            assert_eq!(
                crate::entry(&crate::ID, accounts, &ix),
                Err(ProgramError::Custom(
                    anchor_lang::error::ErrorCode::ConstraintSeeds as u32
                ))
            );
            assert_eq!(accounts[1].data.borrow().to_vec(), before);
        }
    }
}

#[test]
fn anchor_rejects_other_goals_receipt_account_for_readiness() {
    let [mut car, laptop, _] = same_owner_goals();
    car.begin_prepare().unwrap();
    let accounts = vec![
        host_account(
            goal_key(&car).0,
            crate::ID,
            snapshot(&car),
            false,
            true,
            false,
        ),
        host_account(
            position_key(b"usdc", &car),
            token::ID,
            token_data(USDC_MINT, goal_key(&car).0, car.target),
            false,
            false,
            false,
        ),
        host_account(
            position_key(b"shares", &laptop),
            token::ID,
            token_data(KAMINO_COLLATERAL_MINT, goal_key(&laptop).0, 0),
            false,
            false,
            false,
        ),
    ];
    let accounts = Box::leak(accounts.into_boxed_slice());
    let before = accounts[0].data.borrow().to_vec();
    assert_eq!(
        crate::entry(
            &crate::ID,
            accounts,
            &crate::instruction::MarkLocalReady {}.data()
        ),
        Err(ProgramError::Custom(
            anchor_lang::error::ErrorCode::ConstraintSeeds as u32
        ))
    );
    assert_eq!(accounts[0].data.borrow().to_vec(), before);
}

#[test]
fn anchor_rejects_receiver_pda_bound_to_another_goal() {
    let [car, mut laptop, _] = same_owner_goals();
    laptop.begin_prepare().unwrap();
    let wrong_receiver = Pubkey::find_program_address(
        &[b"nabung-receiver", goal_key(&car).0.as_ref()],
        &TRANSPORT_PROGRAM,
    )
    .0;
    let accounts = vec![
        host_account(
            goal_key(&laptop).0,
            crate::ID,
            snapshot(&laptop),
            false,
            true,
            false,
        ),
        host_account(
            wrong_receiver,
            TRANSPORT_PROGRAM,
            vec![],
            true,
            false,
            false,
        ),
        host_account(
            TRANSPORT_PROGRAM,
            Pubkey::new_unique(),
            vec![],
            false,
            false,
            true,
        ),
    ];
    let accounts = Box::leak(accounts.into_boxed_slice());
    let before = accounts[0].data.borrow().to_vec();
    let ix = crate::instruction::ReceiveReady {
        report: ready_report(&laptop, laptop.target),
    }
    .data();
    assert_eq!(
        crate::entry(&crate::ID, accounts, &ix),
        Err(ProgramError::Custom(
            6000 + NabungError::InvalidTransport as u32
        ))
    );
    assert_eq!(accounts[0].data.borrow().to_vec(), before);
}
