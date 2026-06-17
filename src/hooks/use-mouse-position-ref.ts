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
                const relativeX = x - rect.left - (rect.width / 2);
                const relativeY = y - rect.top - (rect.height / 2);

                // Calculate relative position even when outside the container
                positionRef.current = { x: relativeX, y: relativeY };
            } else {
                positionRef.current = { 
                    x: x - window.innerWidth / 2, 
                    y: y - window.innerHeight / 2 
                };
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

            // Sensitivity multiplier for mobile tilt (massively decreased for subtle spatial effect)
            const sensitivity = 0.5;

            // Map gamma (-30 to 30) to screen width centering
            const gamma = Math.min(Math.max(ev.gamma, -30), 30);
            const x = (window.innerWidth / 2) + (gamma * (window.innerWidth / 60) * sensitivity);

            // Map beta (centered around 45 degrees holding position)
            const betaRaw = ev.beta - 45;
            const beta = Math.min(Math.max(betaRaw, -30), 30);
            const y = (window.innerHeight / 2) + (beta * (window.innerHeight / 60) * sensitivity);

            updatePosition(x, y);
        };

        // Listen for mouse only on desktop devices
        const isDesktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        if (isDesktop) {
            window.addEventListener("mousemove", handleMouseMove);
        } else {
            // On mobile, attach touchmove so swiping on the screen pans the parallax 
            // even before gyro permission is granted!
            window.addEventListener("touchmove", handleTouchMove, { passive: true });
        }

        // On mobile, rely ONLY on device orientation. Attach immediately (works on Android).
        // iOS 13+ requires requestPermission via user interaction.
        window.addEventListener("deviceorientation", handleDeviceOrientation);

        // To seamlessly enable tilt on iOS, attach a one-time touch listener to the document
        // to request permission upon their very first interaction.
        const handleFirstTouch = () => {
            if (!permissionGranted) {
                requestAccess();
            }
            document.removeEventListener('touchstart', handleFirstTouch);
        };
        document.addEventListener('touchstart', handleFirstTouch, { once: true });

        return () => {
            if (isDesktop) {
                window.removeEventListener("mousemove", handleMouseMove);
            } else {
                window.removeEventListener("touchmove", handleTouchMove);
            }
            window.removeEventListener("deviceorientation", handleDeviceOrientation);
            document.removeEventListener('touchstart', handleFirstTouch);
        };
    }, [containerRef, permissionGranted]);

    return { positionRef, requestAccess, permissionGranted };
};
