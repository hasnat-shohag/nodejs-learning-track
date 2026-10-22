# Node.js Internals Tutorial — Design Spec

Date: 2026-10-22
Status: Approved in conversation, pending spec review

## Purpose

A bilingual (English / Bangla) learning site for Node.js internals and server-side
fundamentals, built on the CCAR-F Starlight theme. The learner is a frontend
developer (2 years, TypeScript/React/Next.js) who already knows JavaScript and V8
basics and wants server-side understanding: how Node handles requests, how the
event loop and libuv work, and how multi-threading works server-side.

Content is grounded in the official Node.js docs (nodejs.org), cited per lesson.
Every lesson ships a runnable demo. Progress is tracked locally.

Decisions made in brainstorming:

1. Full bilingual site: English root locale, Bangla `bn` locale, Starlight native
   language switcher, untranslated pages fall back to English (rare — both
   languages are authored together per lesson).
2. Two-track curriculum, internals-first: Node internals feed server practice.
3. Each lesson ships runnable demo files (`code/<domain>/<lesson>/`), plain
   `node`, zero dependencies.
4. Keep progress tracking (localStorage) and glossary. No exam-guide or revision
   sheets. Attribution points to nodejs.org docs pages.
5. Each lesson authored English first, Bangla translation immediately after,
   before the lesson counts as done. No translation backlog.
6. New sibling repo `~/nodejs-tutorial`, own git, GitHub Pages, base
   `/nodejs-tutorial/`, deploy via GitHub Actions (port CCAR-F pattern).
7. Locale layout: root locale = English (`src/content/docs/`), Bangla under
   `src/content/docs/bn/`. Same slugs pair pages for the switcher.

## 1. Repository & architecture

- `~/nodejs-tutorial`, git repository, branch `main`.
- GitHub Pages site, base `/nodejs-tutorial/`, `trailingSlash: 'always'`,
  `site: 'https://<owner>.github.io'`. Node >= 22, pnpm.
- Astro + Starlight, ported from CCAR-F (`/home/vivasoft/ccar-f`):
  - `src/components/starlight/Head.astro`
  - `src/styles/custom.css` (minus CCAR-F exam-specific rules)
  - Fonts: Inter (Latin UI), JetBrains Mono (code), Noto Sans Bengali (Bangla)
  - Mermaid diagrams (fenced blocks, client-side render, same inline
    `max-width` + `!important` cap-lift pattern as CCAR-F)
  - `src/lib/urls.ts` — `siteUrl()` helper; all internal links in `.astro`
    components and MDX go through it or spell out the base, because the site is
    served under a non-root path. `check:links` fails on root-relative links
    missing the base.
- Deploy: GitHub Actions workflow ported from CCAR-F `.github/`, building to
  Pages.
- `package.json` scripts: `dev`, `start`, `build`, `preview`, `check`
  (`astro check`), `check:links`, `check:terms`, `check:contrast`.
  `fetch-source` dropped — no upstream site is mirrored; nodejs.org pages are
  cited per lesson via `sourceUrl` instead.

## 2. Curriculum: 5 domains, 30 lessons

Two tracks, internals first. Domain order teaches internals (1–3) before the
server built on them (4–5).

### Domain 1 — Node anatomy & event loop (6 lessons)

| ID | Slug | Title (en) |
|----|------|------------|
| 1-1 | `1-1-process-anatomy` | Node process anatomy: V8, libuv, bindings, `process` |
| 1-2 | `1-2-event-loop-phases` | Event loop phases: timers, poll, check, close |
| 1-3 | `1-3-microtask-ordering` | Microtask ordering: `nextTick` vs Promise vs `setImmediate` |
| 1-4 | `1-4-blocking-the-loop` | Blocking the loop: cost model, measuring event-loop lag |
| 1-5 | `1-5-libuv-thread-pool` | libuv thread pool: `UV_THREADPOOL_SIZE`, off-thread work |
| 1-6 | `1-6-timers-deep` | Timers deep: ref/unref, nesting, `setInterval` drift |

1-5 covers what runs on the thread pool: fs, `crypto.pbkdf2`, zlib, dns.

### Domain 2 — V8, memory & module internals (5 lessons)

| ID | Slug | Title (en) |
|----|------|------------|
| 2-1 | `2-1-v8-server-view` | V8 from a server dev's view: JIT, hidden classes, GC |
| 2-2 | `2-2-heap-stack-limits` | Heap vs stack, `--max-old-space-size`, OOM diagnosis |
| 2-3 | `2-3-memory-leaks` | Memory leaks: closures, timers, listeners; heap snapshots |
| 2-4 | `2-4-module-internals` | CJS vs ESM internals: resolution, module cache, ESM loader |
| 2-5 | `2-5-native-boundary` | The native boundary: N-API addons, JS calling C++ |

### Domain 3 — Multi-threading & processes (6 lessons)

| ID | Slug | Title (en) |
|----|------|------------|
| 3-1 | `3-1-worker-threads` | `worker_threads`: Worker, MessageChannel, transfer vs clone |
| 3-2 | `3-2-sharedarraybuffer` | SharedArrayBuffer + Atomics: shared memory across threads |
| 3-3 | `3-3-cpu-vs-io` | CPU-bound vs I/O-bound: benchmark sync vs worker |
| 3-4 | `3-4-worker-pool` | Worker pool pattern: queue, pool sizing |
| 3-5 | `3-5-cluster` | `cluster` module: processes, round-robin, shared port |
| 3-6 | `3-6-child-process` | `child_process` + signals: spawn/fork/exec, IPC, shutdown |

### Domain 4 — HTTP server from scratch (6 lessons)

| ID | Slug | Title (en) |
|----|------|------------|
| 4-1 | `4-1-http-lifecycle` | `node:http` lifecycle: createServer, req/res, socket events |
| 4-2 | `4-2-request-parsing` | Request parsing: URL, query, headers, body buffering vs streaming |
| 4-3 | `4-3-router-middleware` | Build a router + middleware chain (no Express) |
| 4-4 | `4-4-error-handling` | Error handling: `'error'` events, async wrappers, 500s |
| 4-5 | `4-5-streams` | Streams: Readable/Writable/Duplex/Transform, object mode |
| 4-6 | `4-6-backpressure` | Backpressure: `pipe`, `highWaterMark`, `.write() === false` |

### Domain 5 — Production server (7 lessons)

| ID | Slug | Title (en) |
|----|------|------------|
| 5-1 | `5-1-buffers` | Buffers & binary data: pool, TypedArray views, encoding |
| 5-2 | `5-2-file-uploads` | File uploads: multipart parse, streaming to disk |
| 5-3 | `5-3-static-server` | Static file server: ETag, Cache-Control, MIME, ranges |
| 5-4 | `5-4-tls-server` | TLS server: `node:https`, self-signed cert demo |
| 5-5 | `5-5-server-security` | Security: timing-safe compare, header hygiene, limits |
| 5-6 | `5-6-diagnostics` | Diagnostics: `--inspect`, `perf_hooks`, flamegraphs |
| 5-7 | `5-7-capstone` | Capstone: static server + worker pool for image resize |

Capstone ties domains 3, 4, and 5 together. sharp is optional; if it is not
installed the capstone falls back to a CPU-bound hash loop so the worker pool
pattern is still exercised with zero dependencies.

Plus index pages: `/learn/` syllabus, one `/learn/<domain>/` overview per
domain, `/progress/`, `/glossary/`, `/about/` (sources & license).

## 3. i18n mechanics

- `locales: { root: { label: 'English', lang: 'en' }, bn: { label: 'বাংলা', lang: 'bn-BD' } }`,
  `defaultLocale: 'root'`.
- Starlight's built-in `LanguageSelect` component renders the switch button in
  the header; no custom switcher. It swaps page content, sidebar, and UI.
- Sidebar groups and labels: Starlight's `{ 'en': '…', 'bn': '…' }` string map
  form, so the sidebar translates with the locale.
- English lessons: `src/content/docs/learn/<domain-slug>/<lesson-slug>.mdx`.
- Bangla lessons: `src/content/docs/bn/learn/<domain-slug>/<lesson-slug>.mdx`.
  Same slug pairs them for the switcher.
- UI strings: `src/content/i18n/en.json` (override a few defaults) and
  `src/content/i18n/bn.json` (full translation file, adapted from CCAR-F
  `bn-BD.json`).
- Bangla style rule (from CCAR-F): technical terms stay in English/Latin
  script (`event loop`, `worker_threads`, `SharedArrayBuffer`); code
  identifiers are never transliterated.
- Untranslated-page fallback: Starlight serves the English page under the `bn`
  route with a "page not translated" banner. Expected to be rare: the
  authoring workflow writes both languages per lesson before it counts as
  done. A domain whose Bangla lessons are not all present yet still gets its
  Bangla index page so sidebar links never 404.
- Authoring order per lesson: English body first, Bangla translation second,
  then the lesson is marked complete in the author's own progress. No
  translation backlog by policy.

## 4. Lesson frontmatter & schema

`src/content.config.ts` — Starlight `docsSchema` extended with:

- `titleEn` (Bangla lessons keep the English title for reference; English
  lessons use `title` directly)
- `domain` (1–5), `task` (e.g. "1.1"), `order` (number)
- `sourceUrl` (nodejs.org docs page cited for the lesson)
- `updated` (date)
- `keywords[]` — `{ term }` only; definitions live in the glossary, the
  glossary wins on conflicts (CCAR-F rule)
- `sources[]` — `{ label, href, note? }`

Every lesson body ends with `<Attribution sourceUrl={frontmatter.sourceUrl} />`
and `<MarkComplete lessonId="<domain>-<task>" />`.

## 5. Components & features (ported from CCAR-F, adapted)

- Progress tracking: `MarkComplete`, `ReadingProgress`, `DomainProgress`,
  `OverallProgress`. localStorage key `nodejs:v1`. Progress is per-lesson and
  shared across locales (one progress list whether reading in English or
  Bangla).
- `KeywordTable` — pulls definitions from the glossary by term.
- `GlossaryExplorer` + `/glossary/` page — bilingual definitions.
- `Attribution` — "Source: Node.js docs" link from `sourceUrl`.
- `BuildExercise` — 2–3 hands-on tasks per lesson referencing the demo files.
- `LessonList`, `DomainCards` — index/overview pages.
- CCAR-F's `ExamTrap` is repurposed as `Pitfall` — a callout for classic
  mistakes (blocking the event loop, ignoring backpressure, holding a worker
  pool at size 4 while feeding it I/O).
- No exam-guide, no quick-reference sheets, no domain weights.
- Mermaid diagrams for architecture (event loop phases, thread pool, cluster
  round-robin, stream pipeline, backpressure flow).

## 6. Glossary

`src/content/glossary-terms.json` — entries:

```json
{ "term": "event loop", "defEn": "…", "defBn": "…", "refs": ["https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick"] }
```

- One glossary file for both locales; each entry carries both definitions.
- `check:terms` verifies every lesson keyword resolves to a glossary entry
  (adapted from CCAR-F's `tools/check-terms.mjs`).

## 7. Demos

- `code/<domain-slug>/<lesson-slug>/demo.js` — one or more files per lesson,
  plain `node`, zero npm dependencies.
- Each lesson: embedded snippet + expected output + relative link to the demo
  file (repo link, not site route).
- Lesson code files are excluded from the built site but live in the repo.
- Demos are run by hand during authoring to verify the documented output.

## 8. Verification gates

Before every commit:

- `pnpm check` (astro check, TypeScript)
- `pnpm build`
- `pnpm check:links` (base-aware, ported from CCAR-F)
- `pnpm check:contrast` (headless Chrome over `dist/`, ported; needs Chrome or
  `--allow-missing-browser`)

Plus `pnpm check:terms` when glossary or keywords change.

## 9. Build order (implementation phases)

1. Scaffold repo: package.json, Astro config (i18n locales, sidebar with
   bilingual labels), port Head.astro, custom.css, fonts, `urls.ts`. Two stub
   lessons (one English, one paired Bangla) verify the language switcher
   end-to-end.
2. Tools: `check-links` (new base path), `check-terms` (new glossary schema),
   `check-contrast`. GitHub Actions workflow.
3. Domain data: `domains.ts`, `lessons.ts` for the 30-lesson curriculum.
4. Lessons domain 1 → 5, in order. Each lesson: English body, Bangla body,
   demo files, glossary terms, links, gates. Domain index pages with the
   lessons they have.
5. Progress dashboard `/progress/`, glossary `/glossary/`, about page, 404.

## Non-goals

- No exam or certification material.
- No framework tutorials (Express/Fastify/Nest). Router/middleware lesson
  builds from scratch deliberately.
- No database, auth, or deployment-platform content.
- No custom language-switcher component — Starlight's built-in one.
- No backend for progress — localStorage only.
