"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Camera,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Upload,
  RotateCcw,
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AppHeader, OfflineIndicator } from "@/components/attendance/shared"

// =============================================================================
// Types
// =============================================================================

type RegistrationStatus = "idle" | "capturing" | "processing" | "success" | "error"

interface Student {
  id: string
  name: string
  rollNumber: string
  email: string
  faceRegistered: boolean
}

// =============================================================================
// Mock Data
// =============================================================================

const MOCK_STUDENTS: Student[] = [
  { id: "1", name: "John Doe", rollNumber: "STU-2024-001", email: "john@university.edu", faceRegistered: true },
  { id: "2", name: "Jane Smith", rollNumber: "STU-2024-002", email: "jane@university.edu", faceRegistered: false },
  { id: "3", name: "Alex Johnson", rollNumber: "STU-2024-003", email: "alex@university.edu", faceRegistered: true },
  { id: "4", name: "Emily Davis", rollNumber: "STU-2024-004", email: "emily@university.edu", faceRegistered: false },
  { id: "5", name: "Michael Brown", rollNumber: "STU-2024-005", email: "michael@university.edu", faceRegistered: false },
  { id: "6", name: "Sarah Wilson", rollNumber: "STU-2024-006", email: "sarah@university.edu", faceRegistered: true },
  { id: "7", name: "David Lee", rollNumber: "STU-2024-007", email: "david@university.edu", faceRegistered: false },
  { id: "8", name: "Emma Taylor", rollNumber: "STU-2024-008", email: "emma@university.edu", faceRegistered: true },
]

// =============================================================================
// Face Capture Component
// =============================================================================

function FaceCapture({
  student,
  onSuccess,
  onCancel,
}: {
  student: Student
  onSuccess: () => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<RegistrationStatus>("idle")
  const [cameraActive, setCameraActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (err) {
      console.error("Camera error:", err)
      setStatus("error")
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setCameraActive(false)
    }
  }, [])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    
    const imageData = canvas.toDataURL("image/jpeg")
    setCapturedImage(imageData)
    setStatus("capturing")
    stopCamera()
  }, [stopCamera])

  const retakePhoto = useCallback(() => {
    setCapturedImage(null)
    setStatus("idle")
    startCamera()
  }, [startCamera])

  const processRegistration = useCallback(() => {
    setStatus("processing")
    // Simulate face processing
    setTimeout(() => {
      const success = Math.random() > 0.2
      if (success) {
        setStatus("success")
        setTimeout(onSuccess, 1500)
      } else {
        setStatus("error")
      }
    }, 2500)
  }, [onSuccess])

  const handleCancel = useCallback(() => {
    stopCamera()
    onCancel()
  }, [stopCamera, onCancel])

  return (
    <Card className="rounded-2xl border-border/50 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl"
            onClick={handleCancel}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="text-lg">Register Face</CardTitle>
            <CardDescription>{student.name} - {student.rollNumber}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        {/* Camera/Image Preview */}
        <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-2xl bg-muted">
          {!cameraActive && !capturedImage && (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Camera className="h-10 w-10 text-primary" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Position the student&apos;s face in the center of the frame
              </p>
              <Button
                className="gap-2 rounded-xl"
                onClick={startCamera}
              >
                <Camera className="h-4 w-4" />
                Start Camera
              </Button>
            </div>
          )}

          {cameraActive && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Face guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-full border-4 border-dashed border-primary/50" />
              </div>
            </>
          )}

          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured face"
              className="h-full w-full object-cover"
            />
          )}

          {status === "processing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              >
                <Loader2 className="h-12 w-12 text-primary" />
              </motion.div>
              <p className="mt-4 text-sm font-medium text-foreground">
                Processing face data...
              </p>
            </div>
          )}

          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-success/20 backdrop-blur-sm"
            >
              <CheckCircle2 className="h-16 w-16 text-success" />
              <p className="mt-4 text-lg font-semibold text-success">
                Face Registered!
              </p>
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/20 backdrop-blur-sm"
            >
              <AlertCircle className="h-16 w-16 text-destructive" />
              <p className="mt-4 text-lg font-semibold text-destructive">
                Registration Failed
              </p>
              <p className="mt-1 text-sm text-destructive/80">
                Please try again
              </p>
            </motion.div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Action Buttons */}
        <div className="flex w-full max-w-xs flex-col gap-3">
          {cameraActive && (
            <Button
              className="w-full gap-2 rounded-xl"
              onClick={capturePhoto}
            >
              <Camera className="h-4 w-4" />
              Capture Photo
            </Button>
          )}

          {capturedImage && status === "capturing" && (
            <>
              <Button
                className="w-full gap-2 rounded-xl"
                onClick={processRegistration}
              >
                <Upload className="h-4 w-4" />
                Register Face
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 rounded-xl"
                onClick={retakePhoto}
              >
                <RotateCcw className="h-4 w-4" />
                Retake Photo
              </Button>
            </>
          )}

          {status === "error" && (
            <Button
              className="w-full gap-2 rounded-xl"
              onClick={retakePhoto}
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>

        {/* Security Notice */}
        <div className="rounded-xl bg-primary/5 p-4 text-center">
          <p className="flex items-start justify-center gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <Shield className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
            Face data is encrypted and stored securely. It will only be used for attendance verification.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// Student List
// =============================================================================

const ROWS_PER_PAGE = 6

function StudentList({
  onSelectStudent,
}: {
  onSelectStudent: (student: Student) => void
}) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "registered" | "pending">("all")
  const [page, setPage] = useState(1)

  const filtered = MOCK_STUDENTS.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === "all" ||
      (filter === "registered" && student.faceRegistered) ||
      (filter === "pending" && !student.faceRegistered)
    return matchesSearch && matchesFilter
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const pageStudents = filtered.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE
  )

  const registeredCount = MOCK_STUDENTS.filter((s) => s.faceRegistered).length
  const pendingCount = MOCK_STUDENTS.filter((s) => !s.faceRegistered).length

  return (
    <div className="flex flex-col gap-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-xl border-border/50">
          <CardContent className="flex flex-col items-center p-4">
            <span className="text-2xl font-bold text-foreground">
              {MOCK_STUDENTS.length}
            </span>
            <span className="text-xs text-muted-foreground">Total</span>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50">
          <CardContent className="flex flex-col items-center p-4">
            <span className="text-2xl font-bold text-success">
              {registeredCount}
            </span>
            <span className="text-xs text-muted-foreground">Registered</span>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50">
          <CardContent className="flex flex-col items-center p-4">
            <span className="text-2xl font-bold text-warning-foreground">
              {pendingCount}
            </span>
            <span className="text-xs text-muted-foreground">Pending</span>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="rounded-2xl border-border/50 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Student Face Registration</CardTitle>
          <CardDescription>
            Select a student to register their face for attendance verification
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or roll number..."
                className="rounded-xl pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <Select
              value={filter}
              onValueChange={(v) => {
                setFilter(v as typeof filter)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full rounded-xl sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Student List */}
          <div className="flex flex-col gap-2">
            {pageStudents.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                No students found.
              </div>
            ) : (
              pageStudents.map((student, idx) => (
                <motion.button
                  key={student.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md"
                  onClick={() => onSelectStudent(student)}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {student.name}
                      </span>
                      {student.faceRegistered ? (
                        <Badge className="gap-1 rounded-full border-success/20 bg-success/10 text-xs text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          Registered
                        </Badge>
                      ) : (
                        <Badge className="gap-1 rounded-full border-warning/20 bg-warning/10 text-xs text-warning-foreground">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {student.rollNumber}
                    </span>
                  </div>
                  <Camera className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                </motion.button>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1 pt-2">
              <span className="text-xs text-muted-foreground">
                Showing {(page - 1) * ROWS_PER_PAGE + 1}
                {" - "}
                {Math.min(page * ROWS_PER_PAGE, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[3rem] text-center text-xs font-medium">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// Admin Face Registration Page
// =============================================================================

export default function AdminFaceRegistrationPage() {
  const router = useRouter()
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student)
  }

  const handleRegistrationSuccess = () => {
    setSelectedStudent(null)
  }

  const handleCancel = () => {
    setSelectedStudent(null)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader title="Admin Panel" />
      <OfflineIndicator />

      <main className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 px-4 py-6"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Face Registration
              </h1>
              <p className="text-sm text-muted-foreground">
                Register student faces for biometric verification
              </p>
            </div>
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            {selectedStudent ? (
              <motion.div
                key="capture"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <FaceCapture
                  student={selectedStudent}
                  onSuccess={handleRegistrationSuccess}
                  onCancel={handleCancel}
                />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <StudentList onSelectStudent={handleSelectStudent} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  )
}
