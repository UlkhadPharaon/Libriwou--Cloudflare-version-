import { useEffect, useState } from 'react';

/**
 * Motion preference hook (Phase 6.2).
 *
 * Returns true when entrance/transition animations should be reduced, i.e. when:
 *  - the OS reports `prefers-reduced-motion: reduce`, or
 *  - the viewport is a small/touch screen (mobile), where the staggered Framer Motion
 *    animations were measured as the main source of long tasks.
 *
 * On desktop with no preference, animations stay exactly as before.
 */
export function useMotionPreference(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)');

    const evaluate = () => setReduce(reduceMotionQuery.matches || mobileQuery.matches);

    evaluate();
    // Safari < 14 only supports the deprecated listener API.
    if (reduceMotionQuery.addEventListener) {
      reduceMotionQuery.addEventListener('change', evaluate);
      mobileQuery.addEventListener('change', evaluate);
    } else {
      reduceMotionQuery.addListener(evaluate);
      mobileQuery.addListener(evaluate);
    }

    return () => {
      if (reduceMotionQuery.removeEventListener) {
        reduceMotionQuery.removeEventListener('change', evaluate);
        mobileQuery.removeEventListener('change', evaluate);
      } else {
        reduceMotionQuery.removeListener(evaluate);
        mobileQuery.removeListener(evaluate);
      }
    };
  }, []);

  return reduce;
}
