"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { QRCodeCanvas } from "qrcode.react"
import {
  QrCode,
  LogOut,
  Users,
  Clock,
  Plus,
  Square,
  CheckCircle2,
  XCircle,
  CalendarDays,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Download,
  Eye,
  ArrowLeft,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

// =============================================================================
// Types
// =============================================================================

type ViewMode = "qr" | "sessions" | "details"
type SortField = "register_no" | "scanned_at"
type SortDir = "asc" | "desc"

interface Session {
  id: string
  faculty_id: string
  created_at: string
}

interface AttendanceRecord {
  id: string
  session_id: string
  register_no: string
  scanned_at: string
}

// =============================================================================
// Attendance Donut Chart
// =============================================================================

function AttendanceDonut({
  present,
  total,
}: {
  present: number
  total: number
}) {
  const absent = total - present
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0
  const chartData = [
    { name: "Present", value: present },
    { name: "Absent", value: absent },
  ]

  return (
    <div className="relative mx-auto h-48 w-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
            animationBegin={200}
            animationDuration={800}
          >
            <Cell fill="hsl(var(--success))" />
            <Cell fill="hsl(var(--destructive))" />
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow-lg">
                    <span className="font-medium text-foreground">
                      {payload[0].name}: {payload[0].value}
                    </span>
                  </div>
                )
              }
              return null
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground">{percentage}%</span>
        <span className="text-xs text-muted-foreground">Present</span>
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export default function TeacherDashboard() {
  const router = useRouter()

  // Auth state
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [facultyId, setFacultyId] = useState("")
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Dashboard state
  const [view, setView] = useState<ViewMode>("qr")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [qrValue, setQrValue] = useState("")
  const [sessions, setSessions] = useState<Session[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  // Table state
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("scanned_at")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Check existing session on mount
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setLoggedIn(true)
      })
    }
  }, [])

  // Dynamic QR code generation
  useEffect(() => {
    if (!sessionId) return

    // Initial QR value
    setQrValue(
      JSON.stringify({
        session_id: sessionId,
        t: Date.now(),
      })
    )

    const interval = setInterval(() => {
      setQrValue(
        JSON.stringify({
          session_id: sessionId,
          t: Date.now(),
        })
      )
    }, 10000)

    return () => clearInterval(interval)
  }, [sessionId])

  // Login handler
  const loginTeacher = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoggedIn(true)
      return
    }

    setIsLoading(true)
    setStatus("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setStatus(error.message)
      setIsLoading(false)
      return
    }

    const { data } = await supabase
      .from("teachers")
      .select("*")
      .eq("email", email)
      .eq("faculty_id", facultyId)
      .single()

    if (!data) {
      setStatus("Faculty ID does not match email")
      setIsLoading(false)
      return
    }

    setLoggedIn(true)
    setIsLoading(false)
  }

  // Start new session
  const startSession = async () => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo mode
      const demoId = `demo-${Date.now()}`
      setSessionId(demoId)
      return
    }

    const { data } = await supabase
      .from("sessions")
      .insert({ faculty_id: facultyId })
      .select()
      .single()

    if (data) {
      setSessionId(data.id)
    }
  }

  // End session
  const endSession = () => {
    setSessionId(null)
    setQrValue("")
  }

  // Load sessions
  const loadSessions = async () => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo mode
      setSessions([
        { id: "demo-1", faculty_id: "FAC001", created_at: new Date().toISOString() },
        { id: "demo-2", faculty_id: "FAC001", created_at: new Date(Date.now() - 86400000).toISOString() },
      ])
      setView("sessions")
      return
    }

    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("faculty_id", facultyId)
      .order("created_at", { ascending: false })

    setSessions(data || [])
    setView("sessions")
  }

  // Load attendance for a session
  const loadAttendance = async (session: Session) => {
    setSelectedSession(session)

    if (!isSupabaseConfigured || !supabase) {
      // Demo mode
      setAttendance([
        { id: "1", session_id: session.id, register_no: "STU-2024-001", scanned_at: new Date().toISOString() },
        { id: "2", session_id: session.id, register_no: "STU-2024-002", scanned_at: new Date().toISOString() },
      ])
      setView("details")
      return
    }

    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("session_id", session.id)
      .order("scanned_at", { ascending: true })

    setAttendance(data || [])
    setView("details")
  }

  // Export CSV
  const exportCSV = () => {
    const header = "Register Number,Scanned At\n"
    const rows = attendance
      .map((a) => `${a.register_no},${a.scanned_at}`)
      .join("\n")

    const blob = new Blob([header + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-${selectedSession?.id}.csv`
    a.click()
  }

  // Logout
  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    }
    setLoggedIn(false)
    setView("qr")
    setSessionId(null)
  }

  // Filtered and sorted attendance
  const filteredAttendance = useMemo(() => {
    let result = [...attendance]

    // Search
    if (searchQuery) {
      result = result.filter((a) =>
        a.register_no.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [attendance, searchQuery, sortField, sortDir])

  // Pagination
  const totalPages = Math.ceil(filteredAttendance.length / pageSize)
  const paginatedAttendance = filteredAttendance.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  // =========================================================================
  // LOGIN SCREEN
  // =========================================================================
  if (!loggedIn) {
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
            <Card className="w-full max-w-sm rounded-2xl border-border/50 shadow-lg">
              <CardHeader className="items-center pb-2">
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                  <GraduationCap className="h-7 w-7 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl font-bold">Teacher Login</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Sign in to manage attendance
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="teacher@example.com"
                    className="rounded-xl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    className="rounded-xl"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground">
                    Faculty ID
                  </label>
                  <Input
                    type="text"
                    placeholder="FAC001"
                    className="rounded-xl"
                    value={facultyId}
                    onChange={(e) => setFacultyId(e.target.value)}
                  />
                </div>

                {status && (
                  <p className="text-center text-sm text-destructive">{status}</p>
                )}

                <Button
                  className="mt-2 w-full gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={loginTeacher}
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Login"}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full rounded-xl text-muted-foreground"
                  onClick={() => router.push("/")}
                >
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    )
  }

  // =========================================================================
  // QR VIEW
  // =========================================================================
  if (view === "qr") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <AppHeader />
        <OfflineIndicator />

        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-6 px-4 py-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-foreground">
                  Teacher Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Faculty ID: {facultyId || "Demo Mode"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl border-border/50"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>

            {/* QR Code Card */}
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-5 w-5 text-primary" />
                  Attendance QR Code
                </CardTitle>
                <CardDescription>
                  {sessionId
                    ? "Students can scan this code to mark attendance"
                    : "Start a session to generate QR code"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {sessionId ? (
                  <>
                    <div className="rounded-2xl bg-card p-4">
                      <QRCodeCanvas
                        value={qrValue}
                        size={200}
                        level="H"
                        includeMargin
                        className="rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Refreshes every 10 seconds</span>
                    </div>
                    <Button
                      variant="destructive"
                      className="w-full gap-2 rounded-xl"
                      onClick={endSession}
                    >
                      <Square className="h-4 w-4" />
                      End Session
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full gap-2 rounded-xl"
                    onClick={startSession}
                  >
                    <Plus className="h-4 w-4" />
                    Start New Session
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* View Sessions Button */}
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={loadSessions}
            >
              <CalendarDays className="h-4 w-4" />
              View Past Sessions
            </Button>
          </motion.div>
        </main>
      </div>
    )
  }

  // =========================================================================
  // SESSIONS LIST VIEW
  // =========================================================================
  if (view === "sessions") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <AppHeader />
        <OfflineIndicator />

        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-4 px-4 py-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setView("qr")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Sessions</h1>
                  <p className="text-sm text-muted-foreground">
                    {sessions.length} session{sessions.length !== 1 ? "s" : ""} found
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl border-border/50"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

            {/* Sessions List */}
            <div className="flex flex-col gap-3">
              {sessions.length === 0 ? (
                <Card className="rounded-2xl border-border/50 p-8 text-center">
                  <p className="text-muted-foreground">No sessions found</p>
                </Card>
              ) : (
                sessions.map((session) => (
                  <Card
                    key={session.id}
                    className="rounded-2xl border-border/50 shadow-sm"
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {new Date(session.created_at).toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(session.created_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-xl"
                        onClick={() => loadAttendance(session)}
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </motion.div>
        </main>
      </div>
    )
  }

  // =========================================================================
  // SESSION DETAILS VIEW
  // =========================================================================
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader />
      <OfflineIndicator />

      <main className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 px-4 py-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => {
                  setSelectedSession(null)
                  setAttendance([])
                  setView("sessions")
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-foreground">
                  Session Details
                </h1>
                <p className="text-sm text-muted-foreground">
                  {selectedSession &&
                    new Date(selectedSession.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl border-border/50"
              onClick={exportCSV}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>

          {/* Stats Card */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                    <Users className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {attendance.length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Students attended
                    </p>
                  </div>
                </div>
                <AttendanceDonut present={attendance.length} total={30} />
              </div>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by register number..."
              className="rounded-xl pl-9"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          {/* Attendance Table */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead
                      className="cursor-pointer"
                      onClick={() => toggleSort("register_no")}
                    >
                      <div className="flex items-center gap-1">
                        Register No
                        {sortField === "register_no" ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer text-right"
                      onClick={() => toggleSort("scanned_at")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Time
                        {sortField === "scanned_at" ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8">
                        <p className="text-muted-foreground">No attendance records</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAttendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.register_no}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {new Date(record.scanned_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
