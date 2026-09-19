/**
 * Domain-scoped design languages. Each business domain adopts the design
 * system whose strengths match its workflow:
 * - fluent   (Microsoft Fluent 2): dense data grids & forms — admin console
 * - material (Google Material 3):  people-centric workflows — chips, tonal color
 * - apple    (Apple HIG):          calm content-first reading — portals, overviews
 *
 * Tokens are scoped via `.theme-*` classes in globals.css and applied to the
 * content region in AppShell — chrome (sidebar/topbar) stays neutral.
 */
export type DomainTheme = "fluent" | "material" | "apple";

// Ordered: first matching prefix wins — keep specific prefixes above generic.
const DOMAIN_THEME_MAP: [string, DomainTheme][] = [
  ["/portal", "apple"],
  ["/dashboard", "apple"],
  ["/records", "fluent"],
  ["/attendance", "fluent"],
  ["/academics", "fluent"],
  ["/register", "fluent"],
  ["/schedule", "fluent"],
  ["/dept", "fluent"],
  ["/team", "fluent"],
  ["/school", "fluent"],
  ["/conduct", "material"],
  ["/counseling", "material"],
  ["/parents", "material"],
  ["/activities", "material"],
  ["/safety", "material"],
  ["/emulation", "material"],
  ["/competency", "material"],
];

export function domainThemeFor(pathname: string): DomainTheme {
  for (const [prefix, theme] of DOMAIN_THEME_MAP) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return theme;
  }
  return "fluent";
}
