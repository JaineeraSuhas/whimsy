import * as THREE from 'three';

/**
 * Calculate position on a logarithmic spiral
 * Formula: r = a * e^(b*θ)
 */
export interface SpiralPosition {
    x: number;
    y: number;
    z: number;
    angle: number;
    radius: number;
}

export interface SpiralConfig {
    initialRadius: number; // a parameter
    growthRate: number; // b parameter
    rotations: number; // number of full rotations
    verticalSpacing: number; // vertical distance between points
    totalPoints: number; // total number of points on spiral
}

export const DEFAULT_SPIRAL_CONFIG: SpiralConfig = {
    initialRadius: 2,
    growthRate: 0.25,
    rotations: 4,
    verticalSpacing: 0.3,
    totalPoints: 100,
};

/**
 * Calculate position for a point on the spiral
 */
export function calculateSpiralPosition(
    index: number,
    config: SpiralConfig = DEFAULT_SPIRAL_CONFIG
): SpiralPosition {
    const { initialRadius, growthRate, rotations, verticalSpacing, totalPoints } = config;

    // Angle from 0 to rotations * 2π
    const theta = (index / totalPoints) * rotations * Math.PI * 2;

    // Radius grows exponentially
    const radius = initialRadius * Math.exp(growthRate * theta);

    // Convert polar to Cartesian coordinates
    const x = radius * Math.cos(theta);
    const z = radius * Math.sin(theta);

    // Vertical position increases linearly
    const y = index * verticalSpacing;

    return {
        x,
        y,
        z,
        angle: theta,
        radius,
    };
}

/**
 * Generate all positions for a spiral
 */
export function generateSpiralPositions(
    count: number,
    config: Partial<SpiralConfig> = {}
): SpiralPosition[] {
    const fullConfig = { ...DEFAULT_SPIRAL_CONFIG, ...config, totalPoints: count };

    return Array.from({ length: count }, (_, i) =>
        calculateSpiralPosition(i, fullConfig)
    );
}

/**
 * Create a THREE.js curve for the spiral path
 */
export function createSpiralCurve(config: SpiralConfig = DEFAULT_SPIRAL_CONFIG): THREE.Curve<THREE.Vector3> {
    return new THREE.CatmullRomCurve3(
        generateSpiralPositions(config.totalPoints, config).map(
            pos => new THREE.Vector3(pos.x, pos.y, pos.z)
        ),
        false, // not closed
        'catmullrom',
        0.5
    );
}

/**
 * Calculate camera position to view the spiral
 */
export function getCameraPositionForSpiral(
    config: SpiralConfig = DEFAULT_SPIRAL_CONFIG,
    viewAngle: number = 0
): THREE.Vector3 {
    const maxRadius = config.initialRadius * Math.exp(
        config.growthRate * config.rotations * Math.PI * 2
    );

    const distance = maxRadius * 2.5;
    const height = (config.totalPoints * config.verticalSpacing) / 2;

    return new THREE.Vector3(
        distance * Math.cos(viewAngle),
        height,
        distance * Math.sin(viewAngle)
    );
}

/**
 * Find nearest point on spiral to a given position
 */
export function findNearestSpiralPoint(
    position: THREE.Vector3,
    positions: SpiralPosition[]
): { index: number; distance: number } {
    let minDistance = Infinity;
    let nearestIndex = 0;

    positions.forEach((pos, index) => {
        const distance = Math.sqrt(
            Math.pow(position.x - pos.x, 2) +
            Math.pow(position.y - pos.y, 2) +
            Math.pow(position.z - pos.z, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = index;
        }
    });

    return { index: nearestIndex, distance: minDistance };
}

/**
 * Calculate optimal spiral configuration based on image count
 */
export function getOptimalSpiralConfig(imageCount: number): SpiralConfig {
    // Adjust parameters based on number of images
    const rotations = Math.max(3, Math.min(6, Math.ceil(imageCount / 25)));
    const growthRate = 0.15 + (imageCount / 1000) * 0.1;

    return {
        initialRadius: 2,
        growthRate,
        rotations,
        verticalSpacing: 0.25 + (imageCount / 500) * 0.05,
        totalPoints: imageCount,
    };
}
