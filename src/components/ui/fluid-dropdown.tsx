"use client"

import * as React from "react"
import { motion, AnimatePresence, MotionConfig } from "motion/react"
import { ChevronDown, type LucideIcon } from "lucide-react"

// Utility function for className merging
function cn(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(" ")
}

// Custom hook for click outside detection
function useClickAway<T extends HTMLElement = HTMLElement>(ref: React.RefObject<T | null>, handler: (event: MouseEvent | TouchEvent) => void) {
    React.useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return
            }
            handler(event)
        }

        document.addEventListener("mousedown", listener)
        document.addEventListener("touchstart", listener)

        return () => {
            document.removeEventListener("mousedown", listener)
            document.removeEventListener("touchstart", listener)
        }
    }, [ref, handler])
}

// Button component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "outline"
    children: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                    variant === "outline" && "border border-white/10 bg-transparent",
                    className
                )}
                {...props}
            >
                {children}
            </button>
        )
    }
)
Button.displayName = "Button"

// Types
interface Category {
    id: string
    label: string
    icon: LucideIcon
    color: string
}

// Icon wrapper with animation
const IconWrapper = ({
    icon: Icon,
    isHovered,
    color,
}: { icon: LucideIcon; isHovered: boolean; color: string }) => (
    <motion.div
        className="w-4 h-4 mr-2 relative"
        initial={false}
        animate={isHovered ? { scale: 1.2 } : { scale: 1 }}
    >
        <Icon className="w-4 h-4" />
        {isHovered && (
            <motion.div
                className="absolute inset-0"
                style={{ color }}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
            >
                <Icon className="w-4 h-4" strokeWidth={2} />
            </motion.div>
        )}
    </motion.div>
)

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            when: "beforeChildren",
            staggerChildren: 0.1,
        },
    },
}

const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.3,
            ease: [0.25, 0.1, 0.25, 1] as const,
        },
    },
}

// Main component
interface FluidDropdownProps {
    categories: Category[]
    value: string
    onChange: (value: string) => void
    className?: string
}

export function FluidDropdown({ categories, value, onChange, className }: FluidDropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [selectedCategory, setSelectedCategory] = React.useState<Category>(
        categories.find(c => c.id === value) || categories[0]
    )
    const [hoveredCategory, setHoveredCategory] = React.useState<string | null>(null)
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    useClickAway<HTMLDivElement>(dropdownRef, () => setIsOpen(false))

    React.useEffect(() => {
        const category = categories.find(c => c.id === value)
        if (category) {
            setSelectedCategory(category)
        }
    }, [value, categories])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsOpen(false)
        }
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                className={cn("w-full max-w-xs relative", className)}
                ref={dropdownRef}
            >
                <Button
                    variant="outline"
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "w-full justify-between bg-black/40 text-white/60 backdrop-blur-md",
                        "hover:bg-black/60 hover:text-white",
                        "focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black",
                        "transition-all duration-200 ease-in-out",
                        "border border-white/10 focus:border-white/20",
                        "h-10 px-4",
                        isOpen && "bg-black/60 text-white border-white/20",
                    )}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                >
                    <span className="flex items-center">
                        <IconWrapper
                            icon={selectedCategory.icon}
                            isHovered={false}
                            color={selectedCategory.color}
                        />
                        {selectedCategory.label}
                    </span>
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-center w-5 h-5"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </motion.div>
                </Button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 1, y: 0, height: 0 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                height: "auto",
                                transition: {
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 30,
                                    mass: 1,
                                },
                            }}
                            exit={{
                                opacity: 0,
                                y: 0,
                                height: 0,
                                transition: {
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 30,
                                    mass: 1,
                                },
                            }}
                            className="absolute left-0 right-0 top-full mt-2 z-50"
                            onKeyDown={handleKeyDown}
                        >
                            <motion.div
                                className="w-full rounded-lg border border-white/10 bg-black/90 backdrop-blur-md p-1 shadow-lg"
                                initial={{ borderRadius: 8 }}
                                animate={{
                                    borderRadius: 12,
                                    transition: { duration: 0.2 },
                                }}
                                style={{ transformOrigin: "top" }}
                            >
                                <motion.div
                                    className="py-2 relative"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    <motion.div
                                        layoutId="hover-highlight"
                                        className="absolute inset-x-1 bg-white/10 rounded-md"
                                        animate={{
                                            y: categories.findIndex((c) => (hoveredCategory || selectedCategory.id) === c.id) * 40,
                                            height: 40,
                                        }}
                                        transition={{
                                            type: "spring",
                                            bounce: 0.15,
                                            duration: 0.5,
                                        }}
                                    />
                                    {categories.map((category) => (
                                        <motion.button
                                            key={category.id}
                                            onClick={() => {
                                                setSelectedCategory(category)
                                                onChange(category.id)
                                                setIsOpen(false)
                                            }}
                                            onHoverStart={() => setHoveredCategory(category.id)}
                                            onHoverEnd={() => setHoveredCategory(null)}
                                            className={cn(
                                                "relative flex w-full items-center px-4 py-2.5 text-sm rounded-md",
                                                "transition-colors duration-150",
                                                "focus:outline-none",
                                                selectedCategory.id === category.id || hoveredCategory === category.id
                                                    ? "text-white"
                                                    : "text-white/60",
                                            )}
                                            whileTap={{ scale: 0.98 }}
                                            variants={itemVariants}
                                        >
                                            <IconWrapper
                                                icon={category.icon}
                                                isHovered={hoveredCategory === category.id}
                                                color={category.color}
                                            />
                                            {category.label}
                                        </motion.button>
                                    ))}
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    )
}
