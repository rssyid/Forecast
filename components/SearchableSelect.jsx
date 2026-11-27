"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
export default function SearchableSelect({ options = [], value, onChange, placeholder = "Pilih...", icon, className = '', disabled = false, autoSort = true, id }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Normalize options to { value, label } and apply natural sorting if requested
    const normalized = useMemo(() => {
        if (!Array.isArray(options)) return [];
        const items = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
        if (autoSort) {
            items.sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), undefined, { numeric: true, sensitivity: 'base' }));
        }
        return items;
    }, [options, autoSort]);

    // Current label
    const currentLabel = useMemo(() => {
        const found = normalized.find(o => String(o.value) === String(value));
        return found ? found.label : placeholder;
    }, [normalized, value, placeholder]);

    // Filtered options
    const filtered = useMemo(() => {
        if (!search.trim()) return normalized;
        const lower = search.toLowerCase();
        return normalized.filter(o => String(o.label || '').toLowerCase().includes(lower));
    }, [normalized, search]);

    // Close on outside click or Escape key
    useEffect(() => {
        function handleClick(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setSearch('');
            }
        }
        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                setOpen(false);
                setSearch('');
            }
        }
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
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
                id={id}
                type="button"
                disabled={disabled}
                aria-expanded={open}
                onClick={() => !disabled && setOpen(prev => !prev)}
                className={`flex items-center gap-2 w-full min-w-[160px] min-h-11 pl-3 pr-2.5 rounded-xl border bg-white text-sm font-medium text-gray-900 transition-colors
                    ${open ? 'border-gray-900 ring-1 ring-gray-900/10' : 'border-gray-300 hover:border-gray-400'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                {icon && <span className="text-gray-500 shrink-0" aria-hidden="true">{icon}</span>}
                <span className="flex-1 text-left truncate">{currentLabel}</span>
                <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`shrink-0 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-[9999] mt-2 right-0 min-w-full w-max max-w-[320px] bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
                    {/* Search Input */}
                    <div className="px-3 py-2 border-b border-gray-200">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                            <Search size={13} className="text-gray-500 shrink-0" aria-hidden="true" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Cari..."
                                aria-label="Cari opsi"
                                className="flex-1 text-xs bg-transparent text-gray-900 placeholder-gray-500"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    aria-label="Hapus pencarian"
                                    className="text-gray-500 hover:text-gray-800 p-0.5 rounded"
                                >
                                    <X size={12} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options List */}
                    <ul className="max-h-52 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-xs text-gray-500 text-center">Tidak ditemukan</li>
                        ) : filtered.map(o => (
                            <li key={o.value}>
                                <button
                                    type="button"
                                    onClick={() => handleSelect(o.value)}
                                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors whitespace-nowrap
                                        ${o.value === value
                                            ? 'bg-black text-white font-semibold'
                                            : 'text-gray-700 hover:bg-gray-100'
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
