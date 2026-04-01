"use client"

import { motion } from "framer-motion"
import type { Variants } from "framer-motion"
import { Shield, GraduationCap, BookOpen, ArrowRight, Fingerprint, MapPin, QrCode } from "lucide-react"
import Link from "next/link"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"


const floatingVariants: Variants = {
  animate: (i: number) => ({
    y: [0, -6, 0],
    transition: {
      duration: 2 + i * 0.3,
      repeat: Infinity,
      ease: "linear" as const,
      delay: i * 0.2,
    },
  }),
}

export default function WelcomePage() {
  return (
    <div className="flex min-h-dvh flex-col relative overflow-hidden">

      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-[80px]" />
        <div className="absolute top-1/2 -right-40 h-80 w-80 rounded-full bg-blue-500/15 blur-[70px]" />
        <div className="absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-violet-500/10 blur-[60px]" />
      </div>

      <AppHeader />
      <OfflineIndicator />

      <main className="relative z-10 flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center px-4 py-10"
        >
          <div className="flex w-full max-w-sm flex-col items-center gap-10">

            {/* Hero */}
            <div className="flex flex-col items-center gap-4 text-center">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
                className="relative"
              >
                {/* Softer glow */}
                <div className="absolute inset-0 rounded-3xl bg-primary/15 blur-lg scale-105" />

                {/* Warmer icon background */}
                <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-orange-400 shadow-lg shadow-primary/20">
                  <Shield className="h-10 w-10 text-white/90" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col gap-2"
              >
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  AttendAI
                </h1>
                <p className="text-sm text-muted-foreground max-w-[260px]">
                  Biometric attendance with face recognition, GPS & QR verification
                </p>
              </motion.div>

              {/* Floating pills */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap items-center justify-center gap-2"
              >
                {[
                  { icon: Fingerprint, label: "Face ID" },
                  { icon: MapPin, label: "GPS" },
                  { icon: QrCode, label: "QR Code" },
                ].map(({ icon: Icon, label }, i) => (
                  <motion.div
                    key={label}
                    custom={i}
                    variants={floatingVariants}
                    animate="animate"
                    className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 backdrop-blur-md shadow-sm will-change-transform"
                  >
                    <Icon className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-foreground">{label}</span>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Role buttons */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex w-full flex-col gap-3"
            >
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Continue as
              </p>

              {[
                {
                  href: "/teacher",
                  icon: GraduationCap,
                  title: "Teacher",
                  desc: "Create sessions & track attendance",
                  accent: "from-blue-500/10 to-blue-500/5",
                  border: "hover:border-blue-500/40",
                  iconBg: "bg-blue-500/15",
                  iconColor: "text-blue-500",
                  glow: "hover:shadow-blue-500/20",
                },
                {
                  href: "/student",
                  icon: BookOpen,
                  title: "Student",
                  desc: "Mark attendance with secure verification",
                  accent: "from-violet-500/10 to-violet-500/5",
                  border: "hover:border-violet-500/40",
                  iconBg: "bg-violet-500/15",
                  iconColor: "text-violet-500",
                  glow: "hover:shadow-violet-500/20",
                },
              ].map(({ href, icon: Icon, title, desc, accent, border, iconBg, iconColor, glow }, i) => (
                <motion.div
                  key={href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link href={href} className="group block w-full">
                    <div className={`relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${accent} backdrop-blur-xl shadow-lg transition-all duration-300 ${border} hover:shadow-xl ${glow}`}>
                      
                      <div className="absolute inset-0 bg-card/40 backdrop-blur-md" />
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                      <div className="relative flex items-center gap-4 p-5">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} transition-transform group-hover:scale-110`}>
                          <Icon className={`h-6 w-6 ${iconColor}`} />
                        </div>

                        <div className="flex flex-col text-left">
                          <span className="text-base font-semibold text-foreground">{title}</span>
                          <span className="text-xs text-muted-foreground">{desc}</span>
                        </div>

                        <motion.div className="ml-auto" whileHover={{ x: 4 }}>
                          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </motion.div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-4 py-2 backdrop-blur-md"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">
                End-to-end encrypted · No proxy attendance
              </span>
            </motion.div>

          </div>
        </motion.div>
      </main>
    </div>
  )
}