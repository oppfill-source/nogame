// NoGame brand color system
// "Stop gambling. Start winning." — serious, trustworthy, data-driven.
//
// Rule: green = positive outcome only. Never decorative.
// Rule: indigo = AI-generated. Always distinct from human content.
// Rule: neutral dark backgrounds — legibility over personality.

export const COLORS = {
  // ── Primary brand (three-shade green system) ───────────────────────────────
  brand:          "#22C55E",   // Win Green    — CTAs, active states, wins
  brandLight:     "#4ADE80",   // Signal Green — positive values, earnings
  brandDark:      "#16A34A",   // Deep Green   — pressed, confident accents

  // ── Backgrounds (neutral zinc — no color tint, maximum legibility) ─────────
  bgDeep:         "#09090B",   // Near-black       — screen backgrounds
  bgSurface:      "#18181B",   // Dark surface     — headers, tab bar, nav
  bgCard:         "#1C1C1F",   // Card background  — game cards, pick cards
  bgElevated:     "#27272A",   // Elevated         — odds chips, inputs, sheets

  // ── Legacy aliases (used by app/_layout & tabs/_layout) ───────────────────
  bgVoid:         "#09090B",   // alias → bgDeep
  bgMidnight:     "#18181B",   // alias → bgSurface

  // ── Borders ────────────────────────────────────────────────────────────────
  border:         "#3F3F46",   // Default border
  borderSubtle:   "#27272A",   // Subtle / inner dividers

  // ── Text ───────────────────────────────────────────────────────────────────
  textPrimary:    "#FAFAFA",
  textSecondary:  "#A1A1AA",
  textMuted:      "#71717A",

  // ── Status — each color carries strict semantic meaning ────────────────────
  win:            "#22C55E",   // Win Green — positive P&L, won bets
  loss:           "#EF4444",   // Red — losses, risk, negative values
  caution:        "#F59E0B",   // Amber — moderate confidence, warnings
  ai:             "#6366F1",   // Indigo — AI-generated content, only
  premium:        "#F0B429",   // Gold — elite value rating (9–10)
} as const;
