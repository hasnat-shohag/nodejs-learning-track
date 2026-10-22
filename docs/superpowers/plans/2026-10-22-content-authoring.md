# Content Authoring (Domains 1–5) Plan

> **For agentic workers:** Use superpowers:executing-plans (inline) per domain. Ledger at `.superpowers/sdd/2026-10-22-content-authoring/progress.md`. Steps checkbox-tracked there.

**Goal:** Write all 29 remaining lessons (en+bn pairs, runnable demos, glossary terms), domain by domain, each domain reviewed then pushed.

**Spec:** original platform spec (docs/superpowers/specs/) — content-authoring section: each lesson clones 1-1 template; en body → bn body → demo files → glossary terms → gates.

**Global Constraints:**
- Every keyword `term` must exist in `src/content/glossary-terms.json` BEFORE build (KeywordTable throws; check-terms unknown-term).
- bn prose obeys style-terms.json `preferred` map (ইভেন্ট লুপ → event loop, থ্রেড পুল → thread pool, ওয়ার্কার পুল → worker pool, ওয়ার্কার থ্রেড → worker_threads, ব্যাকপ্রেশার → backpressure, কল স্ট্যাক → call stack, শেয়ার্ড মেমরি বাফার → SharedArrayBuffer, চাইল্ড প্রসেস → child_process, ক্লাস্টার মডিউল → cluster মডিউল); identifiers never transliterated.
- bn lesson imports are 5-ups (`../../../../../components/...`); en are 4-ups.
- Frontmatter: title, (bn: titleEn), quoted description, domain, task ("N.M"), order, sourceUrl, updated: 2026-10-22, keywords (term-only), sources (label+href; note optional).
- Demo commands in lesson body use repo-root-relative `node code/...` path; demos run with plain `node` (zero deps), exit code 0.
- MarkComplete lessonId matches lessons.ts id; slug matches lessons.ts.
- Gates green before each commit: build, check:links, check:terms, check:contrast.
- Commit per lesson pair (en+bn+demo+glossary) unless content says otherwise.
- Commits end `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

## Review Focus (applies per domain)
- Demo runs clean: `node code/<domain>/<lesson>/demo.js` exit 0, output matches lesson's claimed expectations.
- bn prose reads as authored Bangla, not machine translation of en body.
- Keywords: frontmatter terms ⊆ glossary; lesson body actually uses/defines them.
- No locale flips: bn internal links carry `bn/` prefix (siteUrl + locale).
- Sidebar/roadmap grow automatically (hasLesson) — no manual nav edits.

## Workflow per lesson (D1L1–D5L7)
1. Write glossary terms first (needs check-terms unknown-term).
2. Write en lesson .mdx (clone 1-1 structure: What you will learn, KeywordTable, Pitfall, demo run block, BuildExercise, Attribution, MarkComplete).
3. Write bn counterpart (5-up imports; bn authored prose; titleEn kept).
4. Write demo file `code/<domain-slug>/<lesson-slug>/demo.js` — runnable, commented, deterministic output.
5. Run demo — exit 0.
6. Build + all gates green.
7. Commit.

## Per-domain close
- Whole-domain review (fresh reviewer via Agent, caveman:cavecrew-reviewer or general-purpose w/ code-review brief) against lessons.ts/domain overview promises.
- Fix findings, gates green, commit fixes.
- Push origin main; monitor Actions run to green; ledger the run URL.
- Ledger: `Domain <N>: complete (commits <base>..<head>, reviewer: <verdict>, actions: <run-url green>)`.
- Compact checkpoint: after each domain, write domain summary into ledger and compact.
