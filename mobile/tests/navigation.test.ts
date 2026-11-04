import test from "node:test";
import assert from "node:assert/strict";
import { createMainReturn, type ExitPrompt } from "../src/navigation";

function setup(dirty = false) {
  const state = { active: true, busy: false, dirty };
  let returns = 0;
  const prompts: ExitPrompt[] = [];
  const controller = createMainReturn({
    state: () => state,
    confirm: (prompt) => prompts.push(prompt),
    returnToMain: () => {
      returns++;
    },
  });
  return { state, controller, prompts, returns: () => returns };
}

test("material and completed practice screens return directly to main", () => {
  const flow = setup();
  assert.equal(flow.controller.request(), true);
  assert.equal(flow.returns(), 1);
  assert.equal(flow.prompts.length, 0);
});

test("unsaved quiz or result confirms main return and cancellation preserves the screen", () => {
  const flow = setup(true);
  flow.controller.request();
  flow.controller.request();
  assert.equal(flow.prompts.length, 1);
  assert.equal(flow.returns(), 0);
  flow.prompts[0].stay();
  flow.controller.request();
  assert.equal(flow.prompts.length, 2);
  flow.prompts[0].leave();
  assert.equal(flow.returns(), 0);
  flow.prompts[1].leave();
  flow.prompts[1].leave();
  assert.equal(flow.returns(), 1);
});

test("pending saves block Back and late confirmation cannot interrupt a new save", () => {
  const flow = setup(true);
  flow.state.busy = true;
  assert.equal(flow.controller.request(), true);
  assert.equal(flow.prompts.length, 0);
  flow.state.busy = false;
  flow.controller.request();
  flow.state.busy = true;
  flow.prompts[0].leave();
  assert.equal(flow.returns(), 0);
  flow.state.busy = false;
  flow.controller.request();
  flow.prompts[1].leave();
  assert.equal(flow.returns(), 1);
});

test("unmounted screens and cancelled prompts cannot navigate after account changes", () => {
  const flow = setup(true);
  flow.controller.request();
  flow.state.active = false;
  flow.controller.cancel();
  flow.prompts[0].leave();
  assert.equal(flow.controller.request(), false);
  assert.equal(flow.returns(), 0);
  flow.state.active = true;
  flow.controller.request();
  flow.prompts[1].leave();
  assert.equal(flow.returns(), 1);
});
