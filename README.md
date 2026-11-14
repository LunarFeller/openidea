# Agent draft acknowledgement regression evidence

Sending message A or creating task A can finish after the user has typed draft B. The previous code cleared the current composer unconditionally, deleting B. The fix consumes only the submitted composer revision from the same connection. It also preserves the last edited composer destination.

![Before: B disappears. After: B remains.](native-comparison.png)

[Three-step native replay](native-steps.gif): prepare A, submit A and type B while waiting, then complete A. The screenshots come from the macOS Tauri/WebKit app; boxes and captions are added by `annotate.py`.

## Before and after

| Verification | Main | Fixed |
| --- | --- | --- |
| New unit/component regressions | 68 failed, 37 passed | 105 passed |
| Browser submission scenarios | 2 failed, 6 passed | 8 passed |
| Native macOS scenarios | 8 failed, 4 passed | 12 passed |

The unchanged-success and failed-request controls already pass on main. The failing cases show newer draft content being erased by an older successful acknowledgement. Native cases cover session and new-task text edits, ABA edits, new files, new images, unchanged success, and edited failure. New-task checks reopen the New Task page after its normal navigation.

## Coverage

The 105 regression tests exercise queued sends, send-now, and task creation. They cover text/file/image-only and mixed inputs, replacement/addition/removal while pending, whitespace and empty submissions, editing back to the original content, structured and transport errors, overlapping acknowledgements in either order, a third unsent draft, deleting a composer, disconnect/reconnect and switching away/back, editing another composer, unchanged content after model/settings/caret updates, and the submitted payload/history.

`composerSubmission.test.tsx` renders the actual SessionEditor and HomeEditor with CodeMirror. The browser scenarios use the real workbench and local delayed acknowledgements; the native scenarios drive the real Tauri/WebKit editor with `document.execCommand('insertText', ...)`. No paid/external agent service was invoked. They verify client draft lifecycle, not provider integration.

## Revisions and limitations

Final branch base: `e41cf32a9443124c5eabd31c3e5b64aaaf44a9e5`.
Reproduction/native build base: `eeb20f467c6e63135042cd3b1185245850e11671`. The intervening main commits do not change any Agent source, composer dependency, or Agent IPC command. Final frontend checks and independent review were repeated on the final base.

The native development build used debug information off, dependency optimization off, no incremental output, and two Cargo jobs. To fit the local disk, it generated only the desktop executable's rlib dependency, omitted unused staticlib/cdylib packaging outputs, and skipped a temporary debug-strip copy. The temporary Cargo manifest change was restored, the app stopped, and this worktree's Cargo output removed before final checks. No Rust source or build configuration is included in the PR.

Windows/Linux native runs and real-provider end-to-end calls were not performed.

The full frontend run has one pre-existing unhandled rejection in `SourceDialog.test.tsx`: its SSH tunnel test reaches Tauri `invoke` without a native runtime. It reproduces on unmodified Agent code (`main-source-dialog.log`). All assertions pass, but this makes the process exit 1. The error was not suppressed or changed in this PR; see `runtime-errors.json`.

## Commands and review

Exact commands, final counts and exit codes are in [verification.json](verification.json). The original and final review records include SHA-256 hashes for all three change files; both independent reviews found no actionable issues.

- `pnpm vitest run src/features/agents/composerSubmission.test.tsx --maxWorkers=1`
- `pnpm test --maxWorkers=4` (default + JSON + runtime-error reporters)
- `OPENIDEA_E2E_PORT=15541 pnpm e2e e2e/agentDraftSubmission.spec.ts --workers=1`
- `OPENIDEA_E2E_PORT=15541 pnpm e2e e2e/agent*.spec.ts --workers=2`
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm knip`, `pnpm build`

Native replay scripts validate the worktree identifier before operating. They ignore retained editors under `aria-hidden="true"`, inspect both the visible CodeMirror document and its corresponding draft, and clear unrelated notifications before captures.
