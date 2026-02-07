'use client';

import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import React, { useState } from 'react';
import { Layers, X } from 'lucide-react';

// Utility function for className merging
function cn(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(' ')
}

const CONSTANTS = {
    itemSize: 48,
    containerSize: 250,
    openStagger: 0.02,
    closeStagger: 0.07
};

const STYLES: Record<string, Record<string, string>> = {
    trigger: {
        container:
            'rounded-full flex items-center bg-white/10 backdrop-blur-md justify-center cursor-pointer outline-none ring-0 hover:bg-white/20 transition-all duration-100 z-50 border border-white/10',
        active: 'bg-white/20 border-white/20'
    },
    item: {
        container:
            'rounded-full flex items-center justify-center absolute bg-white/10 backdrop-blur-md hover:bg-white/20 cursor-pointer border border-white/10',
        label: 'text-xs text-white absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap bg-black/80 px-2 py-1 rounded backdrop-blur-sm'
    }
};

const pointOnCircle = (i: number, n: number, r: number, cx = 0, cy = 0) => {
    const theta = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta) + 0;
    return { x, y };
};

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    index: number;
    totalItems: number;
    isOpen: boolean;
    isActive?: boolean;
}

const MenuItem = ({ icon, label, onClick, index, totalItems, isOpen, isActive }: MenuItemProps) => {
    const { x, y } = pointOnCircle(index, totalItems, CONSTANTS.containerSize / 2);
    const [hovering, setHovering] = useState(false);

    return (
        <motion.button
            onClick={onClick}
            animate={{
                x: isOpen ? x : 0,
                y: isOpen ? y : 0
            }}
            whileHover={{
                scale: 1.1,
                transition: {
                    duration: 0.1,
                    delay: 0
                }
            }}
            transition={{
                delay: isOpen ? index * CONSTANTS.openStagger : index * CONSTANTS.closeStagger,
                type: 'spring',
                stiffness: 300,
                damping: 30
            }}
            style={{
                height: CONSTANTS.itemSize - 2,
                width: CONSTANTS.itemSize - 2
            }}
            className={cn(
                STYLES.item.container,
                isActive && 'bg-white/30 border-white/30'
            )}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            {icon}
            {hovering && <p className={STYLES.item.label}>{label}</p>}
        </motion.button>
    );
};

interface MenuTriggerProps {
    setIsOpen: (isOpen: boolean) => void;
    isOpen: boolean;
    itemsLength: number;
    closeAnimationCallback: () => void;
    openIcon?: React.ReactNode;
    closeIcon?: React.ReactNode;
}

const MenuTrigger = ({
    setIsOpen,
    isOpen,
    itemsLength,
    closeAnimationCallback,
    openIcon,
    closeIcon
}: MenuTriggerProps) => {
    const animate = useAnimationControls();
    const shakeAnimation = useAnimationControls();

    const scaleTransition = Array.from({ length: itemsLength - 1 })
        .map((_, index) => index + 1)
        .reduce((acc, _, index) => {
            const increasedValue = index * 0.15;
            acc.push(1 + increasedValue);
            return acc;
        }, [] as number[]);

    const closeAnimation = async () => {
        shakeAnimation.start({
            translateX: [0, 2, -2, 0, 2, -2, 0],
            transition: {
                duration: CONSTANTS.closeStagger,
                ease: 'linear',
                repeat: Infinity,
                repeatType: 'loop'
            }
        });
        for (let i = 0; i < scaleTransition.length; i++) {
            await animate.start({
                height: Math.min(
                    CONSTANTS.itemSize * scaleTransition[i],
                    CONSTANTS.itemSize + CONSTANTS.itemSize / 2
                ),
                width: Math.min(
                    CONSTANTS.itemSize * scaleTransition[i],
                    CONSTANTS.itemSize + CONSTANTS.itemSize / 2
                ),
                backgroundColor: `rgba(255, 255, 255, ${Math.max(0.1 + i * 0.05, 0.3)})`,
                transition: {
                    duration: CONSTANTS.closeStagger / 2,
                    ease: 'linear'
                }
            });
            if (i !== scaleTransition.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, CONSTANTS.closeStagger * 1000));
            }
        }

        shakeAnimation.stop();
        shakeAnimation.start({
            translateX: 0,
            transition: {
                duration: 0
            }
        });

        animate.start({
            height: CONSTANTS.itemSize,
            width: CONSTANTS.itemSize,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            transition: {
                duration: 0.1,
                ease: 'backInOut'
            }
        });
    };

    return (
        <motion.div animate={shakeAnimation} className="z-50">
            <motion.button
                animate={animate}
                style={{
                    height: CONSTANTS.itemSize,
                    width: CONSTANTS.itemSize
                }}
                className={cn(STYLES.trigger.container, isOpen && STYLES.trigger.active)}
                onClick={() => {
                    if (isOpen) {
                        setIsOpen(false);
                        closeAnimationCallback();
                        closeAnimation();
                    } else {
                        setIsOpen(true);
                    }
                }}
            >
                <AnimatePresence mode="popLayout">
                    {isOpen ? (
                        <motion.span
                            key="menu-close"
                            initial={{
                                opacity: 0,
                                filter: 'blur(10px)'
                            }}
                            animate={{
                                opacity: 1,
                                filter: 'blur(0px)'
                            }}
                            exit={{
                                opacity: 0,
                                filter: 'blur(10px)'
                            }}
                            transition={{
                                duration: 0.2
                            }}
                        >
                            {closeIcon}
                        </motion.span>
                    ) : (
                        <motion.span
                            key="menu-open"
                            initial={{
                                opacity: 0,
                                filter: 'blur(10px)'
                            }}
                            animate={{
                                opacity: 1,
                                filter: 'blur(0px)'
                            }}
                            exit={{
                                opacity: 0,
                                filter: 'blur(10px)'
                            }}
                            transition={{
                                duration: 0.2
                            }}
                        >
                            {openIcon}
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.button>
        </motion.div>
    );
};

interface CircleMenuProps {
    items: Array<{ label: string; icon: React.ReactNode; onClick: () => void; isActive?: boolean }>;
    openIcon?: React.ReactNode;
    closeIcon?: React.ReactNode;
}

const CircleMenu = ({
    items,
    openIcon = <Layers size={18} className="text-white" />,
    closeIcon = <X size={18} className="text-white" />
}: CircleMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const animate = useAnimationControls();

    const closeAnimationCallback = async () => {
        await animate.start({
            rotate: -360,
            filter: 'blur(1px)',
            transition: {
                duration: CONSTANTS.closeStagger * (items.length + 2),
                ease: 'linear'
            }
        });
        await animate.start({
            rotate: 0,
            filter: 'blur(0px)',
            transition: {
                duration: 0
            }
        });
    };

    return (
        <div
            style={{
                width: CONSTANTS.containerSize,
                height: CONSTANTS.containerSize
            }}
            className="relative flex items-center justify-center place-self-center"
        >
            <MenuTrigger
                setIsOpen={setIsOpen}
                isOpen={isOpen}
                itemsLength={items.length}
                closeAnimationCallback={closeAnimationCallback}
                openIcon={openIcon}
                closeIcon={closeIcon}
            />
            <motion.div
                animate={animate}
                className={cn('absolute inset-0 z-0 flex items-center justify-center')}
            >
                {items.map((item, index) => {
                    return (
                        <MenuItem
                            key={`menu-item-${index}`}
                            icon={item.icon}
                            label={item.label}
                            onClick={() => {
                                item.onClick();
                                setIsOpen(false);
                            }}
                            index={index}
                            totalItems={items.length}
                            isOpen={isOpen}
                            isActive={item.isActive}
                        />
                    );
                })}
            </motion.div>
        </div>
    );
};

export { CircleMenu };
