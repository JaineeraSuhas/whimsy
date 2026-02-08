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
        console.log('[Tilt] Requesting device orientation permission...');
        if (typeof (DeviceOrientationEvent as unknown as DeviceOrientationEventiOS).requestPermission === 'function') {
            try {
                const permissionState = await (DeviceOrientationEvent as unknown as DeviceOrientationEventiOS).requestPermission!();
                console.log('[Tilt] Permission state:', permissionState);
                if (permissionState === 'granted') {
                    setPermissionGranted(true);
                    console.log('[Tilt] Permission granted');
                } else {
                    console.warn('[Tilt] Permission denied');
                }
            } catch (e) {
                console.error("[Tilt] Error requesting device orientation permission", e);
            }
        } else {
            // Non-iOS or older devices usually don't need permission
            console.log('[Tilt] No permission needed (non-iOS device)');
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
            if (ev.gamma === null || ev.beta === null) return;

            // Sensitivity multiplier for mobile tilt
            const sensitivity = 2.0;

            // Map gamma (-30 to 30) to screen width centering
            const gamma = Math.min(Math.max(ev.gamma, -30), 30);
            const x = (window.innerWidth / 2) + (gamma * (window.innerWidth / 60) * sensitivity);

            // Map beta (centered around 45 degrees holding position)
            const betaRaw = ev.beta - 45;
            const beta = Math.min(Math.max(betaRaw, -30), 30);
            const y = (window.innerHeight / 2) + (beta * (window.innerHeight / 60) * sensitivity);

            updatePosition(x, y);
        };

        // Listen for mouse, touch, and device orientation events
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("touchmove", handleTouchMove, { passive: false });

        if (permissionGranted) {
            console.log('[Tilt] Attaching deviceorientation listener');
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
