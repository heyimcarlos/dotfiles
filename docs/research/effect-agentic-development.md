# Effect, TypeScript-Go, and agentic development

Research date: 2026-08-09

## Conclusion

The current Effect recommendation changes the TypeScript ownership model:

```text
Effect project
  -> installs TypeScript >= 7 and @effect/tsgo
  -> `effect-tsgo setup` adds the Effect plugin and patch workflow
  -> the patched project-local TypeScript 7 `tsc` is the only language server
  -> LazyVim connects to that binary and supplies UI, keymaps, and completion
```

`@effect/tsgo` is not a Mason package or a Neovim plugin. It belongs in each
Effect project's `devDependencies`. LazyVim's TypeScript-Go Extra is useful as
the editor-side client configuration, but Mason should not own a second,
ordinary TypeScript-Go binary. The Effect project explicitly warns that
Effect-tsgo is a superset of upstream TypeScript-Go and that running both
servers produces duplicate diagnostics and worse performance
([Effect-tsgo README](https://github.com/Effect-TS/tsgo/blob/257af257aff0334ae081fc1ce3beb484b83e85d9/README.md#best-practices)).

The recommended target for this dotfiles repository is therefore:

| Responsibility | One owner |
|---|---|
| TypeScript and Effect language server | Project-local, patched Effect-tsgo |
| Completion menu | `blink.cmp` |
| Effect diagnostics in the editor | Effect-tsgo LSP initially |
| CI Effect diagnostics | Patched TypeScript, `effect-tsgo diagnostics`, or patched Oxlint |
| Formatting | First configured project formatter only |
| General linting | The linter selected by the project, not every installed Extra |
| External editor tools | Mason, except Effect-tsgo |

## What the Effect sources recommend

### Put dependency source next to the application

The Effect article argues that agents learn library usage more reliably from a
complete source tree than from isolated web results, human-oriented docs, or
compiled `node_modules`. It recommends a squashed Git subtree such as
`repos/effect`, because it is present after a normal clone and has no submodule
initialization step
([Effect article](https://effect.website/blog/the-one-weird-git-trick-that-makes-coding-agents-more-effect-ive/)).

The article's complete workflow is:

1. Add `Effect-TS/effect` under `repos/effect` with `git subtree add --squash`.
2. Refresh it with `git subtree pull --squash`.
3. Exclude `repos/**` from editor search, file watching, and TypeScript
   auto-import suggestions.
4. Tell the agent in `AGENTS.md` that the directory is read-only reference
   material, must not be edited or imported from, and is the preferred source
   for Effect patterns.
5. For repeated topics, derive small project-local pattern notes from the
   implementation, tests, and documentation in the vendored tree.

For Neovim, step 3 implies exclusions in Telescope or Snacks search, the file
explorer, and TypeScript auto-import preferences. The subtree should remain
searchable when an agent explicitly targets `repos/effect`; it should not pollute
interactive application searches by default.

### Effect-tsgo is the new integrated feedback loop

The current repository describes `@effect/tsgo` as a wrapper around
TypeScript-Go that targets Effect v4 primarily and v3 as well. Its guided
`npx @effect/tsgo setup` command adds the package, configures the
`@effect/language-service` plugin in `tsconfig.json`, configures rule severity,
and establishes the patch workflow. It currently also requires a native
TypeScript package at version 7 or newer
([installation documentation](https://github.com/Effect-TS/tsgo/blob/257af257aff0334ae081fc1ce3beb484b83e85d9/README.md#installation)).

Effect-tsgo provides more than hover and completion. Its rules use TypeScript
type information to detect missing Effect errors and requirements, floating
Effects, unsafe error-channel assertions, broken Layer composition, non-Effect
APIs, outdated Effect APIs, and many style opportunities. It also exposes
Effect-specific quick fixes and refactors
([diagnostic and refactor inventory](https://github.com/Effect-TS/tsgo/blob/257af257aff0334ae081fc1ce3beb484b83e85d9/README.md#diagnostic-status)).

There are three supported ways to put the same diagnostics into a fast
feedback loop:

- patched `tsc`, which type-checks once and can cache the result;
- `effect-tsgo diagnostics --project tsconfig.json`, which performs another
  type-check and can emit structured or GitHub Actions output;
- the Effect patch for Oxlint's type-aware runner.

These are alternatives for delivering Effect diagnostics, not three linters to
run indiscriminately. If patched Oxlint reports them, the official guide says
to set the LSP plugin's `diagnostics` option to `false` to prevent duplicate
editor messages. The Oxlint path requires matching supported versions of
`oxlint` and `oxlint-tsgolint`, and all Effect rules run in type-aware mode
([Oxlint integration guide](https://github.com/Effect-TS/tsgo/blob/257af257aff0334ae081fc1ce3beb484b83e85d9/docs/README.md)).

For a first implementation, LSP diagnostics plus patched TypeScript in the
project's normal `check` command is the smallest coherent setup. Add the
patched-Oxlint path only in projects that intentionally adopt Oxlint, and then
turn off duplicate LSP diagnostics.

## Implications for this LazyVim configuration

The current configuration has a contradictory TypeScript selection:

- [`lazyvim.json`](../../nvim/.config/nvim/lazyvim.json) enables the base
  TypeScript, Biome, OXC, and TypeScript-Go Extras as well as ESLint.
- [`options.lua`](../../nvim/.config/nvim/lua/config/options.lua) forces
  `vim.g.lazyvim_ts_lsp = "vtsls"`.
- [`README.md`](../../nvim/.config/nvim/README.md) still presents vtsls plus the
  older `@effect/language-service` as the normal route.

That explains why adding the `typescript.tsgo` Extra did not make Effect-tsgo
the active server. The Extra is editor configuration; the global selector still
chooses vtsls.

LazyVim's stock TypeScript-Go Extra can be reused rather than replaced. It
defines TypeScript filetypes, inlay hints, and the `tsgo` server
([LazyVim Extra source](https://github.com/LazyVim/LazyVim/blob/c10948c50b18fae7f256433afdef09e432410480/lua/lazyvim/plugins/extras/lang/typescript/tsgo.lua)).
The underlying Neovim LSP configuration first checks
`<project>/node_modules/.bin/tsgo`, then falls back to `PATH`, and invokes it as
`tsgo --lsp --stdio`
([nvim-lspconfig source](https://github.com/neovim/nvim-lspconfig/blob/43ed3797b266e1ee8d222e491379ad471c9d3146/lsp/tsgo.lua)).
Current TypeScript 7 instead publishes `node_modules/.bin/tsc`, which
`@effect/tsgo` patches in place. The local LazyVim override therefore resolves
that patched `tsc` for Effect projects and starts it with the same LSP flags.

The safe editor target is:

- select `tsgo` instead of `vtsls`;
- retain the stock LazyVim TypeScript-Go Extra for client behavior;
- mark the server `mason = false`, so Mason does not install an ordinary
  upstream server as a fallback;
- require each Effect project to run `npx @effect/tsgo setup` and install its
  native TypeScript dependency;
- leave Blink enabled because it consumes LSP completion results and is not a
  competing language server;
- verify in `:LspInfo` that exactly one TypeScript client is attached and that
  its command resolves inside the project.

The `--nvim` setup flag exists in Effect-tsgo's current CLI, but its current
source does not emit a concrete Neovim configuration block. The editor wiring
above is therefore an inference from the Effect-tsgo, LazyVim, and
nvim-lspconfig sources rather than a copied first-party Neovim recipe
([CLI setup options](https://github.com/Effect-TS/tsgo/blob/257af257aff0334ae081fc1ce3beb484b83e85d9/_packages/tsgo/src/cli/setup/options.ts),
[setup output implementation](https://github.com/Effect-TS/tsgo/blob/257af257aff0334ae081fc1ce3beb484b83e85d9/_packages/tsgo/src/cli/setup/changes.ts#L1103-L1121)).

### Linter and formatter ownership

Enabling the Biome, OXC, Prettier, and ESLint Extras globally is not inherently
wrong, but it is wrong if all of them attach or format the same project. A
project-marker policy keeps a broad dotfiles installation without multiplying
work:

```text
format TypeScript
  -> oxfmt, only when an Oxfmt config exists
  -> otherwise Biome, only when a Biome config exists
  -> otherwise Prettier, only when a Prettier config exists
  -> stop after the first match
```

Lint servers should follow the same principle: enable ESLint for ESLint
projects, Biome for Biome projects, and Oxlint for Oxlint projects. Effect-tsgo
remains the TypeScript/Effect semantic owner in each case. If Oxlint is patched
to report Effect rules, disable those diagnostics in the LSP to keep one
publisher.

## What the Accountability repository demonstrates

`mikearnaldi/accountability` is a useful example of agent-oriented feedback,
but it is not an example of the latest Effect-tsgo integration. At commit
`c07a6eac`, it uses TypeScript 5.8 and `@effect/language-service`, with an
`effect-language-service patch` script
([package.json](https://github.com/mikearnaldi/accountability/blob/c07a6eac1bff48e350b558891e97710132a24806/package.json)).

Its transferable practices are:

- vendored Effect, Effect Atom, and TanStack source trees under `repos/`, plus
  a guide that tells agents where to find implementation and test patterns
  ([reference repository guide](https://github.com/mikearnaldi/accountability/blob/c07a6eac1bff48e350b558891e97710132a24806/specs/reference/reference-repos.md));
- a detailed agent guide that names architecture boundaries, required reading,
  forbidden patterns, and the exact verification commands
  ([CLAUDE.md](https://github.com/mikearnaldi/accountability/blob/c07a6eac1bff48e350b558891e97710132a24806/CLAUDE.md));
- local ESLint rules that turn project decisions into immediate, mechanical
  feedback, including rules for imports, Schema validation, SQL decoding,
  Effect error handling, Layers, direct fetch, storage, and pipe size
  ([ESLint configuration](https://github.com/mikearnaldi/accountability/blob/c07a6eac1bff48e350b558891e97710132a24806/eslint.config.mjs));
- a focused autonomous loop that performs one task per iteration and runs
  typecheck, lint, build, and tests before accepting it
  ([agent prompt](https://github.com/mikearnaldi/accountability/blob/c07a6eac1bff48e350b558891e97710132a24806/RALPH_AUTO_PROMPT.md),
  [verification loop](https://github.com/mikearnaldi/accountability/blob/c07a6eac1bff48e350b558891e97710132a24806/ralph-auto.sh#L276-L388)).

The lesson is not to copy its large inline ESLint file. Start with a single
fast `check` command, then promote repeated review comments and project
invariants into focused rules with tests. Effect-tsgo already covers many
general Effect mistakes, so custom rules should concentrate on application
architecture and house style that the upstream language service cannot know.

There is also a concrete policy conflict to resolve deliberately:
Accountability bans `Effect.asVoid` and `Effect.ignore`, while Effect-tsgo has
style refactors that can recommend void-oriented mapping and explicit ignore
operations in suitable contexts. This is evidence that an upstream style
preset is not automatically the project's style guide. Enable Effect-tsgo's
correctness diagnostics first, then review anti-pattern, Effect-native, and
style severities against local conventions before making them CI failures
([Accountability rules](https://github.com/mikearnaldi/accountability/blob/c07a6eac1bff48e350b558891e97710132a24806/eslint.config.mjs#L832-L899),
[Effect-tsgo diagnostic inventory](https://github.com/Effect-TS/tsgo/blob/257af257aff0334ae081fc1ce3beb484b83e85d9/README.md#diagnostic-status)).

## What Dillon Mulroy publicly does

Dillon's current public setup does not provide evidence that he uses
Effect-tsgo in Neovim. His current config uses `typescript-tools.nvim`; a
`tsserver_path` pointing to `tsgo` is commented out
([current TypeScript config](https://github.com/dmmulroy/.dotfiles/blob/40608fec75c3158595c064dd9213e0a97a21c74f/home/.config/nvim/lua/plugins/typescript-tools.lua)).
He enabled that path in August 2025 and commented it out in September 2025,
without recording a reason in the public commit
([enabled commit](https://github.com/dmmulroy/.dotfiles/commit/7e8f9649984b192f16e5226311743723724600ac),
[disabled commit](https://github.com/dmmulroy/.dotfiles/commit/7f449258f8b56f0a7db9a6560ae6012c8c2a47e0)).
His public `effect-cloudflare` project also uses the older
`@effect/language-service`, not `@effect/tsgo`
([package](https://github.com/dmmulroy/effect-cloudflare/blob/6fcd6e68e697c1bb4201ddbd7c867937be8ac917/package.json),
[tsconfig](https://github.com/dmmulroy/effect-cloudflare/blob/6fcd6e68e697c1bb4201ddbd7c867937be8ac917/tsconfig.json)).

His practices are still highly relevant:

- He keeps Blink as completion and separately runs project-wide `tsc --noEmit`
  into quickfix; these tools are complementary, not replicas
  ([Blink config](https://github.com/dmmulroy/.dotfiles/blob/40608fec75c3158595c064dd9213e0a97a21c74f/home/.config/nvim/lua/plugins/blink-cmp.lua),
  [`tsc.nvim` config](https://github.com/dmmulroy/.dotfiles/blob/40608fec75c3158595c064dd9213e0a97a21c74f/home/.config/nvim/lua/plugins/tsc.lua)).
- His formatter chain selects Oxfmt, Biome, or Prettier from project config and
  stops after the first available formatter
  ([Conform config](https://github.com/dmmulroy/.dotfiles/blob/40608fec75c3158595c064dd9213e0a97a21c74f/home/.config/nvim/lua/plugins/conform.lua)).
- His LSP config gates Oxlint by project markers and disables ESLint autostart,
  preventing every installed tool from attaching everywhere
  ([LSP config](https://github.com/dmmulroy/.dotfiles/blob/40608fec75c3158595c064dd9213e0a97a21c74f/home/.config/nvim/lua/plugins/lsp.lua)).
- His agent standards require inspecting the pinned Effect source rather than
  selecting APIs from memory, tracing the full public operation, representing
  expected failures explicitly, and testing through real interfaces
  ([coding standards](https://github.com/dmmulroy/.dotfiles/blob/40608fec75c3158595c064dd9213e0a97a21c74f/home/.agents/skills/coding-standards/SKILL.md),
  [Effect source rule](https://github.com/dmmulroy/.dotfiles/blob/40608fec75c3158595c064dd9213e0a97a21c74f/home/.agents/skills/coding-standards/references/effect.md),
  [testing standards](https://github.com/dmmulroy/.dotfiles/blob/40608fec75c3158595c064dd9213e0a97a21c74f/home/.agents/skills/coding-standards/references/testing.md)).

A concrete project, `cf-twitch`, makes `pnpm check` the narrow feedback-loop
entry point and layers architecture checks, linting, and typechecking behind it.
It includes a project-specific Oxlint rule forbidding dynamic imports, while
documenting why type-aware tsgolint is disabled for that project's decorator
constraints
([scripts](https://github.com/dmmulroy/cf-twitch/blob/66aa3cd587941c63773fa5a24fd048a5e6d1e967/package.json),
[Vite+ lint configuration](https://github.com/dmmulroy/cf-twitch/blob/66aa3cd587941c63773fa5a24fd048a5e6d1e967/vite.config.ts),
[custom rule](https://github.com/dmmulroy/cf-twitch/blob/66aa3cd587941c63773fa5a24fd048a5e6d1e967/tools/oxlint-rules/no-dynamic-import.cjs)).

The correct synthesis is to follow current Effect guidance for the language
server, while adopting Dillon's project-aware tool selection and explicit
agent feedback loop. Copying his current LSP configuration literally would
move this setup away from the Effect team's latest recommendation.

## Recommended sequence

This ordering keeps each change independently testable:

1. **Establish one server.** Select LazyVim's `tsgo`, disable Mason ownership
   for it, remove the global vtsls selection, and validate a project-local
   patched TypeScript 7 binary with `:LspInfo`.
2. **Deduplicate editor tools.** Make formatting and general linter attachment
   conditional on project configuration, with `stop_after_first` formatting.
   Keep Blink unchanged.
3. **Tighten the project loop.** Give each Effect project one `check` command
   that runs its chosen typecheck, Effect diagnostics, lint, and tests. Start
   Effect-tsgo with correctness diagnostics; opt into subjective style rules
   only after reviewing conflicts with project conventions.
4. **Add agent reference material.** Vendor or maintain a local reference clone
   of the pinned Effect source, exclude it from normal interactive editor
   discovery, and add a small `AGENTS.md` routing section with read-only and
   no-import constraints.
5. **Encode repeated feedback.** Add project-specific lint rules only for
   invariants that survive repeated reviews and are not already enforced by
   Effect-tsgo or TypeScript.

## Recommended acceptance checks for a later implementation

The implementation is complete when these observations hold in a real
Effect-tsgo project:

1. `:LspInfo` shows one TypeScript client, not vtsls plus tsgo.
2. The client command is the project-local patched TypeScript 7 `tsc` binary.
3. Effect hover, diagnostics, code actions, and refactors work in a TypeScript
   buffer.
4. Blink displays completions from that one client.
5. Saving runs at most one configured formatter.
6. Only the project's chosen general linter attaches.
7. The project's non-editor `check` command reproduces the important Effect
   diagnostics for humans, agents, and CI.
8. Vendored reference repositories are absent from normal picker results and
   auto-imports, but remain available for explicitly scoped agent searches.

## Uncertainties and cautions

- Effect-tsgo is moving quickly. This report is tied to repository commit
  `257af257` and package version `0.36.1`; re-read its setup and compatibility
  guidance before implementation.
- The Effect team documents the server and patch workflow but currently does
  not publish a complete Neovim recipe in the repository. The proposed
  LazyVim wiring must be validated against a real project.
- Accountability and Dillon's public projects mostly demonstrate the older
  language-service generation. They are evidence for feedback-loop design,
  not authority for choosing the current Effect LSP.
- Dillon's public history does not explain why he stopped pointing
  `typescript-tools.nvim` at `tsgo`; no reason should be inferred.
