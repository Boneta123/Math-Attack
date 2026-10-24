type P = { x: number; y: number }

// Landmark chains for the thumb and the four fingers (MCP -> tip), and the palm outline.
const CHAINS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
]
// Finger thickness in hand sizes (wrist to middle-finger knuckle).
const WIDTHS = [0.3, 0.27, 0.28, 0.26, 0.23]
const PALM = [0, 1, 5, 9, 13, 17]
const OUTLINE = '#2f1c0e'
const LEATHER = '#8a5a2e'
const CUFF = '#5a3819'
const CUFF_BAND = '#a4763f'

// Draws a brown leather glove over a hand from its 21 canvas-space landmarks.
// The caller draws the landmark points afterwards so every point stays visible on the glove.
export function drawGlove(ctx: CanvasRenderingContext2D, pts: P[]) {
  const s = Math.max(Math.hypot(pts[0].x - pts[9].x, pts[0].y - pts[9].y), 24)

  // Unit vector pointing from the knuckles towards the wrist; the cuff extends along it.
  const dx = pts[0].x - pts[9].x
  const dy = pts[0].y - pts[9].y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const cuffEnd = { x: pts[0].x + ux * s * 0.45, y: pts[0].y + uy * s * 0.45 }
  const cuffWidth = s * 0.72

  const chain = (idx: number[]) => {
    ctx.beginPath()
    idx.forEach((i, k) => (k ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y)))
  }
  const cuff = () => {
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    ctx.lineTo(cuffEnd.x, cuffEnd.y)
  }

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Outline pass first for every part so the glove reads as one merged silhouette.
  ctx.strokeStyle = OUTLINE
  ctx.fillStyle = OUTLINE
  CHAINS.forEach((c, k) => {
    chain(c)
    ctx.lineWidth = s * WIDTHS[k] + 6
    ctx.stroke()
  })
  chain(PALM)
  ctx.closePath()
  ctx.lineWidth = s * 0.3 + 6
  ctx.fill()
  ctx.stroke()
  cuff()
  ctx.lineCap = 'butt'
  ctx.lineWidth = cuffWidth + 6
  ctx.stroke()
  ctx.lineCap = 'round'

  // Leather fill pass.
  ctx.strokeStyle = LEATHER
  ctx.fillStyle = LEATHER
  CHAINS.forEach((c, k) => {
    chain(c)
    ctx.lineWidth = s * WIDTHS[k]
    ctx.stroke()
  })
  chain(PALM)
  ctx.closePath()
  ctx.lineWidth = s * 0.3
  ctx.fill()
  ctx.stroke()
  cuff()
  ctx.strokeStyle = CUFF
  ctx.lineCap = 'butt'
  ctx.lineWidth = cuffWidth
  ctx.stroke()
  ctx.lineCap = 'round'

  // Lighter band across the cuff.
  const bx = pts[0].x + ux * s * 0.3
  const by = pts[0].y + uy * s * 0.3
  const px = -uy * (cuffWidth / 2)
  const py = ux * (cuffWidth / 2)
  ctx.beginPath()
  ctx.moveTo(bx - px, by - py)
  ctx.lineTo(bx + px, by + py)
  ctx.strokeStyle = CUFF_BAND
  ctx.lineCap = 'butt'
  ctx.lineWidth = s * 0.1
  ctx.stroke()
  ctx.lineCap = 'round'

  // Sheen along each finger and stitching down its center.
  CHAINS.forEach((c, k) => {
    chain(c)
    ctx.strokeStyle = 'rgba(255, 214, 160, 0.16)'
    ctx.lineWidth = s * WIDTHS[k] * 0.35
    ctx.stroke()
    chain(c)
    ctx.setLineDash([4, 5])
    ctx.strokeStyle = 'rgba(35, 20, 8, 0.6)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.setLineDash([])
  })

  ctx.restore()
}
