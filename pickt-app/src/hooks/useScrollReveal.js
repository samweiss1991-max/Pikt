import { useEffect, useRef } from 'react'

/**
 * Attaches an IntersectionObserver to the ref element.
 * Adds 'revealed' class when element enters viewport.
 * Options: threshold (0-1), rootMargin, once (boolean).
 */
export function useScrollReveal(options = {}) {
  const ref = useRef(null)
  const { threshold = 0.15, rootMargin = '0px 0px -40px 0px', once = true } = options

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed')
          if (once) observer.unobserve(el)
        } else if (!once) {
          el.classList.remove('revealed')
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return ref
}

/**
 * Observe multiple children of a container.
 * Each child with [data-reveal] gets 'revealed' class staggered.
 */
export function useStaggerReveal(options = {}) {
  const ref = useRef(null)
  const { threshold = 0.1, rootMargin = '0px 0px -30px 0px', staggerMs = 60 } = options

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const children = container.querySelectorAll('[data-reveal]')
    if (!children.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target
            const index = Array.from(children).indexOf(el)
            el.style.transitionDelay = `${index * staggerMs}ms`
            el.classList.add('revealed')
            observer.unobserve(el)
          }
        })
      },
      { threshold, rootMargin }
    )

    children.forEach(child => observer.observe(child))
    return () => observer.disconnect()
  }, [threshold, rootMargin, staggerMs])

  return ref
}
