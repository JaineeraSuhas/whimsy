'use client';

import React, { useRef, useEffect } from 'react';

interface InfiniteCanvasProps {
  children: React.ReactNode;
  scrollSpeed?: number;
  dragSpeed?: number;
  ease?: number;
  enableDrag?: boolean;
  parallaxEnabled?: boolean;
  parallaxIntensity?: number;
}

export default function InfiniteCanvas({
  children,
  scrollSpeed = 0.4,
  dragSpeed = 0.5,
  ease = 0.3,
  enableDrag = true,
  parallaxEnabled = true,
  parallaxIntensity = 1.0,
}: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  // Smooth scroll and physics state
  const scroll = useRef({
    current: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
    last: { x: 0, y: 0 },
    deltaSmooth: { x: 0, y: 0 },
  });

  // Mouse/Touch tracking for inertia and parallax
  const mouse = useRef({
    current: { x: 0.5, y: 0.5 },
    target: { x: 0.5, y: 0.5 },
  });

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 });
  const dimensions = useRef({ parentW: 0, parentH: 0 });

  // Cached DOM elements and coordinates
  const itemsRef = useRef<{
    baseX: number;
    baseY: number;
    width: number;
    height: number;
    extraX: number[];
    extraY: number[];
    ease: number;
    domElements: HTMLDivElement[];
  }[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const parent = container.parentElement;
    if (!parent) return;

    const init = () => {
      const parentRect = parent.getBoundingClientRect();
      const parentW = parentRect.width;
      const parentH = parentRect.height;
      dimensions.current = { parentW, parentH };

      // Query all rendered copies
      const instanceEls = container.querySelectorAll<HTMLDivElement>('.infinite-instance');
      
      // Group instance elements by child index
      const itemsMap: { [key: number]: HTMLDivElement[] } = {};
      instanceEls.forEach((el) => {
        const idx = parseInt(el.getAttribute('data-index') || '0', 10);
        const copyIdx = parseInt(el.getAttribute('data-copy') || '0', 10);
        if (!itemsMap[idx]) itemsMap[idx] = [];
        itemsMap[idx][copyIdx] = el;
      });

      const parsedItems: typeof itemsRef.current = [];

      Object.keys(itemsMap).forEach((key) => {
        const idx = parseInt(key, 10);
        const copies = itemsMap[idx];
        const firstCopy = copies[0];
        if (!firstCopy) return;

        // Measure bounding dimensions
        const rect = firstCopy.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        const baseX = rect.left - parentRect.left;
        const baseY = rect.top - parentRect.top;

        // Reset copies inline properties to avoid double-translation
        copies.forEach((copy) => {
          if (!copy) return;
          copy.style.position = 'absolute';
          copy.style.left = '0px';
          copy.style.top = '0px';
          copy.style.width = `${width}px`;
          copy.style.height = `${height}px`;
          copy.style.margin = '0px';
          copy.style.willChange = 'transform';
        });

        parsedItems.push({
          baseX,
          baseY,
          width,
          height,
          extraX: [0, 0, 0, 0],
          extraY: [0, 0, 0, 0],
          ease: Math.random() * 0.4 + 0.6,
          domElements: copies,
        });
      });

      itemsRef.current = parsedItems;
    };

    // Initialize layout after Next.js mount/paint delay
    const timer = setTimeout(init, 200);

    // Track resize
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        init();
      });
      resizeObserver.observe(parent);
    }

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [children]);

  // Event handlers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const parent = container.parentElement;
    if (!parent) return;

    // Wheel navigation (pan)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      scroll.current.target.x -= e.deltaX * scrollSpeed;
      scroll.current.target.y -= e.deltaY * scrollSpeed;
    };

    // Drag start
    const handleMouseDown = (e: MouseEvent) => {
      if (!enableDrag) return;
      isDragging.current = true;
      parent.style.cursor = 'grabbing';
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        scrollX: scroll.current.target.x,
        scrollY: scroll.current.target.y,
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Track normal mouse position for parallax
      const parentRect = parent.getBoundingClientRect();
      mouse.current.target.x = (e.clientX - parentRect.left) / parentRect.width;
      mouse.current.target.y = (e.clientY - parentRect.top) / parentRect.height;

      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      scroll.current.target.x = dragStart.current.scrollX + dx * dragSpeed;
      scroll.current.target.y = dragStart.current.scrollY + dy * dragSpeed;
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      parent.style.cursor = 'grab';
    };

    // Touch support for mobile
    const handleTouchStart = (e: TouchEvent) => {
      if (!enableDrag || e.touches.length !== 1) return;
      const touch = e.touches[0];
      isDragging.current = true;
      dragStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        scrollX: scroll.current.target.x,
        scrollY: scroll.current.target.y,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.current.x;
      const dy = touch.clientY - dragStart.current.y;
      scroll.current.target.x = dragStart.current.scrollX + dx * dragSpeed;
      scroll.current.target.y = dragStart.current.scrollY + dy * dragSpeed;
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
    };

    parent.style.cursor = 'grab';
    parent.addEventListener('wheel', handleWheel, { passive: false });
    parent.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    parent.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      parent.style.cursor = '';
      parent.removeEventListener('wheel', handleWheel);
      parent.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      parent.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enableDrag, scrollSpeed, dragSpeed]);

  // Animation render loop
  useEffect(() => {
    const render = () => {
      // Interpolate position with ease
      const s = scroll.current;
      s.current.x += (s.target.x - s.current.x) * ease;
      s.current.y += (s.target.y - s.current.y) * ease;

      const deltaX = s.current.x - s.last.x;
      const deltaY = s.current.y - s.last.y;

      s.deltaSmooth.x += (deltaX - s.deltaSmooth.x) * 0.04;
      s.deltaSmooth.y += (deltaY - s.deltaSmooth.y) * 0.04;

      mouse.current.current.x += (mouse.current.target.x - mouse.current.current.x) * 0.08;
      mouse.current.current.y += (mouse.current.target.y - mouse.current.current.y) * 0.08;

      const parentW = dimensions.current.parentW;
      const parentH = dimensions.current.parentH;
      const tileW = parentW * 2;
      const tileH = parentH * 2;

      const dirX = s.current.x > s.last.x ? 'right' : 'left';
      const dirY = s.current.y > s.last.y ? 'down' : 'up';

      itemsRef.current.forEach((item) => {
        // Apply parallax offsets
        const pM = parallaxEnabled ? parallaxIntensity : 0;
        const pxParallax = 5 * s.deltaSmooth.x * item.ease + (mouse.current.current.x - 0.5) * item.width * 0.1 * pM;
        const pyParallax = 5 * s.deltaSmooth.y * item.ease + (mouse.current.current.y - 0.5) * item.height * 0.1 * pM;

        for (let copyIdx = 0; copyIdx < 4; copyIdx++) {
          const gridX = copyIdx % 2;
          const gridY = Math.floor(copyIdx / 2);

          const offsetX = gridX * parentW;
          const offsetY = gridY * parentH;

          // Compute raw coordinate
          let posX = item.baseX + offsetX + s.current.x + item.extraX[copyIdx] + pxParallax;
          let posY = item.baseY + offsetY + s.current.y + item.extraY[copyIdx] + pyParallax;

          // Wrapping logic: wrap if elements go outside 2x tile boundary
          if (dirX === 'right') {
            while (posX > parentW) {
              item.extraX[copyIdx] -= tileW;
              posX -= tileW;
            }
          } else {
            while (posX + item.width < 0) {
              item.extraX[copyIdx] += tileW;
              posX += tileW;
            }
          }

          if (dirY === 'down') {
            while (posY > parentH) {
              item.extraY[copyIdx] -= tileH;
              posY -= tileH;
            }
          } else {
            while (posY + item.height < 0) {
              item.extraY[copyIdx] += tileH;
              posY += tileH;
            }
          }

          const el = item.domElements[copyIdx];
          if (el) {
            el.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;

            // Vis check (plus a safe 200px buffer)
            const isVisible = (
              posX >= -item.width - 200 &&
              posX <= parentW + 200 &&
              posY >= -item.height - 200 &&
              posY <= parentH + 200
            );

            el.style.opacity = isVisible ? '1' : '0';
            el.style.pointerEvents = isVisible ? 'auto' : 'none';
          }
        }
      });

      s.last.x = s.current.x;
      s.last.y = s.current.y;
    };

    const loop = () => {
      render();
      rafId.current = requestAnimationFrame(loop);
    };

    rafId.current = requestAnimationFrame(loop);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [ease, parallaxEnabled, parallaxIntensity]);

  const childArray = React.Children.toArray(children);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none pointer-events-none overflow-visible"
      style={{
        transform: 'translateZ(0)',
        transformStyle: 'flat',
      }}
    >
      {childArray.map((child, idx) => (
        <div key={idx} className="infinite-group absolute inset-0 pointer-events-none">
          {[0, 1, 2, 3].map((copyIdx) => (
            <div
              key={copyIdx}
              className="infinite-instance absolute pointer-events-auto"
              data-index={idx}
              data-copy={copyIdx}
            >
              {child}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
