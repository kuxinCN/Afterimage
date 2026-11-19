// Presentation-only mapping from the story service's tone names to the app's
// cinematic palette. The tones themselves (warm/cool/ember/dusk/paper) come
// from INTENT_META / ENDING_META; this module never classifies anything.
export const TONE_STYLES = {
  warm: {
    text: "#e6c98f",
    border: "rgba(230, 201, 143, 0.4)",
    surface: "rgba(230, 201, 143, 0.08)",
    glow: "rgba(230, 201, 143, 0.28)",
  },
  cool: {
    text: "#9db4c9",
    border: "rgba(157, 180, 201, 0.4)",
    surface: "rgba(157, 180, 201, 0.08)",
    glow: "rgba(157, 180, 201, 0.26)",
  },
  ember: {
    text: "#d99a6c",
    border: "rgba(217, 154, 108, 0.42)",
    surface: "rgba(217, 154, 108, 0.08)",
    glow: "rgba(217, 154, 108, 0.28)",
  },
  dusk: {
    text: "#b3a1d1",
    border: "rgba(179, 161, 209, 0.4)",
    surface: "rgba(179, 161, 209, 0.08)",
    glow: "rgba(179, 161, 209, 0.26)",
  },
  paper: {
    text: "#c9c0b0",
    border: "rgba(201, 192, 176, 0.36)",
    surface: "rgba(201, 192, 176, 0.07)",
    glow: "rgba(201, 192, 176, 0.22)",
  },
};

export function toneStyle(tone) {
  return TONE_STYLES[tone] ?? TONE_STYLES.paper;
}