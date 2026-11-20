# Hand-off: finish the table library, subtasks 4 to 9

This work moved here from a local session on 2026-11-21. The owner wants all remaining subtasks done in one run, without questions and without waits. Pushes are allowed. Read this file first, then the files it names.

## What to read, in this order

1. `CLAUDE.md` at the repository root: layers, design rules, commands, tool facts.
2. `docs/handoff/task-002.md`: the full task record. It holds the Goal, the Facts about the old table, the Decisions (D1 to D9 are the owner's; A1 to A13 are assumptions), the nine Slices, and the Notes with the state of the work and the design of subtasks 3 and 4. Paths in it are Windows paths of the first machine; `.backlog/...` paths do not exist here.
3. `docs/handoff/task-002-log.md`: what each earlier session did and learned.
4. `docs/ui-sdk-api-notes.md`: exact UI SDK 0.1.0-beta.13 signatures and limits. Never read `docs/core.md` of `@ui-sdk/vue` whole, and never read `dist/*.js` of `@ui-sdk/*`.
5. `docs/proof/RESULT.md` and `docs/proof/src/proofs/`: proven bridges for resize, reorder, cell range and the virtualizer.

## Repositories

- This repository is the library: `packages/core`, `packages/vue`, `packages/styled`, `apps/docs`.
- `../repos/` holds `dashboard-template`, the app that the library replaces a table in. Run `ls ../repos` and `git -C ../repos/<dir> remote -v` to find the real folder name. Its branch `table-swap-baseline` is the state to start from, not `master`. Its `CLAUDE.md` has its own rules (design system, `pnpm ds:audit`, two linters). The old table is in `src/components/CustomTable/` and `src/composables/table/` there; read it for feature parity (export, labels, sticky rows, virtual rows, facets, formatters).

## State on 2026-11-21

- Subtasks 1, 2 and 3 are done and accepted by the owner. Checks at that point: `vp check` pass, `vue-tsc --build` 0 errors, 145 unit tests, 3 Playwright tests, build pass.
- Subtask 4 (columns) has started: `packages/core/src/columns/layout.ts` (`layoutColumns`, `fullColumnOrder`) with 6 passing tests. It is not yet used by `packages/core/src/table.ts`. The plan for the rest of subtask 4 is in the Notes of `task-002.md` ("Next: subtask 4, columns").
- Open from subtask 3: the footer row and the `empty` row are outside the keyboard grid and have no `aria-rowindex` (fix in subtask 5); no test with a UI SDK control inside a cell (add in subtask 6); `simplify` was not run on subtask 3; the `Table` component has three default English texts (`+`, `−`, the group count) to move to `messages` in subtask 7.

## What to do

Do the Slices 4 to 9 of `task-002.md` in order. For each subtask:

1. Diagnose before you fix. A bug is evidence that the structure permits it; remove the structure, do not guard the symptom.
2. Build it. Each experimental UI SDK behavior sits behind one file in `packages/core/src/behaviors/`.
3. Test it: unit tests for pure code and for the primitive (`mount` from `@ui-sdk/core/testing`), `@vue/test-utils` for the Vue layer, and a Playwright test for every keyboard, focus, pointer and layout rule. jsdom passed three rules that were wrong in a browser.
4. Run all checks: `pnpm check`, `pnpm type-check`, `pnpm exec vp test run`, `pnpm test:e2e`, `pnpm build`. Fix every failure before the next subtask.
5. Review it: start one subagent that has not seen your conclusions, give it the files and ask for correctness bugs with concrete scenarios. Verify each finding, fix what holds, and add a test for each fix.
6. Record it: tick the slice in `docs/handoff/task-002.md`, add a dated note to its "State of the work" list, and add an entry to `docs/handoff/task-002-log.md` (Did, Decisions, Learned, State). When the 50,000-row numbers change, add a column to `docs/benchmarks.md`.
7. Commit and push to `master` of this repository: one or a few commits per subtask, with messages in the style `area: what changed`.

Judge work by whether it is correct, not by its cost. "A lot of work" is no reason to stop or to cut scope. Stop a line of work only when you tried it and it is proven impossible; then write what you tried in the log and take the next best correct route.

### Subtask 9, in `dashboard-template`

- Work on a new branch `table-swap`, created from `origin/table-swap-baseline` with that branch as its upstream base. Never push to `master` there. Open a pull request from `table-swap` to `master` with `gh pr create` when the checks of that repository pass (`vp check`, `pnpm type-check`, `pnpm lint:eslint`, `vp test`, `pnpm ds:audit`, and its Playwright tests where they cover the table pages).
- Do not publish to npm. The public package name is not confirmed by the owner, and the packages cannot ship declaration files yet (assumption A11). Consume the headless packages as git dependencies on a commit of this repository (pnpm supports a sub-folder: `github:<owner>/<repo>#<commit>&path:/packages/core`), or another route that installs from this repository without a registry. Write the chosen route and its limits in the pull request text. The npm publish stays an open item for the owner.
- The styled table reaches the app as owned source through a registry file that this repository builds (decision D3). The `@electricity-ui` registry entry of the app stays.
- The library develops against Vue 3.5. `dashboard-template` pins a Vue 3.6 release candidate: run the library tests under that Vue version too, and record the result.

## Rules that always hold

- No mention of an AI agent or an AI tool in code, comments, commit messages, commit authors or pull request text. The file name `CLAUDE.md` and the `.agents/` folder are tool configuration and stay.
- Comments explain why. No comment describes a change (`// new`, `// fixed`, `// removed`).
- Tabs, single quotes, no semicolons; run `pnpm exec vp fmt` before a commit. `noUncheckedIndexedAccess` is on: guard or default, never `!`, `as any` or `@ts-ignore`.
- Do not bump `@ui-sdk/*`, `typescript`, or `vue-tsc`.
- Decisions D1 to D9 are the owner's. When one cannot hold, do not trade it away silently: take the route that keeps it, or, when none exists, write a section "Divergence" in the log with what you found, the options, and the option you took, and continue.
- Prose for the owner (the log, the final report, the pull request text) is in Simplified Technical English: short active sentences, one idea each, exact technical names.

## When all subtasks are done

Write `docs/handoff/REPORT.md`: for each subtask what was built, the decisions kept, the assumptions you added, the checks with their results, the 50,000-row numbers, and every open item (npm publish and package name, declaration files, anything you could not finish and why). Commit and push it, and give the report path, the last commit of this repository and the pull request URL as your final message.
