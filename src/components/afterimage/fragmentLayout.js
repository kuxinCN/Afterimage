// C-side integration projection for A's MemorySpace.
//
// A's fragments are large fixed-pixel cards (96px wide, ~150px tall with label).
// C's scene templates pack up to 24 hotspots into rows whose far spacing can be
// as tight as 4%, which is fine for C's 3.4% markers but makes A's cards overlap.
// A's own 8 scatter slots are only used when a fragment has no position, and C
// always supplies one, so the scatter fallback never rescues dense C data.
//
// Rather than edit A's core (kept verbatim), the bridge re-projects hotspot
// positions onto a coarse, count-aware grid and shrinks the cards with the
// --ms-scale variable A already exposes. Geometry stays pure here so it can be
// tested without a DOM; the pixel fit is confirmed in a real browser.

const MAX_COLUMNS = 3;
const X_RANGE = [0.14, 0.86];
const Y_RANGE = [0.14, 0.86];
const DENSE_THRESHOLD = 8;

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Evenly spaced grid, each row centred, returned in C's normalised 0~1 space so
// A's adapter still does the single ×100 conversion. Never reuses a slot: every
// index gets a distinct cell, so >8 fragments cannot stack on the 8 scatter slots.
export function gridSlots(count) {
  const total = Math.max(0, Math.floor(count));
  if (total === 0) {
    return [];
  }

  const columns = Math.min(MAX_COLUMNS, total);
  const rows = Math.ceil(total / columns);
  const stepX = columns === 1 ? 0 : (X_RANGE[1] - X_RANGE[0]) / (columns - 1);
  const stepY = rows === 1 ? 0 : (Y_RANGE[1] - Y_RANGE[0]) / (rows - 1);
  const slots = [];

  for (let index = 0; index < total; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const itemsInRow = Math.min(columns, total - row * columns);
    const rowStartX = 0.5 - ((itemsInRow - 1) * stepX) / 2;

    slots.push({
      x: round(columns === 1 ? 0.5 : rowStartX + column * stepX),
      y: round(rows === 1 ? 0.5 : Y_RANGE[0] + row * stepY),
    });
  }

  return slots;
}

// Cards shrink as the scene grows so a 3-column grid keeps a clear gap even on a
// narrow phone. Floor 0.4 keeps icons legible at the 24-hotspot ceiling.
export function fragmentScale(count) {
  const total = Math.max(1, Math.floor(count) || 1);
  return round(clamp(Math.sqrt(4.5 / total), 0.4, 0.9));
}

export function isDenseLayout(count) {
  return (Math.floor(count) || 0) > DENSE_THRESHOLD;
}

// Replace only position; id / name / description / sourceType / sourceIds and
// every other hotspot field pass through untouched so provenance is preserved.
export function projectScene(scene) {
  if (!scene || !Array.isArray(scene.hotspots)) {
    return scene ?? null;
  }

  const slots = gridSlots(scene.hotspots.length);

  return {
    ...scene,
    hotspots: scene.hotspots.map((hotspot, index) => ({
      ...hotspot,
      position: slots[index],
    })),
  };
}