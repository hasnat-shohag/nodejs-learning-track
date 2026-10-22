# Node.js Tutorial Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the bilingual (en/bn) Starlight site that hosts the Node.js internals curriculum — theme, i18n with language switcher, domain/lesson data, demo-code scaffolding, ported tools, CI — verified with two paired stub lessons.

**Architecture:** Port the CCAR-F Starlight theme to a fresh repo. Root locale = English, `bn` locale = Bangla under `src/content/docs/bn/`, Starlight's built-in `LanguageSelect` switches languages by pairing same slugs. All project-wide data (domains, lessons, glossary, progress) lives in `src/lib/` and `src/content/` with typed interfaces; lessons ship demo code under `code/<domain-slug>/<lesson-slug>/`.

**Tech Stack:** Astro 7 + Starlight 0.42, pnpm, Node >= 22, TypeScript, Mermaid 11, fontsource fonts (Inter Variable, JetBrains Mono Variable, Noto Sans Bengali), GitHub Actions → Pages.

**Spec:** `docs/superpowers/specs/2026-10-22-nodejs-tutorial-design.md`

Source theme to port from: `/home/vivasoft/ccar-f` (read files there, adapt, never edit that repo).

## Global Constraints

- Base path `/nodejs-tutorial/`, `site: 'https://hasnat-shohag.github.io'`, `trailingSlash: 'always'`.
- Every internal link in `.astro` components uses `siteUrl()` from `src/lib/urls.ts`; links in MDX that must be root-relative spell out `/nodejs-tutorial/` fully. `check:links` fails otherwise.
- localStorage key `nodejs:v1` (`src/lib/progress.ts`), event name `nodejs:progress-change`.
- Bangla prose keeps technical terms in English/Latin script; code identifiers never transliterated.
- Zero npm dependencies for demo code under `code/`.
- Frontmatter lesson schema: `titleEn?`, `domain` (1–5), `task`, `order`, `sourceUrl`, `updated`, `keywords[{term}]` (strict object), `sources[{label,href,note?}]`.
- Every lesson body ends with `<Attribution sourceUrl={frontmatter.sourceUrl} />` and `<MarkComplete lessonId="<domain>-<task>" />`.
- Glossary schema: `{ "term": string, "defEn": string, "defBn": string, "refs"?: string[] }` — one file, both locales.
- Gates before every commit: `pnpm check`, `pnpm build`, `pnpm check:links`, `pnpm check:contrast` (`--allow-missing-browser` acceptable locally when Chrome absent), `pnpm check:terms` when glossary/keywords touched.
- Commit style: conventional commits, end with `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- No exam-guide, no quick-reference sheets, no fetch-source tool, no custom language switcher.

## Review Focus

- **Base-pathless links 404 in Pages.** Any internal href without the `/nodejs-tutorial` prefix breaks in production but works in dev. Pinned by Task 8: `check:links` must fail when a stub lesson carries a bare `/learn/` link (test by temporarily removing the prefix and expecting exit 1).
- **Untranslated bn lesson must fall back, not 404.** A `bn` route whose Bangla file is missing must serve the English page. Pinned by Task 6: build with only the English stub of the pair, expect `/nodejs-tutorial/bn/learn/.../index.html` to exist in `dist/`.
- **Corrupt localStorage must not crash the site.** Bad JSON in `nodejs:v1` must degrade to empty progress. Pinned by Task 9: unit test `loadState` with garbage input expecting empty state.
- **Glossary drift must fail fast.** A lesson keyword missing from the glossary must fail `check:terms` (and KeywordTable's throw) before it ships. Pinned by Task 10: `check:terms` run against a stub lesson with an unknown keyword must exit 1.
- **Sidebar must not 404 for not-yet-written lessons.** `lessons.ts` lists all 30 planned lessons; only built ones show. Pinned by Task 7: sidebar test in `astro.config.mjs` (`hasLesson` filter) — with one stub lesson on disk, `astro build` output sidebar must contain exactly that one lesson link, not 29 broken ones.

---

### Task 1: Repo scaffold + config

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.nvmrc` (`22`), `.gitignore`, `.vscode/extensions.json`
- Copy: `.gitignore` content adapted from `/home/vivasoft/ccar-f/.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm` scripts used by all later tasks: `dev`, `start`, `build`, `preview`, `check`, `check:links`, `check:terms`, `check:contrast`. `astro.config.mjs` exports `defineConfig` with `site`, `base`, `trailingSlash`, `integrations: [starlight({...})]`.

- [ ] **Step 1: Write `package.json`**

Name `nodejs-learning-track`, private, `type: module`, engines `node >= 22`. Dependencies mirror CCAR-F minus nothing (all used): `@astrojs/starlight ^0.42.0`, `astro ^7.2.10`, `mermaid ^11.6.0`, `sharp ^0.35.3`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `@fontsource/noto-sans-bengali`; devDeps `@astrojs/check`, `typescript`. Scripts: `dev`/`start` = `astro dev`, `build`, `preview`, `check` = `astro check`, plus `check:links`/`check:terms`/`check:contrast` pointing at `tools/*.mjs` (files arrive in Tasks 8/10/11 — create placeholder scripts that `console.log('not implemented')` and `process.exit(0)` so the scripts exist from the first commit).

- [ ] **Step 2: Write `astro.config.mjs`**

Port the CCAR-F structure (`/home/vivasoft/ccar-f/astro.config.mjs`) with these changes:
- `site: 'https://hasnat-shohag.github.io'`, `base: '/nodejs-tutorial'`, `trailingSlash: 'always'`
- `title` and `description` via Starlight string-map form: `{ 'en': 'Node.js Learning Track', 'bn': 'Node.js লার্নিং ট্র্যাক' }`
- `locales: { root: { label: 'English', lang: 'en' }, bn: { label: 'বাংলা', lang: 'bn-BD' } }`, `defaultLocale: 'root'`
- Sidebar defined later (Task 7) — for now one group `{ label: {'en': 'Learn', 'bn': 'শেখা'}, items: [{ label: {'en': 'Index', 'bn': 'ইনডেক্স'}, link: 'learn/' }] }`
- `editLink.baseUrl: 'https://github.com/hasnat-shohag/nodejs-learning-track/edit/main/'`, `lastUpdated: true`, `pagination: true`
- `customCss: ['./src/styles/custom.css']`, `components: { Head: './src/components/starlight/Head.astro' }` (files arrive Tasks 2/5; create minimal placeholders so config validates)
- No `head` meta yet (Task 2 adds via site config), no `__SOURCE_SITE__` define.

- [ ] **Step 3: `.nvmrc`, `.gitignore`, `tsconfig.json`, `.vscode/extensions.json`**

`.gitignore` from CCAR-F (node_modules, dist, .astro). `tsconfig.json`: `{"extends": "astro/tsconfigs/strict", "include": [".astro/types.d.ts", "src/**/*"], "exclude": ["dist", "code"]}` — exclude `code/` from typecheck so demo files stay loose JS. `.vscode/extensions.json`: astro-build.astro-vscode.

- [ ] **Step 4: Install + verify**

Run: `pnpm install && pnpm astro --version`
Expected: install succeeds, prints Astro 7.x. Placeholders mean `pnpm check` passes with zero content (Starlight builds with no docs yet is an error — add `src/content/docs/index.mdx` stub `{ title: 'Node.js Learning Track' }` now; Task 12 replaces it).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Astro + Starlight site with bilingual config"
```

### Task 2: Styles, fonts, base helpers

**Files:**
- Create: `src/styles/custom.css`, `src/lib/urls.ts`, `src/lib/domains.ts`, `src/lib/lessons.ts`

**Interfaces:**
- Consumes: Task 1 config.
- Produces: `siteUrl(path: string): string`; `DOMAINS: DomainMeta[]`, `DomainId = 1|2|3|4|5`, `DomainMeta { id, slug, labelBn, labelEn, accent }` (no `weight`, no `lessons` count — lesson count derived), `TOTAL_LESSONS`; `LESSONS: LessonMeta[]` with `{ id, domain, slug, titleEn, titleBn }`, `domainLessons(domain: DomainId): LessonMeta[]`, `lessonPath(lesson): string` → `learn/<domain-slug>/<lesson-slug>`.

- [ ] **Step 1: Port `custom.css`**

Copy `/home/vivasoft/ccar-f/src/styles/custom.css` wholesale, then: rename CSS custom properties `--ccarf-*` to `--nlt-*` (control height/radius/reading bar), remove rules targeting `.keyword-table .tip`, `.exam-*`, `.quick-ref-*` classes if present, keep everything else (fonts import, typography, TOC column grid, accent remap `--sl-color-text-accent` → `--sl-color-accent-high`, mermaid `!important` cap-lift, search dialog grid, mark-complete styles, domain accent paint via `[data-domain]`).

- [ ] **Step 2: Port `urls.ts` verbatim** (base-prefix helper, 9 lines).

- [ ] **Step 3: Write `domains.ts`**

Five domains from spec section 2, slugs: `1-node-anatomy-event-loop`, `2-v8-memory-modules`, `3-multithreading-processes`, `4-http-server-scratch`, `5-production-server`. Labels (en + bn) from spec domain names; accents reuse CCAR-F palette (`#3b82f6`, `#14b8a6`, `#f59e0b`, `#8b5cf6`, `#f43f5e`). `TOTAL_LESSONS = 30`. No `SOURCE_SITE` export (nodejs.org cited per lesson).

- [ ] **Step 4: Write `lessons.ts`**

All 30 `LessonMeta` entries from spec section 2 tables, `titleEn` + `titleBn` per lesson (Bangla titles follow CCAR-F style: technical terms in English inside Bangla title). Same `domainLessons`/`lessonPath` helpers as CCAR-F, types only.

- [ ] **Step 5: Verify**

Run: `pnpm check`
Expected: pass (types compile).

- [ ] **Step 6: Commit**

```bash
git add src && git commit -m "feat: port theme styles and add domain/lesson data"
```

### Task 3: Content schema + glossary

**Files:**
- Create: `src/content.config.ts`, `src/content/glossary-terms.json`, `src/content/style-terms.json`

**Interfaces:**
- Consumes: Task 2 lessons (for demo glossary entries).
- Produces: `lessonFrontmatter` zod schema (Global Constraints shape, `strictObject` on keywords — zod v4 `z.object` silently strips unknown keys); glossary entries `{ term, defEn, defBn, refs?, domain? }` consumed by `KeywordTable` (Task 5) and `check:terms` (Task 10).

- [ ] **Step 1: Write `src/content.config.ts`**

Port CCAR-F `src/content.config.ts`, keep `docs` + `i18n` collections, swap `lessonFrontmatter` to Global Constraints shape (add `titleEn`, keep strict keywords). Comments adapted, not copied verbatim (CCAR-F comment references CCAR-F rules).

- [ ] **Step 2: Write seed `glossary-terms.json`**

Three entries needed by stub lessons (Task 6/7): `event loop`, `libuv`, `worker_threads` — `defEn`/`defBn` one-two sentences each, `refs` pointing at real nodejs.org pages (`https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick`, `https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop`, `https://nodejs.org/api/worker_threads.html`).

- [ ] **Step 3: Write seed `style-terms.json`**

Copy CCAR-F shape (`{ "prefer": [...], "avoid": [...] }` — inspect the actual file first), seed: prefer `worker_threads` avoid `Worker`/`worker threads` in prose, prefer `child_process` avoid `child process`. Bangla transliteration bans go here too.

- [ ] **Step 4: Verify + commit**

Run: `pnpm check`
Expected: pass.

```bash
git add src && git commit -m "feat: content schema and seed glossary"
```

### Task 4: i18n UI strings

**Files:**
- Create: `src/content/i18n/en.json`, `src/content/i18n/bn.json`

**Interfaces:**
- Consumes: nothing.
- Produces: Starlight UI overrides for both locales; `bn.json` full translation (28 Starlight keys + expressiveCode + pagefind keys) adapted from `/home/vivasoft/ccar-f/src/content/i18n/bn-BD.json` (same file, rename to `bn.json`).

- [ ] **Step 1: Write `bn.json`**

Copy CCAR-F `bn-BD.json` as-is (it is a complete Starlight translation, values suit this site). Keep `search.devWarning`, pagefind keys etc.

- [ ] **Step 2: Write `en.json`**

Empty JSON object `{}` — Starlight defaults cover English; the file exists so Task 10 can scan both locales.

- [ ] **Step 3: Verify + commit**

Run: `pnpm build`
Expected: builds; `dist` contains English pages and `dist/bn/` pages for the stub index.

```bash
git add src && git commit -m "feat: bn UI translations"
```

### Task 5: Core components

**Files:**
- Create: `src/components/starlight/Head.astro`, `src/components/content/Attribution.astro`, `src/components/content/KeywordTable.astro`, `src/components/content/Pitfall.astro`, `src/components/content/BuildExercise.astro`
- Create: `src/components/progress/MarkComplete.astro`, `src/components/progress/ReadingProgress.astro`

**Interfaces:**
- Consumes: `progress.ts` (Task 5 defines it first — see step order), `glossary-terms.json` (Task 3).
- Produces: `MarkComplete({ lessonId: string })`, `ReadingProgress()` (no props), `KeywordTable({ keywords: {term}[], caption? })`, `Pitfall({ title: string })` slot body, `BuildExercise({ title?: string })` ordered-list slot, `Attribution({ sourceUrl: string, updated?: string })`. Head.astro handles `data-domain` paint + sidebar completion marks + mermaid lazy render (port all three blocks).

- [ ] **Step 1: Write `src/lib/progress.ts`**

Port CCAR-F `src/lib/progress.ts` with renames: `STORAGE_KEY = 'nodejs:v1'`, `LESSON_EVENT = 'nodejs:progress-change'`. Same functions and signatures: `loadState`, `saveState`, `emitChange`, `isComplete`, `setLessonComplete`, `completedCount`, `domainCompleted`, `overallPercent`, `domainPercent`, `resetProgress`. `domainCompleted` counts via `domainLessons(domain).length` instead of CCAR-F's `meta.lessons` field (spec dropped lesson counts from DomainMeta).

- [ ] **Step 2: Port `Head.astro`**

Copy CCAR-F Head.astro; rename mermaid render id prefix `ccarf-mermaid-` → `nlt-mermaid-`, console tags `[ccarf]` → `[nlt]`.

- [ ] **Step 3: Port progress components**

`MarkComplete.astro`: copy, keep all `data-*` hooks and paint logic. Hardcoded Bangla labels become bilingual — read `Astro.locals.starlightRoute` lang: if `en`, labels `Mark this lesson complete` / `Complete — click again to clear` / `Progress is saved only in this browser` / `Progress saved`; if `bn`, existing Bangla strings. Same for `ReadingProgress.astro` (port; its bar is label-free).

- [ ] **Step 4: Port content components**

`Attribution.astro`: rewrite text — "This lesson is based on the official Node.js documentation: link to `sourceUrl`. Corrections welcome via GitHub issues: `https://github.com/hasnat-shohag/nodejs-learning-track/issues`." Bangla version equivalent ("এই লেসনটি Node.js-এর অফিসিয়াল ডকুমেন্টেশনের ওপর ভিত্তি করে লেখা…"), chosen by locale the same way as MarkComplete.
`KeywordTable.astro`: port, but bilingual columns: term / `defEn` / `defBn` — show `defBn` column only when locale is `bn`, else `defEn` (column header "Meaning" / "অর্থ"). Keep the throw on unknown term.
`Pitfall.astro`: adapt CCAR-F `ExamTrap.astro` — read it first; keep callout markup, drop exam framing, `Props { title: string }`.
`BuildExercise.astro`: port CCAR-F's (read first), exercise slot content.

- [ ] **Step 5: Verify + commit**

Run: `pnpm check && pnpm build`
Expected: pass (components unused so far, but imported by nothing — they must still compile standalone).

```bash
git add src && git commit -m "feat: core components — progress, attribution, keyword table, pitfall"
```

### Task 6: Stub lesson pair — i18n switcher proof

**Files:**
- Create: `src/content/docs/learn/index.mdx` (syllabus stub: `{ title: 'Learn' }` + one line)
- Create: `src/content/docs/learn/1-node-anatomy-event-loop/1-1-process-anatomy.mdx` (English stub lesson, full frontmatter)
- Create: `src/content/docs/bn/learn/index.mdx`
- Create: `src/content/docs/bn/learn/1-node-anatomy-event-loop/1-1-process-anatomy.mdx` (Bangla stub lesson, full frontmatter, `titleEn` set)

**Interfaces:**
- Consumes: components (Task 5), glossary (Task 3), schema (Task 3).
- Produces: the canonical lesson template — frontmatter shape, imports block, `ReadingProgress` at top, lesson-meta div, sections, `<KeywordTable>`, `<Pitfall>`, `<BuildExercise>`, `Attribution` + `MarkComplete` at bottom. Later lesson plans clone this pair.

- [ ] **Step 1: Write English stub lesson**

Frontmatter: `title: 'Node process anatomy: V8, libuv, bindings, process'`, `domain: 1`, `task: "1.1"`, `order: 1`, `sourceUrl: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs'`, `updated: 2026-10-22`, `keywords: [{term: 'event loop'}, {term: 'libuv'}]` (both in seed glossary), `sources: [{label: 'Node.js docs — Introduction', href: sourceUrl}]`. Body: `<ReadingProgress />`, one `## What you will learn` paragraph, `<KeywordTable keywords={frontmatter.keywords} />`, `<Pitfall title="Blocking vs waiting">` one sentence, `<BuildExercise>` one exercise linking `code/1-node-anatomy-event-loop/1-1-process-anatomy/demo.js`, `<Attribution sourceUrl={frontmatter.sourceUrl} />`, `<MarkComplete lessonId="1-1" />`.

- [ ] **Step 2: Write Bangla stub lesson**

Same slug under `docs/bn/learn/...`, `title` in Bangla, `titleEn` = English title, rest identical. Body translated minimally (one paragraph), same components.

- [ ] **Step 3: Build and verify switcher pairing**

Run: `pnpm build && grep -c 'hreflang' dist/learn/1-node-anatomy-event-loop/1-1-process-anatomy/index.html`
Expected: `hreflang` count >= 2 (alternate locale links emitted — pages paired). Also `ls dist/bn/learn/1-node-anatomy-event-loop/1-1-process-anatomy/` exists.

- [ ] **Step 4: Verify fallback**

Temporarily `mv src/content/docs/bn/learn/1-node-anatomy-event-loop/1-1-process-anatomy.mdx /tmp/`. Run `pnpm build`. `ls dist/bn/learn/1-node-anatomy-event-loop/1-1-process-anatomy/` must still exist (English fallback served under bn route). Restore the file, rebuild.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: paired stub lessons proving the en/bn switcher"
```

### Task 7: Sidebar from lesson data

**Files:**
- Modify: `astro.config.mjs`

**Interfaces:**
- Consumes: `DOMAINS`, `domainLessons`, `lessonPath` (Task 2), `existsSync` pattern from CCAR-F config.
- Produces: full sidebar — top group (syllabus `/learn/`, progress `/progress/`, glossary `/glossary/`, about `/about/` — these pages are stubs until Task 12; sidebar links use `slug:` for lessons and `link:` for pages), five domain groups with per-locale labels, each with domain overview page + `hasLesson`-filtered lesson list.

- [ ] **Step 1: Wire sidebar**

Port CCAR-F sidebar generation: top group `{ label: {en: 'Start here', bn: 'শুরু করুন'}, items: [...] }`; per-domain groups labeled `{en: domain.labelEn, bn: domain.labelBn}` with overview item `{ link: 'learn/<slug>/' }` + lessons via `domainLessons(domain).map(...).filter(hasLesson)`, lesson labels `{en: \`${lesson.id} — ${lesson.titleEn}\`, bn: \`${lesson.id} — ${lesson.titleBn}\`}` and `attrs: { 'data-lesson-id': lesson.id }`. `hasLesson(slug)` checks `src/content/docs/<slug>.mdx` exists (English presence governs; bn presence expected by authoring rule).

- [ ] **Step 2: Create needed page stubs**

`src/content/docs/progress.mdx`, `glossary.mdx`, `about.mdx` with `{ title }` frontmatter only (Task 12 fleshes out; without them sidebar 404s). Also `src/content/docs/bn/` equivalents — `progress.mdx`, `glossary.mdx`, `about.mdx` stubs.

- [ ] **Step 3: Verify sidebar filtering**

Run: `pnpm build && grep -o 'data-lesson-id="[^"]*"' dist/learn/index.html dist/index.html 2>/dev/null | sort -u`
Expected: exactly one `data-lesson-id="1-1"` (only stub lesson built), zero links to unbuilt lessons.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: bilingual sidebar generated from lesson data"
```

### Task 8: Link checker

**Files:**
- Create: `tools/check-links.mjs`

**Interfaces:**
- Consumes: `dist/` after `pnpm build`; `src/lib/lessons.ts` + `domains.ts` for planned slugs.
- Produces: `pnpm check:links [--base /nodejs-tutorial] [--verbose]`, exit 1 on broken link.

- [ ] **Step 1: Port and adapt**

Copy `/home/vivasoft/ccar-f/tools/check-links.mjs`; change default base `/CCAR-F` → `/nodejs-tutorial`, keep the planned-slug "pending" logic (reads slug regexes from lessons/domains sources), keep missing-base failure mode. No other changes — the file is base-agnostic apart from the default.

- [ ] **Step 2: Negative test**

Run: `pnpm build`. Then temporarily add `<a href="/learn/">bad</a>` to the English stub lesson, `pnpm build`, `pnpm check:links`; expect exit 1 with `missing the /nodejs-tutorial base`. Remove the bad link, rebuild, rerun; expect `0 broken`.

- [ ] **Step 3: Commit**

```bash
git add tools && git commit -m "feat: base-aware link checker"
```

### Task 9: Progress dashboard + components

**Files:**
- Create: `src/components/progress/DomainProgress.astro`, `src/components/progress/OverallProgress.astro`
- Modify: `src/content/docs/progress.mdx`, `src/content/docs/bn/progress.mdx` (fill in)

**Interfaces:**
- Consumes: `progress.ts` (Task 5), `DOMAINS` (Task 2).
- Produces: `/progress/` page renders overall percent bar + per-domain bars with lesson-id tick lists, bilingual labels via locale branch (same mechanism as MarkComplete).

- [ ] **Step 1: Port both components**

Read CCAR-F `DomainProgress.astro` and `OverallProgress.astro` first; port with label strings made locale-aware (`en`/`bn` branch on `Astro.locals.starlightRoute`), storage key/event names already from `progress.ts`. Domain accent colors from `DomainMeta.accent`.

- [ ] **Step 2: Fill progress pages**

English `progress.mdx`: title `Progress dashboard`, brief paragraph, `<OverallProgress />`, then `<DomainProgress />` per domain (or one loop component if CCAR-F does that — follow CCAR-F's page structure). Bangla mirror.

- [ ] **Step 3: Verify + commit**

Run: `pnpm build && pnpm check:links`
Expected: both pass; `/progress/` and `/bn/progress/` exist in dist.

```bash
git add -A && git commit -m "feat: bilingual progress dashboard"
```

### Task 10: Terms checker

**Files:**
- Create: `tools/check-terms.mjs`

**Interfaces:**
- Consumes: `dist/` (leaked-key scan) + `src/content/docs/**` (frontmatter keywords) + `src/content/glossary-terms.json` + `src/content/style-terms.json`.
- Produces: `pnpm check:terms [--verbose]`, exit 1 on: leaked i18n key, banned variant, unknown keyword, stray definition keys.

- [ ] **Step 1: Port and adapt**

Copy CCAR-F `tools/check-terms.mjs`; changes: content dir now hosts two locales (`src/content/docs` + `src/content/docs/bn`) — walk both; the leaked-ui-key check scans `dist/` for literal dotted i18n keys in **both** `dist/` and `dist/bn/`; glossary schema changed (`bn`/`tip` fields → `defEn`/`defBn`, so unknown-term check compares `term` only — field shape validated by a new JSON-shape assertion: every entry must have non-empty `term`, `defEn`, `defBn`); STARLIGHT_KEYS list re-synced against installed Starlight version's `node_modules/@astrojs/starlight/dist/translations/en.js` (diff and update; report drift in commit message if any).

- [ ] **Step 2: Negative test**

Temporarily add `keywords: [{term: 'not-a-real-term'}]`-style entry to the English stub lesson frontmatter (append to existing list), run `pnpm check:terms`; expect exit 1 naming the term. Revert, rerun; expect pass.

- [ ] **Step 3: Commit**

```bash
git add tools && git commit -m "feat: terms and i18n-integrity checker"
```

### Task 11: Contrast checker + demo scaffolding

**Files:**
- Create: `tools/check-contrast.mjs`
- Create: `code/1-node-anatomy-event-loop/1-1-process-anatomy/demo.js`, `code/README.md`

**Interfaces:**
- Consumes: `dist/`, headless Chrome.
- Produces: `pnpm check:contrast [--allow-missing-browser]`, exit 1 on WCAG AA failure; `KNOWN_GAPS` list ships empty.

- [ ] **Step 1: Port contrast checker**

Copy CCAR-F `tools/check-contrast.mjs` wholesale — it is base-agnostic (walks `dist/`). Keep `KNOWN_GAPS = []`. Keep `--allow-missing-browser`.

- [ ] **Step 2: Write demo README + first demo**

`code/README.md`: how to run (`node code/<domain>/<lesson>/demo.js`), zero-deps rule, each lesson's demo prints its own expected output.
`demo.js` for 1-1: prints `process.versions` (node, v8, uv — shows the three layers), `process.arch`, `process.platform`, and `process.execPath` with one-line comments. Run it, capture output; the stub lesson's BuildExercise already references this file.

- [ ] **Step 3: Verify + commit**

Run: `node code/1-node-anatomy-event-loop/1-1-process-anatomy/demo.js && pnpm build && pnpm check:contrast --allow-missing-browser`
Expected: demo prints version table; contrast check passes or skips gracefully.

```bash
git add -A && git commit -m "feat: contrast checker and first runnable demo"
```

### Task 12: Site pages — syllabus, glossary explorer, about, 404, hero

**Files:**
- Create/Modify: `src/content/docs/index.mdx` (hero: actions via fully-spelled base URLs — Starlight hero actions cannot call `siteUrl()`), `learn/index.mdx` (syllabus), `glossary.mdx`, `about.mdx`, `404.mdx`
- Create: `src/components/content/GlossaryExplorer.astro`, `src/components/content/LessonList.astro`, `src/components/content/DomainCards.astro`
- Create: bn counterparts for every page above.

**Interfaces:**
- Consumes: `DOMAINS`, `LESSONS` (Task 2), glossary (Task 3), `siteUrl` (Task 2).
- Produces: complete public site shell. `DomainCards()` renders five accent-colored domain cards with per-locale labels; `LessonList({ domain })` renders lessons of one domain with completion-aware list items; `GlossaryExplorer()` renders filterable bilingual glossary (client-side filter, definitions column per locale).

- [ ] **Step 1: Port the three content components**

Read CCAR-F versions first (`DomainCards`, `LessonList`, `GlossaryExplorer`); port with bilingual labels (locale branch), `siteUrl()` on every internal href, lesson-completion hooks via `progress.ts`.

- [ ] **Step 2: Write the pages**

`index.mdx` hero: tagline for the learning track, two actions (`Start learning` → `/nodejs-tutorial/learn/`, `Progress` → `/nodejs-tutorial/progress/` — full base spelled out per Global Constraints). Syllabus page: `<DomainCards />` + `<LessonList />` per domain (or CCAR-F's structure — follow it). Glossary page: `<GlossaryExplorer />`. About: sources list (nodejs.org docs, CCAR-F theme credit + link, license note). 404: friendly bilingual body. Bangla mirror pages for all.

- [ ] **Step 3: Full gates**

Run: `pnpm check && pnpm build && pnpm check:links && pnpm check:terms && pnpm check:contrast --allow-missing-browser`
Expected: all pass, zero broken, zero pending except unbuilt lessons (pending allowed, broken not).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: site pages — hero, syllabus, glossary explorer, about, 404"
```

### Task 13: CI workflow + push

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/dependabot.yml` (if CCAR-F has one — check first, copy)

**Interfaces:**
- Consumes: all scripts from Tasks 1–12.
- Produces: Pages deployment on push to `main`.

- [ ] **Step 1: Write workflow**

Port CCAR-F `deploy.yml` exactly (pnpm 11, Node 22, checkout@v5, check → build → check:links → check:terms → check:contrast → configure-pages → upload → deploy), branches `[main]`.

- [ ] **Step 2: Verify locally, push, confirm run**

Run full gates locally once more. `git remote -v` must show the origin added earlier; push: `git push -u origin main`. User enables Pages with Actions source if first run requires it (workflow's `enablement: true` handles it). Confirm green run via `gh run list` or the Actions URL.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "ci: Pages deploy workflow" && git push
```

---

## Post-platform (not this plan)

Content authoring follows as per-domain plans (Domain 1 first), each cloning the Task 6 stub-pair template: English body → Bangla body → demo files → glossary terms → gates. The `hasLesson` sidebar filter grows automatically as files land.
