"use client"

import { motion } from "framer-motion"
import {
  Shield,
  GraduationCap,
  BookOpen,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { AppHeader, SecurityBadges, OfflineIndicator } from "@/components/attendance/shared"

export default function WelcomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader />
      <OfflineIndicator />

      <main className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center px-4 py-8"
        >
          <div className="flex w-full max-w-sm flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 18,
                  delay: 0.1,
                }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary"
              >
                <Shield className="h-8 w-8 text-primary-foreground" />
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-balance text-2xl font-bold text-foreground"
              >
                Welcome to SecureAttend
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground"
              >
                Secure classroom attendance with biometric verification, QR codes,
                and GPS validation.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex w-full flex-col gap-3"
            >
              <p className="text-center text-sm font-medium text-foreground">
                I am a...
              </p>

              <Link href="/teacher" className="group w-full">
                <Card className="cursor-pointer rounded-2xl border-border/50 shadow-md transition-all hover:border-primary/40 hover:shadow-lg">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                      <GraduationCap className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex flex-col items-start gap-0.5 text-left">
                      <span className="text-base font-semibold text-foreground">
                        Teacher
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Create sessions and track attendance
                      </span>
                    </div>
                    <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/student" className="group w-full">
                <Card className="cursor-pointer rounded-2xl border-border/50 shadow-md transition-all hover:border-primary/40 hover:shadow-lg">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex flex-col items-start gap-0.5 text-left">
                      <span className="text-base font-semibold text-foreground">
                        Student
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Mark attendance with secure verification
                      </span>
                    </div>
                    <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <SecurityBadges />
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
