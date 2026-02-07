"use client"

import React, { useEffect, useState } from "react"
import { motion } from "motion/react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
    name: string
    onClick?: () => void
    icon: LucideIcon
    active?: boolean
}

interface NavBarProps {
    items: NavItem[]
    className?: string
    activeItem?: string
}

export function NavBar({ items, className, activeItem }: NavBarProps) {
    const [activeTab, setActiveTab] = useState(activeItem || items[0]?.name)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768)
        }

        handleResize()
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    useEffect(() => {
        if (activeItem) {
            setActiveTab(activeItem)
        }
    }, [activeItem])

    return (
        <div
            className={cn(
                "flex items-center gap-3 bg-black/40 border border-white/10 backdrop-blur-lg py-1 px-1 rounded-full shadow-lg",
                className,
            )}
        >
            {items.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.name

                return (
                    <button
                        key={item.name}
                        onClick={() => {
                            setActiveTab(item.name)
                            item.onClick?.()
                        }}
                        className={cn(
                            "relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors",
                            "text-white/60 hover:text-white",
                            isActive && "text-white",
                        )}
                    >
                        <span className="hidden md:inline relative z-10">{item.name}</span>
                        <span className="md:hidden relative z-10">
                            <Icon size={18} strokeWidth={2.5} />
                        </span>
                        {isActive && (
                            <motion.div
                                layoutId="lamp"
                                className="absolute inset-0 w-full bg-white/10 rounded-full -z-10"
                                initial={false}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 30,
                                }}
                            >
                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-purple-500 rounded-t-full">
                                    <div className="absolute w-12 h-6 bg-purple-500/20 rounded-full blur-md -top-2 -left-2" />
                                    <div className="absolute w-8 h-6 bg-purple-500/20 rounded-full blur-md -top-1" />
                                    <div className="absolute w-4 h-4 bg-purple-500/20 rounded-full blur-sm top-0 left-2" />
                                </div>
                            </motion.div>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
