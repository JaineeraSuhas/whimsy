"use client"

import { useState } from "react"

interface RadioOption {
    id: string
    value: string
    label: string
}

interface AnimatedRadioProps {
    options: RadioOption[]
    value: string
    onChange: (value: string) => void
}

export default function AnimatedRadio({ options, value, onChange }: AnimatedRadioProps) {
    const handleChange = (newValue: string) => {
        onChange(newValue)
    }

    const getGliderTransform = () => {
        const index = options.findIndex((option) => option.value === value)
        return `translateY(${index * 100}%)`
    }

    return (
        <div className="flex items-center justify-center">
            <div className="relative flex flex-col pl-3">
                {options.map((option) => (
                    <div key={option.id} className="relative z-20 py-1">
                        <input
                            id={option.id}
                            name="radio"
                            type="radio"
                            value={option.value}
                            checked={value === option.value}
                            onChange={(e) => handleChange(e.target.value)}
                            className="absolute w-full h-full m-0 opacity-0 cursor-pointer z-30 appearance-none"
                        />
                        <label
                            htmlFor={option.id}
                            className={`cursor-pointer text-sm py-1 px-2 block transition-all duration-300 ease-in-out ${value === option.value
                                ? 'text-purple-400 font-medium'
                                : 'text-gray-400'
                                }`}
                        >
                            {option.label}
                        </label>
                    </div>
                ))}

                <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-700 to-transparent">
                    <div
                        className="relative h-1/3 w-full bg-gradient-to-b from-transparent via-purple-500 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.37,1.95,0.66,0.56)]"
                        style={{ transform: getGliderTransform() }}
                    >
                        <div className="absolute top-1/2 -translate-y-1/2 h-3/5 w-[300%] bg-purple-500 blur-[10px]" />
                        <div className="absolute left-0 h-full w-36 bg-gradient-to-r from-purple-500/10 to-transparent" />
                    </div>
                </div>
            </div>
        </div>
    )
}
