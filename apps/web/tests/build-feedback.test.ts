import {test} from "node:test";
import assert from "node:assert/strict";
import {buildFinishKind,BUILD_FINISH_FILES} from "../src/build-feedback";

test("the final visual reward requires all 100 pieces and completion authority",()=>{
  assert.equal(buildFinishKind(99,true),"progress");
  assert.equal(buildFinishKind(100,false),"progress");
  assert.equal(buildFinishKind(100,true),"goal");
});
test("small final deposits receive the same distinct goal cue",()=>{
  assert.equal(buildFinishKind(100,true),"goal");
  assert.notEqual(BUILD_FINISH_FILES.goal,BUILD_FINISH_FILES.progress);
  assert.throws(()=>buildFinishKind(101,true),/Invalid build count/);
});
