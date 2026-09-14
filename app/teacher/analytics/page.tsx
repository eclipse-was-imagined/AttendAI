"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, BarChart3, Users, AlertTriangle, TrendingUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Student = { register_no: string; name: string }
type Session = { id: string; faculty_id: string; created_at: string }
type Attendance = { session_id: string; register_no: string }

export default function TeacherAnalyticsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) { setLoading(false); return }
      const { data: teacher } = await supabase.from("teachers").select("faculty_id").eq("email", auth.user.email || "").maybeSingle()
      if (!teacher) { setLoading(false); return }
      const { data: sessionRows } = await supabase.from("sessions").select("id, faculty_id, created_at").eq("faculty_id", teacher.faculty_id).order("created_at", { ascending: false })
      const currentSessions = (sessionRows as Session[]) || []
      const ids = currentSessions.map((session) => session.id)
      const [{ data: studentRows }, { data: attendanceRows }] = await Promise.all([
        supabase.from("students").select("register_no, name").order("name"),
        ids.length ? supabase.from("attendance").select("session_id, register_no").in("session_id", ids) : Promise.resolve({ data: [] as Attendance[] }),
      ])
      setSessions(currentSessions); setStudents((studentRows as Student[]) || []); setAttendance((attendanceRows as Attendance[]) || []); setLoading(false)
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const totalSessions = sessions.length
    const present = new Set(attendance.map((row) => `${row.session_id}:${row.register_no}`))
    const low = students.map((student) => {
      const attended = new Set(attendance.filter((row) => row.register_no === student.register_no).map((row) => row.session_id)).size
      const percentage = totalSessions ? Math.round((attended / totalSessions) * 100) : 0
      return { ...student, attended, percentage }
    }).filter((student) => student.percentage < 75).sort((a, b) => a.percentage - b.percentage)
    return { totalSessions, totalStudents: students.length, present: present.size, low }
  }, [sessions, students, attendance])

  return <div className="flex min-h-dvh flex-col"><AppHeader title="Teacher Analytics" /><OfflineIndicator /><main className="flex-1 px-4 py-6"><div className="mx-auto max-w-4xl space-y-5"><div className="flex items-center gap-3"><Link href="/teacher" className="rounded-xl border border-border p-2"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="text-2xl font-bold">Class analytics</h1><p className="text-sm text-muted-foreground">Attendance performance across your sessions</p></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><Card className="rounded-2xl"><CardContent className="flex items-center gap-3 pt-6"><BarChart3 className="text-primary" /><div><p className="text-2xl font-bold">{stats.totalSessions}</p><p className="text-xs text-muted-foreground">Sessions</p></div></CardContent></Card><Card className="rounded-2xl"><CardContent className="flex items-center gap-3 pt-6"><Users className="text-blue-500" /><div><p className="text-2xl font-bold">{stats.totalStudents}</p><p className="text-xs text-muted-foreground">Students</p></div></CardContent></Card><Card className="rounded-2xl"><CardContent className="flex items-center gap-3 pt-6"><TrendingUp className="text-green-500" /><div><p className="text-2xl font-bold">{stats.present}</p><p className="text-xs text-muted-foreground">Attendance records</p></div></CardContent></Card></div>
    <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5 text-yellow-500" /> Low attendance students</CardTitle></CardHeader><CardContent>{loading ? <p className="text-sm text-muted-foreground">Loading analytics…</p> : stats.low.length === 0 ? <p className="text-sm text-green-600">No students are currently below 75%.</p> : <div className="space-y-2">{stats.low.map((student) => <div key={student.register_no} className="flex items-center justify-between rounded-xl bg-yellow-500/10 px-4 py-3"><div><p className="font-medium">{student.name}</p><p className="text-xs text-muted-foreground">{student.register_no} · {student.attended}/{stats.totalSessions} sessions</p></div><span className="font-bold text-yellow-600">{student.percentage}%</span></div>)}</div>}</CardContent></Card>
  </div></main></div>
}
