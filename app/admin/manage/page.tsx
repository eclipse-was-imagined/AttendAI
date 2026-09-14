"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Building2, CheckCircle2, GraduationCap, Layers3, Plus, Trash2, Users } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import OrganizationBadge from "@/components/attendance/OrganizationBadge"
import RippleButton from "@/components/RippleButton"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type College = { id: string; name: string; slug: string }
type Row = { id?: string; name: string; code?: string; email?: string; register_no?: string; faculty_id?: string; teacher_faculty_id?: string }

export default function AdminManagePage() {
  const [college, setCollege] = useState<College | null>(null)
  const [tab, setTab] = useState<"students" | "teachers" | "classes" | "departments" | "organization">("students")
  const [rows, setRows] = useState<Row[]>([])
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [email, setEmail] = useState("")
  const [teacherId, setTeacherId] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    const { data: admin } = await supabase.from("college_admins").select("college_id, colleges(id, name, slug)").eq("user_id", auth.user.id).maybeSingle()
    const current = (admin as { colleges?: College } | null)?.colleges
    if (!current) return
    setCollege(current)
    if (tab === "organization") { setRows([]); return }
    const table = tab === "students" ? "students" : tab === "teachers" ? "teachers" : tab
    const { data } = await supabase.from(table).select("*").eq("college_id", current.id).order("name")
    setRows((data as Row[]) || [])
  }

  useEffect(() => { load() }, [tab])

  const add = async () => {
    if (!college || !name.trim()) return
    setBusy(true); setError(""); setMessage("")
    try {
      if (tab === "organization") {
        const { error: updateError } = await supabase.from("colleges").update({ name: name.trim(), slug: code.trim() || college.slug }).eq("id", college.id)
        if (updateError) throw updateError
        setCollege({ ...college, name: name.trim(), slug: code.trim() || college.slug }); setMessage("Organization updated.")
      } else {
        const payload = tab === "students" ? { college_id: college.id, register_no: code.trim(), name: name.trim(), email: email.trim() } : tab === "teachers" ? { college_id: college.id, faculty_id: code.trim(), name: name.trim(), email: email.trim() } : { college_id: college.id, name: name.trim(), code: code.trim(), ...(tab === "classes" ? { teacher_faculty_id: teacherId.trim() || null } : {}) }
        const { error: insertError } = await supabase.from(tab).insert(payload)
        if (insertError) throw insertError
        setMessage(`${tab.slice(0, -1)} added.`); setName(""); setCode(""); setEmail(""); setTeacherId(""); await load()
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not save changes") } finally { setBusy(false) }
  }

  const remove = async (row: Row) => {
    if (!confirm("Remove this record?")) return
    const result = tab === "students"
      ? await supabase.from("students").delete().eq("college_id", college?.id || "").eq("register_no", row.register_no || "")
      : tab === "teachers"
        ? await supabase.from("teachers").delete().eq("college_id", college?.id || "").eq("faculty_id", row.faculty_id || "")
        : await supabase.from(tab).delete().eq("id", row.id || "")
    const deleteError = result.error
    if (deleteError) setError(deleteError.message); else await load()
  }

  const tabs = [
    ["students", "Students", GraduationCap], ["teachers", "Teachers", Users], ["classes", "Classes", Layers3], ["departments", "Departments", Building2], ["organization", "Organization", Building2],
  ] as const

  return <div className="flex min-h-dvh flex-col"><AppHeader title="Admin Workspace" context={<OrganizationBadge />} /><OfflineIndicator /><main className="flex-1 px-4 py-6"><div className="mx-auto max-w-5xl space-y-5">
    <div className="flex items-center gap-3"><Link href="/admin" className="rounded-xl border border-border p-2"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="text-2xl font-bold">Organization management</h1><p className="text-sm text-muted-foreground">{college?.name || "Manage your college"}</p></div></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{tabs.map(([value, label, Icon]) => <button key={value} onClick={() => setTab(value)} className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-xs transition-colors ${tab === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card/50 text-muted-foreground hover:bg-muted/50"}`}><Icon className="h-5 w-5" />{label}</button>)}</div>
    <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" /> {tab === "organization" ? "Update organization" : `Add ${tab.slice(0, -1)}`}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-4"><Input placeholder={tab === "organization" ? "Organization name" : "Name"} value={name} onChange={(e) => setName(e.target.value)} /><Input placeholder={tab === "students" ? "Register number" : tab === "teachers" ? "Faculty ID" : "Code"} value={code} onChange={(e) => setCode(e.target.value)} />{(tab === "students" || tab === "teachers") && <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}{tab === "classes" && <Input placeholder="Teacher faculty ID" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} />}<RippleButton disabled={busy || !name || (tab !== "organization" && !code)} onClick={add}>Save</RippleButton></CardContent></Card>
    {error && <p className="text-sm text-destructive">{error}</p>}{message && <p className="flex items-center gap-2 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" />{message}</p>}
    {tab !== "organization" && <Card className="rounded-3xl"><CardContent className="space-y-2 pt-6">{rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No {tab} yet.</p> : rows.map((row, index) => { const rowKey = row.id || row.register_no || row.faculty_id || row.code || `${tab}-${index}`; return <div key={rowKey} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-4 py-3"><div><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.code || row.register_no || row.faculty_id} {row.email ? `· ${row.email}` : ""}</p></div><button className="rounded-lg p-2 text-destructive hover:bg-destructive/10" onClick={() => remove(row)}><Trash2 className="h-4 w-4" /></button></div>})}</CardContent></Card>}
  </div></main></div>
}
