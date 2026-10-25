# DESIGN.md — hj-app (연습장) / TEMPERING + Soft Glow

> **Canon.** Impeccable anti-Inter / anti-purple / anti-gradient defaults must **NOT** override this palette.
> Detector policy: run `detect` first; add `ignoreValues` only for rules that actually fire on brand surfaces. Do not pre-waive the whole detector.
> Source of truth for print CMYK: `봇공유/10 업무/디자인/항공정비_공식컬러_TEMPERING.md` (유진님 2026-10-24).

## Official palette — TEMPERING (항공정비)

| # | 이름 | CMYK (정본) | HEX (화면 참고) |
|---|------|-------------|-----------------|
| 1 | 연회색 | C0 M0 Y0 K20 | `#CCCCCC` |
| 2 | 올리브골드 | C50 M55 Y100 K5 | `#796D00` |
| 3 | 딥브라운 | C55 M75 Y100 K35 | `#4A2900` |
| 4 | 다크플럼 | C85 M100 Y65 K50 | `#13002C` |
| 5 | 딥네이비 | C100 M90 Y20 K0 | `#001ACC` |
| 6 | 브라이트블루 | C85 M50 Y5 K0 | `#2680F2` |

**HEX는 참고값이다.** CMYK→HEX 단순 환산이라 화면에서 인쇄물보다 쨍하게 보일 수 있다. 화면용 정본은 인쇄소 ICC·실물 맞춤 후 확정. 그전까지 HEX를 “디지털 락”으로 쓰지 말고 참고로만 쓴다.

### Usage
- Prefer `#001ACC` / `#2680F2` (참고) for interactive accents when a screen preview is needed.
- Prefer `#13002C` (참고) for deep backgrounds / ink — **not** pure black.
- `#796D00` / `#4A2900` (참고) for tempering / aviation-maintenance warmth accents.
- `#CCCCCC` (참고) for muted chrome / dividers — tint further if needed; never pure `#000` / raw system gray stacks.
- Do **not** substitute Inter + purple-to-blue SaaS gradients for this system.
- Live CSS (`css/app.css`) may still use legacy Toss-like `#3182F6` until a deliberate palette migrate.

## Soft Glow Squircle
- **Background:** navy (`#13002C` 참고, or deeper navy derived from it).
- **Glow gradient:** sky → white → pink (sky ≈ `#2680F2` 참고 / light sky, through white, into soft pink).
- **Shape:** Squircle (superellipse / continuous corner), not hard 8px card stacks.
- Soft Glow is intentional brand motion/poster language — do not “quieter” it into flat gray cards.

## Typography
- Avoid default Inter-only stacks when a deliberate Korean-capable face is available.
- Hierarchy: short headlines, readable body, high contrast on TEMPERING grounds.

## Layout
- Prefer clear sections over nested cards-in-cards.
- Squircle radii for Soft Glow surfaces; keep admin tables readable (not decorative).

## Detector policy
- After install/`detect`, waive **only** rules that fire on intentional brand surfaces (e.g. Soft Glow `dark-glow` on poster paths).
- Brand blues / deep plum may trip anti-purple detectors — treat as in-palette when they match the TEMPERING table; do not blanket-ignore before evidence.
- Soft Glow chromatic halos on navy posters may trip `dark-glow` — waive with reason on those files only.
