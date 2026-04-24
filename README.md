# WebGPU Study 2026

A lesson-first WebGPU study studio inspired by `webgpu-samples`, rebuilt with a modern toolchain and a lightweight harness for stable AI-assisted development.

## Stack

- Vite 8
- TypeScript 6
- Raw WebGPU

## Commands

```bash
pnpm install
pnpm dev
pnpm build
```

## Layout

- Left rail: lesson roadmap
- Center: live preview
- Right rail: notes and source pulled from the actual lesson files

## Harness Engineering

This project keeps a slim, repo-native harness:

- `.local-harness/AGENTS.md`: repo contract and development rules
- `.local-harness/docs/`: rationale and operating model
- `.local-harness/tasks/`: one task brief per deliverable
- `.codex/`: project-scoped Codex config, hooks, and agent roles kept local-only

## Lesson Status

- `01 Hello Triangle`: complete
- More lessons are scaffolded as planned entries in the studio UI
