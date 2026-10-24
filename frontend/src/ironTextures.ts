import * as THREE from 'three'

const TEX_W = 512
const TEX_H = 256

// Procedural iron: mottled dark metal with rust blotches and scratches, plus a pitted bump map.
function makeIronBase() {
  const make = () => {
    const canvas = document.createElement('canvas')
    canvas.width = TEX_W
    canvas.height = TEX_H
    return { canvas, g: canvas.getContext('2d')! }
  }

  const { canvas: colorCanvas, g } = make()
  g.fillStyle = '#4a4e53'
  g.fillRect(0, 0, TEX_W, TEX_H)
  for (let i = 0; i < 6000; i++) {
    const v = 50 + Math.floor(Math.random() * 40)
    g.fillStyle = `rgba(${v}, ${v}, ${v + 4}, 0.5)`
    g.fillRect(Math.random() * TEX_W, Math.random() * TEX_H, 2, 2)
  }
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * TEX_W
    const y = Math.random() * TEX_H
    const r = 6 + Math.random() * 26
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(140, 68, 28, 0.55)')
    grad.addColorStop(1, 'rgba(140, 68, 28, 0)')
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  g.strokeStyle = 'rgba(175, 180, 185, 0.25)'
  g.lineWidth = 1
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * TEX_W
    const y = Math.random() * TEX_H
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60)
    g.stroke()
  }

  const { canvas: bumpCanvas, g: b } = make()
  b.fillStyle = '#808080'
  b.fillRect(0, 0, TEX_W, TEX_H)
  for (let i = 0; i < 2500; i++) {
    const v = 90 + Math.floor(Math.random() * 90)
    b.fillStyle = `rgb(${v}, ${v}, ${v})`
    b.beginPath()
    b.arc(Math.random() * TEX_W, Math.random() * TEX_H, 0.6 + Math.random() * 2.2, 0, Math.PI * 2)
    b.fill()
  }

  const bump = new THREE.CanvasTexture(bumpCanvas)
  return { colorCanvas, bump }
}

// Copy of the iron texture with the number stamped on the side that faces the camera
// (u = 0.25 on a three.js sphere is the +z side). Painted on, so no DOM overlay is needed.
function numberedTexture(base: HTMLCanvasElement, value: number) {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const g = canvas.getContext('2d')!
  g.drawImage(base, 0, 0)
  // Shrink the font as numbers get longer so two- and three-digit sums still fit.
  const digits = String(value).length
  g.font = `bold ${digits === 1 ? 84 : digits === 2 ? 68 : 52}px Georgia, serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const x = TEX_W * 0.25
  const y = TEX_H * 0.5
  g.lineJoin = 'round'
  g.lineWidth = 9
  g.strokeStyle = 'rgba(0, 0, 0, 0.9)'
  g.strokeText(String(value), x, y)
  g.fillStyle = '#e6dfcc'
  g.fillText(String(value), x, y)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  return map
}

// The base canvas and bump map are built once and shared by every ball and cannon shot.
let ironBase: ReturnType<typeof makeIronBase> | null = null
export function getIronBase() {
  ironBase ??= makeIronBase()
  return ironBase
}

// One texture per distinct number, created the first time a ball shows it and reused after.
const textureCache = new Map<number, THREE.CanvasTexture>()
export function ironTextureFor(value: number) {
  let texture = textureCache.get(value)
  if (!texture) {
    texture = numberedTexture(getIronBase().colorCanvas, value)
    textureCache.set(value, texture)
  }
  return texture
}
