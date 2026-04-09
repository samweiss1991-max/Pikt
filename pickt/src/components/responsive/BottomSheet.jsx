import { useCallback, useEffect, useRef, useState } from "react";

/**
 * BottomSheet — mobile modal replacement.
 * Animates up from bottom with drag handle.
 *
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   children: ReactNode
 *   maxHeight: string (default '85vh')
 */

const s = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    background: "rgba(26,32,16,.45)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },
  sheet: (translateY) => ({
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "var(--surface)",
    borderRadius: "20px 20px 0 0",
    boxShadow: "0 -8px 32px rgba(0,0,0,.15)",
    zIndex: 51,
    maxHeight: "85vh",
    overflowY: "auto",
    transform: `translateY(${translateY}px)`,
    transition: translateY === 0 ? "transform 0.3s ease" : "none",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  }),
  dragHandle: {
    width: 32,
    height: 4,
    borderRadius: 99,
    background: "var(--border2)",
    margin: "10px auto 8px",
    cursor: "grab",
  },
  content: {
    padding: "0 20px 20px",
  },
};

export default function BottomSheet({ isOpen, onClose, children, maxHeight }) {
  const [translateY, setTranslateY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const sheetRef = useRef(null);

  // Animate in
  useEffect(() => {
    if (isOpen) setTranslateY(0);
  }, [isOpen]);

  function handlePointerDown(e) {
    setDragging(true);
    startY.current = e.clientY;
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    const dy = Math.max(0, e.clientY - startY.current);
    setTranslateY(dy);
  }

  function handlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (translateY > 120) {
      onClose();
    } else {
      setTranslateY(0);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div style={s.backdrop} onClick={onClose} />
      <div
        ref={sheetRef}
        style={{
          ...s.sheet(translateY),
          maxHeight: maxHeight || "85vh",
        }}
      >
        <div
          style={s.dragHandle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        <div style={s.content}>
          {children}
        </div>
      </div>
    </>
  );
}
