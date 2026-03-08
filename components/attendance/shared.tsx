"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Shield,
  Moon,
  Sun,
  Lock,
  Fingerprint,
  Check,
  WifiOff,
  Wifi,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useState } from "react"

// =============================================================================
// SecurityBadges
// =============================================================================

const securityBadges = [
  { icon: Shield, label: "Secure Session" },
  { icon: Lock, label: "Encrypted" },
  { icon: Fingerprint, label: "Biometric Protected" },
]

export function SecurityBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {securityBadges.map((b) => (
        <Badge
          key={b.label}
          variant="outline"
          className="gap-1.5 rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary"
        >
          <b.icon className="h-3 w-3" />
          {b.label}
        </Badge>
      ))}
    </div>
  )
}

// =============================================================================
// AppHeader
// =============================================================================

export function AppHeader({ title = "SecureAttend" }: { title?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold text-foreground">{title}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
        className="h-9 w-9 rounded-xl"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>
    </header>
  )
}

// =============================================================================
// StepIndicator
// =============================================================================

export function StepIndicator({
  steps,
  currentStep,
}: {
  steps: string[]
  currentStep: number
}) {
  return (
    <div className="flex items-center justify-between px-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        return (
          <div key={step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: isCurrent ? 1.1 : 1 }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isCompleted && "bg-success text-success-foreground",
                  isCurrent &&
                    "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </motion.div>
              <span
                className={cn(
                  "max-w-16 text-center text-[10px] leading-tight",
                  isCurrent
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="mx-1 mb-5 h-0.5 flex-1">
                <div
                  className={cn(
                    "h-full rounded-full transition-colors",
                    isCompleted ? "bg-success" : "bg-muted"
                  )}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// =============================================================================
// OfflineIndicator
// =============================================================================

export function OfflineIndicator() {
  const [isOnline] = useState(true)
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="flex items-center justify-center gap-2 bg-warning/10 px-4 py-2 text-sm text-warning-foreground"
        >
          <WifiOff className="h-4 w-4" />
          <span>You are offline. Some features may be unavailable.</span>
        </motion.div>
      )}
      {isOnline && (
        <div className="sr-only">
          <Wifi className="h-4 w-4" />
          <span>Online</span>
        </div>
      )}
    </AnimatePresence>
  )
}

// =============================================================================
// QR Code Display
// =============================================================================

export function generateQRPattern() {
  const rows = 15
  const cols = 15
  const pattern: boolean[][] = []
  for (let i = 0; i < rows; i++) {
    pattern.push([])
    for (let j = 0; j < cols; j++) {
      const isCorner =
        (i < 4 && j < 4) ||
        (i < 4 && j > cols - 5) ||
        (i > rows - 5 && j < 4)
      if (isCorner) {
        const isOuter =
          i === 0 ||
          j === 0 ||
          i === 3 ||
          j === 3 ||
          i === rows - 4 ||
          j === cols - 4 ||
          i === rows - 1 ||
          j === cols - 1
        const isInner =
          (i >= 1 && i <= 2 && j >= 1 && j <= 2) ||
          (i >= 1 && i <= 2 && j >= cols - 3 && j <= cols - 2) ||
          (i >= rows - 3 && i <= rows - 2 && j >= 1 && j <= 2)
        pattern[i].push(isOuter || isInner)
      } else {
        pattern[i].push(Math.random() > 0.5)
      }
    }
  }
  return pattern
}
