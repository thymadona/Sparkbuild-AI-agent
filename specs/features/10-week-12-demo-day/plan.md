# Week 12 — Demo Day: plan

Read `requirements.md` and `validation.md` first. Do the groups in order.

1. **Step sketch.** The goal: the owner has approved `sketch.md` (the program, the tasks, the
   code, checks, steps and copy).
   Skills: `task-design`. Risk: none (no code). Gate: **stop for review**.

2. **Lesson skeleton.** The goal: lesson 112 exists with its 8 tasks, checks, the finished-show
   starter, the `from` chain, the bugzap file, solution fixtures, frozen ids and the demo flag.
   There are no steps yet, and the catalog tests pass.
   Skills: `lesson-authoring`. Risk: a behaviour check that already passes on the previous
   task's finished code; the starter already scores 3, so task 1 must still fail on it.
   Gate: continue.

3. **Demo rule.** The goal: in a demo lesson Sparky judges `# done:` against the run and asks
   the demo questions the OPEN task names before it completes it (one in a core task, three in
   the boss). The tutor eval has the new cases and passes.
   Skills: `ai-tutor`. Risk: a prompt change that leaks into weeks 1–11; Sparky losing count of
   the boss's three questions, or quizzing forever instead of completing.
   Gate: **stop for review** (run the eval by hand).

4. **Steps and copy.** The goal: every task has the steps and `go` line from the sketch, and the
   copy, scenes and catalog tests pass.
   Skills: `lesson-authoring`. Risk: the `walk` frames must match a real trace; the stage
   solution must win. Gate: continue.

5. **Docs, browser check and roadmap.** The goal: the "weeks 1–11" mentions say 12, the week
   works end to end at three widths, and phase 10 is ticked. Phase 10 no longer claims proof
   of skill for parents: that moves to D6's line, and the backlog item points at D6.
   Skills: `project-architecture`. Risk: a long page on a phone. Gate: **stop for review**.
