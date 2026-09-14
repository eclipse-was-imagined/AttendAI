"use client"

import { useMemo, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { AlertTriangle, BarChart3, Building2, CheckCircle2, Clock3, GraduationCap, QrCode, ShieldCheck, Users } from "lucide-react"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import RippleButton from "@/components/RippleButton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Role = "admin" | "teacher" | "student"
type DemoStudent = { registerNo: string; name: string; face: boolean; classCode: string; attendance: number }

const initialStudents: DemoStudent[] = [
  { registerNo: "22CSE1045", name: "Aarav Sharma", face: true, classCode: "ch202511223344", attendance: 92 },
  { registerNo: "22CSE1046", name: "Maya Patel", face: false, classCode: "ch202511223344", attendance: 68 },
]

export default function DemoPage() {
  const [role, setRole] = useState<Role>("admin")
  const [students, setStudents] = useState(initialStudents)
  const [className, setClassName] = useState("Computer Science - CSE B")
  const [classCode, setClassCode] = useState("ch202511223344")
  const [session, setSession] = useState<{ id: string; endsAt: number; lateAfter: number } | null>(null)
  const [duration, setDuration] = useState(60)
  const [lateAfter, setLateAfter] = useState(10)
  const [studentRegister, setStudentRegister] = useState("22CSE1045")
  const [studentStep, setStudentStep] = useState<"idle" | "gps" | "face" | "success">("idle")
  const [studentHistory, setStudentHistory] = useState<{ time: string; status: "present" | "late" }[]>([])

  const currentStudent = students.find((student) => student.registerNo === studentRegister) || students[0]
  const risk = currentStudent.attendance < 50 ? "High risk" : currentStudent.attendance < 75 ? "Needs attention" : "On track"
  const sessionSeconds = session ? Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000)) : 0
  const lowAttendance = students.filter((student) => student.attendance < 75)

  const startDemoSession = () => setSession({ id: `demo-${Date.now()}`, endsAt: Date.now() + duration * 60_000, lateAfter })
  const simulateStudentFlow = () => {
    if (!session) return
    setStudentStep("gps")
    window.setTimeout(() => setStudentStep("face"), 700)
    window.setTimeout(() => {
      const status = Date.now() > session.endsAt - (duration - session.lateAfter) * 60_000 ? "late" : "present"
      setStudentHistory((history) => [{ time: new Date().toLocaleTimeString(), status }, ...history])
      setStudentStep("success")
    }, 1400)
  }

  const tabLabel = useMemo(() => ({ admin: "Admin", teacher: "Teacher", student: "Student" }[role]), [role])

  return <div className="flex min-h-dvh flex-col"><AppHeader title="AttendAI Demo" /><OfflineIndicator /><main className="flex-1 px-4 py-6"><div className="mx-auto max-w-5xl space-y-5">
    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><div><h1 className="text-xl font-bold">Demo Mode</h1><p className="text-sm text-muted-foreground">Try the complete role flow without signing in or changing Supabase data.</p></div></div></div>
    <div className="grid grid-cols-3 gap-2">{(["admin", "teacher", "student"] as Role[]).map((item) => <button key={item} onClick={() => setRole(item)} className={`rounded-2xl border p-3 text-sm font-medium ${role === item ? "border-primary bg-primary/10 text-primary" : "border-border bg-card/50 text-muted-foreground"}`}>{item === "admin" ? <Building2 className="mx-auto mb-1 h-5 w-5" /> : item === "teacher" ? <Users className="mx-auto mb-1 h-5 w-5" /> : <GraduationCap className="mx-auto mb-1 h-5 w-5" />}{item[0].toUpperCase() + item.slice(1)}</button>)}</div>

    {role === "admin" && <div className="space-y-4"><Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-5 w-5 text-primary" /> Demo organization</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Organization</p><p className="font-semibold">Northstar College</p></div><div><p className="text-xs text-muted-foreground">Slug</p><p className="font-semibold text-primary">northstar-demo</p></div><div><p className="text-xs text-muted-foreground">Departments</p><p className="font-semibold">3 departments</p></div></CardContent></Card><div className="grid gap-4 sm:grid-cols-2"><Card className="rounded-3xl"><CardHeader><CardTitle className="text-base">Manage students</CardTitle></CardHeader><CardContent className="space-y-2">{students.map((student) => <div key={student.registerNo} className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2"><div><p className="text-sm font-medium">{student.name}</p><p className="text-xs text-muted-foreground">{student.registerNo} · {student.classCode}</p></div><span className={`text-xs ${student.face ? "text-green-600" : "text-yellow-600"}`}>{student.face ? "Face ready" : "Face pending"}</span></div>)}</CardContent></Card><Card className="rounded-3xl"><CardHeader><CardTitle className="text-base">Manage class</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class name" /><Input value={classCode} onChange={(e) => setClassCode(e.target.value)} placeholder="Class code" /><p className="text-xs text-muted-foreground">Demo class has {students.filter((student) => student.classCode === classCode).length} students assigned.</p></CardContent></Card></div></div>}

    {role === "teacher" && <div className="space-y-4"><Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><QrCode className="h-5 w-5 text-primary" /> {className}</CardTitle></CardHeader><CardContent className="space-y-4">{!session ? <><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Duration (minutes)<input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 1)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></label><label className="text-xs text-muted-foreground">Late after (minutes)<input type="number" min={0} value={lateAfter} onChange={(e) => setLateAfter(Number(e.target.value) || 0)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></label></div><RippleButton onClick={startDemoSession}>Start demo session</RippleButton></> : <div className="flex flex-col items-center gap-4"><div className="rounded-2xl bg-white p-4"><QRCodeCanvas value={JSON.stringify({ session_id: session.id, demo: true })} size={220} /></div><p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" /> Demo QR active · {Math.floor(sessionSeconds / 60)}m {sessionSeconds % 60}s left</p><RippleButton variant="destructive" onClick={() => setSession(null)}>End session</RippleButton></div>}</CardContent></Card><div className="grid gap-4 sm:grid-cols-2"><Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5 text-primary" /> Class analytics</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{students.length}</p><p className="text-sm text-muted-foreground">Students in class</p><p className="mt-3 text-sm text-yellow-600">{lowAttendance.length} low-attendance student{lowAttendance.length === 1 ? "" : "s"}</p></CardContent></Card><Card className="rounded-3xl"><CardHeader><CardTitle className="text-base">Correction history</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Teacher corrections and reasons appear here in the live app.</p></CardContent></Card></div></div>}

    {role === "student" && <div className="space-y-4"><Card className="rounded-3xl"><CardHeader><CardTitle className="text-base">Student verification demo</CardTitle></CardHeader><CardContent className="space-y-3"><select value={studentRegister} onChange={(e) => setStudentRegister(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground">{students.map((student) => <option key={student.registerNo} value={student.registerNo}>{student.name} ({student.registerNo})</option>)}</select><p className="text-sm text-muted-foreground">Select a student, then scan the active teacher QR.</p><RippleButton disabled={!session || studentStep === "gps" || studentStep === "face"} onClick={simulateStudentFlow}>{studentStep === "idle" ? "Scan demo QR" : studentStep === "gps" ? "Verifying GPS…" : studentStep === "face" ? "Face + blink verification…" : "Mark another attendance"}</RippleButton>{studentStep === "success" && <div className="flex items-center gap-2 rounded-xl bg-green-500/10 p-3 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" /> Attendance marked successfully.</div>}</CardContent></Card><div className="grid gap-4 sm:grid-cols-3"><Card className="rounded-2xl"><CardContent className="pt-5"><p className="text-2xl font-bold">{currentStudent.attendance}%</p><p className="text-xs text-muted-foreground">Attendance rate</p></CardContent></Card><Card className="rounded-2xl"><CardContent className="pt-5"><p className="text-lg font-bold">{risk}</p><p className="text-xs text-muted-foreground">Attendance risk</p></CardContent></Card><Card className="rounded-2xl"><CardContent className="pt-5"><p className="text-2xl font-bold">{studentHistory.length}</p><p className="text-xs text-muted-foreground">New demo records</p></CardContent></Card></div><Card className="rounded-3xl"><CardHeader><CardTitle className="text-base">My attendance</CardTitle></CardHeader><CardContent>{studentHistory.length === 0 ? <p className="text-sm text-muted-foreground">No new demo attendance yet.</p> : <div className="space-y-2">{studentHistory.map((record, index) => <div key={`${record.time}-${index}`} className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2 text-sm"><span>{record.time}</span><span className={record.status === "late" ? "text-yellow-600" : "text-green-600"}>{record.status}</span></div>)}</div>}</CardContent></Card><div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />Demo records are stored only in this page session.</div></div>}
    <p className="text-center text-xs text-muted-foreground">Current demo role: {tabLabel} · Real data is not changed.</p>
  </div></main></div>
}
