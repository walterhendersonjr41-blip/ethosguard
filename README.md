# EthosGuard AI

A free, local-first responsible-AI governance workspace. It works in your browser with no account, and your data stays in this browser (localStorage). You can export and import a JSON backup.

Live: https://walterhendersonjr41-blip.github.io/ethosguard/

## What it does (all real, no sample data)
- **Model registry:** register each AI system. A rule-based risk tier covers EU AI Act Annex III / Art. 5 and Colorado SB24-205 consequential-decision areas.
- **Bias testing:** load a CSV of decisions to get selection rates per group, the four-fifths (disparate impact) ratio, and the equal-opportunity gap.
- **Drift telemetry:** compare a baseline CSV with a current CSV to get the Population Stability Index for each column.
- **Policy suite:** starter templates you can adopt and edit, plus AI-drafted policies.
- **XAI matrix:** a per-system explainability checklist and a quick feature-association scan.
- **Audit trail:** every action is logged automatically, and you can export it as CSV.
- **Privacy guard:** a PII scanner (emails, phones, SSNs, cards, IPs and more) with a redacted download.
- **Safety bounds and incidents:** your thresholds plus an incident register.
- **Compliance map:** a NIST AI RMF checklist with automatic evidence, and an HTML governance report.
- **Model provenance:** live Hugging Face model lookups (license, task, base model and datasets) and a live PyPI/npm package license scan.
- **Dataset integrity:** duplicates, conflicting labels, empty rows, outliers and label balance.
- **Free AI** via the keyless Pollinations API: per-system recommendations, policy drafting, plain-English explanations and a chat helper.

Guidance only, not legal advice. Add `?ns=test` to the URL to use a separate test workspace.

## Files
`index.html` (layout and styles), `app.js` (the app), `ai-helper.js` (free AI), `sw.js` and `manifest.webmanifest` (install as an app).

Created by Walter Henderson Jr.
