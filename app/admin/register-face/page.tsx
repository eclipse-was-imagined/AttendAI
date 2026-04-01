"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import * as faceapi from "face-api.js"
import {
  Camera, User, CheckCircle2, AlertCircle, Loader2,
  ArrowLeft, RotateCcw, Shield, Search, ChevronLeft, ChevronRight, Fingerprint,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

type RegistrationStatus = "idle" | "processing" | "success" | "error"
type ScanStep = "align" | "hold" | "analyzing"

interface Student {
  register_no: string
  name: string
  email: string
  face_embedding: number[] | null
}

// ── Skeleton loader ────────────────────────────────────────────────────────

function StudentSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.06 }}
          className="flex items-center gap-4 rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur-md"
        >
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3.5 w-32 rounded-full bg-muted animate-pulse" />
            <div className="h-3 w-24 rounded-full bg-muted/70 animate-pulse" />
          </div>
          <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
        </motion.div>
      ))}
    </div>
  )
}

// ── Stat skeleton ──────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur-md">
          <div className="h-7 w-10 rounded-lg bg-muted animate-pulse mx-auto mb-1" />
          <div className="h-3 w-14 rounded-full bg-muted/70 animate-pulse mx-auto" />
        </div>
      ))}
    </div>
  )
}

// ── Scan Frame ─────────────────────────────────────────────────────────────

function ScanFrame({ color }: { color: string }) {
  const size = 180, corner = 28, stroke = 3
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      className="absolute pointer-events-none"
      style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
      <path d={`M${corner},${stroke} L${stroke},${stroke} L${stroke},${corner}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <path d={`M${size - corner},${stroke} L${size - stroke},${stroke} L${size - stroke},${corner}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <path d={`M${stroke},${size - corner} L${stroke},${size - stroke} L${corner},${size - stroke}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <path d={`M${size - corner},${size - stroke} L${size - stroke},${size - stroke} L${size - stroke},${size - corner}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  )
}

// ── Face Capture ───────────────────────────────────────────────────────────

function FaceCapture({ student, onSuccess, onCancel }: {
  student: Student
  onSuccess: () => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<RegistrationStatus>("idle")
  const [scanStep, setScanStep] = useState<ScanStep>("align")
  const [cameraActive, setCameraActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ])
        if (!cancelled) setModelsLoaded(true)
      } catch { if (!cancelled) setErrorMessage("Failed to load face recognition models") }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()) }
  }, [])

  const stopStream = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => { }) }
      setScanStep("align"); setStatus("idle"); setCapturedImage(null); setErrorMessage(""); setCameraActive(true)
    } catch { setErrorMessage("Failed to access camera. Check browser permissions."); setStatus("error") }
  }, [])

  const captureAndProcess = useCallback(async () => {
    const video = videoRef.current, canvas = canvasRef.current
    if (!video || !canvas) { setErrorMessage("Camera not ready — please try again"); setStatus("error"); return }
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const snapshot = canvas.toDataURL("image/jpeg", 0.95)
    setCapturedImage(snapshot); stopStream(); setStatus("processing")
    if (!isSupabaseConfigured || !supabase) { setErrorMessage("Supabase not configured"); setStatus("error"); return }
    try {
      const detection = await faceapi.detectSingleFace(canvas).withFaceLandmarks().withFaceDescriptor()
      if (!detection) { setErrorMessage("No face detected. Try better lighting or move closer."); setStatus("error"); return }
      const faceEmbedding = Array.from(detection.descriptor)
      const { error: dbError } = await supabase.from("students").update({ face_embedding: faceEmbedding }).eq("register_no", student.register_no)
      if (dbError) { setErrorMessage(`Save failed: ${dbError.message}`); setStatus("error"); return }
      setStatus("success"); setTimeout(onSuccess, 2200)
    } catch { setErrorMessage("Face processing failed. Please try again."); setStatus("error") }
  }, [student.register_no, onSuccess, stopStream])

  useEffect(() => {
    if (!cameraActive || status !== "idle") return
    const t1 = setTimeout(() => setScanStep("hold"), 2000)
    const t2 = setTimeout(() => { setScanStep("analyzing"); setTimeout(() => captureAndProcess(), 400) }, 4000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [cameraActive, status, captureAndProcess])

  const retake = useCallback(() => {
    setStatus("idle"); setCapturedImage(null); setErrorMessage(""); setScanStep("align"); startCamera()
  }, [startCamera])

  const frameColor = status === "success" ? "#22c55e" : status === "error" ? "#ef4444"
    : scanStep === "hold" || scanStep === "analyzing" ? "#3b82f6" : "rgba(255,255,255,0.5)"

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/40 shadow-2xl backdrop-blur-xl">
      {/* Top glass highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-muted/50 hover:bg-muted"
            onClick={() => { stopStream(); onCancel() }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Fingerprint className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground leading-tight">Register Face</p>
            <p className="text-xs text-muted-foreground">{student.name} · {student.register_no}</p>
          </div>
        </div>

        {/* Models loading */}
        {!modelsLoaded && !errorMessage && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary/20" />
              <motion.div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-primary border-t-transparent"
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Loading AI models</p>
              <p className="text-xs text-muted-foreground mt-1">This only happens once</p>
            </div>
          </div>
        )}

        {!modelsLoaded && errorMessage && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        {modelsLoaded && (
          <div className="flex flex-col items-center gap-5">
            {/* Camera viewport */}
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-xl" style={{ aspectRatio: "4/3" }}>

              {/* Start prompt */}
              {!cameraActive && !capturedImage && status === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-muted/80 to-muted">
                  <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 shadow-lg shadow-primary/20">
                    <Camera className="h-10 w-10 text-primary" />
                  </motion.div>
                  <div className="text-center px-6">
                    <p className="font-semibold text-foreground">Ready to scan</p>
                    <p className="mt-1 text-xs text-muted-foreground">Face the camera directly in good lighting</p>
                  </div>
                  <Button className="gap-2 rounded-xl px-6 shadow-lg shadow-primary/20" onClick={startCamera}>
                    <Camera className="h-4 w-4" /> Start Camera
                  </Button>
                </div>
              )}

              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"
                style={{ display: cameraActive ? "block" : "none", transform: "scaleX(-1)" }} />

              {/* Live overlays */}
              {cameraActive && (
                <>
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "radial-gradient(ellipse 60% 55% at 50% 45%, transparent 40%, rgba(0,0,0,0.65) 100%)" }} />
                  {(scanStep === "hold" || scanStep === "analyzing") && (
                    <motion.div className="absolute left-1/2 w-44 h-0.5 rounded-full pointer-events-none"
                      style={{ background: "linear-gradient(90deg, transparent, #3b82f6, transparent)", x: "-50%" }}
                      animate={{ top: ["22%", "72%", "22%"] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }} />
                  )}
                  <ScanFrame color={frameColor} />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                    <AnimatePresence mode="wait">
                      {scanStep === "align" && (
                        <motion.div key="align" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5 backdrop-blur-sm">
                          <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                          <span className="text-xs font-medium text-white">Align your face in the frame</span>
                        </motion.div>
                      )}
                      {scanStep === "hold" && (
                        <motion.div key="hold" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="flex items-center gap-2 rounded-full bg-blue-600/80 px-4 py-1.5 backdrop-blur-sm">
                          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          <span className="text-xs font-medium text-white">Hold still...</span>
                        </motion.div>
                      )}
                      {scanStep === "analyzing" && (
                        <motion.div key="analyzing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="flex items-center gap-2 rounded-full bg-blue-700/90 px-4 py-1.5 backdrop-blur-sm">
                          <Loader2 className="h-3 w-3 text-white animate-spin" />
                          <span className="text-xs font-medium text-white">Scanning...</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}

              {/* Processing overlay */}
              {capturedImage && status === "processing" && (
                <>
                  <img src={capturedImage} alt="Captured" className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="relative mb-4">
                      <div className="h-14 w-14 rounded-full border-4 border-primary/20" />
                      <motion.div className="absolute inset-0 h-14 w-14 rounded-full border-4 border-primary border-t-transparent"
                        animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
                    </div>
                    <p className="text-sm font-semibold text-white">Analyzing face...</p>
                    <p className="mt-1 text-xs text-white/60">Extracting biometric features</p>
                  </div>
                </>
              )}

              {/* Success overlay */}
              {status === "success" && capturedImage && (
                <>
                  <img src={capturedImage} alt="Captured" className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-green-950/85 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 18 }}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/40">
                      <CheckCircle2 className="h-10 w-10 text-white" />
                    </motion.div>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                      className="mt-4 text-lg font-bold text-white">Face Registered!</motion.p>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                      className="mt-1 text-xs text-green-300">Saved to database ✓</motion.p>
                  </motion.div>
                </>
              )}

              {/* Error overlay */}
              {status === "error" && capturedImage && (
                <>
                  <img src={capturedImage} alt="Captured" className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/85 backdrop-blur-sm px-6">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 18 }}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500">
                      <AlertCircle className="h-10 w-10 text-white" />
                    </motion.div>
                    <p className="mt-4 text-base font-bold text-white">Detection Failed</p>
                    <p className="mt-1 text-center text-xs text-red-300">{errorMessage}</p>
                  </motion.div>
                </>
              )}

              {status === "error" && !capturedImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted px-6">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <p className="text-center text-sm text-destructive">{errorMessage}</p>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Actions */}
            <div className="flex w-full flex-col gap-2">
              {status === "error" && (
                <Button className="w-full gap-2 rounded-xl shadow-lg shadow-primary/20" onClick={retake}>
                  <RotateCcw className="h-4 w-4" /> Try Again
                </Button>
              )}
              {status !== "success" && (
                <Button variant="ghost" size="sm" className="w-full rounded-xl text-muted-foreground"
                  onClick={() => { stopStream(); onCancel() }}>
                  Cancel
                </Button>
              )}
            </div>

            {/* Security notice */}
            <div className="flex w-full items-start gap-2 rounded-xl border border-border/40 bg-primary/5 p-3 backdrop-blur-md">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Face data is stored securely and used only for attendance verification.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Student List ───────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 6

function StudentList({ onSelectStudent }: { onSelectStudent: (s: Student) => void }) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "registered" | "pending">("all")
  const [page, setPage] = useState(1)

  useEffect(() => {
    const fetchStudents = async () => {
      if (!isSupabaseConfigured || !supabase) { setLoading(false); return }
      const { data, error } = await supabase.from("students").select("register_no, name, email, face_embedding").order("name")
      if (!error) setStudents(data || [])
      setLoading(false)
    }
    fetchStudents()
  }, [])

  const filtered = students.filter((s) => {
    const matchesSearch = (s.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.register_no ?? "").toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === "all" || (filter === "registered" && s.face_embedding) || (filter === "pending" && !s.face_embedding)
    return matchesSearch && matchesFilter
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const pageStudents = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)
  const registeredCount = students.filter((s) => s.face_embedding).length
  const pendingCount = students.filter((s) => !s.face_embedding).length

  return (
    <div className="flex flex-col gap-4">
      {/* Stats */}
      {loading ? <StatSkeleton /> : (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: students.length, color: "text-foreground", bg: "bg-muted/50" },
            { label: "Registered", value: registeredCount, color: "text-green-500", bg: "bg-green-500/10" },
            { label: "Pending", value: pendingCount, color: "text-yellow-500", bg: "bg-yellow-500/10" },
          ].map(({ label, value, color, bg }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`relative overflow-hidden rounded-2xl border border-border/40 ${bg} p-4 text-center backdrop-blur-md`}>
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <span className={`text-2xl font-bold ${color}`}>{value}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* List card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/40 shadow-xl backdrop-blur-xl">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Student Face Registration</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Select a student to register their face</p>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search name or register no..." className="rounded-xl pl-9 bg-muted/30 border-border/40 backdrop-blur-md"
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <Select value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(1) }}>
              <SelectTrigger className="w-full rounded-xl sm:w-40 bg-muted/30 border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Student rows */}
          {loading ? <StudentSkeleton /> : (
            <div className="flex flex-col gap-2">
              {pageStudents.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {students.length === 0 ? "No students in database." : "No students match your search."}
                </div>
              ) : (
                pageStudents.map((student, idx) => (
                  <motion.button key={student.register_no}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border/40 bg-muted/20 p-4 text-left backdrop-blur-md transition-all hover:border-primary/30 hover:bg-muted/40 hover:shadow-md"
                    onClick={() => onSelectStudent(student)}>
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted shadow-inner">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground truncate">{student.name}</span>
                        {student.face_embedding ? (
                          <Badge className="gap-1 rounded-full border-green-500/20 bg-green-500/10 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" /> Registered
                          </Badge>
                        ) : (
                          <Badge className="rounded-full border-yellow-500/20 bg-yellow-500/10 text-xs text-yellow-600">Pending</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{student.register_no}</span>
                    </div>
                    <Camera className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  </motion.button>
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/30">
              <span className="text-xs text-muted-foreground">
                {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[3rem] text-center text-xs font-medium">{page} / {totalPages}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminFaceRegistrationPage() {
  const router = useRouter()
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="flex min-h-dvh flex-col relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/15 blur-[90px]" />
        <div className="absolute bottom-0 -left-20 h-60 w-60 rounded-full bg-blue-500/10 blur-[80px]" />
      </div>

      <AppHeader title="Admin Panel" />
      <OfflineIndicator />

      <main className="relative z-10 flex-1 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 px-4 py-6">

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-card/60 backdrop-blur-md border border-border/40 shadow-sm"
              onClick={() => router.push("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Face Registration</h1>
              <p className="text-xs text-muted-foreground">Register student faces for biometric verification</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {selectedStudent ? (
              <motion.div key="capture" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
                <FaceCapture student={selectedStudent}
                  onSuccess={() => { setSelectedStudent(null); setRefreshKey((k) => k + 1) }}
                  onCancel={() => setSelectedStudent(null)} />
              </motion.div>
            ) : (
              <motion.div key={`list-${refreshKey}`} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
                <StudentList onSelectStudent={setSelectedStudent} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  )
}