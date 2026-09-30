use super::*;
use crate::wire::*;

fn fixture() -> serde_json::Value {
    serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../../shared/protocol/wire-v1.json"
    )))
    .unwrap()
}

fn hex(value: &str) -> Vec<u8> {
    let value = value.strip_prefix("0x").unwrap();
    (0..value.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&value[i..i + 2], 16).unwrap())
        .collect()
}

fn bytes(value: &serde_json::Value) -> [u8; 32] {
    hex(value.as_str().unwrap()).try_into().unwrap()
}

fn wire_goal() -> (Goal, Pubkey) {
    let f = fixture();
    let mut g = goal();
    g.owner = Pubkey::new_from_array(bytes(&f["config"]["solanaOwner"]));
    g.goal_id = bytes(&f["packet"]["goalId"]);
    g.config_hash = bytes(&f["packet"]["configHash"]);
    g.remote_owner = bytes(&f["packet"]["baseOwner"]);
    g.remote_vault = bytes(&f["packet"]["destination"]);
    g.target = f["config"]["target"].as_u64().unwrap();
    (g, Pubkey::new_from_array(bytes(&f["packet"]["source"])))
}

fn report(g: &Goal, key: Pubkey, kind: u8, sequence: u64, amount: u64) -> Packet {
    Packet {
        kind,
        source_domain: BASE_DOMAIN,
        destination_domain: SOLANA_DOMAIN,
        goal_id: g.goal_id,
        config_hash: g.config_hash,
        source: g.remote_vault,
        destination: key.to_bytes(),
        base_owner: g.remote_owner,
        round: if kind == PROGRESS || kind == REGISTERED {
            0
        } else {
            g.round
        },
        sequence,
        amount,
        aggregate: 0,
        observation: 1234,
        observed_at: 1_700_000_000,
    }
}

#[test]
fn wire_and_configuration_match_the_shared_solidity_golden_fixture() {
    let f = fixture();
    let raw = hex(f["packet"]["encoded"].as_str().unwrap());
    let packet = Packet::decode(&raw).unwrap();
    assert_eq!(packet.amount, 4_100_000_000);
    assert_eq!(packet.aggregate, 10_200_000_000);
    assert_eq!(packet.encode().unwrap(), raw);
    let (g, key) = wire_goal();
    assert_eq!(
        configuration_hash(
            key,
            g.owner,
            &InitializeArgs {
                goal_id: g.goal_id,
                target: g.target,
                remote_owner: g.remote_owner,
                remote_vault: g.remote_vault,
            }
        ),
        g.config_hash
    );
}

#[test]
fn every_truncated_packet_bad_version_kind_and_noncanonical_address_is_rejected() {
    let raw = hex(fixture()["packet"]["encoded"].as_str().unwrap());
    for end in 0..LENGTH {
        assert!(Packet::decode(&raw[..end]).is_err());
    }
    let mut too_long = raw.clone();
    too_long.push(0);
    assert!(Packet::decode(&too_long).is_err());
    for (offset, value) in [(0, 0), (4, 2), (5, READY), (110, 1), (142, 1)] {
        let mut bad = raw.clone();
        bad[offset] = value;
        assert!(Packet::decode(&bad).is_err());
    }
}

#[test]
fn funding_and_preparation_require_registration_bound_to_both_owners_and_target() {
    let (mut g, key) = wire_goal();
    g.linked = false;
    assert_error(g.record_deposit(1), NabungError::GoalNotRegistered);
    assert_error(g.begin_prepare(), NabungError::GoalNotRegistered);
    let valid = report(&g, key, REGISTERED, 0, g.target);
    let before = snapshot(&g);
    let mut wrong = valid.clone();
    wrong.base_owner[31] ^= 1;
    assert!(g.accept_registration(&wrong, key).is_err());
    let mut wrong = valid.clone();
    wrong.amount -= 1;
    assert!(g.accept_registration(&wrong, key).is_err());
    assert_eq!(snapshot(&g), before);
    g.accept_registration(&valid, key).unwrap();
    g.record_deposit(1).unwrap();
    g.begin_prepare().unwrap();
    let before = snapshot(&g);
    g.accept_registration(&valid, key).unwrap();
    assert_eq!(snapshot(&g), before);
}

#[test]
fn absolute_progress_replaces_can_decrease_and_never_unlocks() {
    let (mut g, key) = wire_goal();
    let first = report(&g, key, PROGRESS, 1, 9_000_000_000);
    g.accept_progress(&first, key, 1_700_000_001).unwrap();
    let lower = report(&g, key, PROGRESS, 3, 8_000_000_000);
    g.accept_progress(&lower, key, 1_700_000_002).unwrap();
    g.accept_progress(&first, key, 1_700_000_003).unwrap();
    assert_eq!(g.remote_net_assets, 8_000_000_000);
    assert_eq!(g.remote_progress_sequence, 3);
    let high = report(&g, key, PROGRESS, 4, 20_000_000_000);
    g.accept_progress(&high, key, 1_700_000_004).unwrap();
    assert_eq!(g.phase, Phase::Locked);
    assert_eq!(g.achieved_total, 0);
    assert_eq!(g.remote_reserved, 0);
    assert!(!g.remote_ready);
    assert_error(g.record_claim(1, 20_000_000_000), NabungError::StillLocked);
}

#[test]
fn command_outbox_keeps_prepare_relayable_during_abort_and_after_commit() {
    let (mut g, key) = wire_goal();
    g.begin_prepare().unwrap();
    assert_eq!(
        g.command_packet(key, 1, 100, 1_700_000_000).unwrap().kind,
        PREPARE
    );
    g.begin_abort().unwrap();
    assert_eq!(
        g.command_packet(key, 1, 100, 1_700_000_000).unwrap().kind,
        PREPARE
    );
    assert_eq!(
        g.command_packet(key, 2, 100, 1_700_000_000).unwrap().kind,
        ABORT
    );
    g.accept_abort_ack(&ready_report(&g, 0)).unwrap();
    assert!(g.command_packet(key, 2, 100, 1_700_000_000).is_err());
    g.begin_prepare().unwrap();
    g.reserve_local(6_100_000_000, 0, 100).unwrap();
    g.accept_remote_ready(&ready_report(&g, 4_100_000_000))
        .unwrap();
    g.achieve(6_100_000_000, 0, 101).unwrap();
    let prepare = g.command_packet(key, 3, 101, 1_700_000_000).unwrap();
    let commit = g.command_packet(key, 4, 101, 1_700_000_000).unwrap();
    assert_eq!(prepare.kind, PREPARE);
    assert_eq!(prepare.round, 2);
    assert_eq!(commit.kind, COMMIT);
    assert_eq!(commit.amount, 4_100_000_000);
    assert_eq!(commit.aggregate, 10_200_000_000);
    g.record_claim(6_100_000_000, 6_100_000_000).unwrap();
    assert_eq!(
        g.command_packet(key, 4, 101, 1_700_000_000).unwrap(),
        commit
    );
}

#[test]
fn all_supported_message_kinds_roundtrip_with_u64_boundary_values() {
    let (g, key) = wire_goal();
    for kind in [
        PREPARE, COMMIT, ABORT, READY, ABORT_ACK, PROGRESS, REGISTER, REGISTERED,
    ] {
        let from_base = matches!(kind, READY | ABORT_ACK | PROGRESS | REGISTERED);
        let mut packet = if from_base {
            report(&g, key, kind, 1, 0)
        } else {
            g.registration_packet(key, 1234, 1_700_000_000)
        };
        packet.kind = kind;
        packet.round = if matches!(kind, REGISTER | REGISTERED | PROGRESS) {
            0
        } else {
            u64::MAX
        };
        packet.sequence = if matches!(kind, REGISTER | REGISTERED) {
            0
        } else {
            u64::MAX
        };
        packet.amount = if matches!(kind, REGISTER | REGISTERED | COMMIT | READY | PROGRESS) {
            u64::MAX
        } else {
            0
        };
        packet.aggregate = if kind == COMMIT { u64::MAX } else { 0 };
        let raw = packet.encode().unwrap();
        assert_eq!(raw.len(), LENGTH);
        assert_eq!(Packet::decode(&raw).unwrap(), packet);
    }
}
