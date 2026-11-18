const TONES = {
  home: {
    base: "radial-gradient(80% 60% at 50% 0%, rgba(216,168,96,0.12), transparent 65%), linear-gradient(180deg, #0d0b09 0%, #0a0908 55%, #070606 100%)",
    orbA: "rgba(216,168,96,0.20)",
    orbB: "rgba(122,84,48,0.16)",
  },
  memory: {
    base: "radial-gradient(75% 55% at 82% 0%, rgba(216,168,96,0.10), transparent 65%), linear-gradient(180deg, #0e0c0a 0%, #0b0a09 60%, #080706 100%)",
    orbA: "rgba(216,168,96,0.15)",
    orbB: "rgba(140,96,52,0.12)",
  },
  story: {
    base: "radial-gradient(70% 50% at 50% 0%, rgba(230,213,176,0.08), transparent 65%), linear-gradient(180deg, #0c0c11 0%, #0a090c 60%, #070608 100%)",
    orbA: "rgba(230,213,176,0.10)",
    orbB: "rgba(70,58,96,0.18)",
  },
};

const DUST = [
  { left: "10%", top: "72%", delay: "0s", duration: "12s", opacity: 0.35 },
  { left: "22%", top: "86%", delay: "3s", duration: "15s", opacity: 0.28 },
  { left: "35%", top: "64%", delay: "6s", duration: "11s", opacity: 0.4 },
  { left: "48%", top: "90%", delay: "1.5s", duration: "17s", opacity: 0.25 },
  { left: "58%", top: "70%", delay: "8s", duration: "13s", opacity: 0.35 },
  { left: "69%", top: "84%", delay: "4.5s", duration: "16s", opacity: 0.3 },
  { left: "79%", top: "66%", delay: "10s", duration: "12s", opacity: 0.38 },
  { left: "88%", top: "80%", delay: "2s", duration: "18s", opacity: 0.26 },
  { left: "44%", top: "78%", delay: "12s", duration: "14s", opacity: 0.32 },
];

// Pure CSS atmosphere: no hooks, no JS animation loops. Depth comes from
// layered gradients, two drifting light orbs, dust and a vignette.
export function PageAtmosphere({ tone = "home" }) {
  const palette = TONES[tone] ?? TONES.home;

  return (
    <div aria-hidden className="atmo">
      <div className="absolute inset-0" style={{ background: palette.base }} />
      <div
        className="atmo-orb atmo-orb-a"
        style={{
          width: "46vw",
          height: "46vw",
          left: "-12%",
          top: "-18%",
          background: palette.orbA,
        }}
      />
      <div
        className="atmo-orb atmo-orb-b"
        style={{
          width: "38vw",
          height: "38vw",
          right: "-10%",
          bottom: "-22%",
          background: palette.orbB,
        }}
      />
      {DUST.map((particle, index) => (
        <span
          key={index}
          className="dust"
          style={{
            left: particle.left,
            top: particle.top,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
            "--dust-o": particle.opacity,
          }}
        />
      ))}
      <div className="atmo-vignette" />
      <div className="afterimage-grain absolute inset-0" />
    </div>
  );
}