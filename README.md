# Executive Tycoon 3D — Realism build

Play via a local static server (ES modules):

```bash
cd "/Users/togi/Executive Tycoon 3D"
python3 -m http.server 8765
```

Open http://127.0.0.1:8765/executive_tycoon_3d_integrated.html

## Layout

- `executive_tycoon_3d_integrated.html` — UI + core loop
- `integrate.js` — bridges realism systems + modular office
- `game/` — clock, body, risk, economy, life, pipeline
- `office/` — prop modules + assembleOffice + postFx
- `tests/smoke-realism.mjs` — `npm run test:smoke`

## Notes

- Default clock: 1 real second = 1 game hour (1x); Pause / 2x / 4x available
- Save key: `executive_tycoon_save_v4`
- Film sizes (canon): Small $3M · Medium $8M · Large $20M · Blockbuster $45M
- Graphics: Low / Med / High / Cinematic / Path Trace (RT-*look* lighting stub — not a progressive WebGPU path tracer)

## Known limitations

- Must serve over HTTP (opening the HTML as `file://` breaks ES module imports)
- Path Trace mode is a cinematic lighting preset stub, not true path tracing
- Cursor IDE browser may not reach `127.0.0.1`; use a system browser for local play
