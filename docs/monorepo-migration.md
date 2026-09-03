# on-blast monorepo migration

Status: **complete** — all nine phases landed, one commit each (8 and 9 share
one). Kept as the record of why the structure is the way it is.

Not yet pushed: the remote exists but has never received a commit.

## Where we are

The git root (`on-blast/`) contains exactly one thing: `apps/on-blast`, a Tauri
v2 + React app holding ~2,100 lines of source and ~47 MB of staged runtime
assets. There is no root `package.json`, no workspace config, no linter, no CI,
and **no git remote yet**.

Everything is currently one Vite app: MediaPipe detection, gesture logic, the
Web Audio engine, and the UI all live side by side under `src/`.

## What we want

1. A real workspace at the git root, orchestrated by Turbo.
2. The feature work split into packages that can be tested independently.
3. All app content moved into `packages/app-core`, exposing **one component**.
4. A second consumer — a web app deployed to GitHub Pages on push to `main` —
   proving the component is genuinely portable.

## Target layout

```
on-blast/
├── package.json              workspaces + root scripts
├── turbo.json                build / typecheck / lint / test pipelines
├── biome.json                lint + format, one config for everything
├── tsconfig.base.json        strict settings every package extends
├── .github/workflows/
│   ├── ci.yml                lint + typecheck + test
│   └── pages.yml             build + deploy web on push to main
├── apps/
│   ├── on-blast/             Tauri shell — thin
│   └── web/                  Vite SPA for GitHub Pages — thin
└── packages/
    ├── vision/               camera, MediaPipe, gesture detection
    ├── audio/                Web Audio engine, scale, tempo
    └── app-core/             the <OnBlast /> component and everything under it
```

## Package boundaries

Three packages, not more. Each has a boundary that already exists in the code.

### `@on-blast/vision`

Detection and gesture logic. No React, no audio, no DOM beyond `<video>`.

| moves from | contents |
|---|---|
| `src/hands/` | `types`, `landmarks`, `mediapipeDetector`, `onBlast` |
| `src/body/` | `types`, `posture`, `mediapipeBodyDetector` |
| `src/util/` | `history`, `holdTrigger` |

`history` and `holdTrigger` are generic enough to justify their own package
later, but today `vision` is their only consumer — splitting now would add a
package to own 134 lines. Revisit if `audio` ever needs them.

Exports: the two detector factories, the gesture detectors
(`detectOnBlast`, `detectPosture`), `HoldTrigger`, `History`, and the types.

### `@on-blast/audio`

Sound. No React, no vision types.

| moves from | contents |
|---|---|
| `src/audio/` | `types`, `scale` (incl. Camelot wheel), `tempo`, `webAudioEngine` |

Exports: `createWebAudioEngine`, the `AudioEngine` interface, and the musical
helpers (`buildScale`, `CAMELOT`, `NoteQuantizer`, `TempoGate`, …).

### `@on-blast/app-core`

The React layer, and the deliverable of this whole exercise.

| moves from | contents |
|---|---|
| `src/hooks/` | `useCamera`, `useHandDetector`, `useBodyDetector`, `useVisionLoop`, `useAudioEngine` |
| `src/components/` | `CameraView`, `CameraPicker`, `GestureHud`, `ShoulderHud`, `StatsHud`, `HitOverlay` |
| `src/App.tsx`, `App.css` | become the `OnBlast` component and its styles |
| `src/features.ts` | feature flags |

Depends on `vision` and `audio`. Nothing depends on it except the two apps.

## The single-component contract

Both apps reduce to this:

```tsx
import { OnBlast } from "@on-blast/app-core";

export default function App() {
  return <OnBlast />;
}
```

`OnBlast` owns its own layout, styles, camera lifecycle, and error states.

Its props are the seam for anything an app must vary:

```ts
interface OnBlastProps {
  /** Base URL for runtime assets. Defaults to import.meta.env.BASE_URL. */
  assetBase?: string;
  /** Override feature flags per app. */
  features?: Partial<Features>;
}
```

## The asset problem — read this before anything else

This is the one thing most likely to break the web app, and it needs solving
during the migration, not after.

**Six absolute paths are hardcoded in the source today:**

```
src/hands/mediapipeDetector.ts   "/mediapipe/wasm", "/mediapipe/models/gesture_recognizer.task"
src/body/mediapipeBodyDetector.ts "/mediapipe/wasm", "/mediapipe/models/pose_landmarker_lite.task"
src/audio/webAudioEngine.ts       "/audio/voice-a4.wav", "/audio/sting.wav"
```

Two independent problems:

1. **GitHub Pages serves from a subpath.** A project site lives at
   `https://<user>.github.io/<repo>/`, so `/mediapipe/wasm` resolves against the
   *domain* root and 404s. Tauri serves from `/`, so this breaks only in the
   deployed web app — which means local dev will look fine and production will
   not.
2. **Two apps now need the same assets.** They currently sit in one app's
   `public/`.

**Fix:** thread a base through instead of hardcoding.

- Detector and engine factories take explicit URLs; no module-level constants.
- `app-core` resolves them from `assetBase`, defaulting to
  `import.meta.env.BASE_URL` — which Vite sets correctly per app.
- `apps/web` sets `base: "/<repo>/"` in its Vite config; Tauri keeps `"/"`.

**Staging:** assets stay out of git (47 MB, and the wasm is already in
`node_modules`). A shared script stages them into whichever app is building;
CI runs it before the build. Today's `scripts/fetch-assets.sh` generalizes into
this — it already copies the wasm from `node_modules` and downloads the models.

While `SHOULDER_SYNTH_ENABLED` is false, `pose_landmarker_lite.task` (5.8 MB)
is dead weight and the script should skip it.

## Tooling

**Turbo** for orchestration. Root scripts fan out: `build`, `typecheck`,
`lint`, `test`. `build` uses `dependsOn: ["^build"]`; the rest are independent
and parallel.

**Bun workspaces** (`workspaces: ["apps/*", "packages/*"]`). Bun is already the
package manager for the Tauri before-commands, so nothing changes there.

**Packages ship TypeScript source, not `dist`.** `exports` points straight at
`src/index.ts`. Both consumers are Vite apps that transpile anyway, so a build
step per package would only add ordering constraints and stale-output bugs for
no benefit. Revisit only if something outside this repo ever consumes them.

**Biome** for lint and format, one config at root. Expect the first run to
touch nearly every file — that reformat should be its own commit, separate from
any behavioural change, so review stays readable. Note the current
`onBlast.ts` uses tabs from hand-editing; Biome will normalise it. The tuned
*values* are unaffected.

**`tsc --noEmit`** per package for typechecking, all extending
`tsconfig.base.json`. Keep `noUnusedLocals`/`noUnusedParameters` — they have
already caught real leftovers during this work.

**`bun test`** per package. There are **104 existing assertions** written during
development that currently live as throwaway scripts outside the repo. Porting
them is part of this migration, not optional:

| suite | assertions | lands in |
|---|---|---|
| `holdTrigger` | 26 | `packages/vision` |
| `onBlast` | 19 | `packages/vision` |
| `posture` | 15 | `packages/vision` |
| `scale` | 32 | `packages/audio` |
| `tempo` | 13 | `packages/audio` |

They currently use hand-rolled `check()` helpers; they convert to
`bun:test`'s `describe`/`it`/`expect` mechanically.

## Migration order

Each phase must end with the Tauri app still building and running. No phase
leaves the repo broken.

1. **Root scaffolding.** `package.json` workspaces, `turbo.json`,
   `tsconfig.base.json`, `bunfig.toml`. No code moves. Verify: the app still
   builds through Turbo.
2. **Biome.** Add config, run the formatter, commit the reformat alone.
3. **Extract `@on-blast/audio`.** Move `src/audio/`, add the package, repoint
   imports. Port the `scale` and `tempo` suites. Verify: build + tests.
4. **Extract `@on-blast/vision`.** Same, with `hands/`, `body/`, `util/`. Port
   the three suites. Verify: build + tests.
5. **De-hardcode assets.** Thread `assetBase` through both packages. Verify in
   the Tauri app that nothing regressed — the paths change even though the
   resolved values don't.
6. **Extract `@on-blast/app-core`.** Move hooks, components, `App` → `OnBlast`.
   Reduce `apps/on-blast/src` to `main.tsx` plus a one-line `App.tsx`.
   Verify: the Tauri app behaves identically, camera and sting included.
7. **Add `apps/web`.** Vite + React, the same one-line import, `base` set for
   Pages. Verify locally with `bun run preview` at the subpath.
8. **CI.** `ci.yml` running lint, typecheck, test on push and PR.
9. **Pages.** `pages.yml` building `apps/web` and deploying. Requires the
   GitHub repo to exist and Pages source set to "GitHub Actions".

Phases 1–2 and 8 are independent of the rest and can land early.

## Deployment

GitHub Pages, built by Actions on push to `main`:

- `actions/checkout` → `oven-sh/setup-bun` → `bun install`
- stage assets (the script, not committed binaries)
- `turbo run build --filter=web`
- `actions/upload-pages-artifact` → `actions/deploy-pages`

Serving over HTTPS means `getUserMedia` works, so the hand tracking demo
functions in the deployed site. It will prompt for camera permission, which is
expected and worth a line of copy on the page.

Size is not a concern: ~47 MB of assets against a 1 GB site limit, and the
largest single file (26.8 MB) is under the 100 MB per-file cap. Trimming the
unused MediaPipe wasm variants is a possible optimisation, not a blocker.

## Resolved decisions

| question | answer |
|---|---|
| Remote | `https://github.com/alexwine36/On-Blast.git` (added; repo exists, **public**, empty) |
| Pages URL | `https://alexwine36.github.io/On-Blast/` |
| Vite `base` for `apps/web` | `"/On-Blast/"` — **case-sensitive**, must match the repo name exactly |
| npm scope | `@on-blast/*` |
| `apps/web` contents | The full demo, same `<OnBlast />` as Tauri |

## Licensing: resolved by shipping it

Initially withheld — the repo is public, so pushing is publishing, and the
sting is cut from the sketch.

**Reversed by the repo owner:** this is a free, non-commercial hobby project
and the clip is ~0.4 seconds. `sting.wav` is committed and ships in the public
build; only the raw source clip stays local. `ATTRIBUTION.md` records the
source and an easy removal path, and the engine still falls back to a
synthesized sting if the file is ever deleted.

Both blobs remain in history from `0b206e6`. Scrubbing them is now close to
pointless given `sting.wav` is deliberately public, so no rewrite is planned.

## Risks

| risk | mitigation |
|---|---|
| Subpath asset 404s only in production | Phase 5 does it explicitly; verify with `preview` at the subpath before deploying |
| Biome reformat buries real changes | Reformat lands as its own commit |
| Tauri before-commands run from `apps/on-blast` and need workspace deps | Verified in phase 1 before anything moves |
| 104 assertions lost in the move | Porting them is a named deliverable of phases 3–4 |
| Asset staging adds CI time | Cached by `actions/cache` keyed on the script hash |
| ~~Copyrighted sting reaching a public repo~~ | Deliberately shipped; see the licensing section |
| Pages base path case mismatch (`on-blast` vs `On-Blast`) | Base is `/On-Blast/`; verified with `preview` at the subpath before deploying |
