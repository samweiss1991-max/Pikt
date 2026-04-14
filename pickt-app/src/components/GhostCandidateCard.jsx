// Skeleton placeholder card mimicking a real CandidateCard.
// Props: animationDelay (s), blur (px), opacity (0-1)

const SHIMMER_BG = '#eae9db' // cream-dark equivalent → surface-container-highest

function Bone({ width, height, radius, delay, style }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: SHIMMER_BG,
        animation: 'ghostShimmer 1.8s ease-in-out infinite',
        animationDelay: `${delay}s`,
        ...style,
      }}
    />
  )
}

export default function GhostCandidateCard({ animationDelay = 0, blur = 4, opacity = 0.6 }) {
  const d = animationDelay

  return (
    <>
      {/* Inline keyframes (scoped via animation-name) */}
      <style>{`
        @keyframes ghostShimmer {
          0%   { opacity: 0.5; }
          50%  { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>

      <div
        style={{
          borderRadius: 16,
          border: '1px solid var(--outline-variant)',
          background: 'var(--surface-container-lowest)',
          padding: 16,
          filter: `blur(${blur}px)`,
          opacity,
          transition: 'filter 0.4s ease, opacity 0.4s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Row 1 — Avatar + two stacked lines */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bone width={36} height={36} radius={10} delay={d} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Bone width="68%" height={14} radius={4} delay={d + 0.05} />
            <Bone width="50%" height={11} radius={4} delay={d + 0.1} />
          </div>
        </div>

        {/* Row 2 — Three pills */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          <Bone width={58} height={24} radius={99} delay={d + 0.15} />
          <Bone width={70} height={24} radius={99} delay={d + 0.2} />
          <Bone width={52} height={24} radius={99} delay={d + 0.25} />
        </div>

        {/* Row 3 — Full-width bar */}
        <div style={{ marginTop: 14 }}>
          <Bone width="100%" height={28} radius={8} delay={d + 0.3} />
        </div>

        {/* Row 4 — Three skill placeholders */}
        <div style={{ display: 'flex', gap: 5, marginTop: 14 }}>
          <Bone width={52} height={20} radius={5} delay={d + 0.35} />
          <Bone width={64} height={20} radius={5} delay={d + 0.4} />
          <Bone width={48} height={20} radius={5} delay={d + 0.45} />
        </div>

        {/* Row 5 — Footer (border-top) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 8,
            borderTop: '1px solid var(--outline-variant)',
          }}
        >
          <Bone width="40%" height={11} radius={4} delay={d + 0.5} />
          <Bone width="20%" height={11} radius={4} delay={d + 0.55} />
        </div>
      </div>
    </>
  )
}
