import * as React from 'react';
import {
    LayoutGroup,
    motion,
    useAnimate,
    delay,
    type Transition,
    type AnimationSequence,
} from 'motion/react';

interface RadialFaceSelectorProps {
    people: Person[];
    onSelectPerson: (personId: string) => void;
    onUpdateName?: (personId: string, newName: string) => void;
    selectedPersonIds: string[];
    stageSize?: number;
    imageSize?: number;
}

export type Person = {
    id: string;
    name: string;
    thumbnailUrl?: string; // Optional legacy support
    thumbnailBlob?: Blob;  // New preferred way
    photoCount: number;
};

const transition: Transition = {
    delay: 0,
    stiffness: 300,
    damping: 35,
    type: 'spring',
    restSpeed: 0.01,
    restDelta: 0.01,
};

const spinConfig = {
    duration: 30,
    ease: 'linear' as const,
    repeat: Infinity,
};

const qsa = (root: Element, sel: string) =>
    Array.from(root.querySelectorAll(sel));

const angleOf = (el: Element) => Number((el as HTMLElement).dataset.angle || 0);

const armOfImg = (img: Element) =>
    (img as HTMLElement).closest('[data-arm]') as HTMLElement | null;

export function RadialFaceSelector({
    people,
    onSelectPerson,
    onUpdateName,
    selectedPersonIds,
    stageSize = 280,
    imageSize = 56,
}: RadialFaceSelectorProps) {
    const step = people.length > 0 ? 360 / people.length : 0;
    const [scope, animate] = useAnimate();

    // Manage Blob URLs locally to prevent leaks
    const [objectUrls, setObjectUrls] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
        const newUrls: Record<string, string> = {};

        people.forEach(p => {
            if (p.thumbnailBlob) {
                newUrls[p.id] = URL.createObjectURL(p.thumbnailBlob);
            } else if (p.thumbnailUrl) {
                newUrls[p.id] = p.thumbnailUrl;
            }
        });

        setObjectUrls(newUrls);

        return () => {
            // Revoke only the ones we created (from blobs)
            people.forEach(p => {
                if (p.thumbnailBlob && newUrls[p.id]) {
                    URL.revokeObjectURL(newUrls[p.id]);
                }
            });
        };
    }, [people]); // Re-run if people change

    React.useEffect(() => {
        const root = scope.current;
        if (!root || people.length === 0) return;

        // get arm and image elements
        // get arm and image elements
        const arms = qsa(root, '[data-arm]');
        const imgs = qsa(root, '[data-arm-image]');
        const stops: Array<() => void> = [];

        // image lift-in
        delay(() => {
            animate(imgs, { top: 0 }, transition);
        }, 250);

        // build sequence for orbit placement
        const orbitPlacementSequence: AnimationSequence = [
            ...arms.map((el): [Element, Record<string, any>, any] => [
                el,
                { rotate: angleOf(el) },
                { ...transition, at: 0 },
            ]),
            ...imgs.map((img): [Element, Record<string, any>, any] => [
                img,
                { rotate: -angleOf(armOfImg(img)!), opacity: 1 },
                { ...transition, at: 0 },
            ]),
        ];

        // play placement sequence
        delay(() => animate(orbitPlacementSequence), 700);

        // start continuous spin for arms and images
        delay(() => {
            // arms spin clockwise
            arms.forEach((el) => {
                const angle = angleOf(el);
                const ctrl = animate(el, { rotate: [angle, angle + 360] }, spinConfig);
                stops.push(() => ctrl.cancel());
            });

            // images counter-spin to stay upright
            imgs.forEach((img) => {
                const arm = armOfImg(img);
                const angle = arm ? angleOf(arm) : 0;
                const ctrl = animate(
                    img,
                    { rotate: [-angle, -angle - 360] },
                    spinConfig,
                );
                stops.push(() => ctrl.cancel());
            });
        }, 1300);

        return () => stops.forEach((stop) => stop());
    }, [people.length, animate]);

    if (people.length === 0) {
        return (
            <div
                className="flex items-center justify-center text-white/50 text-sm"
                style={{ width: stageSize, height: stageSize }}
            >
                <div className="text-center">
                    <p className="mb-1">No faces detected</p>
                    <p className="text-xs text-white/30">Upload photos with people</p>
                </div>
            </div>
        );
    }

    return (
        <LayoutGroup>
            <motion.div
                ref={scope}
                style={{ width: stageSize, height: stageSize }}
                initial={false}
                className="relative overflow-visible pointer-events-none" // Fix: Allow clicks to pass through
            >
                {people.map((person, i) => (
                    <motion.div
                        key={person.id}
                        data-arm
                        className="will-change-transform absolute inset-0"
                        style={{ zIndex: people.length - i }}
                        data-angle={i * step}
                        layoutId={`arm-${person.id}`}
                    >
                        <motion.button
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onSelectPerson(person.id);
                            }}
                            data-arm-image
                            className={`pointer-events-auto rounded-full object-cover absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 cursor-pointer transition-all border-2 overflow-hidden ${selectedPersonIds.includes(person.id)
                                ? 'border-white shadow-lg shadow-white/30 scale-110'
                                : 'border-white/30 hover:border-white/80 hover:scale-105'
                                }`}
                            style={{
                                width: imageSize,
                                height: imageSize,
                                backgroundImage: `url(${objectUrls[person.id] || ''})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                            }}
                            title={`${person.photoCount} photos`}
                            draggable={false}
                            layoutId={`arm-img-${person.id}`}
                        />
                    </motion.div>
                ))}
            </motion.div>
        </LayoutGroup>
    );
}


