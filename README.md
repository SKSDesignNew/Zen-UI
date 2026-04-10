# ZenPlus — Enterprise Rules Traceability Demo

## What This Is
Interactive client-facing demo for **ZenPlus** (formerly ZenFlow), showing deterministic AI governance for BFSI legacy TAL-to-Java modernization. Target clients: Visa, US Bank, Citi, Amex, Capital One.

## Tech Stack
- React 18 + Vite 6 (single-file App.jsx, ~930 lines)
- No external UI deps — pure inline styles
- Google Fonts: Playfair Display, DM Sans, Inter, JetBrains Mono
- Dual themes: Executive Warm + Frost

## 10 Tabs
1. **The Challenge** — Legacy reality: 9M lines TAL, real code explorer (3 TAL files)
2. **Dashboard** — Migration progress pipeline, 18mo vs 6mo comparison, multi-persona view
3. **5 Pillars** — Interactive governance pillar explorer with visual moat diagrams
4. **Use Case** — 6-step credit card authorization pipeline
5. **Rules** — 100K procedurally generated rules, paginated table, search/filter/sort
6. **Z+Graph** — Hierarchical domain cluster graph → drill into 13-rule call graph
7. **Lineage** — Live transaction flow simulator with editable inputs
8. **LLM vs ZF** — Side-by-side 7-stage pipeline comparison
9. **Sandbox** — TAL-to-Java conversion simulator (8 phases)
10. **What-If** — Rule parameter adjustment with simulated impact

## Supabase Backend
- **Project:** zenplus-tal-intelligence
- **ID:** dggijemnrsjngwictqzc
- **URL:** https://dggijemnrsjngwictqzc.supabase.co
- **Region:** us-east-1
- 20 real TAL files from darmin/sample-mainframe-repo (HPE NonStop TPA system)
- 34 extracted routines, 14 business rules, 20 dependencies
- 9 tables: tal_source_files, tal_routines, tal_structures, tal_rules, routine_dependencies, rule_dependencies, conversion_artifacts, audit_trail, file_metrics

## Deploy
```bash
npm install
npm run build
npx vercel --prod
```

## TODO
- Connect demo to Supabase (replace synthetic data with real TAL)
- Extract routines from remaining 16 TAL files
- Push to GitHub repo
- Add FINIPC message flow visualization
