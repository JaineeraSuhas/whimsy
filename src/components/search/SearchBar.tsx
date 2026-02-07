
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface SearchBarProps {
    onSearch: (query: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    suggestions?: string[];
}

export default function SearchBar({
    onSearch,
    placeholder = 'Explore visual connections...',
    autoFocus = false,
    suggestions = [],
}: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);

    const exampleQueries = [
        'the evolution of Tokyo street fashion from 1980 to now',
        'brutalist architecture in Eastern Europe',
        'vintage movie posters from the 1970s',
        'ceramic pottery techniques through history',
        'minimalist product design',
        'surrealist art movements',
    ];

    const displaySuggestions = suggestions.length > 0 ? suggestions : exampleQueries;

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query.trim());
            setShowSuggestions(false);
        }
    }, [query, onSearch]);

    const handleSuggestionClick = useCallback((suggestion: string) => {
        setQuery(suggestion);
        onSearch(suggestion);
        setShowSuggestions(false);
    }, [onSearch]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!showSuggestions) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < displaySuggestions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev > 0 ? prev - 1 : displaySuggestions.length - 1
                );
                break;
            case 'Enter':
                if (selectedIndex >= 0) {
                    e.preventDefault();
                    handleSuggestionClick(displaySuggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedIndex(-1);
                break;
        }
    }, [showSuggestions, selectedIndex, displaySuggestions, handleSuggestionClick]);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    return (
        <div className="w-full max-w-3xl mx-auto relative">
            <form onSubmit={handleSubmit} className="relative">
                {/* Search Input */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-accent-warm to-accent-cool rounded-2xl blur-lg opacity-0 group-hover:opacity-30 group-focus-within:opacity-50 transition-opacity duration-300" />

                    <div className="relative flex items-center bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-2 border-transparent group-focus-within:border-accent-warm transition-all duration-300">
                        {/* Icon */}
                        <div className="pl-6 pr-3">
                            <MagnifyingGlassIcon className="w-6 h-6 text-gray-400 group-focus-within:text-accent-warm transition-colors" />
                        </div>

                        {/* Input */}
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setShowSuggestions(true);
                                setSelectedIndex(-1);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => {
                                // Delay to allow click on suggestions
                                setTimeout(() => setShowSuggestions(false), 200);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            className="flex-1 py-5 px-2 bg-transparent border-none outline-none text-lg font-body placeholder:text-gray-400 text-gray-900 dark:text-white"
                        />

                        {/* AI Indicator */}
                        {query.length > 0 && (
                            <div className="pr-4 flex items-center gap-2 text-sm text-gray-500">
                                <SparklesIcon className="w-5 h-5 text-accent-cool animate-pulse" />
                                <span className="font-mono hidden sm:inline">AI-powered</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={!query.trim()}
                            className="mr-2 px-6 py-3 bg-gradient-to-r from-accent-warm to-accent-cool text-white font-display font-bold rounded-xl hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            Search
                        </button>
                    </div>
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && displaySuggestions.length > 0 && (
                    <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden z-50 animate-fade-in">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-800">
                            <p className="text-xs font-mono text-gray-500 px-3 py-1">
                                {suggestions.length > 0 ? 'Recent searches' : 'Try these examples'}
                            </p>
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                            {displaySuggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className={`
                    w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer
                    ${selectedIndex === index ? 'bg-gray-100 dark:bg-gray-800' : ''}
                  `}
                                >
                                    <div className="flex items-start gap-3">
                                        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            {suggestion}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </form>

            {/* Search Tips */}
            {!query && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    <span className="text-xs font-mono text-gray-500">Try:</span>
                    {['Deep Mode', 'Time periods', 'Visual styles', 'Sources'].map((tip) => (
                        <span
                            key={tip}
                            className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-mono text-gray-600 dark:text-gray-400"
                        >
                            {tip}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
