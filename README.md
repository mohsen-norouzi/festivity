# Festivity — Music, in Motion

A local, single-hero React and Three.js experiment. A floating sculpture of rounded music tiles, capsules, rings, and small satellites. Coral ceramic, lilac, pearl, dark satin, and refractive glass sit against a warm-to-cool studio backdrop. No extra pages or deployment.

## Run

```sh
cd /Users/mohsen/Nova/Experiments/festivity
bun install
bun run dev
```

Open the Local URL printed by Vite, normally http://127.0.0.1:5173.

```sh
bun run build
bun run preview
```

## Interactions

- Move through the sculpture to push the shapes.
- Hold and drag a piece; release it to let it settle.
- Click **M** to scatter the composition.
- Pause, resume, and reset from the footer or menu.
- Touch dragging and reduced-motion preferences are supported.

## Rendering

- `src/scene.ts`: 34 physical bodies, fixed 90 Hz simulation, interpolated motion, smooth superellipsoid geometry with analytic normals, and physical materials.
- `src/musicIcons.ts`: extruded procedural music symbols. Icons render after transmission to avoid ghosted refraction.
- `src/studio.ts`: a baked studio environment, feathered softboxes, and a procedural gradient backdrop.
- `src/contactLighting.ts`: all-neighbor contact lighting compressed into directional coefficients, with three texture samples per vertex and no nearest-neighbor switching.
- `src/App.tsx` and `src/style.css`: accessible controls and responsive hero layout.

Native MSAA and 1.5–2× rendering preserve edges within a five-million-pixel budget. The glass refraction buffer uses 35% of the render resolution; rough refraction conceals the reduced resolution while keeping the sculpture sharp. Small satellites use lighter geometry. Paused scenes stop rendering; hidden tabs suspend simulation. All assets are local or procedural.

React + TypeScript + Vite + Bun + Tailwind CSS + Three.js. Festivity is an experiment name, not the final platform identity.
