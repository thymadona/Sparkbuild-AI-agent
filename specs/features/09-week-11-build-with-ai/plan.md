# Week 11 — Build With AI: plan

Read `requirements.md` and `validation.md` first. Do the groups in order.

1. **Step sketch.** The goal: the owner has approved `sketch.md`, which covers the project, tasks,
   code, checks, steps and copy.
   Skills: `task-design`. Risk: none (no code). Gate: **stop for review** (approved with this spec).

2. **Lesson skeleton.** The goal: lesson 111 exists with its 8 tasks, checks, the `from` chain
   of the four show steps, the empty starters, the bugzap file, solution fixtures, frozen ids
   and the step-by-step flag. There are no steps yet, and catalog tests pass.
   Skills: `lesson-authoring`. Risk: `from` chains are new in a director lesson (the director
   tests assume a starter holds no plan, ask or notes); a behaviour check that already passes on
   the previous step's finished code; a loose pattern (`star` also matches `start`).
   Gate: continue.

3. **Tutor rules.** The goal: in a step-by-step lesson Sparky refuses an `# ask:` that asks for
   more than this task's step, and asks one "why" question about a line Bolt wrote before it
   completes the task. The tutor eval has the new cases and passes.
   Skills: `ai-tutor`. Risk: a prompt change that leaks into weeks 1–10, or Sparky asking "why"
   again and again instead of completing. Gate: **stop for review** (run the eval by hand).

4. **Steps and copy.** The goal: every task has the steps and `go` line from the sketch, and the
   copy, scenes and catalog tests pass.
   Skills: `lesson-authoring`. Risk: the step-copy total (about 60 words to spare) and the stage
   solution. Gate: continue.

5. **Browser check and roadmap.** The goal: the week works end to end at three widths, and phase
   9 is ticked. Skills: `project-architecture`. Risk: layout on a phone, Bolt on a long page.
   Gate: **stop for review**.
