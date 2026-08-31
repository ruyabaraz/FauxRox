# Tests

Unit tests for the pure analysis modules — the parts of FauxRox that hold no
Lens Studio state and can therefore be run and verified outside the editor.

Currently covers `Assets/Scripts/RaceAnalysis.ts`, the Coach's Verdict
diagnosis pipeline.

## Running

```bash
cd Tests
npm install
npm test
```

## Why this folder is outside Assets/

The project's root `tsconfig.json` only includes `Assets/` and `Packages/`, so
Lens Studio never compiles anything here. That keeps test code and its
dev dependency on TypeScript out of the Lens build entirely.

## What is covered

- **Scale factor regression** — when the reference is uniformly wrong (a model
  calibrated for a different athlete, or simply a bad day), residuals must
  collapse to ~0 and only genuinely split-specific slowdowns survive. This is
  the behaviour the whole pipeline exists for, so it is locked first.
- **Dual significance threshold** — a residual must clear both an absolute
  (10s) and a relative (10%) bar, so neither a large percentage of a short
  split nor a small percentage of a long one is dramatised.
- **Signed residuals** — "strongest" is the biggest negative residual, not the
  shortest split.
- **Baseline promotion** — modelled reference until 3 comparable personal
  samples exist, then personal median, with confidence reported.
- **Comparability** — races run under different course tuning, and legacy
  records with no tuning recorded, are excluded from personal baselines.
- **Wording** — a modelled reference must never produce "your weakest station",
  and heart rate must never be stated as proof of cause.
