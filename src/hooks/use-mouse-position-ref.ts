import { RefObject, useEffect, useRef, useState } from "react";

interface DeviceOrientationEventiOS extends DeviceOrientationEvent {
    requestPermission?: () => Promise<'granted' | 'denied'>;
}

export const useMousePositionRef = (
    containerRef?: RefObject<HTMLElement | SVGElement>
) => {
    const positionRef = useRef({ x: 0, y: 0 });
    const [permissionGranted, setPermissionGranted] = useState(false);

    const requestAccess = async () => {
        if (typeof (DeviceOrientationEvent as unknown as DeviceOrientationEventiOS).requestPermission === 'function') {
            try {
                const permissionState = await (DeviceOrientationEvent as unknown as DeviceOrientationEventiOS).requestPermission!();
                if (permissionState === 'granted') {
                    setPermissionGranted(true);
                }
            } catch (e) {
                console.error("Error requesting device orientation permission", e);
            }
        } else {
            // Non-iOS or older devices usually don't need permission
            setPermissionGranted(true);
        }
    };

    useEffect(() => {
        const updatePosition = (x: number, y: number) => {
            if (containerRef && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const relativeX = x - rect.left;
                const relativeY = y - rect.top;

                // Calculate relative position even when outside the container
                positionRef.current = { x: relativeX, y: relativeY };
            } else {
                positionRef.current = { x, y };
            }
        };

        const handleMouseMove = (ev: MouseEvent) => {
            updatePosition(ev.clientX, ev.clientY);
        };

        const handleTouchMove = (ev: TouchEvent) => {
            const touch = ev.touches[0];
            updatePosition(touch.clientX, touch.clientY);
        };

        const handleDeviceOrientation = (ev: DeviceOrientationEvent) => {
            // Map device tilt (gamma/beta) to screen coordinates
            // Gamma: left-to-right tilt (-90 to 90)
            // Beta: front-to-back tilt (-180 to 180)

            // Map gamma (-45 to 45) to screen width (0 to window.innerWidth)
            const gamma = Math.min(Math.max((ev.gamma || 0), -45), 45);
            const x = ((gamma + 45) / 90) * window.innerWidth;

            // Map beta (-45 to 45, relative to holding position) to screen height
            // Assuming simplified holding position around 45 degrees
            const betaRaw = (ev.beta || 0) - 45; // Center around 45 degrees tilt
            const beta = Math.min(Math.max(betaRaw, -45), 45);
            const y = ((beta + 45) / 90) * window.innerHeight;

            updatePosition(x, y);
        };

        // Listen for mouse, touch, and device orientation events
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("touchmove", handleTouchMove, { passive: false });

        if (permissionGranted) {
            window.addEventListener("deviceorientation", handleDeviceOrientation);
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("deviceorientation", handleDeviceOrientation);
        };
    }, [containerRef, permissionGranted]);

    return { positionRef, requestAccess, permissionGranted };
};
