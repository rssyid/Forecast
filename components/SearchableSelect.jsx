"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

/**
 * SearchableSelect - Dropdown yang bisa diketik untuk search
 * Props:
 *   options: [{ value, label }] or ["string"]
 *   value: current selected value
 *   onChange: (value) => void
 *   placeholder: string
 *   icon: ReactNode (optional icon on left)
 *   className: string
 *   disabled: boolean
 */
export default function SearchableSelect({ options = [], value, onChange, placeholder = "Pilih...", icon, className = '', disabled = false }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Normalize options to { value, label }
    const normalized = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);

    // Current label
    const currentLabel = normalized.find(o => o.value === value)?.label ?? placeholder;

    // Filtered options
    const filtered = search.trim()
        ? normalized.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
        : normalized;

    // Close on outside click
    useEffect(() => {
        function handleClick(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setSearch('');
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Focus input when opening
    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const handleSelect = useCallback((val) => {
        onChange(val);
        setOpen(false);
        setSearch('');
    }, [onChange]);

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(prev => !prev)}
                className={`flex items-center gap-2 w-full min-w-[160px] h-9 pl-3 pr-2 rounded-xl border bg-white/70 backdrop-blur-sm text-sm font-medium text-gray-700 transition-all
                    ${open ? 'border-gray-400 ring-2 ring-black/10' : 'border-gray-200 hover:border-gray-300'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
                <span className="flex-1 text-left truncate">{currentLabel}</span>
                <ChevronDown
                    size={14}
                    className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 mt-1.5 right-0 min-w-full w-max max-w-[280px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {/* Search Input */}
                    <div className="px-3 py-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                            <Search size={13} className="text-gray-400 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Cari..."
                                className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options List */}
                    <ul className="max-h-52 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-xs text-gray-400 text-center">Tidak ditemukan</li>
                        ) : filtered.map(o => (
                            <li key={o.value}>
                                <button
                                    type="button"
                                    onClick={() => handleSelect(o.value)}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors whitespace-nowrap
                                        ${o.value === value
                                            ? 'bg-black text-white font-medium'
                                            : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    {o.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
