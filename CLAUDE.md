@AGENTS.md

# Code notes

Project rules, commands and the task → doc → code table are in `../CLAUDE.md`; reference docs in `../about-application/` (outside this repo). Open only what the task needs.

- `src/lib/calc/` — pure calculation engine (no DB/React/Next imports). One module per item type in `items/`, registered in `registry.ts`; flat patterns via `dev/geometry.ts` + `dev/result.ts`. Item type ids are stored in the DB: never rename one.
- `src/lib/export/` — Excel (ExcelJS) and PDF (pdfmake) builders, pure; routes in `src/app/costings/[id]/export/`.
- `src/server/` — data layer; pages read through `queries.ts` / `load.ts`, mutations go through `run()` in `src/app/actions.ts` (always `requireUser()`).
- `src/db/schema.ts` — inputs only; weights and ₹ are recomputed on every read.
- This repo is public: never commit `.env` or client files.
