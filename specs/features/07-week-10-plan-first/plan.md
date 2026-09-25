# Week 10 — Plan First: plan

Read `requirements.md` and `validation.md` first. Do the groups in order.

1. **Step sketch.** The goal: the owner has approved `sketch.md`, which covers the tasks, code,
   checks, steps and copy.
   Skills: `task-design`. Risk: none (no code). Gate: **stop for review** (approved with this spec).

2. **Lesson skeleton.** The goal: lesson 110 exists with its 9 tasks, checks, empty starters,
   bugzap file, solution fixtures, frozen ids and the plan check helpers. The director invariant
   accepts the goal check. There are no steps yet, and catalog tests pass.
   Skills: `lesson-authoring`. Risk: shipped ids and anchors, a plan regex that also matches
   `NOTE`, a behaviour check that passes on an empty starter. Gate: continue.

3. **Bolt plan gate.** The goal: in a plan-first lesson Bolt gives a fixed "plan first" reply,
   with no LLM call and no block, until the page has goal, step and done lines. Weeks 8–9 don't
   change.
   Skills: `ai-tutor`, `roles-permissions`. Risk: the helper route's auth and ordering, reading a
   stale board, and breaking weeks 8–9. Bolt's code is rejected if it has a comment, and it may
   copy the plan lines from the page: check by hand that it still returns a block. If it doesn't,
   the Bolt prompt question goes back to the owner. Gate: **stop for review**.

4. **Tutor rules.** The goal: Sparky judges plans (a goal it can see, small steps, a done-check
   matched to a run), never writes plan lines, and knows Bolt waits for a plan. The tutor eval
   has the new cases and passes.
   Skills: `ai-tutor`. Risk: a prompt change that leaks into weeks 1–9, or Sparky refusing good
   plans. Gate: **stop for review** (run the eval by hand).

5. **Steps and copy.** The goal: every task has the steps and `go` line from the sketch, and the
   copy, scenes and catalog tests pass.
   Skills: `lesson-authoring`. Risk: the step-copy total and stage solutions. Gate: continue.

6. **Browser check and roadmap.** The goal: the week works end to end at three widths, and phase
   7 is ticked. Skills: `project-architecture`. Risk: layout on a phone. Gate: **stop for review**.
