"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Shield,
  Fingerprint,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  LogOut,
  BookOpen,
  Camera,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

// =============================================================================
// Types
// =============================================================================

type Step = "scan" | "verify" | "success" | "error"

// =============================================================================
// Main Component
// =============================================================================

export default function StudentPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)

  // Auth state
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [registerNo, setRegisterNo] = useState("")
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Attendance flow state
  const [currentStep, setCurrentStep] = useState<Step>("scan")
  const [scannerReady, setScannerReady] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  // Check existing session on mount
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setLoggedIn(true)
      })
    }
  }, [])

  // Initialize QR scanner when logged in
  useEffect(() => {
    if (!loggedIn || currentStep !== "scan") return

    let scanner: any = null

    const initScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode")
        
        scanner = new Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: 250 },
          false
        )

        const onScanSuccess = async (decodedText: string) => {
          let payload
          try {
            payload = JSON.parse(decodedText)
          } catch {
            setErrorMessage("Invalid QR code")
            setCurrentStep("error")
            return
          }

          const { session_id } = payload

          // Move to verification step
          setCurrentStep("verify")
          setVerifying(true)

          // Verify face
          const verified = await verifyFace()

          if (!verified) {
            setErrorMessage("Face verification failed")
            setCurrentStep("error")
            setVerifying(false)
            return
          }

          // Mark attendance
          if (isSupabaseConfigured && supabase) {
            const { error } = await supabase.from("attendance").insert({
              session_id,
              register_no: registerNo,
            })

            if (error) {
              if (error.code === "23505") {
                setErrorMessage("Attendance already marked")
              } else {
                setErrorMessage(error.message)
              }
              setCurrentStep("error")
              setVerifying(false)
              return
            }
          }

          setVerifying(false)
          setCurrentStep("success")
          scanner?.clear()
        }

        scanner.render(onScanSuccess, () => {})
        setScannerReady(true)
      } catch (err) {
        console.error("Failed to initialize scanner:", err)
      }
    }

    initScanner()

    return () => {
      scanner?.clear().catch(() => {})
    }
  }, [loggedIn, currentStep, registerNo])

  // Load face models
  const loadFaceModels = async () => {
    const faceapi = await import("face-api.js")
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models")
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models")
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models")
    return faceapi
  }

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error("Failed to start camera:", err)
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
    }
  }

  // Verify face
  const verifyFace = async (): Promise<boolean> => {
    try {
      const faceapi = await loadFaceModels()
      await startCamera()

      // Wait for camera to stabilize
      await new Promise((res) => setTimeout(res, 2000))

      if (!videoRef.current) return false

      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        stopCamera()
        return false
      }

      const liveDescriptor = Array.from(detection.descriptor)

      if (!isSupabaseConfigured || !supabase) {
        // Demo mode - always pass
        stopCamera()
        return true
      }

      const { data } = await supabase
        .from("students")
        .select("face_embedding")
        .eq("register_no", registerNo)
        .single()

      if (!data || !data.face_embedding) {
        stopCamera()
        return false
      }

      const distance = faceapi.euclideanDistance(
        liveDescriptor,
        data.face_embedding
      )

      stopCamera()
      return distance < 0.5
    } catch (err) {
      console.error("Face verification error:", err)
      stopCamera()
      return false
    }
  }

  // Login handler
  const loginStudent = async () => {
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
      .from("students")
      .select("*")
      .eq("email", email)
      .eq("register_no", registerNo)
      .single()

    if (!data) {
      setStatus("Register number does not match email")
      setIsLoading(false)
      return
    }

    setLoggedIn(true)
    setIsLoading(false)
  }

  // Logout
  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    }
    stopCamera()
    setLoggedIn(false)
    setCurrentStep("scan")
  }

  // Reset to scan
  const resetToScan = () => {
    setCurrentStep("scan")
    setErrorMessage("")
    setScannerReady(false)
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
                  <BookOpen className="h-7 w-7 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl font-bold">Student Login</CardTitle>
                <CardDescription>Sign in to mark your attendance</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="student@example.com"
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
                    Register Number
                  </label>
                  <Input
                    type="text"
                    placeholder="STU-2024-001"
                    className="rounded-xl"
                    value={registerNo}
                    onChange={(e) => setRegisterNo(e.target.value)}
                  />
                </div>

                {status && (
                  <p className="text-center text-sm text-destructive">{status}</p>
                )}

                <Button
                  className="mt-2 w-full gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={loginStudent}
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
  // QR SCAN STEP
  // =========================================================================
  if (currentStep === "scan") {
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
                  Mark Attendance
                </h1>
                <p className="text-sm text-muted-foreground">
                  Register: {registerNo || "Demo Mode"}
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

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <QrCode className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Scan QR</span>
              </div>
              <div className="h-px w-8 bg-border" />
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Fingerprint className="h-4 w-4" />
                </div>
                <span className="text-sm text-muted-foreground">Verify</span>
              </div>
              <div className="h-px w-8 bg-border" />
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-sm text-muted-foreground">Done</span>
              </div>
            </div>

            {/* QR Scanner */}
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-5 w-5 text-primary" />
                  Scan Attendance QR
                </CardTitle>
                <CardDescription>
                  Point your camera at the QR code displayed by your teacher
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  id="reader"
                  className="overflow-hidden rounded-xl"
                  style={{ width: "100%" }}
                />
                {!scannerReady && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Secure verification with face recognition</span>
            </div>
          </motion.div>
        </main>
      </div>
    )
  }

  // =========================================================================
  // VERIFICATION STEP
  // =========================================================================
  if (currentStep === "verify") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <AppHeader />
        <OfflineIndicator />

        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center gap-6 px-4 py-8"
          >
            <Card className="w-full max-w-sm rounded-2xl border-border/50 shadow-lg">
              <CardHeader className="items-center pb-2">
                <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Camera className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl font-bold">
                  Face Verification
                </CardTitle>
                <CardDescription className="text-center">
                  Look at the camera to verify your identity
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="relative aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl bg-muted">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  {verifying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm font-medium">Verifying...</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    )
  }

  // =========================================================================
  // SUCCESS STEP
  // =========================================================================
  if (currentStep === "success") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <AppHeader />
        <OfflineIndicator />

        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center gap-6 px-4 py-8"
          >
            <Card className="w-full max-w-sm rounded-2xl border-border/50 shadow-lg">
              <CardContent className="flex flex-col items-center gap-4 pt-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10"
                >
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </motion.div>
                <h2 className="text-xl font-bold text-foreground">
                  Attendance Marked!
                </h2>
                <p className="text-center text-sm text-muted-foreground">
                  Your attendance has been successfully recorded.
                </p>
                <Badge
                  variant="outline"
                  className="mt-2 rounded-full border-success/30 bg-success/10 text-success"
                >
                  {new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Badge>

                <Button
                  className="mt-4 w-full gap-2 rounded-xl"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Done
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    )
  }

  // =========================================================================
  // ERROR STEP
  // =========================================================================
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader />
      <OfflineIndicator />

      <main className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center gap-6 px-4 py-8"
        >
          <Card className="w-full max-w-sm rounded-2xl border-border/50 shadow-lg">
            <CardContent className="flex flex-col items-center gap-4 pt-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10"
              >
                <XCircle className="h-10 w-10 text-destructive" />
              </motion.div>
              <h2 className="text-xl font-bold text-foreground">
                Verification Failed
              </h2>
              <p className="text-center text-sm text-muted-foreground">
                {errorMessage || "Something went wrong. Please try again."}
              </p>

              <Button
                className="mt-4 w-full gap-2 rounded-xl"
                onClick={resetToScan}
              >
                Try Again
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-xl text-muted-foreground"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
