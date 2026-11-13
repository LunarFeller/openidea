# Exact numeric text: verification for #3105

`9007199254740993 + 1` was shown as `9007199254740992`; the fix shows `9007199254740994`. HTTP/GraphQL no longer change `1.0000000000000000002` into `1` or `1e-400` into `0`.

- Same 283 focused cases: 119 fail on the original main code; all 283 pass with the fix. These count test cases, not independent bugs. The regression suite includes 1,088 deterministic rational-oracle datasets plus 250 arithmetic datasets, sign/scale/cancellation/NULL/median/rounding boundaries, and a subprocess timeout protecting the extreme-negative-axis regression.
- Full frontend suite: 11,249 pass, six skipped. Final database/numeric browser subset: 33 pass. Full browser run: 393/399 pass; all six unrelated failures reproduced on original main. See the baseline reports for repeat counts.
- Workspace Rust tests ran in batches to fit available disk: 4,533 pass, 114 skipped at `09aa03bb`. After rebasing to `b971c8b3`, all 144 ide-core/ide-http tests and full-workspace clippy pass. Three new Rust tests fail with the old environment parser and pass with the fix.
- Native macOS: real SQLite queries and actual HTTP/GraphQL requests to a local server. `python3 verify-native.py` independently checks the recorded query values, rendered text and server request bodies with Python integers/Decimal: 24 numeric checks fail before and pass after; five controls pass in both phases.
- Decimal fixtures use SQLite TEXT so the database cannot round them before the UI receives them. This is not a live PostgreSQL test. Windows/Linux were not tested natively.
- Notification toasts were dismissed before captures. Annotated images add code-drawn borders and explanatory footers. Original numeric pixels are unchanged; original PNGs and annotation metadata are included. No image generation was used.
- `chart-interaction-browser.webm` is a browser recording of changing chart aggregation and chart type; native screenshots are separate.

Reproduce native fixtures: create an SQLite database using `fixture/reproduce.sql`; open the folder in the app, connect to that database and execute `fixture/checks.sql`. Start `python3 fixture/server.py` for a local endpoint; it writes `.graphqlrc.json`, requests and the selected port into that fixture folder. Paste the exact response object into GraphQL Variables before running the query. `verify-native.py` checks the captures already stored here without launching the app.

Intentionally approximate coordinates and float database columns remain approximate. Repeating averages retain the existing twelve-significant-digit display policy; arithmetic beyond the bounded size is reported as unavailable rather than a rounded total.
