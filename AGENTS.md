# Agent notes

- Before writing any prose (changelog, README, docs, commit messages, comments, English or Swedish UI strings), read [`.cursor/skills/writing/SKILL.md`](.cursor/skills/writing/SKILL.md). No LLM language.
- When a change ships that learners will notice, add it to [`CHANGELOG.md`](CHANGELOG.md) and [`CHANGELOG.sv.md`](CHANGELOG.sv.md) following [`.cursor/skills/changelog/SKILL.md`](.cursor/skills/changelog/SKILL.md).
- Content rules live in [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md). Run `npm run content:check`, `npx vitest run`, `npx tsc -b` and `npm run lint` before committing.
