"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, FileUp, GraduationCap, LogIn, ShieldCheck, Users, UserPlus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import OrganizationBadge from "@/components/attendance/OrganizationBadge"
import RippleButton from "@/components/RippleButton"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ImportKind = "students" | "teachers"
type ImportResult = { kind: ImportKind; count: number; error?: string }
type ImportPreview = { kind: ImportKind; fileName: string; rows: Record<string, string>[]; duplicates: string[] }
type College = { id: string; name: string; slug: string }
type CollegeJoin = { college_id: string; colleges: College | null }

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error) return String((error as { message: unknown }).message)
  return "Something went wrong"
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error("The file needs a header row and at least one data row.")
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
  return lines.slice(1).map((line): Record<string, string> => {
    const values = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""))
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]))
  })
}

export default function AdminPage() {
  const [mode, setMode] = useState<"login" | "signup">("signup")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [collegeName, setCollegeName] = useState("")
  const [collegeSlug, setCollegeSlug] = useState("")
  const [college, setCollege] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [existingAdminNeedsSetup, setExistingAdminNeedsSetup] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [imports, setImports] = useState<ImportResult[]>([])
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)

  const canCreate = useMemo(() => Boolean(email && password && collegeName && collegeSlug), [email, password, collegeName, collegeSlug])

  useEffect(() => {
    const loadCollege = async () => {
      try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data } = await supabase.from("college_admins").select("college_id, colleges(id, name, slug)").eq("user_id", auth.user.id).maybeSingle()
      const row = data as CollegeJoin | null
      if (row?.colleges) setCollege(row.colleges)
      else setExistingAdminNeedsSetup(true)
      } finally {
        setIsCheckingSession(false)
      }
    }
    loadCollege()
  }, [])

  const submitAuth = async () => {
    setBusy(true); setError(""); setMessage("")
    try {
      if (existingAdminNeedsSetup) {
        await finishExistingAdminSetup()
        return
      }
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError || !data.user) throw signUpError ?? new Error("Could not create account")
        if (!data.session) {
          localStorage.setItem("attendai_pending_college", JSON.stringify({ name: collegeName.trim(), slug: collegeSlug.trim() }))
          setMode("login")
          setMessage("Check your email to confirm the admin account, then sign in to finish setup.")
          return
        }
        const { data: newCollege, error: collegeError } = await supabase.from("colleges").insert({ name: collegeName.trim(), slug: collegeSlug.trim(), owner_id: data.user.id }).select("id, name, slug").single()
        if (collegeError || !newCollege) throw collegeError ?? new Error("Could not create college")
        const { error: adminError } = await supabase.from("college_admins").insert({ college_id: newCollege.id, user_id: data.user.id })
        if (adminError) throw adminError
        setCollege(newCollege); setMessage("College created. You can now import your student and faculty files.")
      } else {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password })
        if (loginError || !data.user) throw loginError ?? new Error("Could not sign in")
        const { data: row, error: collegeError } = await supabase.from("college_admins").select("college_id, colleges(id, name, slug)").eq("user_id", data.user.id).maybeSingle()
        const collegeRow = row as CollegeJoin | null
        if (collegeError) throw collegeError
        if (!collegeRow?.colleges) {
          const pending = localStorage.getItem("attendai_pending_college")
          if (!pending) {
            setExistingAdminNeedsSetup(true)
            setMode("signup")
            setMessage("This existing admin account is signed in. Enter your college details to finish setup.")
            return
          }
          const details = JSON.parse(pending) as { name: string; slug: string }
          const { data: newCollege, error: createError } = await supabase.from("colleges").insert({ ...details, owner_id: data.user.id }).select("id, name, slug").single()
          if (createError || !newCollege) throw createError ?? new Error("Could not finish college setup")
          const { error: adminError } = await supabase.from("college_admins").insert({ college_id: newCollege.id, user_id: data.user.id })
          if (adminError) throw adminError
          localStorage.removeItem("attendai_pending_college")
          setCollege(newCollege); setMessage("College created. You can now import your student and faculty files.")
          return
        }
        setCollege(collegeRow.colleges); setMessage("Signed in successfully.")
      }
    } catch (err: unknown) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  const finishExistingAdminSetup = async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setError("Your session expired. Please sign in again."); return }
    setBusy(true); setError("")
    try {
      const { data: newCollege, error: collegeError } = await supabase.from("colleges").insert({ name: collegeName.trim(), slug: collegeSlug.trim(), owner_id: auth.user.id }).select("id, name, slug").single()
      if (collegeError || !newCollege) throw collegeError ?? new Error("Could not create college")
      const { error: adminError } = await supabase.from("college_admins").insert({ college_id: newCollege.id, user_id: auth.user.id })
      if (adminError) throw adminError
      setExistingAdminNeedsSetup(false); setCollege(newCollege); setMessage("College created. You can now import your student and faculty files.")
    } catch (err: unknown) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  const previewFile = async (file: File, kind: ImportKind) => {
    if (!college) return
    setError(""); setMessage("")
    try {
      const rows = parseCsv(await file.text())
      const mapped = rows.map((row) => kind === "students"
        ? { college_id: college.id, register_no: row.register_no || row.reg_no || row.roll_no, name: row.name, email: row.email }
        : { college_id: college.id, faculty_id: row.faculty_id || row.faculty_no || row.employee_id, name: row.name, email: row.email })
      const missing = mapped.find((row) => !row.name || !row.email || (kind === "students" ? !row.register_no : !row.faculty_id))
      if (missing) throw new Error(`Each row needs name, email, and ${kind === "students" ? "register_no" : "faculty_id"}.`)
      const seen = new Set<string>()
      const duplicates = mapped.map((row) => kind === "students" ? row.register_no : row.faculty_id).filter((value): value is string => Boolean(value)).filter((value) => seen.has(value) || !seen.add(value))
      setImportPreview({ kind, fileName: file.name, rows, duplicates: [...new Set(duplicates)] })
      setMessage("Review the import before saving it.")
    } catch (err: unknown) { setError(errorMessage(err)) }
  }

  const commitImport = async () => {
    if (!college || !importPreview) return
    setBusy(true); setError(""); setMessage("")
    try {
      const mapped = importPreview.rows.map((row) => importPreview.kind === "students"
        ? { college_id: college.id, register_no: row.register_no || row.reg_no || row.roll_no, name: row.name, email: row.email }
        : { college_id: college.id, faculty_id: row.faculty_id || row.faculty_no || row.employee_id, name: row.name, email: row.email })
      const { error: insertError } = await supabase.from(importPreview.kind).upsert(mapped, { onConflict: importPreview.kind === "students" ? "college_id,register_no" : "college_id,faculty_id" })
      if (insertError) throw insertError
      setImports((prev) => [{ kind: importPreview.kind, count: mapped.length }, ...prev]); setImportPreview(null); setMessage(`${mapped.length} ${importPreview.kind} imported successfully.`)
    } catch (err: unknown) { const detail = errorMessage(err); setImports((prev) => [{ kind: importPreview.kind, count: 0, error: detail }, ...prev]); setError(detail) } finally { setBusy(false) }
  }

  const downloadTemplate = (kind: ImportKind) => {
    const content = kind === "students" ? "register_no,name,email\nSTU001,Student Name,student@example.com\n" : "faculty_id,name,email\nFAC001,Teacher Name,teacher@example.com\n"
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }))
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${kind}-template.csv`; anchor.click(); URL.revokeObjectURL(url)
  }

  if (isCheckingSession) return <div className="flex min-h-dvh flex-col"><AppHeader title="College Admin" context={<OrganizationBadge />} /><OfflineIndicator /><main className="flex flex-1 items-center justify-center px-4 py-8"><p className="text-sm text-muted-foreground">Loading your workspace…</p></main></div>

  return <div className="flex min-h-dvh flex-col"><AppHeader title="College Admin" context={<OrganizationBadge />} /><OfflineIndicator /><main className="flex flex-1 justify-center px-4 py-8"><div className="w-full max-w-2xl space-y-5">
    {!college ? <Card className="mx-auto max-w-md rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> {mode === "signup" ? "Create your college workspace" : "Admin sign in"}</CardTitle><CardDescription>{mode === "signup" ? "Each college gets its own protected attendance data." : "Access your college’s imported data."}</CardDescription></CardHeader><CardContent className="space-y-3">
      {mode === "signup" && <><Input placeholder="College name" value={collegeName} onChange={(e) => { setCollegeName(e.target.value); setCollegeSlug(slugify(e.target.value)) }} /><Input placeholder="College code / slug" value={collegeSlug} onChange={(e) => setCollegeSlug(slugify(e.target.value))} /></>}
      <Input type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} /><Input type="password" placeholder="Password (minimum 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}{message && <p className="text-sm text-green-600">{message}</p>}
      <RippleButton className="w-full gap-2" disabled={busy || (mode === "signup" ? !canCreate : !email || !password)} onClick={submitAuth}>{mode === "signup" ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}{busy ? "Please wait…" : mode === "signup" ? "Create workspace" : "Sign in"}</RippleButton>
      <button className="w-full text-sm text-muted-foreground underline" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError("") }}>{mode === "signup" ? "Already have an admin account? Sign in" : "Create a new college workspace"}</button>
    </CardContent></Card> : <>
      <div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Workspace</p><h1 className="text-2xl font-bold">{college.name}</h1><p className="text-xs text-muted-foreground">/{college.slug}</p></div><RippleButton variant="outline" onClick={async () => { await supabase.auth.signOut(); setCollege(null) }}>Sign out</RippleButton></div>
      <div className="grid gap-3 sm:grid-cols-2"><Link href="/admin/manage" className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm font-medium hover:bg-primary/10">Manage students, teachers, classes, departments, and organization →</Link><Link href="/admin/register-face" className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 text-sm font-medium hover:bg-violet-500/10">Register student face data →</Link></div><div className="grid gap-4 sm:grid-cols-2"><Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-5 w-5 text-violet-500" /> Import students</CardTitle><CardDescription>CSV: register_no, name, email</CardDescription></CardHeader><CardContent className="space-y-3"><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-sm hover:bg-muted/40"><FileUp className="h-4 w-4" /> Choose CSV<input className="hidden" type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => e.target.files?.[0] && previewFile(e.target.files[0], "students")} /></label><button className="text-xs text-muted-foreground underline" onClick={() => downloadTemplate("students")}>Download template</button></CardContent></Card><Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-blue-500" /> Import faculty</CardTitle><CardDescription>CSV: faculty_id, name, email</CardDescription></CardHeader><CardContent className="space-y-3"><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-sm hover:bg-muted/40"><FileUp className="h-4 w-4" /> Choose CSV<input className="hidden" type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => e.target.files?.[0] && previewFile(e.target.files[0], "teachers")} /></label><button className="text-xs text-muted-foreground underline" onClick={() => downloadTemplate("teachers")}>Download template</button></CardContent></Card></div>
      {importPreview && <Card className="rounded-3xl border-primary/30"><CardHeader><CardTitle className="text-base">Review {importPreview.fileName}</CardTitle><CardDescription>{importPreview.rows.length} rows ready to import. Existing matching records will be updated.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="rounded-xl bg-muted/40 p-3 text-sm"><p>Required fields: {importPreview.kind === "students" ? "register_no, name, email" : "faculty_id, name, email"}</p>{importPreview.duplicates.length > 0 && <p className="mt-1 text-yellow-600">Duplicate IDs in this file: {importPreview.duplicates.join(", ")}</p>}<p className="mt-1 text-xs text-muted-foreground">First row: {Object.values(importPreview.rows[0]).join(" · ")}</p></div><div className="flex gap-2"><RippleButton disabled={busy || importPreview.duplicates.length > 0} onClick={commitImport}>Import rows</RippleButton><RippleButton variant="outline" onClick={() => setImportPreview(null)}>Cancel</RippleButton></div></CardContent></Card>}
      {message && <p className="flex items-center gap-2 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" />{message}</p>}{imports.length > 0 && <Card className="rounded-3xl"><CardHeader><CardTitle className="text-base">Recent imports</CardTitle></CardHeader><CardContent className="space-y-2">{imports.map((item, i) => <div key={i} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm"><span>{item.kind}</span><span className={item.error ? "text-destructive" : "text-green-600"}>{item.error || `${item.count} rows`}</span></div>)}</CardContent></Card>}
    </>}
  </div></main></div>
}
