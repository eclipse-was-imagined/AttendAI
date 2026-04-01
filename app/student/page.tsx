"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Shield, Fingerprint, QrCode, CheckCircle2, XCircle,
  Loader2, LogOut, BookOpen, Camera, RefreshCw, MapPin, Eye,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import RippleButton from "@/components/RippleButton"
import Confetti from "@/components/Confetti"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

type Step = "scan" | "gps" | "verify" | "success" | "error"
type VerifyStage = "loading" | "blink" | "analyzing"

// ── Helpers ────────────────────────────────────────────────────────────────

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Eye Aspect Ratio for blink detection
function getEAR(landmarks: any): number {
  const pts = landmarks.positions
  const eyeEAR = (eye: number[]) => {
    const A = Math.hypot(pts[eye[1]].x - pts[eye[5]].x, pts[eye[1]].y - pts[eye[5]].y)
    const B = Math.hypot(pts[eye[2]].x - pts[eye[4]].x, pts[eye[2]].y - pts[eye[4]].y)
    const C = Math.hypot(pts[eye[0]].x - pts[eye[3]].x, pts[eye[0]].y - pts[eye[3]].y)
    return (A + B) / (2.0 * C)
  }
  const left = eyeEAR([36, 37, 38, 39, 40, 41])
  const right = eyeEAR([42, 43, 44, 45, 46, 47])
  return (left + right) / 2
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { key: "scan", icon: QrCode, label: "Scan QR" },
    { key: "gps", icon: MapPin, label: "Location" },
    { key: "verify", icon: Fingerprint, label: "Verify" },
    { key: "success", icon: CheckCircle2, label: "Done" },
  ]
  const idx = ["scan", "gps", "verify", "success", "error"].indexOf(current)
  const displayIdx = Math.min(idx, 3)
  return (
    <div className="flex items-center justify-center flex-wrap gap-1">
      {steps.map((s, i) => {
        const active = i === displayIdx, done = i < displayIdx
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{ backgroundColor: done ? "#22c55e" : active ? "hsl(var(--primary))" : "hsl(var(--muted))", scale: active ? 1.1 : 1 }}
                transition={{ duration: 0.3 }}
                className="flex h-8 w-8 items-center justify-center rounded-full"
              >
                <s.icon className={`h-3.5 w-3.5 ${active || done ? "text-white" : "text-muted-foreground"}`} />
              </motion.div>
              <span className={`text-xs font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <motion.div animate={{ backgroundColor: done ? "#22c55e" : "hsl(var(--border))" }} transition={{ duration: 0.3 }} className="mx-2 h-px w-6" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ScanFrame({ color }: { color: string }) {
  const size = 160, corner = 24, stroke = 3
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute pointer-events-none"
      style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
      <path d={`M${corner},${stroke} L${stroke},${stroke} L${stroke},${corner}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <path d={`M${size - corner},${stroke} L${size - stroke},${stroke} L${size - stroke},${corner}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <path d={`M${stroke},${size - corner} L${stroke},${size - stroke} L${corner},${size - stroke}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <path d={`M${size - corner},${size - stroke} L${size - stroke},${size - stroke} L${size - stroke},${size - corner}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function StudentPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const blinkDetectionRef = useRef<boolean>(false)
  const blinkResolveRef = useRef<((v: boolean) => void) | null>(null)

  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [registerNo, setRegisterNo] = useState("")
  const [authError, setAuthError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const [currentStep, setCurrentStep] = useState<Step>("scan")
  const [scannerReady, setScannerReady] = useState(false)
  const [verifyStage, setVerifyStage] = useState<VerifyStage>("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const [attendanceTime, setAttendanceTime] = useState("")
  const [showConfetti, setShowConfetti] = useState(false)

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<"checking" | "ok" | "error">("checking")
  const [gpsMessage, setGpsMessage] = useState("Getting your location...")
  const [sessionPayload, setSessionPayload] = useState<{ session_id: string; lat?: number; lng?: number } | null>(null)

  // Blink state
  const [blinkDetected, setBlinkDetected] = useState(false)
  const [earValue, setEarValue] = useState(1)
  const [showManualBlink, setShowManualBlink] = useState(false)

  const GPS_THRESHOLD = 150 // meters — accounts for real indoor GPS drift

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => { if (data.session) setLoggedIn(true) })
    }
  }, [])

  const stopCamera = () => {
    blinkDetectionRef.current = false
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    })
    streamRef.current = stream
    if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => { }) }
  }

  useEffect(() => () => stopCamera(), [])

  const loadFaceModels = async () => {
    const faceapi = await import("face-api.js")
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ])
    return faceapi
  }

  // ── GPS Check (FIXED) ─────────────────────────────────────────────────────
  // Takes 3 fresh readings (maximumAge: 0 = no stale cache), picks the one
  // with best accuracy, avoids the single-sample indoor drift bug.
  const checkGPS = async (payload: { session_id: string; lat?: number; lng?: number }): Promise<boolean> => {
    if (!payload.lat || !payload.lng) return true

    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(true); return }

      const readings: GeolocationPosition[] = []
      const MAX_READINGS = 3

      const tryRead = () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            readings.push(pos)
            if (readings.length < MAX_READINGS) {
              // Short pause between readings so device moves the GPS antenna
              setTimeout(tryRead, 800)
              return
            }
            // Pick reading with best (lowest) reported accuracy
            const best = readings.reduce((a, b) =>
              a.coords.accuracy < b.coords.accuracy ? a : b
            )
            const dist = getDistance(
              best.coords.latitude, best.coords.longitude,
              payload.lat!, payload.lng!
            )
            console.log(
              `[AttendAI] GPS: ${readings.length} readings, best accuracy: ${best.coords.accuracy.toFixed(1)}m, distance: ${dist.toFixed(1)}m`
            )

            if (dist <= GPS_THRESHOLD) {
              setGpsMessage(`✓ Location verified (${Math.round(dist)}m away)`)
              setGpsStatus("ok")
              resolve(true)
            } else {
              setGpsMessage(`You are ${Math.round(dist)}m from the classroom (max ${GPS_THRESHOLD}m). Move closer and try again.`)
              setGpsStatus("error")
              resolve(false)
            }
          },
          (err) => {
            console.warn("[AttendAI] GPS error:", err.message)
            if (readings.length > 0) {
              // Use best of what we already collected
              const best = readings.reduce((a, b) =>
                a.coords.accuracy < b.coords.accuracy ? a : b
              )
              const dist = getDistance(
                best.coords.latitude, best.coords.longitude,
                payload.lat!, payload.lng!
              )
              if (dist <= GPS_THRESHOLD) {
                setGpsMessage(`✓ Location verified (${Math.round(dist)}m away)`)
                setGpsStatus("ok")
                resolve(true)
              } else {
                setGpsMessage(`You are ${Math.round(dist)}m from the classroom. Move closer and try again.`)
                setGpsStatus("error")
                resolve(false)
              }
            } else {
              // GPS fully denied — skip gracefully
              resolve(true)
            }
          },
          { timeout: 12000, maximumAge: 0, enableHighAccuracy: true }
        )
      }

      tryRead()
    })
  }

  // ── Blink Detection ──────────────────────────────────────────────────────

  const waitForBlink = async (faceapi: any): Promise<boolean> => {
    return new Promise((resolve) => {
      blinkResolveRef.current = resolve
      blinkDetectionRef.current = true
      setShowManualBlink(false)

      // Tuned for indoors / normal light:
      // - EAR_THRESHOLD raised to 0.25 (0.21 was too strict — many people's blinks don't go that low on camera)
      // - minConfidence lowered to 0.3 (0.5 dropped too many frames indoors, missing the blink window)
      // - EAR_CONSEC_FRAMES = 1 (only need 1 closed frame — catching 2 consecutive is hard at low FPS)
      const EAR_THRESHOLD = 0.32
      const EAR_CONSEC_FRAMES = 1
      let closedFrames = 0
      let frameCount = 0

      // Show manual fallback button after 8s in case EAR still misses
      const manualTimer = setTimeout(() => {
        if (blinkDetectionRef.current) setShowManualBlink(true)
      }, 8000)

      const detect = async () => {
        if (!blinkDetectionRef.current) return
        const video = videoRef.current
        if (!video) return

        try {
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
            .withFaceLandmarks()

          if (detection) {
            const ear = getEAR(detection.landmarks)
            setEarValue(ear)
            frameCount++

            // Log every 10 frames so the student / dev can see live EAR values in console
            if (frameCount % 10 === 0) {
              console.log(`[AttendAI] EAR: ${ear.toFixed(3)} | threshold: ${EAR_THRESHOLD} | closedFrames: ${closedFrames}`)
            }

            if (ear < EAR_THRESHOLD) {
              closedFrames++
            } else {
              if (closedFrames >= EAR_CONSEC_FRAMES) {
                clearTimeout(manualTimer)
                setShowManualBlink(false)
                setBlinkDetected(true)
                blinkDetectionRef.current = false
                setTimeout(() => resolve(true), 400)
                return
              }
              closedFrames = 0
            }
          }
        } catch { }

        if (blinkDetectionRef.current) requestAnimationFrame(detect)
      }

      requestAnimationFrame(detect)

      // Hard timeout at 15s
      setTimeout(() => {
        if (blinkDetectionRef.current) {
          clearTimeout(manualTimer)
          setShowManualBlink(false)
          blinkDetectionRef.current = false
          resolve(false)
        }
      }, 15000)
    })
  }

  const handleManualBlink = () => {
    blinkDetectionRef.current = false
    setShowManualBlink(false)
    setBlinkDetected(true)
    if (blinkResolveRef.current) {
      setTimeout(() => blinkResolveRef.current!(true), 400)
    }
  }

  // ── Face Verify ──────────────────────────────────────────────────────────
  const verifyFace = async (regNo: string): Promise<boolean> => {
    try {
      setVerifyStage("loading")
      const faceapi = await loadFaceModels()
      await startCamera()
      await new Promise((res) => setTimeout(res, 1000))

      setVerifyStage("blink")
      setBlinkDetected(false)
      const blinked = await waitForBlink(faceapi)
      if (!blinked) { stopCamera(); return false }

      setVerifyStage("analyzing")
      await new Promise((res) => setTimeout(res, 400))

      if (!videoRef.current) { stopCamera(); return false }
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) { stopCamera(); return false }
      const liveFloat32 = new Float32Array(detection.descriptor)

      if (!isSupabaseConfigured || !supabase) { stopCamera(); return true }
      const { data, error } = await supabase.from("students").select("face_embedding").eq("register_no", regNo).single()
      if (error || !data?.face_embedding) { stopCamera(); return false }

      const storedFloat32 = new Float32Array(data.face_embedding)
      const distance = faceapi.euclideanDistance(liveFloat32, storedFloat32)
      console.log("[AttendAI] Face distance:", distance.toFixed(4))
      stopCamera()
      return distance < 0.5
    } catch { stopCamera(); return false }
  }

  // ── QR Scanner ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loggedIn || currentStep !== "scan") return
    let scanner: any = null
    const initScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode")
        scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false)
        const capturedRegisterNo = registerNo

        const onScanSuccess = async (decodedText: string) => {
          try { await scanner?.clear() } catch { }

          let payload: { session_id: string; t?: number }
          try { payload = JSON.parse(decodedText) } catch {
            setErrorMessage("Invalid QR code format"); setCurrentStep("error"); return
          }
          if (!payload.session_id) { setErrorMessage("QR code missing session ID"); setCurrentStep("error"); return }

          // Fetch session GPS data
          let sessionLat: number | undefined
          let sessionLng: number | undefined
          if (isSupabaseConfigured && supabase) {
            const { data: sessionData } = await supabase
              .from("sessions")
              .select("latitude, longitude")
              .eq("id", payload.session_id)
              .single()
            sessionLat = sessionData?.latitude
            sessionLng = sessionData?.longitude
          }

          const fullPayload = { session_id: payload.session_id, lat: sessionLat, lng: sessionLng }
          setSessionPayload(fullPayload)

          // GPS check
          setCurrentStep("gps")
          setGpsStatus("checking")
          setGpsMessage("Getting your location...")
          const gpsOk = await checkGPS(fullPayload)

          if (!gpsOk) {
            setErrorMessage(gpsMessage || "You are too far from the classroom.")
            setCurrentStep("error")
            return
          }

          // Face verify
          setCurrentStep("verify")
          await new Promise((res) => setTimeout(res, 600))
          const verified = await verifyFace(capturedRegisterNo)

          if (!verified) {
            setErrorMessage("Face verification failed. Make sure your face is registered, blink clearly, and try in good lighting.")
            setCurrentStep("error")
            return
          }

          // Mark attendance
          if (isSupabaseConfigured && supabase) {
            const { error } = await supabase.from("attendance").insert({
              session_id: payload.session_id,
              register_no: capturedRegisterNo,
            })
            if (error) {
              setErrorMessage(error.code === "23505" ? "Attendance already marked for this session" : error.message)
              setCurrentStep("error")
              return
            }
          }

          setAttendanceTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }))
          setShowConfetti(true)
          setCurrentStep("success")
          setTimeout(() => setShowConfetti(false), 4000)
        }

        scanner.render(onScanSuccess, () => { })
        setScannerReady(true)
      } catch (err) { console.error("[AttendAI] Scanner init failed:", err) }
    }
    initScanner()
    return () => { scanner?.clear().catch(() => { }) }
  }, [loggedIn, currentStep])

  const loginStudent = async () => {
    if (!isSupabaseConfigured || !supabase) { setLoggedIn(true); return }
    setIsLoading(true); setAuthError("")
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) { setAuthError(authErr.message); return }
      const { data } = await supabase.from("students").select("register_no").eq("email", email).eq("register_no", registerNo).single()
      if (!data) { setAuthError("Register number does not match this email"); await supabase.auth.signOut(); return }
      setLoggedIn(true)
    } catch (err: any) {
      setAuthError(err?.message || "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) await supabase.auth.signOut()
    stopCamera(); setLoggedIn(false); setCurrentStep("scan"); setScannerReady(false); setErrorMessage(""); setAuthError("")
  }

  const resetToScan = () => { setCurrentStep("scan"); setErrorMessage(""); setScannerReady(false); setBlinkDetected(false) }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div className="flex min-h-dvh flex-col relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0"><div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" /><div className="absolute bottom-0 -right-20 h-72 w-72 rounded-full bg-blue-500/10 blur-[90px]" /></div>
        <AppHeader />
        <OfflineIndicator />
        <main className="flex-1">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center px-4 py-8">
            <Card className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/50 shadow-2xl backdrop-blur-xl w-full max-w-sm before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent">
              <CardHeader className="items-center pb-2 pt-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
                  <BookOpen className="h-8 w-8 text-primary-foreground" />
                </motion.div>
                <CardTitle className="text-2xl font-bold">Student Login</CardTitle>
                <CardDescription className="text-center">Sign in to mark your attendance</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pb-8">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" placeholder="student@example.com" className="rounded-xl h-11" value={email}
                    onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loginStudent()} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" placeholder="••••••••" className="rounded-xl h-11" value={password}
                    onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loginStudent()} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Register Number</label>
                  <Input type="text" placeholder="e.g. 22BCE1234" className="rounded-xl h-11" value={registerNo}
                    onChange={(e) => setRegisterNo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loginStudent()} />
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
                <RippleButton className="mt-1 h-11 w-full text-base font-semibold" onClick={loginStudent}
                  disabled={isLoading || !email || !password || !registerNo}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : "Login"}
                </RippleButton>
                <RippleButton variant="ghost" className="w-full text-muted-foreground" onClick={() => router.push("/")}>
                  Back to Home
                </RippleButton>
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Secured with GPS + face recognition</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    )
  }

  // ── SCAN ──────────────────────────────────────────────────────────────────
  if (currentStep === "scan") {
    return (
      <div className="flex min-h-dvh flex-col relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0"><div className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-primary/15 blur-[100px]" /><div className="absolute bottom-0 left-0 h-60 w-60 rounded-full bg-blue-500/10 blur-[80px]" /></div>
        <AppHeader />
        <OfflineIndicator />
        <main className="flex-1 overflow-y-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="flex flex-col gap-5 px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Mark Attendance</h1>
                <p className="text-sm text-muted-foreground">{registerNo ? `Reg: ${registerNo}` : "Demo Mode"}</p>
              </div>
              <RippleButton variant="outline" size="sm" className="gap-1.5" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Logout
              </RippleButton>
            </div>
            <StepIndicator current={currentStep} />
            <Card className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/50 shadow-xl backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-5 w-5 text-primary" /> Scan Attendance QR
                </CardTitle>
                <CardDescription>Point your camera at the QR code shown by your teacher</CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                <div id="reader" className="overflow-hidden rounded-xl" style={{ width: "100%" }} />
                {!scannerReady && (
                  <div className="flex flex-col items-center justify-center gap-3 py-14">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Starting camera...</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/5 py-3 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>GPS + Face + Blink verification</span>
            </div>
          </motion.div>
        </main>
      </div>
    )
  }

  // ── GPS CHECK ─────────────────────────────────────────────────────────────
  if (currentStep === "gps") {
    return (
      <div className="flex min-h-dvh flex-col relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" /></div>
        <AppHeader />
        <OfflineIndicator />
        <main className="flex-1">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center gap-5 px-4 py-8">
            <StepIndicator current={currentStep} />
            <Card className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/50 shadow-2xl backdrop-blur-xl w-full max-w-sm before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent">
              <CardContent className="flex flex-col items-center gap-5 pt-8 pb-8">
                <motion.div
                  animate={gpsStatus === "checking" ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className={`flex h-20 w-20 items-center justify-center rounded-full ${gpsStatus === "ok" ? "bg-green-500/10" : gpsStatus === "error" ? "bg-destructive/10" : "bg-primary/10"}`}
                >
                  {gpsStatus === "checking" && <Loader2 className="h-10 w-10 animate-spin text-primary" />}
                  {gpsStatus === "ok" && <MapPin className="h-10 w-10 text-green-500" />}
                  {gpsStatus === "error" && <MapPin className="h-10 w-10 text-destructive" />}
                </motion.div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <h2 className="text-xl font-bold">
                    {gpsStatus === "checking" ? "Verifying Location" : gpsStatus === "ok" ? "Location Verified!" : "Location Check Failed"}
                  </h2>
                  <p className="text-sm text-muted-foreground px-4">{gpsMessage}</p>
                </div>
                {gpsStatus === "checking" && (
                  <p className="text-xs text-muted-foreground">Taking a few readings for accuracy — allow location access when prompted</p>
                )}
                {gpsStatus === "error" && (
                  <RippleButton className="w-full gap-2" onClick={resetToScan}>
                    <RefreshCw className="h-4 w-4" /> Try Again
                  </RippleButton>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    )
  }

  // ── VERIFY ────────────────────────────────────────────────────────────────
  if (currentStep === "verify") {
    return (
      <div className="flex min-h-dvh flex-col relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0"><div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-blue-500/15 blur-[100px]" /><div className="absolute bottom-0 -left-20 h-60 w-60 rounded-full bg-primary/10 blur-[80px]" /></div>
        <AppHeader />
        <OfflineIndicator />
        <main className="flex-1">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center gap-5 px-4 py-8">
            <StepIndicator current={currentStep} />
            <Card className="glass w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
              <CardHeader className="items-center pb-3 pt-6">
                <motion.div
                  animate={verifyStage === "blink" ? { scale: [1, 1.08, 1] } : verifyStage === "analyzing" ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  {verifyStage === "loading" && <Loader2 className="h-7 w-7 animate-spin text-primary" />}
                  {verifyStage === "blink" && <Eye className="h-7 w-7 text-primary" />}
                  {verifyStage === "analyzing" && <Fingerprint className="h-7 w-7 text-primary" />}
                </motion.div>
                <CardTitle className="text-lg font-bold">
                  {verifyStage === "loading" ? "Loading AI Models"
                    : verifyStage === "blink" ? "Liveness Check"
                      : "Analyzing Face"}
                </CardTitle>
                <CardDescription className="text-center text-sm">
                  {verifyStage === "loading" ? "Preparing face recognition..."
                    : verifyStage === "blink" ? "Please blink once to confirm you're live"
                      : "Comparing with registered face..."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 pb-6">
                <div className="relative w-full max-w-[260px] overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "1/1" }}>
                  <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"
                    style={{ transform: "scaleX(-1)", display: verifyStage !== "loading" ? "block" : "none" }} />
                  {verifyStage === "loading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                    </div>
                  )}
                  {verifyStage !== "loading" && (
                    <>
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "radial-gradient(ellipse 65% 60% at 50% 45%, transparent 35%, rgba(0,0,0,0.55) 100%)" }} />
                      {verifyStage === "analyzing" && (
                        <motion.div className="absolute left-1/2 w-36 h-0.5 rounded-full pointer-events-none"
                          style={{ background: "linear-gradient(90deg, transparent, #3b82f6, transparent)", x: "-50%" }}
                          animate={{ top: ["20%", "75%", "20%"] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} />
                      )}
                      <ScanFrame color={
                        blinkDetected ? "#22c55e"
                          : verifyStage === "analyzing" ? "#3b82f6"
                            : "rgba(255,255,255,0.4)"
                      } />
                      {/* Live EAR debug overlay — shows on phone so you can tune threshold */}
                      {verifyStage === "blink" && !blinkDetected && (
                        <div className="absolute top-2 left-2 rounded-lg bg-black/70 px-2 py-1 backdrop-blur-sm">
                          <p className="text-[10px] font-mono text-white leading-tight">
                            EAR: <span style={{ color: earValue < 0.32 ? "#4ade80" : "#facc15" }}>{earValue.toFixed(3)}</span>
                          </p>
                          <p className="text-[10px] font-mono text-white/60 leading-tight">thr: 0.320</p>
                        </div>
                      )}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                        <AnimatePresence mode="wait">
                          {verifyStage === "blink" && !blinkDetected && (
                            <motion.div key="blink" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 backdrop-blur-sm">
                              <Eye className="h-3 w-3 text-yellow-400" />
                              <span className="text-xs text-white font-medium">Blink once 👁</span>
                            </motion.div>
                          )}
                          {blinkDetected && (
                            <motion.div key="blinked" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                              className="flex items-center gap-1.5 rounded-full bg-green-600/80 px-3 py-1 backdrop-blur-sm">
                              <CheckCircle2 className="h-3 w-3 text-white" />
                              <span className="text-xs text-white font-medium">Blink detected!</span>
                            </motion.div>
                          )}
                          {verifyStage === "analyzing" && (
                            <motion.div key="analyzing" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              className="flex items-center gap-1.5 rounded-full bg-blue-600/80 px-3 py-1 backdrop-blur-sm">
                              <Loader2 className="h-3 w-3 text-white animate-spin" />
                              <span className="text-xs text-white font-medium">Scanning...</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  )}
                </div>
                {verifyStage === "blink" && !blinkDetected && (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-center text-xs text-muted-foreground px-4">
                      Keep your face in frame and blink naturally. Blink slowly and fully close your eyes.
                    </p>
                    <AnimatePresence>
                      {showManualBlink && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="flex flex-col items-center gap-2">
                          <p className="text-xs text-yellow-600 font-medium">Camera not catching it?</p>
                          <RippleButton variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleManualBlink}>
                            <Eye className="h-3.5 w-3.5" /> I blinked — continue
                          </RippleButton>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {verifyStage === "analyzing" && (
                  <p className="text-center text-xs text-muted-foreground px-4">Hold still...</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    )
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (currentStep === "success") {
    return (
      <div className="flex min-h-dvh flex-col relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-green-500/15 blur-[120px]" /></div>
        <AppHeader />
        <OfflineIndicator />
        <Confetti trigger={showConfetti} />
        <main className="flex-1">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
            className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center gap-5 px-4 py-8">
            <StepIndicator current={currentStep} />
            <Card className="glass w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
              <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.1 }}
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.25 }}>
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  </motion.div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  className="flex flex-col items-center gap-1">
                  <h2 className="text-2xl font-bold">Attendance Marked!</h2>
                  <p className="text-center text-sm text-muted-foreground">Your attendance has been successfully recorded.</p>
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex flex-col items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-green-500/30 bg-green-500/10 px-4 py-1 text-sm text-green-600">
                    ✓ Verified at {attendanceTime}
                  </Badge>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 text-green-500" /> GPS ✓</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3 text-green-500" /> Liveness ✓</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Fingerprint className="h-3 w-3 text-green-500" /> Face ✓</span>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-2 w-full">
                  <RippleButton className="w-full h-11 gap-2" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" /> Done
                  </RippleButton>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    )
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh flex-col relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-destructive/10 blur-[100px]" /></div>
      <AppHeader />
      <OfflineIndicator />
      <main className="flex-1">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
          className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center gap-5 px-4 py-8">
          <Card className="glass w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
            <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.1 }}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-12 w-12 text-destructive" />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="flex flex-col items-center gap-1">
                <h2 className="text-2xl font-bold">Verification Failed</h2>
                <p className="text-center text-sm text-muted-foreground px-4">{errorMessage || "Something went wrong. Please try again."}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="mt-2 flex w-full flex-col gap-2">
                <RippleButton className="w-full h-11 gap-2" onClick={resetToScan}>
                  <RefreshCw className="h-4 w-4" /> Try Again
                </RippleButton>
                <RippleButton variant="ghost" className="w-full text-muted-foreground" onClick={handleLogout}>Logout</RippleButton>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}