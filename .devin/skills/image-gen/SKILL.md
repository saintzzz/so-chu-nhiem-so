---
name: image-gen
description: Generate production images - hero art, illustrations, icons, thumbnails, textures, placeholders - via image APIs with strict asset discipline. Use when a project needs real visual assets (not grey boxes). Requires an image-capable API key (Gemini image / OpenAI images / OpenRouter image models); falls back to procedural/SVG art when no key exists.
---

# Image Generation - real assets, not placeholders

## Provider order (same fallback rule as review chains)

1. `GEMINI_API_KEY` -> Gemini image models (`gemini-*-image` / imagen via API)
2. `OPENAI_API_KEY` -> `gpt-image-*`
3. `OPENROUTER_API_KEY` -> any `:free` image model first, paid as fallback
4. **No key -> procedural fallback**: SVG art, CSS-generated textures, canvas
   scripts. Never ship a grey `placehold.co` box - that is a mockup violation.

Call via a small committed script (`scripts/gen-image.mjs`) so generation is
reproducible and re-runnable - ad-hoc curl images are not reproducible.

## Asset discipline (mandatory)

- **Art direction first**: pull palette/mood from DESIGN_SYSTEM.md + domain
  pack. Prompts include the project's named tokens ("primary #1a56db, flat
  editorial illustration style") - freestyle prompting produces visual drift
  across assets.
- **Naming**: `assets/img/<role>-<subject>-<variant>.<ext>` (hero-dashboard-01.png).
  No `image.png`, `untitled.png`, `download (2).png`.
- **Formats**: web delivery -> generate PNG, convert to WebP/AVIF for shipped
  assets; keep the PNG as source. Never hotlink generated URLs.
- **Rights/regulations**: domain pack rules apply (education/health imagery:
  no real children's faces; check the Role matrix for imagery constraints).
- **Consistency**: one asset set = one prompt family. Establish a "style
  lock" line in the prompt and reuse it verbatim across the set.

## Editing existing images

Prefer img2img/edit endpoints over regenerate-from-scratch - keeps
composition. For crops/resizes/compression, use sharp/imagemagick, never the
generation API.

## Verification gate

- Open the file: is it the requested subject, on-brand, usable at target
  size? Generate >= 2x display resolution for hero images.
- Playwright screenshot the page WITH the image loaded - a 404'd or
  stretched asset is a defect, not "generated".
- Check file size budget (<500KB web hero after WebP; report if larger).
