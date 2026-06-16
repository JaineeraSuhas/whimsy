"use client"

import React, { useState } from "react"

export interface MenuItemProps {
  children?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  icon?: React.ReactNode
  isActive?: boolean
}

export function MenuItem({ children, onClick, disabled = false, icon, isActive = false }: MenuItemProps) {
  return (
    <button
      className={`relative block w-full h-12 text-center group
        ${disabled ? "text-gray-500 cursor-not-allowed" : "text-white/80 hover:text-white"}
        ${isActive ? "bg-white/20 rounded-full" : ""}
      `}
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex items-center justify-center h-full">
        {icon && (
          <span className="h-5 w-5 transition-all duration-200 group-hover:[&_svg]:stroke-[2.5]">
            {icon}
          </span>
        )}
        {children}
      </span>
    </button>
  )
}

export function MenuContainer({ children, isExpanded, onToggle }: { children: React.ReactNode, isExpanded: boolean, onToggle: () => void }) {
  const childrenArray = React.Children.toArray(children)

  return (
    <div className="relative w-12" data-expanded={isExpanded}>
      {/* Container for all items */}
      <div className="relative">
        {/* First item - always visible (Trigger) */}
        <div 
          className="relative w-12 h-12 bg-white/10 backdrop-blur-md border border-white/20 text-white cursor-pointer rounded-full group will-change-transform z-50 flex items-center justify-center"
          onClick={onToggle}
        >
          {childrenArray[0]}
        </div>

        {/* Other items - expanding UPWARDS */}
        {childrenArray.slice(1).map((child, index) => (
          <div 
            key={index} 
            className="absolute top-0 left-0 w-12 h-12 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full will-change-transform flex items-center justify-center"
            style={{
              transform: `translateY(${isExpanded ? -(index + 1) * 56 : 0}px)`,
              opacity: isExpanded ? 1 : 0,
              zIndex: 40 - index,
              clipPath: "circle(50% at 50% 50%)",
              transition: `transform ${isExpanded ? '300ms' : '300ms'} cubic-bezier(0.4, 0, 0.2, 1),
                         opacity ${isExpanded ? '300ms' : '350ms'}`,
              backfaceVisibility: 'hidden',
              perspective: 1000,
              WebkitFontSmoothing: 'antialiased'
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
