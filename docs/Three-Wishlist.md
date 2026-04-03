# Wishlist: Three Major Features

This file now tracks what actually happened, not just the original intent.

## 1. Real-World Default Presets (Calendars & Celestials)

**Status:** Done

### What shipped

- Calendar presets exist in `src/lib/calendar/presets.ts`.
- The calendar create flow exposes `Start from preset` in `CalendarHub.svelte`.
- Celestial presets exist in `src/lib/celestial/presets.ts`.
- The celestial registry has a `Create from Preset` flow that builds a full system from real-world data.

### What this means in practice

This wishlist item is no longer hypothetical. Users can start from Gregorian, Julian, and Simple Fantasy calendar presets, and they can create a Solar System preset with stars, planets, and moons already populated.

### Notes

The shipped celestial UX is button-driven rather than a dropdown above each create form, but the product goal is met.

---

## 2. Infobox System Rework

**Status:** Not done

### What still matches the old problem

- Adding a new infobox type still requires touching multiple files.
- `WikiTemplate.svelte` still statically imports per-type infobox components.
- `detect.ts` still performs heuristic type detection.
- `registry.ts` still exists, but the lazy-loading path is not the one actually rendering infoboxes.

### What did not happen

- No `definitions/` directory of data-driven infobox schemas.
- No single `InfoboxRenderer.svelte`.
- No removal of heuristic detection.
- No collapse from many per-type Svelte components down to one generic renderer.

### Assessment

This item is still open almost exactly as written. Some related infobox work has happened elsewhere, but the architecture described here has not landed.

---

## 3. Celestial Editing (Currently Broken)

**Status:** Mostly done, with gaps

### What shipped

- The celestial detail route now supports both `/edit` and `/configure`.
- Stars have a dedicated configure screen.
- Planetary bodies have a dedicated configure screen.
- Those configure screens edit structured properties and article content together.
- The existing PUT APIs are actually used by the UI now.

### What shipped differently

- The work landed as `CelestialConfigureStar.svelte` and `CelestialConfigureBody.svelte`, not one `CelestialConfigure.svelte`.
- The configure screens also gained preset population from real-world celestial data, which was not part of the original request.

### What is still missing

- Systems do not get the same configure flow that stars and bodies get.
- The registry page still gives systems an `Edit` link rather than a true configure flow.
- The stretch-goal live infobox preview does not appear to exist.

### Assessment

The core complaint in this wishlist item was real and is no longer true for stars and bodies. Celestial editing is no longer "broken" in the old sense. The unfinished part is consistency: systems still lag behind, and the final UX is split rather than unified.
