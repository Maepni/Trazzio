"use client"

import { useState, useRef, useEffect } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatUnitsToBoxes } from "@/lib/utils"

interface Product {
  id: string
  name: string
  code?: string | null
  aliases?: string[] | null
  company: { name: string }
  stock: number
  unitPerBox?: number
}

interface ProductSearchComboboxProps {
  products: Product[]
  onSelect: (product: Product) => void
  placeholder?: string
  disabled?: boolean
}

export function ProductSearchCombobox({
  products,
  onSelect,
  placeholder = "Buscar producto o empresa...",
  disabled = false,
}: ProductSearchComboboxProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered =
    query.trim() === ""
      ? []
      : products.filter((p) => {
          const q = query.toLowerCase()
          return (
            p.name.toLowerCase().includes(q) ||
            p.company.name.toLowerCase().includes(q) ||
            (p.code != null && p.code.toLowerCase().includes(q)) ||
            (p.aliases != null && p.aliases.some((a) => a.toLowerCase().includes(q)))
          )
        })

  const handleSelect = (product: Product) => {
    onSelect(product)
    setQuery("")
    setOpen(false)
    setFocusedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocusedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault()
      handleSelect(filtered[focusedIndex])
    } else if (e.key === "Escape") {
      setOpen(false)
      setFocusedIndex(-1)
    }
  }

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement
      if (typeof item?.scrollIntoView === "function") {
        item.scrollIntoView({ block: "nearest" })
      }
    }
  }, [focusedIndex])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open && query.trim() !== ""}
          aria-autocomplete="list"
          type="text"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          className="pl-9 pr-8"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setFocusedIndex(-1)
          }}
          onFocus={() => { if (query.trim()) setOpen(true) }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setOpen(false) }}
            className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.trim() !== "" && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400 text-center">Sin resultados para "{query}"</p>
          ) : (
            <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
              {filtered.map((product, idx) => (
                <li key={product.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      idx === focusedIndex ? "bg-blue-50" : ""
                    }`}
                    onMouseDown={() => handleSelect(product)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-400">{product.company.name}</p>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">
                      {product.unitPerBox
                        ? formatUnitsToBoxes(product.stock, product.unitPerBox)
                        : `${product.stock}u`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
