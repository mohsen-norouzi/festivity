# Festivity

A local, single-hero experiment inspired by the supplied ornament-collision video. Full-browser pale background, pink ornaments, rose-gold fittings, sparse typography, and interactive physical motion. No additional pages, backend, or deployment.

## Run

```sh
cd /Users/mohsen/Nova/Experiments/festivity
bun install
bun run dev
```

Open the Local URL printed by Vite (normally http://127.0.0.1:5173).

```sh
bun run build
bun run preview
```

## Interactions

- Move through the cloud to push the ornaments.
- Press and drag an ornament to pull it out of the cluster.
- Release it and let the attraction and collisions settle the composition.
- Click **X** to scatter the cloud.
- Use the footer or menu to pause, resume, or reset.
- Touch and drag works on phones. The initial motion respects reduced-motion preferences.

## Structure

- `src/scene.ts` — Three.js rendering, procedural geometry, studio lighting, contact shading, fixed-step sphere collisions, and pointer interaction.
- `src/contactLighting.ts` — continuous contact lighting using each sphere's eight nearest neighbors, without screen-space shadow artifacts.
- `src/App.tsx` — React hero and accessible controls.
- `src/style.css` — Tailwind import, responsive layout, typography, and cursor.
- `public/fonts` — locally served Anton and Inter with their open-font licenses.

React + TypeScript + Vite + Bun + Tailwind CSS + Three.js. The entire ornament scene uses four instanced draw calls and a single rendering pass. Smooth 64 × 48 sphere geometry, native MSAA, and 1.5–2× render resolution keep edges clean, with a five-million-pixel budget for larger displays. Continuous contact lighting replaces the former low-resolution GTAO and blur passes. Physics uses a fixed 90 Hz step with interpolation. Paused scenes stop rendering, and hidden tabs suspend their simulation. All visual assets are procedural; no external image or model service is needed at runtime.

This is a visual experiment, not a final music-platform identity. The frame-by-frame shape differs from the video because the scene is a live simulation.
