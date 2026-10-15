# Festivity — MUSYNC hero study

A local React and Three.js hero and balloon-transition experiment using MUSYNC’s official logo and core messaging. The workspace/project name remains Festivity. A floating sculpture of rounded music tiles, capsules, small satellites, a reflective orbit, and iridescent bubbles. Three tiny transparent glass capsules sit within the same hero: artist–fan details, a random-track discovery button, and the MUSYNC waitlist invitation. Scuffed black lacquer, warm coral, vivid pink, aged paper, lavender, and clear rose glass sit against bright peach-and-violet concert haze. The official symbol, distressed manifesto lettering, a live-session image, and a vinyl record appear on the rounded faces. The dark inscription ribbon reads “ARTISTS OWN TOMORROW.” The balloon journey reveals one placeholder section, Page-1. No deployment.

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
- Click a shape once to play its music and start an upward balloon journey. Additional clicks during the journey cannot interrupt it. The music continues on Page-1; the header menu can select another recording. Waveform bars animate independently, the heart changes through warm colors and beats, the black text tile gains golden lettering, notes sway, headphones pulse, clouds float, globes turn, and stars twinkle. Body materials stay original except for the heart. Selecting another shape returns the previous reaction to rest.
- The “Surprise me” capsule draws a different track without repeating the remaining deck. The connection card reveals the artist–fan benefits, and the glass invitation opens the existing waitlist. The header menu opens the MUSYNC Mix: seven local tracks with live selection, keyboard navigation, and matching sculpture reactions. Music begins only after a gesture, pauses while the tab is hidden, and stops on reset.
- The selected tile or small bubble remains in the live physics simulation as it inflates, rises, and leads the camera up exactly one viewport height over 3.7 seconds. Camera, page, rotation, and physical bodies share the same interpolated rendering time, avoiding fixed-step judder. The lift spring is critically damped and ascending contacts do not bounce. Without stopping at arrival, it pops and the centered Page-1 heading appears. Holding and dragging do not launch a journey. The header logo returns to the hero and resets the sculpture; it also cancels an in-progress flight.
- The destination pop reuses the existing liquid effects and material palette. Its drops fall freely on the empty destination. Reset clears the effects.
- Click the large MUSYNC play/waveform symbol to scatter the composition.
- The footer shows a small spinning record and the current title/artist. Reset by clicking the header logo. The footer and menu contain no animation, fullscreen, reset, or mute controls.
- Touch dragging and reduced-motion preferences are supported. Reduced motion skips the climb and pops immediately at the destination. Hidden tabs suspend the journey clock.

## Rendering

- `src/scene.ts`: 26 physical bodies, fixed 90 Hz simulation, interpolated motion, smooth superellipsoid geometry with analytic normals, and physical materials.
- `src/musicAudio.ts` and `src/musicMoods.ts`: seven local MP3 recordings, streamed only after a click. At most two media sources are alive during a crossfade; replaced sources release their downloads and buffers. Pause/resume preserves position, and the actual recording's energy and bass attacks drive the reactions. The footer shows the track title and artist; the menu can pause/resume playback, while cubes always select and play.
- `src/tileReactions.ts`: per-symbol reactions, including single-draw equalizer geometry and isolated heart materials. Heartbeat scale is shared by rendered geometry and physical colliders.
- `src/musicVisuals.ts`: restrained moving stage light over the luminous haze. A low-resolution cached half-float background texture updates at 30 Hz; the sculpture stays at the display rate. Audio energy drives restrained atmosphere changes without a bloom pass. Pausing the soundtrack also stops its reactions.
- `src/undergroundSurfaces.ts`: shared 512px color, roughness, and bump textures baked once; curved artwork decals; local generated concert photography. No per-frame texture generation.
- `src/musicIcons.ts`: beveled music symbols from official Phosphor SVG contours and the Lucide cloud silhouette. Icons render after transmission to avoid ghosted refraction.
- `src/orbits.ts`: a dynamically updated cable mesh with continuous transported normals, plus five instanced iridescent glass bubbles.
- `src/studio.ts`: a baked peach/violet lighting environment and a responsive, cropped concert-haze backdrop. The background texture reallocates safely on resize.
- `src/wirePhysics.ts`: a 96-node closed cable with stretch/bending constraints, a weak rest spring, traveling loads, and two-way rounded-cube contact at the same 90 Hz fixed step. Node and segment contacts keep the wire outside the cube surfaces.
- `src/balloonJourney.ts`: one visible-time clock coordinates inflation, upward motion, exactly one camera-height move, arrival, and one immediate arrival pop. `balloonFlight.ts` lifts the original body with a buoyant spring; `bodyContacts.ts` keeps contacts reciprocal while inflation changes the collider and visible size together. The destination haze uses the selected material’s palette. The active balloon keeps its existing geometry and materials; no extra renderer or asset downloads are needed.
- `src/burstLifecycle.ts`: shared body sizing and the retained standalone inflation/replacement machinery; hero clicks now use the balloon journey.
- `src/liquidCollision.ts`: continuous oil contacts against translating and rotating rounded bodies, including drop width and full liquid strands. Oil and cubes share the fixed simulation step.
- `src/contactLighting.ts`: all-neighbor contact lighting compressed into directional coefficients, with three texture samples per vertex and no nearest-neighbor switching.
- `src/JellyCard.tsx`: slim, transparent capsules with a subtle elastic silhouette, damped pointer tilt, a gentle press response, and crisp DOM lettering. Animation frames run only while responding or settling; no additional WebGL pass, textures, or assets. Reduced motion disables the deformation.
- `src/App.tsx` and `src/style.css`: accessible controls, the translated hero layer, and the centered Page-1 placeholder.

Native MSAA and 1.5–2× rendering preserve edges within a five-million-pixel budget. The glass refraction buffer uses 35% of the render resolution; rough refraction conceals the reduced resolution while keeping the sculpture sharp. Small satellites use lighter geometry. Paused scenes stop rendering; hidden tabs suspend simulation. All assets are local or procedural.

Icon sources: [Phosphor](https://github.com/phosphor-icons/core) and [Lucide](https://github.com/lucide-icons/lucide). The original licenses are included in `src/assets/icons/`. SVG geometry is generated once; icons are served locally, without an icon API.

React + TypeScript + Vite + Bun + Tailwind CSS + Three.js. Festivity is an experiment name, not the final platform identity.

## Physics checks

Run `bun test` for balloon arrival/pop ordering, repeat-click protection, return/reset, frame-rate independence, reduced motion, cable stretch/stability, reciprocal cube reaction, rounded-surface clearance during dragging, wave propagation/damping, deterministic reset, continuous inflation and repeated-click protection, oil adhesion and pinch-off, swept droplet contacts, moving-cube collision regressions, local track mappings, pause/resume, silent startup, crossfades, rapid switching and stale playback cancellation, independent reactions, and heartbeat collider/render agreement.

## Local songs

The uploaded recordings live in `public/songs/`. Assignments and displayed metadata are in `src/musicMoods.ts`.

| Material | Track | Artist |
| --- | --- | --- |
| Vermilion (coral ID) | Sunshine | Moavii |
| Black | Wavy Strut | Tetuano |
| Acid pink (lilac ID) | Pink Clouds | NVL8 |
| Aged paper (pearl ID) | Enjoy | Pufino |
| Glass | That's Life | Johny Grimes |
| Gunmetal (blue ID) | Back To Promise | Unheard |
| Small bubbles | Tariro | Pufino |

## Brand source

The full white SVG logo is from https://www.musync.me/assets/Logo_White.svg; the standalone symbol uses its original first path. The favicon is from https://www.musync.me/en/. The underground manifesto and tile phrases follow the supplied design reference. Public brand assets are stored in `public/brand/`. The existing hero CTA opens the live MUSYNC waitlist in a new tab; no signup form is included locally. Page-1 is a content placeholder only.

## Image assets

`public/textures/underground-club.webp` (1920px wide, about 151 KB) and `public/textures/live-session.webp` (768px square, about 26 KB) were generated with the built-in image generation tool for this experiment. The anonymous concert subject is generated and remains unchanged in the brighter redesign. `public/textures/stage-haze.webp` is the new generated background; the old venue image remains available as a previous direction. Brush lettering uses the locally served Permanent Marker font from https://github.com/google/fonts/tree/main/apache/permanentmarker, with its Apache license retained beside the font. Existing official brand vectors are retained. Surface wear, vinyl artwork, and typography are procedural.

Headline lettering uses the user-provided Hey August font, served locally from `public/fonts/hey-august.otf`. The alternate TTF source is kept beside it. A small native SVG provides the broken paint-stroke underline. The cube lettering retains Permanent Marker.
