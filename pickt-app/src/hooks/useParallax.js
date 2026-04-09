import { useEffect, useRef } from 'react'

/**
 * Layered parallax: attach to a container, and all children with
 * data-parallax-speed="0.1" will drift at that fraction of scroll.
 *
 * Speed guide:
 *   0.05 = very subtle drift
 *   0.1  = clearly visible layering
 *   0.2  = dramatic depth
 *
 * Positive speed = element scrolls slower than page (recedes)
 * The offset is: scrollY * speed, applied as translateY
 */
export function useLayeredParallax() {
  const ref = useRef(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false

    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop
        const layers = container.querySelectorAll('[data-parallax-speed]')

        layers.forEach(layer => {
          const speed = parseFloat(layer.dataset.parallaxSpeed) || 0
          if (speed === 0) return
          // Element moves slower than scroll — creates depth
          const offset = -(scrollY * speed)
          layer.style.transform = `translateY(${offset}px)`
        })

        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll() // run once on mount

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return ref
}
