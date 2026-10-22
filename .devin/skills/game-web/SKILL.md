---
name: game-web
description: Build playable browser games and interactive 3D scenes - canvas 2D games, Three.js scenes/games, Phaser projects. Use when the user asks for a game, playable demo, interactive 3D visualization, gamified feature, or canvas-driven interactive experience. For a full game production pass, prefer installing the external threejs-game-skills pack (director + 9 specialist skills with Playwright test hooks).
---

# Game Web - playable, verified, not a demo

A "game" that renders a spinning cube is not a game. The bar: a playable
loop (input -> state -> render -> win/lose/score), verified by actually
playing it via Playwright - the same evidence bar as any product feature.

## Engine choice

| Need | Engine |
|---|---|
| 2D game, sprites, arcade | Plain canvas or **Phaser 3** (physics, tilemaps, input built in) |
| 3D scene / game | **three.js** (+ drei/cannon-es if React/physics) |
| UI-gamified widget in an app | DOM + motion skill - don't pull a game engine for a badge animation |

## Non-negotiables

- **Fixed-timestep loop** (`requestAnimationFrame` + delta accumulation) -
  frame-rate-dependent physics breaks on 120Hz screens.
- **Seeded RNG** for anything procedural - makes bugs reproducible and
  Playwright tests deterministic.
- **Game-state machine** (menu -> playing -> paused -> gameover) as an
  explicit state object, not a pile of booleans.
- **Test hooks**: expose `window.__game` (state snapshot + score + reset)
  in dev/test builds so Playwright can assert state without pixel-guessing.
- **Assets**: generated via `image-gen` skill or procedural - no hotlinked
  or scraped game art (rights + 404 risk).
- **Input**: keyboard AND touch where the audience is mobile; pause on blur.

## Scaling up

For anything beyond a mini-game (levels, 3D asset pipeline, audio):
install `majidmanzarpour/threejs-game-skills` (MIT) - director + specialist
skills with scaffold, Playwright smoke tests, visual-regression baselines
and bot playtests. `remotion-dev/skills` for rendered clips/trailers.
`OpenDCAI/GameFactory-3A` only for heavy asset pipelines (3D gen, motion
retarget) - evaluate first, it's research-scale.

## Verification gate (playable proof)

- Playwright: load game, send inputs, advance frames, assert
  `window.__game` state transitions (menu->playing->score change).
- Screenshot menu + mid-play + gameover states.
- Console clean (zero errors/rejections), 60fps check via
  `requestAnimationFrame` timing on target viewport.
