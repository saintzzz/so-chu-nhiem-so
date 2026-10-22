---
name: motion
description: Animation and motion work - UI micro-interactions, page transitions, loading states, scroll-driven effects (CSS/WAAPI/GSAP), and rendered video/motion graphics (Remotion). Use when the user asks for animation, animated elements, motion design, transitions, an animated asset, or a video/clip deliverable. Covers both in-app motion and rendered media.
---

# Motion - two lanes, pick the right one

| Lane | Output | Tooling |
|---|---|---|
| **UI motion** (in-app) | transitions, micro-interactions, loading, scroll effects | CSS transitions/keyframes, WAAPI (`el.animate()`), GSAP for complex timelines, framer-motion in React |
| **Rendered media** (file deliverable) | mp4/webm/gif clips, animated explainers, motion graphics | **Remotion** (React -> rendered video) - install `remotion-dev/skills` when the project is video-first |

## UI motion rules (from the design-system conventions)

- Motion is minimal by default: 100-150ms color/shadow transitions,
  200-300ms for layout/state changes. Longer only when it communicates
  structure (drawer, modal, page transitions).
- `prefers-reduced-motion` MUST disable themed/large-motion work - a11y is
  not optional.
- Animate `transform` + `opacity` only - animating layout properties
  (width/top/margin) janks on mobile.
- Every animated element needs a static state that reads correctly when
  motion is off.
- Signature motion (the thing a user would describe in one sentence) comes
  from the Design Brief - don't freestyle it.

## Rendered media rules

- Remotion project structure: `src/Composition` per clip, props-driven, so
  content can be regenerated without re-authoring.
- Keep clips parameterized (text/data as props) - a video hard-coded to one
  data set can't be regenerated when content updates.
- Render verification: `npx remotion render` produces the file; scrub
  frames (`ffmpeg -i out.mp4 thumb%03d.png`) to confirm no blank/frozen
  segments.

## Game/canvas animation

For canvas/game loops use `requestAnimationFrame` with delta-time math -
never `setInterval`. See the `game-web` skill for full game work.

## Verification gate

- UI: Playwright - measure `transition`/`animation` computed styles on the
  touched elements; screenshot both states; test with reduced-motion on.
- Rendered: file exists, correct duration/resolution, frame-scrub check.
