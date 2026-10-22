---
name: web-elements
description: Craft distinctive web elements and sections - hero sections, feature grids, pricing tables, navbars, footers, dashboards, cards, empty states, CTAs - that look designed, not template-default. Use when building or upgrading any visible UI section/component. Pairs with `impeccable` (which audits); this skill generates. Trigger on "make this section look good", landing pages, marketing surfaces, dashboard widgets, component redesign.
---

# Web Elements - generate at design quality

`impeccable` audits; this skill **generates**. Every element must pass the
anti-slop bar BEFORE it reaches review: a distinctive decision visible in
the first viewport (layout asymmetry, editorial type, signature color or
motion), never a centered-everything hero on a default gradient.

## Process (skip a step = ship generic)

1. **Read DESIGN_SYSTEM.md first** - tokens, surface-pairing rules,
   anti-patterns are law. No system file? Establish minimal tokens first.
2. **Recon, don't invent**: screenshot 2-3 reference sites in the domain
   (Playwright) and extract the pattern - layout grid, density, type rhythm.
   Reference-informed beats "from imagination" every time.
3. **Compose from states**: every element ships its full state matrix -
   default/hover/active/disabled/loading/empty/error. An element that only
   exists in its happy state is half-built.

## Element playbook

- **Hero**: asymmetric split or oversized display type beats centered
  stack; one focal element (product shot, generated art via `image-gen`,
  live widget) - never stock icon grids.
- **Feature grid**: vary card treatment (icon position, numbering, span
  asymmetry); identical cards in a row reads as AI-default.
- **Pricing**: emphasize the recommended tier structurally (scale/border/
  badge), not just a highlighted bg.
- **Dashboard/data**: real density decisions from the domain pack -
  glanceable KPIs, not decorated stat cards.
- **Nav/footer**: full-word labels, exact page-header echo (conventions);
  footers carry real links, not lorem columns.
- **Empty states**: illustration + one-line why + single primary action -
  never a bare "No data".

## Hard rules

- Vietnamese copy: no em-dash/en-dash, full-word nav labels, no emoji in UI.
- New text-on-surface pairing = new named token (conventions law).
- Icons: one neutral set (lucide/phosphor per design system), name-keyed.
- Every section responsive at 390px - check, don't assume.

## Verification gate

Playwright screenshot at desktop + mobile + computed-style audit of the
BUILT element, then `impeccable audit`/critique pass. "It rendered" is not
done - compare against the design intent.
