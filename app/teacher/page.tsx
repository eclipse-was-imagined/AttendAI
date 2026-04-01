"use client"

import Confetti from "@/components/Confetti"
import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { QRCodeCanvas } from "qrcode.react"
import {
  QrCode, LogOut, Users, Clock, Plus, Square,
  CalendarDays, ArrowUpDown, ArrowUp, ArrowDown, Search,
  ChevronLeft, ChevronRight, GraduationCap, Download, Eye, ArrowLeft, XCircle, RefreshCw, MapPin,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import RippleButton from "@/components/RippleButton"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

type ViewMode = "qr" | "sessions" | "details" | "goodbye"
type SortField = "register_no" | "scanned_at"
type SortDir = "asc" | "desc"

interface Session { id: string; faculty_id: string; created_at: string; latitude?: number; longitude?: number }
interface AttendanceRecord { id: string; session_id: string; register_no: string; scanned_at: string }

const GPS_THRESHOLD = 150 // meters — matches student page

function AttendanceDonut({ present, total }: { present: number; total: number }) {
  const absent = Math.max(0, total - present)
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0
  const chartData = [{ name: "Present", value: present }, { name: "Absent", value: absent }]
  return (
    <div className="relative mx-auto h-48 w-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={58} outerRadius={80} paddingAngle={3}
            dataKey="value" strokeWidth={0} animationBegin={200} animationDuration={800}>
            <Cell fill="#22c55e" />
            <Cell fill="#ef4444" />
          </Pie>
          <Tooltip content={({ active, payload }) => {
            if (active && payload?.length) return (
              <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow-lg">
                <span className="font-medium">{payload[0].name}: {payload[0].value}</span>
              </div>
            )
            return null
          }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{percentage}%</span>
        <span className="text-xs text-muted-foreground">Present</span>
      </div>
    </div>
  )
}

function GoodbyeScreen() {
  const [showConfetti] = useState(true)
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <Confetti trigger={showConfetti} />
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="flex flex-col items-center gap-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
          className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary shadow-2xl">
          <GraduationCap className="h-12 w-12 text-primary-foreground" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">See you next class!</h1>
          <p className="text-lg text-muted-foreground font-medium">Attendance made effortless. 🎓</p>
          <p className="text-sm text-muted-foreground mt-1">Your students&#39; attendance has been recorded securely.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="h-2 w-2 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }} />
          ))}
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="text-xs text-muted-foreground">Redirecting you out...</motion.p>
      </motion.div>
    </div>
  )
}


// ── Session skeleton ──────────────────────────────────────────────────────
function SessionSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="h-4 w-40 rounded-full bg-muted animate-pulse" />
              <div className="h-3 w-24 rounded-full bg-muted/70 animate-pulse" />
            </div>
            <div className="h-9 w-28 rounded-xl bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Attendance skeleton ────────────────────────────────────────────────────
function AttendanceSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div className="h-3.5 w-32 rounded-full bg-muted animate-pulse" />
          <div className="h-3.5 w-16 rounded-full bg-muted/70 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export default function TeacherDashboard() {
  const router = useRouter()

  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [facultyId, setFacultyId] = useState("")
  const [authError, setAuthError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const [view, setView] = useState<ViewMode>("qr")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [qrValue, setQrValue] = useState("")
  const [sessions, setSessions] = useState<Session[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [sessionLocation, setSessionLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("scanned_at")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const realtimeChannelRef = useRef<any>(null)

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => { if (data.session) setLoggedIn(true) })
    }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    setQrValue(JSON.stringify({ session_id: sessionId, t: Date.now() }))
    const interval = setInterval(() => setQrValue(JSON.stringify({ session_id: sessionId, t: Date.now() })), 10000)
    return () => clearInterval(interval)
  }, [sessionId])

  useEffect(() => {
    return () => { if (realtimeChannelRef.current && supabase) supabase.removeChannel(realtimeChannelRef.current) }
  }, [])

  // ── GPS Location (FIXED) ──────────────────────────────────────────────────
  // Takes 3 fresh readings (maximumAge: 0 = no stale cache), picks the one
  // with best accuracy so the saved session coordinates are reliable.
  const getLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return }

      const readings: GeolocationPosition[] = []
      const MAX_READINGS = 3

      const tryRead = () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            readings.push(pos)
            if (readings.length < MAX_READINGS) {
              setTimeout(tryRead, 800)
              return
            }
            // Use reading with best (lowest) reported accuracy
            const best = readings.reduce((a, b) =>
              a.coords.accuracy < b.coords.accuracy ? a : b
            )
            console.log(`[AttendAI] Teacher GPS locked, accuracy: ${best.coords.accuracy.toFixed(1)}m`)
            resolve({ lat: best.coords.latitude, lng: best.coords.longitude })
          },
          () => {
            if (readings.length > 0) {
              const best = readings.reduce((a, b) =>
                a.coords.accuracy < b.coords.accuracy ? a : b
              )
              resolve({ lat: best.coords.latitude, lng: best.coords.longitude })
            } else {
              resolve(null)
            }
          },
          { timeout: 12000, maximumAge: 0, enableHighAccuracy: true }
        )
      }

      tryRead()
    })
  }

  const loginTeacher = async () => {
    if (!isSupabaseConfigured || !supabase) { setLoggedIn(true); return }
    setIsLoading(true); setAuthError("")
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setAuthError(authError.message); return }
      const { data } = await supabase.from("teachers").select("*").eq("email", email).eq("faculty_id", facultyId).single()
      if (!data) { setAuthError("Faculty ID does not match this email"); return }
      setLoggedIn(true)
    } catch (err: any) {
      setAuthError(err?.message || "Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const startSession = async () => {
    if (!isSupabaseConfigured || !supabase) { setSessionId(`demo-${Date.now()}`); return }

    setIsGettingLocation(true)
    const location = await getLocation()
    setIsGettingLocation(false)
    setSessionLocation(location)

    const insertData: any = { faculty_id: facultyId }
    if (location) {
      insertData.latitude = location.lat
      insertData.longitude = location.lng
    }

    const { data } = await supabase.from("sessions").insert(insertData).select().single()
    if (data) setSessionId(data.id)
  }

  const endSession = () => { setSessionId(null); setQrValue(""); setSessionLocation(null) }

  const loadSessions = async () => {
    setIsLoadingSessions(true)
    if (!isSupabaseConfigured || !supabase) {
      setSessions([
        { id: "demo-1", faculty_id: "FAC001", created_at: new Date().toISOString() },
        { id: "demo-2", faculty_id: "FAC001", created_at: new Date(Date.now() - 86400000).toISOString() },
      ])
      setView("sessions"); return
    }
    const { data } = await supabase.from("sessions").select("*").eq("faculty_id", facultyId).order("created_at", { ascending: false })
    setSessions(data || []); setIsLoadingSessions(false); setView("sessions")
  }

  const loadAttendance = async (session: Session) => {
    setSelectedSession(session)
    if (!isSupabaseConfigured || !supabase) {
      setAttendance([
        { id: "1", session_id: session.id, register_no: "STU-2024-001", scanned_at: new Date().toISOString() },
        { id: "2", session_id: session.id, register_no: "STU-2024-002", scanned_at: new Date().toISOString() },
      ])
      setView("details"); return
    }
    const { data } = await supabase.from("attendance").select("*").eq("session_id", session.id).order("scanned_at", { ascending: true })
    setAttendance(data || [])
    setView("details")

    if (realtimeChannelRef.current) await supabase.removeChannel(realtimeChannelRef.current)
    const channel = supabase.channel(`attendance-${session.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance", filter: `session_id=eq.${session.id}` },
        (payload) => {
          const newRecord = payload.new as AttendanceRecord
          setAttendance((prev) => {
            if (prev.find((r) => r.id === newRecord.id)) return prev
            return [...prev, newRecord].sort((a, b) => a.scanned_at.localeCompare(b.scanned_at))
          })
        })
      .subscribe()
    realtimeChannelRef.current = channel
  }

  const manualRefresh = async () => {
    if (!selectedSession || !supabase) return
    setIsRefreshing(true)
    const { data } = await supabase.from("attendance").select("*").eq("session_id", selectedSession.id).order("scanned_at", { ascending: true })
    setAttendance(data || [])
    setIsRefreshing(false)
  }

  const exportCSV = () => {
    const header = "Register Number,Scanned At\n"
    const rows = attendance.map((a) => `${a.register_no},${a.scanned_at}`).join("\n")
    const blob = new Blob([header + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `attendance-${selectedSession?.id}.csv`; a.click()
  }

  const handleLogout = async () => {
    if (realtimeChannelRef.current && supabase) await supabase.removeChannel(realtimeChannelRef.current)
    setView("goodbye")
    setTimeout(async () => {
      if (isSupabaseConfigured && supabase) await supabase.auth.signOut()
      setLoggedIn(false); setView("qr"); setSessionId(null); setAttendance([]); setSelectedSession(null)
    }, 3500)
  }

  const filteredAttendance = useMemo(() => {
    let result = [...attendance]
    if (searchQuery) result = result.filter((a) => a.register_no.toLowerCase().includes(searchQuery.toLowerCase()))
    result.sort((a, b) => {
      const cmp = a[sortField] < b[sortField] ? -1 : a[sortField] > b[sortField] ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
    return result
  }, [attendance, searchQuery, sortField, sortDir])

  const totalPages = Math.ceil(filteredAttendance.length / pageSize)
  const paginatedAttendance = filteredAttendance.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  if (view === "goodbye") return <GoodbyeScreen />

  // LOGIN
  if (!loggedIn) {
    return (
      <div className="flex min-h-dvh flex-col relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0"><div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" /><div className="absolute bottom-0 -left-20 h-72 w-72 rounded-full bg-blue-500/10 blur-[90px]" /></div>
        <AppHeader />
        <OfflineIndicator />
        <main className="flex-1">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center px-4 py-8">
            <Card className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/50 shadow-2xl backdrop-blur-xl w-full max-w-sm">
              <CardHeader className="items-center pb-2 pt-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
                  <GraduationCap className="h-8 w-8 text-primary-foreground" />
                </motion.div>
                <CardTitle className="text-2xl font-bold">Teacher Login</CardTitle>
                <CardDescription>Sign in to manage attendance</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pb-8">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" placeholder="teacher@example.com" className="rounded-xl h-11" value={email}
                    onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loginTeacher()} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" placeholder="••••••••" className="rounded-xl h-11" value={password}
                    onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loginTeacher()} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Faculty ID</label>
                  <Input type="text" placeholder="FAC001" className="rounded-xl h-11" value={facultyId}
                    onChange={(e) => setFacultyId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loginTeacher()} />
                </div>
                <AnimatePresence>
                  {authError && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5">
                      <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                      <p className="text-sm text-destructive">{authError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                <RippleButton className="mt-1 h-11 w-full text-base font-semibold" onClick={loginTeacher}
                  disabled={isLoading || !email || !password || !facultyId}>
                  {isLoading ? "Signing in..." : "Login"}
                </RippleButton>
                <RippleButton variant="ghost" className="w-full text-muted-foreground" onClick={() => router.push("/")}>
                  Back to Home
                </RippleButton>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    )
  }

  // QR VIEW
  if (view === "qr") {
    return (
      <div className="flex min-h-dvh flex-col relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0"><div className="absolute -top-20 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-[100px]" /><div className="absolute bottom-0 right-0 h-60 w-60 rounded-full bg-violet-500/10 blur-[80px]" /></div>
        <AppHeader />
        <OfflineIndicator />
        <main className="flex-1 overflow-y-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="flex flex-col gap-6 px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Teacher Dashboard</h1>
                <p className="text-sm text-muted-foreground">Faculty ID: {facultyId || "Demo Mode"}</p>
              </div>
              <RippleButton variant="outline" size="sm" className="gap-1.5" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Logout
              </RippleButton>
            </div>
            <Card className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/50 shadow-xl backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-5 w-5 text-primary" /> Attendance QR Code
                </CardTitle>
                <CardDescription>
                  {sessionId ? "Students can scan this code to mark attendance" : "Start a session to generate QR code"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {sessionId ? (
                  <>
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className="rounded-2xl bg-white p-4 shadow-lg">
                      <QRCodeCanvas value={qrValue} size={200} level="H" includeMargin className="rounded-lg" />
                    </motion.div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Refreshes every 10 seconds</span>
                    </div>
                    {sessionLocation ? (
                      <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-600">
                        <MapPin className="h-3 w-3" />
                        GPS locked · students must be within {GPS_THRESHOLD}m
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-xs text-yellow-600">
                        <MapPin className="h-3 w-3" />
                        No GPS — location check skipped
                      </div>
                    )}
                    <RippleButton variant="destructive" className="w-full gap-2" onClick={endSession}>
                      <Square className="h-4 w-4" /> End Session
                    </RippleButton>
                  </>
                ) : (
                  <RippleButton className="w-full gap-2" onClick={startSession} disabled={isGettingLocation}>
                    {isGettingLocation ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Getting location...</>
                    ) : (
                      <><Plus className="h-4 w-4" /> Start New Session</>
                    )}
                  </RippleButton>
                )}
              </CardContent>
            </Card>
            <RippleButton variant="outline" className="gap-2 w-full" onClick={loadSessions}>
              <CalendarDays className="h-4 w-4" /> View Past Sessions
            </RippleButton>
          </motion.div>
        </main>
      </div>
    )
  }

  // SESSIONS LIST
  if (view === "sessions") {
    return (
      <div className="flex min-h-dvh flex-col relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0"><div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/10 blur-[90px]" /></div>
        <AppHeader />
        <OfflineIndicator />
        <main className="flex-1 overflow-y-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="flex flex-col gap-4 px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RippleButton variant="ghost" size="icon" onClick={() => setView("qr")}>
                  <ArrowLeft className="h-5 w-5" />
                </RippleButton>
                <div>
                  <h1 className="text-lg font-bold">Sessions</h1>
                  <p className="text-sm text-muted-foreground">{sessions.length} session{sessions.length !== 1 ? "s" : ""} found</p>
                </div>
              </div>
              <RippleButton variant="outline" size="sm" className="gap-1.5" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </RippleButton>
            </div>
            {isLoadingSessions ? <SessionSkeleton /> : (
            <div className="flex flex-col gap-3">
              {sessions.length === 0 ? (
                <Card className="glass rounded-2xl p-8 text-center">
                  <p className="text-muted-foreground">No sessions found</p>
                </Card>
              ) : (
                sessions.map((session, idx) => (
                  <motion.div key={session.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                    <Card className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 shadow-lg backdrop-blur-xl">
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">
                            {new Date(session.created_at).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm text-muted-foreground">
                              {new Date(session.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {session.latitude && (
                              <span className="flex items-center gap-0.5 text-xs text-green-600">
                                <MapPin className="h-2.5 w-2.5" /> GPS
                              </span>
                            )}
                          </div>
                        </div>
                        <RippleButton variant="outline" size="sm" className="gap-1.5" onClick={() => loadAttendance(session)}>
                          <Eye className="h-4 w-4" /> View Details
                        </RippleButton>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
            )}
          </motion.div>
        </main>
      </div>
    )
  }

  // SESSION DETAILS
  return (
    <div className="flex min-h-dvh flex-col relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0"><div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-primary/10 blur-[90px]" /><div className="absolute bottom-0 -right-20 h-60 w-60 rounded-full bg-blue-500/10 blur-[80px]" /></div>
      <AppHeader />
      <OfflineIndicator />
      <main className="flex-1 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RippleButton variant="ghost" size="icon" onClick={() => {
                if (realtimeChannelRef.current && supabase) supabase.removeChannel(realtimeChannelRef.current)
                setSelectedSession(null); setAttendance([]); setView("sessions")
              }}>
                <ArrowLeft className="h-5 w-5" />
              </RippleButton>
              <div>
                <h1 className="text-lg font-bold">Session Details</h1>
                <p className="text-sm text-muted-foreground">{selectedSession && new Date(selectedSession.created_at).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RippleButton variant="outline" size="icon" className="h-9 w-9" onClick={manualRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </RippleButton>
              <RippleButton variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
                <Download className="h-4 w-4" /> Export
              </RippleButton>
            </div>
          </div>

          <Card className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 shadow-lg backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                    <Users className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{attendance.length}</p>
                    <p className="text-sm text-muted-foreground">Students attended</p>
                  </div>
                </div>
                <AttendanceDonut present={attendance.length} total={30} />
              </div>
            </CardContent>
          </Card>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by register number..." className="rounded-xl pl-9" value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }} />
          </div>

          <Card className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 shadow-lg backdrop-blur-xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("register_no")}>
                      <div className="flex items-center gap-1">
                        Register No
                        {sortField === "register_no" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("scanned_at")}>
                      <div className="flex items-center justify-end gap-1">
                        Time
                        {sortField === "scanned_at" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No attendance records</TableCell>
                    </TableRow>
                  ) : (
                    paginatedAttendance.map((record) => (
                      <motion.tr key={record.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="border-b transition-colors hover:bg-muted/50">
                        <TableCell className="font-medium">{record.register_no}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {new Date(record.scanned_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
              <div className="flex gap-2">
                <RippleButton variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </RippleButton>
                <RippleButton variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </RippleButton>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live updates enabled
          </div>
        </motion.div>
      </main>
    </div>
  )
}