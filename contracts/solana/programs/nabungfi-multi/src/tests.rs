use super::*;
use crate::wire::*;

fn address(n: u8) -> [u8; 32] {
    let mut a = [0; 32];
    a[12..].fill(n);
    a
}
fn params() -> InitializeArgs {
    InitializeArgs {
        goal_id: [7; 32],
        target: 10,
        participants: (2..=4)
            .map(|domain| ParticipantArgs {
                domain,
                eid: eid_for_domain(domain).unwrap(),
                asset: address(domain as u8),
                router: address(10 + domain as u8),
                vault: address(20 + domain as u8),
                owner: address(30 + domain as u8),
            })
            .collect(),
    }
}
fn goal() -> (Goal, Pubkey) {
    let a = params();
    let owner = Pubkey::new_from_array([5; 32]);
    let key = Pubkey::new_from_array([6; 32]);
    let participants = a
        .participants
        .iter()
        .map(|p| Participant {
            domain: p.domain,
            eid: p.eid,
            asset: p.asset,
            router: p.router,
            vault: p.vault,
            owner: p.owner,
            config_hash: leaf_hash(
                crate::ID,
                TRANSPORT_PROGRAM,
                key,
                owner,
                a.goal_id,
                a.target,
                p,
            ),
            linked: false,
            net_assets: 0,
            progress_sequence: 0,
            observation: 0,
            observed_at: 0,
            received_at: 0,
            inbound_sequence: 0,
            reserved: 0,
            ready: false,
            abort_ack: false,
        })
        .collect();
    (
        Goal {
            owner,
            goal_id: a.goal_id,
            target: a.target,
            principal: 0,
            claimed: 0,
            round: 0,
            outbound_sequence: 0,
            local_reserved: 0,
            local_ready_slot: 0,
            achieved_total: 0,
            local_ready: false,
            phase: Phase::Locked,
            bump: 255,
            participants,
        },
        key,
    )
}
fn report(g: &Goal, key: Pubkey, domain: u32, kind: u8, sequence: u64, amount: u64) -> Packet {
    let p = &g.participants[g.participant_index(domain).unwrap()];
    Packet {
        kind,
        source_domain: domain,
        destination_domain: 1,
        goal_id: g.goal_id,
        config_hash: p.config_hash,
        source: p.vault,
        destination: key.to_bytes(),
        evm_owner: p.owner,
        round: if matches!(kind, PROGRESS | REGISTERED) {
            0
        } else {
            g.round
        },
        sequence,
        amount,
        aggregate: 0,
        observation: 100,
        observed_at: 200,
    }
}
fn register_all(g: &mut Goal, key: Pubkey) {
    for domain in 2..=4 {
        let p = report(g, key, domain, REGISTERED, 0, g.target);
        g.receive_packet(&p, key, 201).unwrap();
    }
}
fn ready(g: &mut Goal, key: Pubkey, domain: u32, amount: u64) {
    let p = report(
        g,
        key,
        domain,
        READY,
        g.participants[g.participant_index(domain).unwrap()].inbound_sequence + 1,
        amount,
    );
    g.receive_packet(&p, key, 201).unwrap();
}
fn hex(s: &str) -> Vec<u8> {
    let s = s.strip_prefix("0x").unwrap();
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
        .collect()
}
fn fixture() -> serde_json::Value {
    serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../../shared/protocol/wire-v2.json"
    )))
    .unwrap()
}

#[test]
fn all_three_configuration_hashes_and_wire_match_shared_fixture() {
    let f = fixture();
    let c = &f["config"];
    let bytes =
        |v: &serde_json::Value| -> [u8; 32] { hex(v.as_str().unwrap()).try_into().unwrap() };
    for pair in f["pairs"].as_array().unwrap() {
        let evm = |v: &serde_json::Value| {
            let mut a = [0; 32];
            a[12..].copy_from_slice(&hex(v.as_str().unwrap()));
            a
        };
        let p = ParticipantArgs {
            domain: pair["domain"].as_u64().unwrap() as u32,
            eid: pair["eid"].as_u64().unwrap() as u32,
            asset: evm(&pair["asset"]),
            router: evm(&pair["router"]),
            vault: evm(&pair["vault"]),
            owner: evm(&pair["owner"]),
        };
        let hash = leaf_hash(
            Pubkey::new_from_array(bytes(&c["program"])),
            Pubkey::new_from_array(bytes(&c["transportProgram"])),
            Pubkey::new_from_array(bytes(&c["solanaGoal"])),
            Pubkey::new_from_array(bytes(&c["solanaOwner"])),
            bytes(&c["goalId"]),
            c["target"].as_u64().unwrap(),
            &p,
        );
        assert_eq!(hash, bytes(&pair["expectedHash"]));
        assert_eq!(
            hashv(&[&hex(pair["preimage"].as_str().unwrap())]).to_bytes(),
            hash
        );
    }
    let raw = hex(f["packet"]["encoded"].as_str().unwrap());
    let packet = Packet::decode(&raw).unwrap();
    assert_eq!(packet.encode().unwrap(), raw);
    assert_eq!(packet.destination_domain, 3);
    assert_eq!(packet.amount, 2_000_000);
    assert_eq!(packet.aggregate, 10_000_000);
    let mut v1 = raw.clone();
    v1[4] = 1;
    assert!(Packet::decode(&v1).is_err());
}
#[test]
fn immutable_participant_list_rejects_empty_duplicate_unsorted_wrong_eid_and_bad_address() {
    let a = params();
    validate_participants(&a).unwrap();
    let mut a = params();
    a.participants.clear();
    assert!(validate_participants(&a).is_err());
    let mut a = params();
    a.participants[1].domain = 2;
    assert!(validate_participants(&a).is_err());
    let mut a = params();
    a.participants.swap(0, 2);
    assert!(validate_participants(&a).is_err());
    let mut a = params();
    a.participants[1].eid = 40245;
    assert!(validate_participants(&a).is_err());
    let mut a = params();
    a.participants[1].router = [0; 32];
    assert!(validate_participants(&a).is_err());
}
#[test]
fn identical_evm_address_on_different_chains_is_valid_but_leaf_hashes_differ() {
    let mut a = params();
    a.participants[2].vault = a.participants[1].vault;
    a.participants[2].router = a.participants[1].router;
    validate_participants(&a).unwrap();
    let (_, key) = goal();
    let owner = Pubkey::new_from_array([5; 32]);
    assert_ne!(
        leaf_hash(
            crate::ID,
            TRANSPORT_PROGRAM,
            key,
            owner,
            a.goal_id,
            a.target,
            &a.participants[1]
        ),
        leaf_hash(
            crate::ID,
            TRANSPORT_PROGRAM,
            key,
            owner,
            a.goal_id,
            a.target,
            &a.participants[2]
        )
    );
}
#[test]
fn all_registration_acknowledgements_are_required_even_zero_balance_participants() {
    let (mut g, key) = goal();
    assert!(g.record_deposit(4).is_err());
    let p = report(&g, key, 2, REGISTERED, 0, 10);
    g.receive_packet(&p, key, 201).unwrap();
    assert!(g.begin_prepare().is_err());
    assert!(g.record_deposit(4).is_err());
    register_all(&mut g, key);
    g.record_deposit(4).unwrap();
    assert_eq!(g.principal, 4);
}
#[test]
fn partial_readiness_or_estimated_nav_never_achieves() {
    let (mut g, key) = goal();
    register_all(&mut g, key);
    for domain in 2..=4 {
        let p = report(&g, key, domain, PROGRESS, 1, 100);
        g.receive_packet(&p, key, 201).unwrap();
    }
    assert!(g.record_claim(1, 4).is_err());
    g.begin_prepare().unwrap();
    g.reserve_local(4, 100).unwrap();
    ready(&mut g, key, 2, 6);
    ready(&mut g, key, 3, 0);
    assert!(g.achieve(4, 101).is_err());
    ready(&mut g, key, 4, 0);
    g.achieve(4, 101).unwrap();
    assert_eq!(g.achieved_total, 10);
}
#[test]
fn cross_slot_reduced_reserve_and_one_unit_short_are_rejected() {
    let (mut g, key) = goal();
    register_all(&mut g, key);
    g.begin_prepare().unwrap();
    g.reserve_local(4, 100).unwrap();
    for domain in 2..=4 {
        ready(&mut g, key, domain, if domain == 4 { 1 } else { 2 });
    }
    assert!(g.achieve(4, 100).is_err());
    assert!(g.achieve(3, 101).is_err());
    assert!(g.achieve(4, 101).is_err());
    assert_eq!(g.phase, Phase::Preparing);
}
#[test]
fn report_replay_is_per_participant_and_future_report_has_no_mutation() {
    let (mut g, key) = goal();
    register_all(&mut g, key);
    g.begin_prepare().unwrap();
    let p = report(&g, key, 2, READY, 1, 2);
    g.receive_packet(&p, key, 201).unwrap();
    g.receive_packet(&p, key, 201).unwrap();
    ready(&mut g, key, 3, 2);
    assert_eq!(g.participants[0].inbound_sequence, 1);
    assert_eq!(g.participants[1].inbound_sequence, 1);
    let future = report(&g, key, 4, READY, 2, 2);
    assert!(g.receive_packet(&future, key, 201).is_err());
    assert_eq!(g.participants[2].inbound_sequence, 0);
}
#[test]
fn wrong_domain_goal_vault_owner_config_and_round_are_rejected() {
    let (mut g, key) = goal();
    register_all(&mut g, key);
    g.begin_prepare().unwrap();
    let p = report(&g, key, 3, READY, 1, 2);
    let mut wrong = p.clone();
    wrong.source_domain = 4;
    assert!(g.receive_packet(&wrong, key, 201).is_err());
    let mut wrong = p.clone();
    wrong.goal_id = [8; 32];
    assert!(g.receive_packet(&wrong, key, 201).is_err());
    let mut wrong = p.clone();
    wrong.source = address(99);
    assert!(g.receive_packet(&wrong, key, 201).is_err());
    let mut wrong = p.clone();
    wrong.evm_owner = address(99);
    assert!(g.receive_packet(&wrong, key, 201).is_err());
    let mut wrong = p.clone();
    wrong.config_hash = [99; 32];
    assert!(g.receive_packet(&wrong, key, 201).is_err());
    let mut wrong = p;
    wrong.round = 2;
    assert!(g.receive_packet(&wrong, key, 201).is_err());
}
#[test]
fn absolute_progress_decreases_without_affecting_readiness_and_stale_is_ignored() {
    let (mut g, key) = goal();
    register_all(&mut g, key);
    for (sequence, amount) in [(1, 100), (2, 3), (1, 999)] {
        let p = report(&g, key, 3, PROGRESS, sequence, amount);
        g.receive_packet(&p, key, 201).unwrap();
    }
    assert_eq!(g.participants[1].net_assets, 3);
    assert_eq!(g.participants[1].progress_sequence, 2);
    assert!(!g.participants[1].ready);
    assert_eq!(g.participants[0].net_assets, 0);
}
#[test]
fn abort_requires_every_ack_and_late_ready_cannot_restore_reserve() {
    let (mut g, key) = goal();
    register_all(&mut g, key);
    g.begin_prepare().unwrap();
    g.reserve_local(4, 100).unwrap();
    g.begin_abort().unwrap();
    let ack = report(&g, key, 2, ABORT_ACK, 1, 0);
    g.receive_packet(&ack, key, 201).unwrap();
    assert!(g.begin_prepare().is_err());
    ready(&mut g, key, 3, 9);
    assert!(!g.participants[1].ready);
    assert_eq!(g.participants[1].reserved, 0);
    let ack = report(&g, key, 3, ABORT_ACK, 2, 0);
    g.receive_packet(&ack, key, 201).unwrap();
    assert_eq!(g.phase, Phase::Aborting);
    let ack = report(&g, key, 4, ABORT_ACK, 1, 0);
    g.receive_packet(&ack, key, 201).unwrap();
    assert_eq!(g.phase, Phase::Locked);
    assert_eq!(g.local_reserved, 0);
    g.begin_prepare().unwrap();
    assert_eq!(g.round, 2);
    assert_eq!(g.outbound_sequence, 3);
}
#[test]
fn overflow_of_aggregate_deposit_claim_or_lifecycle_is_rejected() {
    let (mut g, key) = goal();
    register_all(&mut g, key);
    g.principal = u64::MAX;
    assert!(g.record_deposit(1).is_err());
    g.begin_prepare().unwrap();
    g.reserve_local(u64::MAX, 100).unwrap();
    for domain in 2..=4 {
        ready(&mut g, key, domain, 1);
    }
    assert!(g.achieve(u64::MAX, 101).is_err());
    assert_eq!(g.phase, Phase::Preparing);
    g.phase = Phase::Achieved;
    g.claimed = u64::MAX;
    assert!(g.record_claim(1, 1).is_err());
    g.phase = Phase::Locked;
    g.outbound_sequence = u64::MAX;
    assert!(g.begin_prepare().is_err());
}
#[test]
fn permanent_achievement_survives_claims_and_postclaim_zero_nav() {
    let (mut g, key) = goal();
    register_all(&mut g, key);
    g.record_deposit(4).unwrap();
    g.begin_prepare().unwrap();
    g.reserve_local(4, 100).unwrap();
    for domain in 2..=4 {
        ready(&mut g, key, domain, 2);
    }
    g.achieve(4, 101).unwrap();
    g.record_claim(1, 4).unwrap();
    g.record_claim(3, 3).unwrap();
    for domain in 2..=4 {
        let p = report(&g, key, domain, PROGRESS, 1, 0);
        g.receive_packet(&p, key, 201).unwrap();
    }
    assert_eq!(g.phase, Phase::Achieved);
    assert_eq!(g.achieved_total, 10);
    assert_eq!(g.claimed, 4);
    for domain in 2..=4 {
        let p = g.packet(key, domain, 2, 100, 200).unwrap();
        assert_eq!(p.kind, COMMIT);
        assert_eq!(p.amount, 2);
        assert_eq!(p.aggregate, 10);
    }
    assert!(g.begin_prepare().is_err());
}
#[test]
fn many_goals_are_isolated_and_packets_do_not_cross_unlock() {
    let (mut a, key) = goal();
    let (mut b, bkey) = goal();
    b.goal_id = [9; 32];
    register_all(&mut a, key);
    register_all(&mut b, bkey);
    a.begin_prepare().unwrap();
    a.reserve_local(100, 100).unwrap();
    for d in 2..=4 {
        ready(&mut a, key, d, 0);
    }
    a.achieve(100, 101).unwrap();
    let packet = report(&a, key, 2, PROGRESS, 1, 100);
    assert!(b.receive_packet(&packet, bkey, 201).is_err());
    assert_eq!(b.phase, Phase::Locked);
    assert_eq!(b.achieved_total, 0);
    assert!(b.record_claim(1, 100).is_err());
}
#[test]
fn packets_for_three_destinations_bind_each_own_leaf_and_reserve() {
    let (mut g, key) = goal();
    for d in 2..=4 {
        let p = g.packet(key, d, 0, 100, 200).unwrap();
        assert_eq!(p.destination_domain, d);
        assert_eq!(p.amount, 10);
    }
    register_all(&mut g, key);
    g.begin_prepare().unwrap();
    for d in 2..=4 {
        assert_eq!(g.packet(key, d, 1, 100, 200).unwrap().kind, PREPARE);
    }
    g.begin_abort().unwrap();
    for d in 2..=4 {
        assert_eq!(g.packet(key, d, 1, 100, 200).unwrap().kind, PREPARE);
        assert_eq!(g.packet(key, d, 2, 100, 200).unwrap().kind, ABORT);
    }
    assert!(g.packet(key, 5, 2, 100, 200).is_err());
}
