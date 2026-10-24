import { useEffect, useRef, useState } from 'react'
import { ballRadiusPx, balls, updateBalls } from './balls'
import { drawGlove } from './glove'
import {
  HAND_CONNECTIONS,
  INDEX_TIP,
  MIDDLE_TIP,
  stopHandTracking,
  detect,
  handAnchors,
  initHandTracking,
} from './handTracking'
import { getSickleHands } from './bird'
import { updateOperation } from './operations'

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '8px 16px',
  borderRadius: 8,
  background: 'rgba(0, 0, 0, 0.6)',
  color: '#fff',
  font: '18px system-ui, sans-serif',
  zIndex: 12,
}

// The webcam stream must keep running (MediaPipe reads its frames), but it is not shown:
// only the beach and the gloved hands are visible. Set to true to debug alignment.
const SHOW_CAMERA_FEED = false

export default function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [handVisible, setHandVisible] = useState(false)

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

  useEffect(() => {
    let cancelled = false
    let raf = 0
    let lastVideoTime = -1
    let lastTimestamp = 0
    let wasVisible = false
    // Gloves are drawn opaque here first, then composited over the main canvas (see draw).
    const gloveLayer = document.createElement('canvas')

    const draw = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      const dpr = window.devicePixelRatio || 1
      const cw = canvas.clientWidth
      const ch = canvas.clientHeight
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr)
        canvas.height = Math.round(ch * dpr)
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cw, ch)

      // Reproduce object-fit: cover so points land on the cropped video.
      const vw = video.videoWidth
      const vh = video.videoHeight
      const scale = Math.max(cw / vw, ch / vh)
      const offsetX = (cw - vw * scale) / 2
      const offsetY = (ch - vh * scale) / 2
      // Anchors are already mirrored, so only the cover mapping is applied here.
      const toCanvas = (p: { x: number; y: number }) => ({
        x: offsetX + p.x * vw * scale,
        y: offsetY + p.y * vh * scale,
      })

      // Pick up, drag and drop the cannonballs by pinching the index and middle fingertips together.
      const handInput = (hand: typeof handAnchors.left) => ({
        present: hand.present,
        pinch: hand.present && hand.pinch,
        point: hand.present ? toCanvas(hand.pinchPoint) : { x: 0, y: 0 },
      })
      updateOperation({ left: handAnchors.left, right: handAnchors.right })
      updateBalls({ left: handInput(handAnchors.left), right: handInput(handAnchors.right) }, cw, ch)

      // Gloves: opaque everywhere except over the balls, where they turn see-through so the
      // balls stay visible. Drawn on a layer first so overlapping glove parts do not stack alpha.
      // A hand showing a sickle (thumbs up) gets no glove at all: the sickle replaces it. A hand reading
      // Thumb_Up is hidden right away too, so the glove does not wait on the bird step to catch up.
      const sickleHands = getSickleHands().map((key) => handAnchors[key])
      const presentHands = [handAnchors.left, handAnchors.right].filter(
        (h) => h.present && h.gesture !== 'Thumb_Up' && !sickleHands.includes(h),
      )
      if (presentHands.length > 0) {
        if (gloveLayer.width !== canvas.width || gloveLayer.height !== canvas.height) {
          gloveLayer.width = canvas.width
          gloveLayer.height = canvas.height
        }
        const lg = gloveLayer.getContext('2d')
        if (lg) {
          lg.setTransform(dpr, 0, 0, dpr, 0, 0)
          lg.clearRect(0, 0, cw, ch)
          for (const hand of presentHands) drawGlove(lg, hand.landmarks.map(toCanvas))

          const radius = ballRadiusPx(cw, ch)
          const circles = new Path2D()
          for (const ball of balls) circles.arc(ball.x * cw, ball.y * ch, radius, 0, Math.PI * 2)
          const blit = () => ctx.drawImage(gloveLayer, 0, 0, cw, ch)

          ctx.save()
          const outside = new Path2D()
          outside.rect(0, 0, cw, ch)
          outside.addPath(circles)
          ctx.clip(outside, 'evenodd')
          blit()
          ctx.restore()

          ctx.save()
          ctx.clip(circles)
          ctx.globalAlpha = 0.35
          blit()
          ctx.restore()
        }
      }

      // Ball numbers on top of the gloves, so values stay readable while a hand covers a ball.
      if (presentHands.length > 0) {
        const r = ballRadiusPx(cw, ch)
        ctx.font = `bold ${Math.round(r * 1.1)}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        ctx.lineWidth = Math.max(4, r * 0.18)
        for (const ball of balls) {
          // Resting balls already show the number painted on them; only held balls (under the glove) need it.
          if (!ball.heldBy) continue
          const text = String(ball.value)
          const bx = ball.x * cw
          const by = ball.y * ch
          ctx.strokeStyle = '#000'
          ctx.strokeText(text, bx, by)
          ctx.fillStyle = ball.heldBy ? '#3dff7a' : '#fff'
          ctx.fillText(text, bx, by)
        }
      }

      for (const hand of presentHands) {
        const pts = hand.landmarks.map(toCanvas)
        const held = hand.pinch

        ctx.lineWidth = 2
        ctx.strokeStyle = 'rgba(255, 236, 205, 0.65)'
        for (const { start, end } of HAND_CONNECTIONS) {
          ctx.beginPath()
          ctx.moveTo(pts[start].x, pts[start].y)
          ctx.lineTo(pts[end].x, pts[end].y)
          ctx.stroke()
        }

        pts.forEach((p, i) => {
          const key = i === INDEX_TIP || i === MIDDLE_TIP // the two fingers that pick up balls
          ctx.beginPath()
          ctx.arc(p.x, p.y, key ? 11 : 6, 0, Math.PI * 2)
          ctx.fillStyle = key ? (held ? '#3dff7a' : '#ff3d71') : held ? '#3dff7a' : '#ffe14d'
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = '#111'
          ctx.stroke()
        })

        // State label near the palm; drawn on the unmirrored canvas so text reads normally.
        const palm = toCanvas(hand.palm)
        ctx.font = 'bold 28px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 6
        ctx.strokeStyle = '#000'
        const label = held ? 'Ball held' : 'Ball released'
        ctx.strokeText(label, palm.x, palm.y + 48)
        ctx.fillStyle = held ? '#3dff7a' : '#fff'
        ctx.fillText(label, palm.x, palm.y + 48)
      }
    }

    const loop = () => {
      raf = requestAnimationFrame(loop)
      const video = videoRef.current
      if (!video || video.readyState < 2 || video.videoWidth === 0) return
      if (video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime

      // detectForVideo requires strictly increasing timestamps.
      const now = Math.max(performance.now(), lastTimestamp + 1)
      lastTimestamp = now
      if (!detect(video, now)) return

      draw()
      const visible = handAnchors.left.present || handAnchors.right.present
      if (visible !== wasVisible) {
        wasVisible = visible
        setHandVisible(visible)
      }
    }

    initHandTracking()
      .then(() => {
        if (cancelled) return
        loop()
      })
      .catch(() => {
        if (!cancelled) setTrackingError('Hand tracking failed to load. Check your connection and reload the page.')
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stopHandTracking()
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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
          // Gloomy look. CSS filters only change how the video is shown, not the frames MediaPipe reads.
          filter: 'saturate(0.6) brightness(0.82) contrast(1.05)',
          opacity: SHOW_CAMERA_FEED ? 1 : 0,
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
      {trackingError ? (
        <div style={{ ...overlayStyle, top: 24 }}>{trackingError}</div>
      ) : (
        !handVisible && <div style={{ ...overlayStyle, top: 24 }}>Show your hand to the camera</div>
      )}
    </div>
  )
}
