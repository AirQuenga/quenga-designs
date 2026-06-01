"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown, X } from "lucide-react"

interface FilterOption {
  value: string
  label: string
}

interface FilterButtonProps {
  /** Icon shown on the left of the button. */
  icon?: ReactNode
  /** Default label when no selection is active. */
  label: string
  /** Currently selected value, or null when cleared. */
  value: string | null
  options: FilterOption[]
  onChange: (value: string | null) => void
  /** Disables the button (e.g. no options available). */
  disabled?: boolean
  /** Aligns the dropdown panel to the right edge of the button. */
  align?: "left" | "right"
}

/**
 * A compact, self-contained filter "pill" button. Clicking it pops out a
 * dropdown of options. When a value is selected the button stays highlighted
 * and shows an inline "X" to clear just that filter.
 */
export function FilterButton({
  icon,
  label,
  value,
  options,
  onChange,
  disabled,
  align = "left",
}: FilterButtonProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const active = value !== null
  const selectedLabel = options.find((o) => o.value === value)?.label

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
          <span className="whitespace-nowrap">{active ? selectedLabel : label}</span>
          {!active && <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => onChange(null)}
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
          className={
            align === "right"
              ? "absolute right-0 z-50 mt-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
              : "absolute left-0 z-50 mt-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          }
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No options available</p>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value === value ? null : opt.value)
                    setOpen(false)
                  }}
                  className={
                    isSelected
                      ? "flex w-full items-center justify-between rounded-lg bg-primary/10 px-3 py-1.5 text-left text-sm font-medium text-primary"
                      : "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                  }
                >
                  {opt.label}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
