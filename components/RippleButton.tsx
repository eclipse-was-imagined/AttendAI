"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "icon"
}

export default function RippleButton({
  children,
  className,
  variant = "default",
  size = "default",
  onClick,
  disabled,
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([])
  const ref = useRef<HTMLButtonElement>(null)
  const counter = useRef(0)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return
    const btn = ref.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = counter.current++
    setRipples((prev) => [...prev, { x, y, id }])
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600)
    onClick?.(e)
  }

  const base =
    "relative overflow-hidden inline-flex items-center justify-center gap-2 font-medium transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"

  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
  }

  const sizes = {
    default: "h-10 px-4 py-2 rounded-xl text-sm",
    sm: "h-8 px-3 rounded-lg text-xs",
    icon: "h-9 w-9 rounded-xl",
  }

  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      onClick={handleClick}
      disabled={disabled}
      {...props}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute animate-ripple rounded-full bg-white/30"
          style={{ left: r.x, top: r.y, transform: "translate(-50%, -50%)" }}
        />
      ))}
      {children}
    </button>
  )
}