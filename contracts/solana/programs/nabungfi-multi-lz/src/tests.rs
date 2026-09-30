use super::*;
#[test]
fn core_transport_identity_is_exact() {
    assert_eq!(crate::ID, nabungfi_multi::TRANSPORT_PROGRAM);
}
#[test]
fn canonical_eids_are_not_application_domain_numbers() {
    assert_eq!(eid_for_domain(2).unwrap(), 40245);
    assert_eq!(eid_for_domain(3).unwrap(), 40231);
    assert_eq!(eid_for_domain(4).unwrap(), 40161);
    assert!(eid_for_domain(1).is_err());
}
#[test]
fn receiver_plan_has_correct_distinct_nonce_channel_for_each_peer() {
    let store = Pubkey::new_unique();
    let goal = Pubkey::new_unique();
    let peer = Pubkey::new_unique();
    let mut payloads = Vec::new();
    for eid in [40245, 40231, 40161] {
        let params = LzReceiveParams {
            src_eid: eid,
            sender: [3; 32],
            nonce: 9,
            guid: [4; 32],
            message: vec![],
            extra_data: vec![],
        };
        let plan = receive_plan(store, peer, goal, &params);
        assert_eq!(plan.context_version, 1);
        assert_eq!(plan.instructions.len(), 1);
        if let lz_receive_types_v2::Instruction::LzReceive { accounts } = &plan.instructions[0] {
            assert_eq!(accounts.len(), 15);
            payloads.push(accounts[11].pubkey.try_to_vec().unwrap());
        } else {
            panic!("wrong instruction");
        }
    }
    assert_ne!(payloads[0], payloads[1]);
    assert_ne!(payloads[1], payloads[2]);
}
