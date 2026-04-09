import { useCallback, useRef, useState } from "react";

/**
 * SwipeableCard — wraps a card with swipe-to-keep/remove gestures.
 * Used for shortlist review on mobile.
 *
 * Swipe right = keep (green indicator)
 * Swipe left = remove (red indicator)
 *
 * Props:
 *   onSwipeRight: () => void
 *   onSwipeLeft: () => void
 *   children: ReactNode
 *   threshold: number (default 100px)
 */

const SPRING_DAMPING = 0.6;
const VELOCITY_THRESHOLD = 0.5;

const s = {
  wrapper: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
    marginBottom: 14,
  },
  card: (translateX) => ({
    transform: `translateX(${translateX}px)`,
    transition: translateX === 0 ? "transform 0.3s cubic-bezier(.25,.1,.25,1)" : "none",
    position: "relative",
    zIndex: 2,
  }),
  indicator: (side, opacity) => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: Math.min(1, opacity),
    zIndex: 1,
    ...(side === "right"
      ? { left: 0, background: "var(--green-dim)" }
      : { right: 0, background: "var(--red-dim)" }
    ),
  }),
  indicatorIcon: (side) => ({
    fontSize: 24,
    color: side === "right" ? "var(--green)" : "var(--red)",
    fontWeight: 700,
  }),
};

export default function SwipeableCard({
  onSwipeRight,
  onSwipeLeft,
  children,
  threshold = 100,
}) {
  const [translateX, setTranslateX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startTime = useRef(0);

  const handlePointerDown = useCallback((e) => {
    setDragging(true);
    startX.current = e.clientX;
    startTime.current = Date.now();
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    setTranslateX(e.clientX - startX.current);
  }, [dragging]);

  const handlePointerUp = useCallback((e) => {
    if (!dragging) return;
    setDragging(false);

    const dx = e.clientX - startX.current;
    const dt = (Date.now() - startTime.current) / 1000;
    const velocity = Math.abs(dx / dt);

    // Velocity-based or distance-based trigger
    const triggered = Math.abs(dx) > threshold || velocity > VELOCITY_THRESHOLD * 1000;

    if (triggered && dx > 0) {
      onSwipeRight?.();
    } else if (triggered && dx < 0) {
      onSwipeLeft?.();
    }

    // Spring return
    setTranslateX(0);
  }, [dragging, threshold, onSwipeRight, onSwipeLeft]);

  const rightOpacity = Math.max(0, translateX / threshold);
  const leftOpacity = Math.max(0, -translateX / threshold);

  return (
    <div style={s.wrapper}>
      {/* Background indicators */}
      {translateX > 10 && (
        <div style={s.indicator("right", rightOpacity)}>
          <span style={s.indicatorIcon("right")}>&#10003;</span>
        </div>
      )}
      {translateX < -10 && (
        <div style={s.indicator("left", leftOpacity)}>
          <span style={s.indicatorIcon("left")}>&#10007;</span>
        </div>
      )}

      {/* Card */}
      <div
        style={s.card(translateX)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {children}
      </div>
    </div>
  );
}
