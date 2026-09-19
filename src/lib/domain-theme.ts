/**
 * Single design language for the whole app: Fluent 2 (Microsoft).
 * Chosen because the product is a dense data-entry/admin tool — grids,
 * forms, and workflows are Fluent's home turf. The theme layer
 * (`.theme-*` classes in globals.css) is kept so another language can be
 * reintroduced later, but every domain currently maps to Fluent.
 */
export type DomainTheme = "fluent" | "material" | "apple";

const APP_THEME: DomainTheme = "fluent";

export function domainThemeFor(): DomainTheme {
  return APP_THEME;
}
