# tvOS UI + Liquid Glass research, and what it means for this TV

Target hardware: LG UQ80 (65UQ8040PSB), webOS 22, alpha 5 Gen5 chip, 1.5 GB RAM, Chromium 87.

## 1. tvOS design rules (what the launcher copies)
- Icons are 400x240 pt (800x480 px @2x), 5:3 landscape; the system adds the rounded corners, rim light and shadow.
  Back layer opaque brand colour, logo layers on top. Focused size is about 1.23x the resting size (300x180 -> 370x222).
- Focus is shown by scale (1.05x-1.1x), a lifted shadow, a white glare sweeping across the surface, and (on Apple TV) parallax tilt.
  Focusing animations should be prominent, unfocusing ones subtler. Colour is never the only focus cue.
- Safe area: 60 pt top/bottom, 80 pt left/right. Prefer one row of 5-7 cards over dense grids. Minimum card target 250x150 pt.
- Type: body 29 pt minimum (31-35 recommended), titles 48+ pt, medium/semibold weight, no hairlines. Viewing distance is about 10 ft.
- Home: a top row of apps with the focused app's name shown under it; no cursor; Menu/Back always goes up one level.
- Avoid: dense text, hamburger menus, tiny targets, excess motion, animation without user interaction.

## 2. Liquid Glass (Apple, WWDC25 "Meet Liquid Glass", tvOS 26)
- Real properties: lensing (bends and concentrates light, not just blur), specular highlights that follow geometry/motion,
  adaptive shadows and tint, content-aware light/dark, thicker-looking material when larger.
- Rules: glass belongs to the navigation/control layer floating above content; never glass on glass; never glass in the content
  layer; tint sparingly; regular variant for legibility; honour Reduce Transparency/Motion.
- tvOS 26: translucent dock/top row that slightly warps the video behind it, "glassy edge" icons, glass scrub bar.
  Reviewers found legibility/contrast weaker. Apple only ships it on the 2nd/3rd-gen Apple TV 4K (too heavy for older chips).
- In CSS only blur + saturate + rim-light shadows are reproducible; real refraction needs an SVG displacement filter and a duplicated
  background (fragile and expensive). The cheap, effective part is the specular edge (inset box-shadows).

## 3. TV browser performance (why the launcher lagged)
- Each compositing layer costs width x height x 4 bytes of GPU memory (a full-HD layer is about 8 MB); dozens exhaust a TV GPU.
- backdrop-filter / filter: blur() are among the most expensive operations (every pixel behind the element is sampled); a
  full-screen blur is the worst case. Each glass element is another blur pass. Guidance: 2-3 at most, never animate them.
- Use will-change only while animating, never as a default; animate transform and opacity only (compositor-only).
- Keep visible DOM small (~100 nodes); window long lists; decode images at display size; use decoding="async".
- Do not re-render large trees on a timer; update small nodes directly.
- LG's own table: webOS 22 = Chromium 87. 2022 entry-level TV chips have a weak GPU (Mali-T820-class on the O22 platform).

## 4. Decisions made
1. No live blur and no SVG refraction anywhere. Glass = a pre-blurred copy of the wallpaper shown through the glass shapes
   (background-attachment: fixed) + static rim-light shadows. Settings is a solid dark panel.
2. Only `transform` animates on focus; the shadow/shine appear instantly; `will-change` only on the focused tile.
3. The clock is its own component (the home screen no longer re-renders every second).
4. The wallpaper picker draws only the rows near the one in view, not all 233 thumbnails.
5. Default 5 wallpapers bundled (each with a 960x540 pre-blurred copy); the 233-image library loads from the cloud on demand.

## Sources
- https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine (Chromium per webOS version)
- https://developer.samsung.com/smarttv/develop/guides/web-app-memory-optimization-guide.html (TV memory/GPU rules)
- https://www.tothenew.com/blog/optimizing-performance-in-smarttv-html-tv-apps (TV CSS/DOM tips)
- https://developer.apple.com/videos/play/wwdc2025/219/ (Meet Liquid Glass)
- https://theplusaddons.com/blog/liquid-glass-ui/ (what CSS can and cannot reproduce)
- https://appleinsider.com/articles/25/06/18/tvos-26-hands-on-sleek-liquid-glass-redesign-new-control-center-and-more (tvOS 26)
- https://takazudomodular.com/pj/zcss/docs/styling/effects/backdrop-filter-and-glassmorphism/ (pre-blurred image technique)
- https://github.com/BasThomas/tvOS-guidelines, https://github.com/ehmo/platform-design-skills (tvOS rules summarised)
