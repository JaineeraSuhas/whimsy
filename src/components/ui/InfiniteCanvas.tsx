import React, { useEffect, useRef, ReactNode } from "react";

function mapLinear(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function mapSpeedUiToInternal(ui: number) {
  const clamped = Math.max(0.1, Math.min(1, ui));
  return mapLinear(clamped, 0.1, 1, 0.1, 2);
}

function mapEaseUiToInternal(ui: number) {
  const clamped = Math.max(0, Math.min(1, ui));
  return mapLinear(clamped, 0, 1, 0.01, 0.2);
}

export interface InfiniteCanvasProps {
  children: ReactNode;
  scrollSpeed?: number;
  dragSpeed?: number;
  ease?: number;
  enableDrag?: boolean;
  parallaxEnabled?: boolean;
  parallaxIntensity?: number;
  className?: string;
  contentWidth?: number;
  contentHeight?: number;
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  children,
  scrollSpeed = 0.4,
  dragSpeed = 0.5,
  ease = 0.3,
  enableDrag = true,
  parallaxEnabled = true,
  parallaxIntensity = 1,
  className = "",
  contentWidth,
  contentHeight,
}) => {
  const internalScrollSpeed = mapSpeedUiToInternal(scrollSpeed);
  const internalDragSpeed = mapSpeedUiToInternal(dragSpeed);
  const internalEase = mapEaseUiToInternal(ease);

  const containerRef = useRef<HTMLDivElement>(null);
  const elementGroupsRef = useRef<any[]>([]);

  const scroll = useRef({
    ease: internalEase,
    current: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
    last: { x: 0, y: 0 },
    delta: { x: { c: 0, t: 0 }, y: { c: 0, t: 0 } },
  });

  const isDragging = useRef(false);
  const drag = useRef({ startX: 0, startY: 0, scrollX: 0, scrollY: 0 });
  const mouse = useRef({ x: { t: 0.5, c: 0.5 }, y: { t: 0.5, c: 0.5 }, press: { t: 0, c: 0 } });

  const winW = useRef(typeof window !== "undefined" ? window.innerWidth : 1920);
  const winH = useRef(typeof window !== "undefined" ? window.innerHeight : 1080);
  const parentDimensions = useRef({ width: 0, height: 0, tileSizeW: 0, tileSizeH: 0 });

  const rafId = useRef<number | null>(null);
  const resizeTimeoutId = useRef<number | null>(null);

  const initializeInfiniteCanvas = (parentElement: HTMLElement) => {
    if (typeof window !== "undefined") {
      winW.current = window.innerWidth;
      winH.current = window.innerHeight;
    }

    const parentRect = parentElement.getBoundingClientRect();

    // Find all direct children ignoring previous clones
    const baseChildren = Array.from(parentElement.children).filter(
      (c) => (c as HTMLElement).dataset.isClone !== "true"
    );

    // Dynamic bounding box calc to support seamless loop over varied content scales
    let contentMaxX = parentRect.width;
    let contentMaxY = parentRect.height;

    baseChildren.forEach((child) => {
      const rect = child.getBoundingClientRect();
      const right = rect.right - parentRect.left;
      const bottom = rect.bottom - parentRect.top;
      if (right > contentMaxX) contentMaxX = right;
      if (bottom > contentMaxY) contentMaxY = bottom;
    });

    const parentWidth = contentWidth ? contentWidth : Math.max(parentRect.width, contentMaxX);
    const parentHeight = contentHeight ? contentHeight : Math.max(parentRect.height, contentMaxY);

    const repsX = [-parentWidth, 0, parentWidth];
    const repsY = [-parentHeight, 0, parentHeight];

    elementGroupsRef.current = [];

    baseChildren.forEach((baseChild: Element) => {
      const htmlChild = baseChild as HTMLElement;
      
      // Step 1: Capture precise position bounds (this bakes any % transforms into absolute rect coords)
      const rect = htmlChild.getBoundingClientRect();
      const baseX = rect.left - parentRect.left;
      const baseY = rect.top - parentRect.top;
      const width = rect.width;
      const height = rect.height;

      // Random weight to use for parallax multiplier later
      const elementEase = Math.random() * 0.5 + 0.5;

      const clones: HTMLElement[] = [];
      const positions: any[] = [];

      const originalStyles = {
        position: htmlChild.style.position,
        left: htmlChild.style.left,
        top: htmlChild.style.top,
        width: htmlChild.style.width,
        height: htmlChild.style.height,
        margin: htmlChild.style.margin,
        transform: htmlChild.style.transform,
      };

      // Create 8 identical clones per item to build a 3x3 quadrant block
      for (let i = 0; i < 8; i++) {
        const clone = htmlChild.cloneNode(true) as HTMLElement;
        clone.dataset.isClone = "true";
        parentElement.appendChild(clone);

        clone.style.position = "absolute";
        clone.style.left = "0px";
        clone.style.top = "0px";
        clone.style.width = `${width}px`;
        clone.style.height = `${height}px`;
        clone.style.margin = "0";
        clone.style.willChange = "transform";
        clone.style.backfaceVisibility = "hidden";
        clone.style.userSelect = "none";

        clones.push(clone);
      }

      // Step 2: Absolute Normalization for the base React element
      htmlChild.style.position = "absolute";
      htmlChild.style.left = "0px";
      htmlChild.style.top = "0px";
      htmlChild.style.width = `${width}px`;
      htmlChild.style.height = `${height}px`;
      htmlChild.style.margin = "0";
      htmlChild.style.willChange = "transform";
      htmlChild.style.backfaceVisibility = "hidden";
      htmlChild.style.userSelect = "none";

      repsX.forEach((offsetX) => {
        repsY.forEach((offsetY) => {
          positions.push({
            x: baseX + offsetX,
            y: baseY + offsetY,
            width,
            height,
            extraX: 0,
            extraY: 0,
            ease: elementEase,
            baseElement: htmlChild,
          });
        });
      });

      elementGroupsRef.current.push({
        baseElement: htmlChild,
        realElement: htmlChild,
        clones,
        positions,
        lastActiveIndex: -1,
        originalStyles,
      });
    });

    scroll.current.current = { x: 0, y: 0 };
    scroll.current.target = { x: 0, y: 0 };
    scroll.current.last = { x: 0, y: 0 };

    const tileSizeW = parentWidth * 3;
    const tileSizeH = parentHeight * 3;
    parentDimensions.current = { width: parentWidth, height: parentHeight, tileSizeW, tileSizeH };
  };

  const cleanupInfiniteCanvas = () => {
    elementGroupsRef.current.forEach((group) => {
      group.clones.forEach((clone: HTMLElement) => {
        if (clone.parentNode) {
          clone.parentNode.removeChild(clone);
        }
      });

      const el = group.realElement;
      el.style.position = group.originalStyles.position;
      el.style.left = group.originalStyles.left;
      el.style.top = group.originalStyles.top;
      el.style.width = group.originalStyles.width;
      el.style.height = group.originalStyles.height;
      el.style.margin = group.originalStyles.margin;
      el.style.transform = group.originalStyles.transform;
      el.style.willChange = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
      const firstChild = el.firstElementChild as HTMLElement;
      if (firstChild) firstChild.style.transform = "";
    });
    elementGroupsRef.current = [];
  };

  useEffect(() => {
    const parentElement = containerRef.current;
    if (!parentElement) return;

    // Small delay ensures child layout metrics are fully computed by the browser
    const initTimer = setTimeout(() => {
      initializeInfiniteCanvas(parentElement);
    }, 100);

    const handleWindowResize = () => {
      if (typeof window !== "undefined") {
        winW.current = window.innerWidth;
        winH.current = window.innerHeight;
      }
    };

    const handleParentResize = () => {
      if (resizeTimeoutId.current !== null) {
        clearTimeout(resizeTimeoutId.current);
      }
      resizeTimeoutId.current = window.setTimeout(() => {
        if (parentElement) {
          cleanupInfiniteCanvas();
          initializeInfiniteCanvas(parentElement);
        }
        resizeTimeoutId.current = null;
      }, 100);
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleParentResize);
      resizeObserver.observe(parentElement);
    }
    window.addEventListener("resize", handleWindowResize);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener("resize", handleWindowResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeTimeoutId.current !== null) {
        clearTimeout(resizeTimeoutId.current);
      }
      cleanupInfiniteCanvas();
    };
  }, [children]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      scroll.current.target.x -= e.deltaX * internalScrollSpeed;
      scroll.current.target.y -= e.deltaY * internalScrollSpeed;
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [internalScrollSpeed]);

  useEffect(() => {
    const parentElement = containerRef.current;
    if (!parentElement || !enableDrag) return;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      document.documentElement.classList.add("dragging");
      mouse.current.press.t = 1;
      drag.current.startX = e.clientX;
      drag.current.startY = e.clientY;
      drag.current.scrollX = scroll.current.target.x;
      drag.current.scrollY = scroll.current.target.y;
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.documentElement.classList.remove("dragging");
      mouse.current.press.t = 0;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x.t = e.clientX / winW.current;
      mouse.current.y.t = e.clientY / winH.current;

      if (isDragging.current) {
        const dx = e.clientX - drag.current.startX;
        const dy = e.clientY - drag.current.startY;
        scroll.current.target.x = drag.current.scrollX + dx * internalDragSpeed;
        scroll.current.target.y = drag.current.scrollY + dy * internalDragSpeed;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        isDragging.current = true;
        mouse.current.press.t = 1;
        drag.current.startX = touch.clientX;
        drag.current.startY = touch.clientY;
        drag.current.scrollX = scroll.current.target.x;
        drag.current.scrollY = scroll.current.target.y;
      }
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
      mouse.current.press.t = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDragging.current) {
        e.preventDefault();
        const touch = e.touches[0];
        mouse.current.x.t = touch.clientX / winW.current;
        mouse.current.y.t = touch.clientY / winH.current;
        const dx = touch.clientX - drag.current.startX;
        const dy = touch.clientY - drag.current.startY;
        scroll.current.target.x = drag.current.scrollX + dx * internalDragSpeed;
        scroll.current.target.y = drag.current.scrollY + dy * internalDragSpeed;
      }
    };

    parentElement.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    parentElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      parentElement.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      parentElement.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [enableDrag, internalDragSpeed]);

  useEffect(() => {
    scroll.current.ease = internalEase;
  }, [internalEase]);

  const render = () => {
    scroll.current.current.x += (scroll.current.target.x - scroll.current.current.x) * scroll.current.ease;
    scroll.current.current.y += (scroll.current.target.y - scroll.current.current.y) * scroll.current.ease;

    scroll.current.delta.x.t = scroll.current.current.x - scroll.current.last.x;
    scroll.current.delta.y.t = scroll.current.current.y - scroll.current.last.y;
    scroll.current.delta.x.c += (scroll.current.delta.x.t - scroll.current.delta.x.c) * 0.04;
    scroll.current.delta.y.c += (scroll.current.delta.y.t - scroll.current.delta.y.c) * 0.04;

    mouse.current.x.c += (mouse.current.x.t - mouse.current.x.c) * 0.04;
    mouse.current.y.c += (mouse.current.y.t - mouse.current.y.c) * 0.04;
    mouse.current.press.c += (mouse.current.press.t - mouse.current.press.c) * 0.04;

    const dirX = scroll.current.current.x > scroll.current.last.x ? "right" : "left";
    const dirY = scroll.current.current.y > scroll.current.last.y ? "down" : "up";
    const scrollX = scroll.current.current.x;
    const scrollY = scroll.current.current.y;

    const parentW = parentDimensions.current.width;
    const parentH = parentDimensions.current.height;
    const tileW = parentDimensions.current.tileSizeW;
    const tileH = parentDimensions.current.tileSizeH;

    const centerX = winW.current / 2;
    const centerY = winH.current / 2;
    const mousePX = mouse.current.x.t * winW.current;
    const mousePY = mouse.current.y.t * winH.current;

    const parentElement = containerRef.current;
    if (!parentElement) return;
    const parentRect = parentElement.getBoundingClientRect();
    const mouseRelX = mousePX - parentRect.left;
    const mouseRelY = mousePY - parentRect.top;

    elementGroupsRef.current.forEach((group) => {
      const calculatedPositions: any[] = [];

      group.positions.forEach((item: any) => {
        const parallaxMultiplier = parallaxEnabled ? parallaxIntensity : 0;
        const parallaxX = 5 * scroll.current.delta.x.c * item.ease + (mouse.current.x.c - 0.5) * item.width * 0.6 * parallaxMultiplier;
        const parallaxY = 5 * scroll.current.delta.y.c * item.ease + (mouse.current.y.c - 0.5) * item.height * 0.6 * parallaxMultiplier;

        const rawX = item.x + scrollX;
        const rawY = item.y + scrollY;

        const wrap = (min: number, max: number, v: number) => {
          const range = max - min;
          return ((((v - min) % range) + range) % range) + min;
        };

        const finalX = wrap(-parentW, 2 * parentW, rawX) + parallaxX;
        const finalY = wrap(-parentH, 2 * parentH, rawY) + parallaxY;

        const absFinalX = finalX + parentRect.left;
        const absFinalY = finalY + parentRect.top;
        const cx = absFinalX + item.width / 2;
        const cy = absFinalY + item.height / 2;

        const distToCenter = Math.pow(cx - centerX, 2) + Math.pow(cy - centerY, 2);
        const distToMouse = Math.pow(cx - mousePX, 2) + Math.pow(cy - mousePY, 2);

        // Viewport Culling buffer
        const buffer = 500;
        const isVisible =
          absFinalX >= -item.width - buffer &&
          absFinalX <= winW.current + buffer &&
          absFinalY >= -item.height - buffer &&
          absFinalY <= winH.current + buffer;

        calculatedPositions.push({ item, finalX, finalY, distToCenter, distToMouse, isVisible });
      });

      let bestIndex = -1;
      let minMouseDist = Infinity;

      for (let i = 0; i < calculatedPositions.length; i++) {
        const p = calculatedPositions[i];
        if (
          mouseRelX >= p.finalX &&
          mouseRelX <= p.finalX + p.item.width &&
          mouseRelY >= p.finalY &&
          mouseRelY <= p.finalY + p.item.height
        ) {
          if (p.distToMouse < minMouseDist) {
            minMouseDist = p.distToMouse;
            bestIndex = i;
          }
        }
      }

      if (bestIndex === -1 && group.lastActiveIndex !== -1) {
        const lastPos = calculatedPositions[group.lastActiveIndex];
        if (lastPos && lastPos.isVisible) {
          bestIndex = group.lastActiveIndex;
        }
      }

      if (bestIndex === -1) {
        let minCenterDist = Infinity;
        for (let i = 0; i < calculatedPositions.length; i++) {
          if (calculatedPositions[i].distToCenter < minCenterDist) {
            minCenterDist = calculatedPositions[i].distToCenter;
            bestIndex = i;
          }
        }
      }

      group.lastActiveIndex = bestIndex;

      const availableClones = [...group.clones];

      calculatedPositions.forEach((calc, index) => {
        let el: HTMLElement;
        const isHovered = index === bestIndex;
        if (isHovered) {
          el = group.realElement;
        } else {
          el = availableClones.pop()!;
        }

        if (!el) return;

        if (calc.isVisible) {
          // HW Accelerated Matrix translation, fully skipping React Render Tree
          el.style.transform = `translate3d(${calc.finalX}px, ${calc.finalY}px, 0)`;
          el.style.opacity = "1";
          el.style.pointerEvents = "auto";
        } else {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
        }
      });
    });

    scroll.current.last.x = scroll.current.current.x;
    scroll.current.last.y = scroll.current.current.y;
  };

  useEffect(() => {
    const animate = () => {
      render();
      rafId.current = requestAnimationFrame(animate);
    };
    rafId.current = requestAnimationFrame(animate);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-[100vw] h-[100vh] overflow-hidden touch-none ${className}`}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        touchAction: 'none'
      }}
    >
      {children}
    </div>
  );
};
