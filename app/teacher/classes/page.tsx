"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, BookOpen, Plus, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import RippleButton from "@/components/RippleButton"

type ClassRow = { id: string; name: string; code: string; college_id: string; teacher_faculty_id: string }
type Member = { class_id: string; register_no: string }

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<ClassRow | null>(null)
  const [registerNo, setRegisterNo] = useState("")
  const [message, setMessage] = useState("")

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    const { data: teacher } = await supabase.from("teachers").select("faculty_id, college_id").eq("email", auth.user.email || "").maybeSingle()
    if (!teacher) return
    const { data } = await supabase.from("classes").select("id, name, code, college_id, teacher_faculty_id").eq("college_id", teacher.college_id).eq("teacher_faculty_id", teacher.faculty_id).order("name")
    setClasses((data as ClassRow[]) || [])
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const choose = async (row: ClassRow) => {
    setSelected(row); setMessage("")
    const { data } = await supabase.from("class_students").select("class_id, register_no").eq("class_id", row.id)
    setMembers((data as Member[]) || [])
  }

  const addMember = async () => {
    if (!selected || !registerNo.trim()) return
    const { error } = await supabase.from("class_students").insert({ class_id: selected.id, college_id: selected.college_id, register_no: registerNo.trim() })
    if (error) setMessage(error.message); else { setRegisterNo(""); setMessage("Student added to class."); await choose(selected) }
  }

  const removeMember = async (member: Member) => {
    if (!selected) return
    const { error } = await supabase.from("class_students").delete().eq("class_id", selected.id).eq("register_no", member.register_no)
    if (error) setMessage(error.message); else await choose(selected)
  }

  return <div className="flex min-h-dvh flex-col"><AppHeader title="My Classes" /><OfflineIndicator /><main className="flex-1 px-4 py-6"><div className="mx-auto max-w-4xl space-y-5"><div className="flex items-center gap-3"><Link href="/teacher" className="rounded-xl border border-border p-2"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="text-2xl font-bold">Manage my classes</h1><p className="text-sm text-muted-foreground">View classes assigned to you and manage student membership</p></div></div>
    <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]"> <Card className="rounded-3xl"><CardHeader><CardTitle className="text-base">Assigned classes</CardTitle></CardHeader><CardContent className="space-y-2">{classes.length === 0 ? <p className="text-sm text-muted-foreground">No classes assigned yet.</p> : classes.map((row) => <button key={row.id} onClick={() => choose(row)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected?.id === row.id ? "border-primary bg-primary/10" : "border-border/50 hover:bg-muted/40"}`}><BookOpen className="h-4 w-4 text-primary" /><span><span className="block font-medium">{row.name}</span><span className="text-xs text-muted-foreground">{row.code}</span></span></button>)}</CardContent></Card>
      <Card className="rounded-3xl"><CardHeader><CardTitle className="text-base">{selected ? `${selected.name} students` : "Select a class"}</CardTitle></CardHeader><CardContent>{selected ? <div className="space-y-3"><div className="flex gap-2"><Input placeholder="Register number" value={registerNo} onChange={(e) => setRegisterNo(e.target.value)} /><RippleButton size="sm" className="gap-1" onClick={addMember}><Plus className="h-4 w-4" /> Add</RippleButton></div>{message && <p className="text-xs text-muted-foreground">{message}</p>}{members.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No students assigned.</p> : members.map((member) => <div key={member.register_no} className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2"><span className="text-sm">{member.register_no}</span><button onClick={() => removeMember(member)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Choose a class to manage its students.</p>}</CardContent></Card></div>
  </div></main></div>
}
