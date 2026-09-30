use super::*;
use anchor_lang::solana_program::program_error::ProgramError;
use anchor_lang::{AccountDeserialize, AccountSerialize, InstructionData};
use nabungfi::state::Phase;

const BASE_EID: u32 = 30184;

fn address(byte: u8) -> [u8; 32] {
    let mut value = [0; 32];
    value[12..].fill(byte);
    value
}

fn fixture_goal() -> Goal {
    let mut g = Goal {
        owner: Pubkey::new_from_array([44; 32]),
        goal_id: [11; 32],
        config_hash: [0; 32],
        target: 10_000_000_000,
        remote_owner: address(0xbb),
        remote_vault: address(0xaa),
        linked: false,
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
    };
    let (key, bump) =
        Pubkey::find_program_address(&[b"goal", g.owner.as_ref(), &g.goal_id], &nabungfi::ID);
    g.bump = bump;
    g.config_hash = nabungfi::configuration_hash(
        key,
        g.owner,
        &nabungfi::InitializeArgs {
            goal_id: g.goal_id,
            target: g.target,
            remote_owner: g.remote_owner,
            remote_vault: g.remote_vault,
        },
    );
    g
}

fn serialize(value: &impl AccountSerialize) -> Vec<u8> {
    let mut result = vec![];
    value.try_serialize(&mut result).unwrap();
    result
}

fn account(
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

fn packet(g: &Goal, key: Pubkey, kind: u8, amount: u64, sequence: u64) -> Packet {
    Packet {
        kind,
        source_domain: 2,
        destination_domain: 1,
        goal_id: g.goal_id,
        config_hash: g.config_hash,
        source: g.remote_vault,
        destination: key.to_bytes(),
        base_owner: g.remote_owner,
        round: if kind == wire::READY { g.round } else { 0 },
        sequence,
        amount,
        aggregate: 0,
        observation: 999,
        observed_at: 1_700_000_000,
    }
}

fn params(packet: &Packet) -> LzReceiveParams {
    LzReceiveParams {
        src_eid: BASE_EID,
        sender: address(9),
        nonce: packet.sequence + 1,
        guid: [42; 32],
        message: packet.encode().unwrap(),
        extra_data: vec![],
    }
}

fn receive_accounts(g: &Goal, params: &LzReceiveParams) -> Vec<AccountInfo<'static>> {
    let (store_key, bump) = Pubkey::find_program_address(&[STORE_SEED], &crate::ID);
    let (peer_key, peer_bump) = Pubkey::find_program_address(
        &[PEER_SEED, store_key.as_ref(), &BASE_EID.to_be_bytes()],
        &crate::ID,
    );
    let goal_key =
        Pubkey::find_program_address(&[b"goal", g.owner.as_ref(), &g.goal_id], &nabungfi::ID).0;
    let receiver =
        Pubkey::find_program_address(&[b"nabung-receiver", goal_key.as_ref()], &crate::ID).0;
    let store = Store {
        administrator: Pubkey::new_unique(),
        endpoint: endpoint::ID,
        base_eid: BASE_EID,
        route_sealed: true,
        bump,
    };
    let store_info = account(store_key, crate::ID, serialize(&store), false, false, false);
    let mut accounts = vec![
        account(
            Pubkey::new_unique(),
            Pubkey::default(),
            vec![],
            true,
            true,
            false,
        ),
        store_info.clone(),
        account(
            peer_key,
            crate::ID,
            serialize(&PeerConfig {
                peer_address: address(9),
                bump: peer_bump,
            }),
            false,
            false,
            false,
        ),
        account(goal_key, nabungfi::ID, serialize(g), false, true, false),
        account(receiver, Pubkey::default(), vec![], false, false, false),
        account(nabungfi::ID, Pubkey::default(), vec![], false, false, true),
        account(crate::ID, Pubkey::default(), vec![], false, false, true),
    ];
    for item in endpoint_cpi::get_accounts_for_clear(
        endpoint::ID,
        &store_key,
        params.src_eid,
        &params.sender,
        params.nonce,
    ) {
        accounts.push(if item.pubkey == store_key {
            store_info.clone()
        } else {
            account(
                item.pubkey,
                endpoint::ID,
                vec![],
                false,
                item.is_writable,
                item.pubkey == endpoint::ID,
            )
        });
    }
    accounts
}

fn read_goal(info: &AccountInfo) -> Goal {
    Goal::try_deserialize(&mut info.data.borrow().as_ref()).unwrap()
}

// Successful CPI is tested with compiled programs in the LiteSVM harness.
#[test]
fn valid_payload_without_endpoint_accounts_cannot_update_the_goal() {
    let g = fixture_goal();
    let key =
        Pubkey::find_program_address(&[b"goal", g.owner.as_ref(), &g.goal_id], &nabungfi::ID).0;
    let incoming = params(&packet(&g, key, wire::REGISTERED, g.target, 0));
    let mut infos = receive_accounts(&g, &incoming);
    infos.truncate(7);
    let accounts = Box::leak(infos.into_boxed_slice());
    let before = accounts[3].data.borrow().to_vec();
    let ix = crate::instruction::LzReceive { params: incoming }.data();
    assert_eq!(
        crate::entry(&crate::ID, accounts, &ix),
        Err(ProgramError::Custom(
            6000 + TransportError::MissingEndpointAccounts as u32
        ))
    );
    assert_eq!(accounts[3].data.borrow().to_vec(), before);
}

#[test]
fn wrong_peer_or_goal_is_rejected_before_endpoint_or_core_execution() {
    let g = fixture_goal();
    let key =
        Pubkey::find_program_address(&[b"goal", g.owner.as_ref(), &g.goal_id], &nabungfi::ID).0;
    let valid = packet(&g, key, wire::REGISTERED, g.target, 0);
    for wrong_goal in [false, true] {
        let mut p = valid.clone();
        if wrong_goal {
            p.goal_id[0] ^= 1;
        }
        let mut incoming = params(&p);
        let accounts = Box::leak(receive_accounts(&g, &incoming).into_boxed_slice());
        if !wrong_goal {
            incoming.sender = address(8);
        }
        assert!(crate::entry(
            &crate::ID,
            accounts,
            &crate::instruction::LzReceive { params: incoming }.data()
        )
        .is_err());
        assert!(!read_goal(&accounts[3]).linked);
    }
}

#[test]
fn discovery_plan_resolves_goal_receiver_and_official_endpoint_accounts() {
    let g = fixture_goal();
    let goal_key = Pubkey::new_unique();
    let p = params(&packet(&g, goal_key, wire::REGISTERED, g.target, 0));
    let store = Pubkey::find_program_address(&[STORE_SEED], &crate::ID).0;
    let peer = Pubkey::find_program_address(
        &[PEER_SEED, store.as_ref(), &BASE_EID.to_be_bytes()],
        &crate::ID,
    )
    .0;
    let plan = receive_plan(store, peer, goal_key, &p);
    assert_eq!(plan.instructions.len(), 1);
    match &plan.instructions[0] {
        lz_receive_types_v2::Instruction::LzReceive { accounts } => {
            assert_eq!(
                accounts.len(),
                7 + endpoint::cpi::accounts::Clear::MIN_ACCOUNTS_LEN
            );
            assert!(matches!(accounts[0].pubkey, AddressLocator::Payer));
            assert!(accounts[3].is_writable);
            assert!(
                matches!(accounts[3].pubkey, AddressLocator::Address(value) if value == goal_key)
            );
        }
        _ => panic!("expected receive instruction"),
    }
    assert_eq!(crate::ID, nabungfi::TRANSPORT_PROGRAM);
}
