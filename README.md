# Festivity — Music, in Motion

A local, single-hero React and Three.js experiment. A floating sculpture of rounded music tiles, capsules, small satellites, a reflective orbit, and iridescent bubbles. Floating cards sit within the same hero; the Explore card becomes a compact music player. Coral ceramic, lilac, pearl, periwinkle, dark satin, and refractive glass sit against a warm-to-cool studio backdrop. No extra pages or deployment.

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
- Hold and drag a piece; release it to let it settle. Cubes bend the wire, and wire tension gently pushes and turns them in return.
- Click a shape to toggle its music and individual reaction. Waveform bars animate independently, the heart changes through warm colors and beats, the black text tile gains golden lettering, notes sway, headphones pulse, clouds float, globes turn, and stars twinkle. Body materials stay original except for the heart. Selecting another shape returns the previous reaction to rest.
- Use the floating player to pause/resume music; the speaker control mutes both music and pops. Music begins only after a gesture, pauses while the tab is hidden, and stops on reset.
- Every click also adds one inflation puff, including clicks that turn music off. Five clicks pop the shape. Holding and dragging do not add air. A matching replacement floats in.
- Oil stretches, falls, and leaves wet patches on the moving shapes. Reset clears both pressure and oil.
- Click **M** to scatter the composition.
- Pause, resume, and reset from the footer or menu.
- Touch dragging and reduced-motion preferences are supported.

## Rendering

- `src/scene.ts`: 26 physical bodies, fixed 90 Hz simulation, interpolated motion, smooth superellipsoid geometry with analytic normals, and physical materials.
- `src/musicAudio.ts` and `src/musicMoods.ts`: lazy Web Audio instruments, a bounded look-ahead scheduler, gain crossfades, a quiet delay, and a dynamics compressor. No remote tracks or extra audio downloads.
- `src/tileReactions.ts`: per-symbol reactions, including single-draw equalizer geometry and isolated heart materials. Heartbeat scale is shared by rendered geometry and physical colliders.
- `src/musicVisuals.ts`: a gently animated background palette. A small half-float background texture updates at 30 Hz; the sculpture stays at the display rate. Audio energy drives restrained atmosphere changes without a bloom pass. Pausing the soundtrack also stops its reactions.
- `src/musicIcons.ts`: beveled music symbols from official Phosphor SVG contours and the Lucide cloud silhouette. Icons render after transmission to avoid ghosted refraction.
- `src/orbits.ts`: a dynamically updated cable mesh with continuous transported normals, plus five instanced iridescent glass bubbles.
- `src/studio.ts`: a baked studio environment, feathered softboxes, and a procedural gradient backdrop with soft diagonal light streaks.
- `src/wirePhysics.ts`: a 96-node closed cable with stretch/bending constraints, a weak rest spring, traveling loads, and two-way rounded-cube contact at the same 90 Hz fixed step. Node and segment contacts keep the wire outside the cube surfaces.
- `src/burstLifecycle.ts`: discrete five-click inflation, a soft puff response, one pop per cycle, and matching replacements.
- `src/liquidCollision.ts`: continuous oil contacts against translating and rotating rounded bodies, including drop width and full liquid strands. Oil and cubes share the fixed simulation step.
- `src/contactLighting.ts`: all-neighbor contact lighting compressed into directional coefficients, with three texture samples per vertex and no nearest-neighbor switching.
- `src/App.tsx` and `src/style.css`: accessible controls and responsive hero layout.

Native MSAA and 1.5–2× rendering preserve edges within a five-million-pixel budget. The glass refraction buffer uses 35% of the render resolution; rough refraction conceals the reduced resolution while keeping the sculpture sharp. Small satellites use lighter geometry. Paused scenes stop rendering; hidden tabs suspend simulation. All assets are local or procedural.

Icon sources: [Phosphor](https://github.com/phosphor-icons/core) and [Lucide](https://github.com/lucide-icons/lucide). The original licenses are included in `src/assets/icons/`. SVG geometry is generated once; icons are served locally, without an icon API.

React + TypeScript + Vite + Bun + Tailwind CSS + Three.js. Festivity is an experiment name, not the final platform identity.

## Physics checks

Run `bun test` for cable stretch/stability, reciprocal cube reaction, rounded-surface clearance during dragging, wave propagation/damping, deterministic reset, click inflation, oil adhesion and pinch-off, swept droplet contacts, moving-cube collision regressions, score bounds, transport state, silent startup, rapid mood-switching limits, independent reactions, and heartbeat collider/render agreement.
