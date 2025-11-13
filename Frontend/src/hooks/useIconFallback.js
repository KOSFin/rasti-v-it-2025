import { useEffect, useRef, useState } from 'react';

const isTransparent = (value) => {
  if (!value) {
    return true;
  }
  const normalized = value.toLowerCase();
  return normalized === 'none' || normalized.includes('rgba(0, 0, 0, 0)') || normalized.includes('transparent');
};

const measureSvg = (container) => {
  if (!container) {
    return { hasVisibleSvg: false };
  }

  const svg = container.querySelector('svg');
  if (!svg) {
    return { hasVisibleSvg: false };
  }

  const rect = svg.getBoundingClientRect();
  const hasArea = rect.width > 2 && rect.height > 2;

  const computed = window.getComputedStyle(svg);
  const invisibleStroke = isTransparent(computed.stroke) && isTransparent(computed.fill);

  return {
    hasVisibleSvg: hasArea && !invisibleStroke,
  };
};

const useIconFallback = (...deps) => {
  const ref = useRef(null);
  const [shouldFallback, setShouldFallback] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const evaluate = () => {
      const { hasVisibleSvg } = measureSvg(ref.current);
      setShouldFallback(!hasVisibleSvg);
    };

    const frameId = window.requestAnimationFrame(evaluate);
    window.addEventListener('resize', evaluate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', evaluate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [ref, shouldFallback];
};

export default useIconFallback;
