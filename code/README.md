# Lesson demo code

Every lesson ships runnable demos: `code/<domain-slug>/<lesson-slug>/demo.js`.

Run one with plain `node`:

```bash
node code/1-node-anatomy-event-loop/1-1-process-anatomy/demo.js
```

Rules:

- **Zero dependencies.** Everything runs on Node's built-in modules only — the point is to see Node's own internals, not a library's wrapper over them.
- **Each demo prints its own expected output** in comments at the top; the lesson page shows the same output.
- Run demos from the repo root; the paths in the lessons assume it.

`code/` is excluded from the site build and from `astro check` — it is loose JavaScript on purpose, kept close to the lessons it belongs to.
