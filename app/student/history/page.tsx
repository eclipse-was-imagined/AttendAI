"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarCheck, ShieldAlert, TrendingUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Session = { id: string; created_at: string }
type Attendance = { session_id: string; scanned_at: string; status?: "present" | "late" }

export default function StudentHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [registerNo, setRegisterNo] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) { setLoading(false); return }
      const { data: student } = await supabase.from("students").select("register_no, college_id").eq("email", auth.user.email || "").maybeSingle()
      if (!student) { setLoading(false); return }
      setRegisterNo(student.register_no)
      const [{ data: sessionRows }, { data: attendanceRows }] = await Promise.all([
        supabase.from("sessions").select("id, created_at").eq("college_id", student.college_id).order("created_at", { ascending: false }),
        supabase.from("attendance").select("session_id, scanned_at, status").eq("register_no", student.register_no).order("scanned_at", { ascending: false }),
      ])
      setSessions((sessionRows as Session[]) || []); setAttendance((attendanceRows as Attendance[]) || []); setLoading(false)
    }
    load()
  }, [])

  const attended = new Set(attendance.map((row) => row.session_id))
  const percentage = sessions.length ? Math.round((attended.size / sessions.length) * 100) : 0
  const risk = percentage < 50 ? "High risk" : percentage < 75 ? "Needs attention" : "On track"
  const recent = useMemo(() => attendance.slice(0, 12), [attendance])

  return <div className="flex min-h-dvh flex-col"><AppHeader title="Student Attendance" /><OfflineIndicator /><main className="flex-1 px-4 py-6"><div className="mx-auto max-w-3xl space-y-5"><div className="flex items-center gap-3"><Link href="/student" className="rounded-xl border border-border p-2"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="text-2xl font-bold">My attendance</h1><p className="text-sm text-muted-foreground">{registerNo || "Student history"}</p></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><Card className="rounded-2xl"><CardContent className="flex items-center gap-3 pt-6"><CalendarCheck className="text-primary" /><div><p className="text-2xl font-bold">{attended.size}/{sessions.length}</p><p className="text-xs text-muted-foreground">Sessions attended</p></div></CardContent></Card><Card className="rounded-2xl"><CardContent className="flex items-center gap-3 pt-6"><TrendingUp className="text-green-500" /><div><p className="text-2xl font-bold">{percentage}%</p><p className="text-xs text-muted-foreground">Attendance rate</p></div></CardContent></Card><Card className="rounded-2xl"><CardContent className="flex items-center gap-3 pt-6"><ShieldAlert className={percentage < 75 ? "text-yellow-500" : "text-green-500"} /><div><p className="text-lg font-bold">{risk}</p><p className="text-xs text-muted-foreground">Attendance risk</p></div></CardContent></Card></div>
    <Card className="rounded-3xl"><CardHeader><CardTitle className="text-base">Recent attendance</CardTitle></CardHeader><CardContent>{loading ? <p className="text-sm text-muted-foreground">Loading history…</p> : recent.length === 0 ? <p className="text-sm text-muted-foreground">No attendance records yet.</p> : <div className="space-y-2">{recent.map((row) => <div key={`${row.session_id}-${row.scanned_at}`} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3"><div><span className="block text-sm">Session {row.session_id.slice(0, 8)}</span><span className={`text-xs font-medium ${row.status === "late" ? "text-yellow-600" : "text-green-600"}`}>{row.status === "late" ? "Late" : "Present"}</span></div><span className="text-xs text-muted-foreground">{new Date(row.scanned_at).toLocaleString()}</span></div>)}</div>}</CardContent></Card>
  </div></main></div>
}
