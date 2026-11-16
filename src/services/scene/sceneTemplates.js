import { SCENE_TYPES, SCENE_TYPE_LIST } from "@/lib/constants";

// Rows above the first threshold read as "far away", rows below the second as
// "close to the viewer". Everything between is the middle ground.
export const SCENE_DEPTH_THRESHOLDS = { far: 0.4, mid: 0.7 };

export const SCENE_DEPTH_BANDS = {
  far: { scale: 0.82, zIndex: 10, opacity: 0.72 },
  mid: { scale: 1, zIndex: 20, opacity: 0.9 },
  near: { scale: 1.18, zIndex: 30, opacity: 1 },
};

const VISITED_OPACITY_FACTOR = 0.5;

// Offsets from the horizontal centre. Negative is left, positive is right, so
// every row stays symmetric around the vanishing point.
const SLOT_COLUMN_OFFSETS = [-1, -0.6, -0.2, 0.2, 0.6, 1];

const TEMPLATE_LAYOUTS = {
  [SCENE_TYPES.CAFETERIA]: { rows: [0.3, 0.46, 0.63, 0.82], farHalfWidth: 0.16, nearHalfWidth: 0.4 },
  [SCENE_TYPES.CLASSROOM]: { rows: [0.28, 0.44, 0.62, 0.82], farHalfWidth: 0.14, nearHalfWidth: 0.42 },
  [SCENE_TYPES.BEDROOM]: { rows: [0.34, 0.5, 0.66, 0.84], farHalfWidth: 0.18, nearHalfWidth: 0.38 },
  [SCENE_TYPES.STREET]: { rows: [0.24, 0.42, 0.62, 0.84], farHalfWidth: 0.1, nearHalfWidth: 0.44 },
  [SCENE_TYPES.OUTDOOR]: { rows: [0.3, 0.48, 0.66, 0.86], farHalfWidth: 0.2, nearHalfWidth: 0.42 },
  [SCENE_TYPES.GENERIC]: { rows: [0.32, 0.48, 0.64, 0.82], farHalfWidth: 0.18, nearHalfWidth: 0.4 },
};

function round(value) {
  return Math.round(value * 10000) / 10000;
}

// Rows widen towards the viewer, which is what makes a flat grid read as depth.
function buildSlots({ rows, farHalfWidth, nearHalfWidth }) {
  return rows.flatMap((y, rowIndex) => {
    const progress = rowIndex / (rows.length - 1);
    const halfWidth = farHalfWidth + (nearHalfWidth - farHalfWidth) * progress;

    return SLOT_COLUMN_OFFSETS.map((offset) => ({
      x: round(0.5 + offset * halfWidth),
      y,
    }));
  });
}

export const SCENE_TEMPLATE_SLOTS = Object.fromEntries(
  Object.entries(TEMPLATE_LAYOUTS).map(([type, layout]) => [type, buildSlots(layout)]),
);

export const SCENE_SLOT_COUNT = SLOT_COLUMN_OFFSETS.length * TEMPLATE_LAYOUTS[SCENE_TYPES.GENERIC].rows.length;

export function resolveTemplate(sceneType) {
  return SCENE_TYPE_LIST.includes(sceneType) ? sceneType : SCENE_TYPES.GENERIC;
}

export function templateSlots(sceneType) {
  return SCENE_TEMPLATE_SLOTS[resolveTemplate(sceneType)];
}

export function depthBandFor(y) {
  if (y < SCENE_DEPTH_THRESHOLDS.far) {
    return "far";
  }
  if (y <= SCENE_DEPTH_THRESHOLDS.mid) {
    return "mid";
  }

  return "near";
}

// Geometry only: the caller decides how to paint it. Keeping this out of React
// is what lets the layout be tested without a DOM.
export function hotspotLayout(position, { visited = false } = {}) {
  const band = SCENE_DEPTH_BANDS[depthBandFor(position.y)];

  return {
    left: `${round(position.x * 100)}%`,
    top: `${round(position.y * 100)}%`,
    transform: `translate(-50%, -50%) scale(${band.scale})`,
    zIndex: band.zIndex,
    opacity: visited ? round(band.opacity * VISITED_OPACITY_FACTOR) : band.opacity,
  };
}

// FNV-1a: a stable id derived from the wording, so regenerating a scene keeps
// the exploration history pointing at the same hotspot.
export function hotspotIdFor(value) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `hs-${hash.toString(16).padStart(8, "0")}`;
}

export function assignHotspotIds(values) {
  const used = new Set();

  return values.map((value, index) => {
    const base = hotspotIdFor(value);
    let id = base;
    let suffix = index;

    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }

    used.add(id);

    return id;
  });
}