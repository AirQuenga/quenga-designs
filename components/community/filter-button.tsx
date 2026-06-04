"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown, X, Search } from "lucide-react"

interface FilterOption {
  value: string
  label: string
}

interface FilterButtonProps {
  /** Icon shown on the left of the button. */
  icon?: ReactNode
  /** Default label when no selection is active. */
  label: string
  /** Currently selected values (array for multi-select). */
  value: string[]
  options: FilterOption[]
  onChange: (values: string[]) => void
  /** Disables the button (e.g. no options available). */
  disabled?: boolean
  /** Aligns the dropdown panel to the right edge of the button. */
  align?: "left" | "right"
  /** Allow multiple selections. Default true. */
  multiSelect?: boolean
}

/**
 * A compact, self-contained filter "pill" button. Clicking it pops out a
 * searchable dropdown of options. Supports multi-select toggling.
 * When values are selected, shows a count badge.
 */
export function FilterButton({
  icon,
  label,
  value,
  options,
  onChange,
  disabled,
  align = "left",
  multiSelect = true,
}: FilterButtonProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Focus the search input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const active = value.length > 0
  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  const toggleOption = (optValue: string) => {
    if (multiSelect) {
      if (value.includes(optValue)) {
        onChange(value.filter((v) => v !== optValue))
      } else {
        onChange([...value, optValue])
      }
    } else {
      onChange(value.includes(optValue) ? [] : [optValue])
      setOpen(false)
      setSearch("")
    }
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <div
        className={
          active
            ? "flex items-center rounded-full border border-primary bg-primary/10 text-sm font-medium text-primary"
            : "flex items-center rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-600 transition-colors hover:border-primary/40 hover:text-foreground"
        }
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex items-center gap-1.5 py-1.5 pl-3 pr-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span className="whitespace-nowrap">{label}</span>
          {active && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
              {value.length}
            </span>
          )}
          {!active && <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />}
        </button>
        {active && (
          <button
            type="button"
            onClick={clearAll}
            aria-label={`Clear ${label} filter`}
            className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          aria-multiselectable={multiSelect}
          className={`absolute z-[100] mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Search input */}
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm outline-none focus:border-primary focus:bg-white"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No options found</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleOption(opt.value)}
                    className={
                      isSelected
                        ? "flex w-full items-center justify-between rounded-lg bg-primary/10 px-3 py-1.5 text-left text-sm font-medium text-primary"
                        : "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                    }
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
