import { useEffect, useRef, useState } from 'react'

export default function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : ''
        setError(
          name === 'NotFoundError'
            ? 'No camera found. Plug in a webcam and reload the page.'
            : 'Camera access was denied. Click the camera icon in your browser address bar, allow access, then reload the page.',
        )
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  if (error) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          boxSizing: 'border-box',
          color: '#fff',
          font: '20px system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        {error}
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: 'scaleX(-1)',
      }}
    />
  )
}
