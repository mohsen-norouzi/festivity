import * as THREE from 'three'

export type TileArtwork = 'live' | 'poster' | 'brand' | 'vinyl'

/** Small, shared, mipmapped maps. All wear is baked once, never per frame. */
export function createUndergroundSurfaces(anisotropy: number) {
  const textures: THREE.CanvasTexture[] = []
  let disposed = false, seed = 71
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296 }
  const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = 512; return c }
  const texture = (c: HTMLCanvasElement, color = true) => {
    const map = new THREE.CanvasTexture(c)
    if (color) map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = Math.min(8, anisotropy)
    textures.push(map)
    return map
  }
  const wearCanvas = canvas(), inkCanvas = canvas(), roughCanvas = canvas(), paperCanvas = canvas()
  const wear = wearCanvas.getContext('2d')!, ink = inkCanvas.getContext('2d')!, rough = roughCanvas.getContext('2d')!, paper = paperCanvas.getContext('2d')!
  for (const [ctx, color] of [[wear, '#f4eee8'], [ink, '#26282b'], [rough, '#b9b9b9'], [paper, '#e6ded1']] as const) { ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 512) }
  for (let i = 0; i < 3200; i++) {
    const x = random() * 512, y = random() * 512, size = .3 + random() * 1.5
    wear.fillStyle = `rgba(18,15,13,${.06 + random() * .3})`; wear.fillRect(x, y, size, size * .65)
    ink.fillStyle = `rgba(178,164,145,${.04 + random() * .17})`; ink.fillRect(x, y, size, size * .7)
    rough.fillStyle = random() > .5 ? '#e6e6e6' : '#888888'; rough.fillRect(x, y, size, size)
    paper.fillStyle = `rgba(40,29,23,${random() * .16})`; paper.fillRect(x, y, size, size)
  }
  for (let i = 0; i < 75; i++) {
    const x = random() * 512, y = random() * 512, dx = 2 + random() * 30, dy = (random() - .5) * 10
    for (const [ctx, color] of [[wear, 'rgba(36,25,20,.33)'], [ink, 'rgba(167,154,139,.29)'], [rough, '#eeeeee']] as const) {
      ctx.strokeStyle = color; ctx.lineWidth = .35 + random() * .55
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke()
    }
  }
  // Irregular chips and hairline scuffs stay visible at the actual tile size.
  const chip = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) => {
    ctx.fillStyle = color; ctx.beginPath()
    for (let j = 0; j < 9; j++) {
      const angle = j / 9 * Math.PI * 2, r = radius * (.3 + random() * .7)
      const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r * .7
      if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath(); ctx.fill()
  }
  for (let i = 0; i < 145; i++) {
    const x = random() * 512, y = random() * 512, radius = 1.2 + random() ** 3 * 8
    chip(wear, x, y, radius, `rgba(22,19,17,${.3 + random() * .5})`)
    chip(ink, x, y, radius * .65, 'rgba(162,151,137,.42)')
    chip(rough, x, y, radius, '#ffffff')
  }
  for (let i = 0; i < 90; i++) {
    const x = random() * 512, y = random() * 512
    if (x > 65 && x < 440 && y > 75 && y < 430) continue
    chip(paper, x, y, 3 + random() ** 2 * 24, random() > .55 ? '#37322d' : '#b5a48f')
  }
  paper.save(); paper.globalAlpha = .15; paper.fillStyle = '#27221e'; paper.font = '900 33px Arial'
  paper.translate(8, 510); paper.rotate(-Math.PI / 2); paper.fillText('MUSYNC / AFTER HOURS / 001', 15, 24); paper.restore()
  const maps = { paint: texture(wearCanvas), ink: texture(inkCanvas), roughness: texture(roughCanvas, false), paper: texture(paperCanvas) }
  const artworks = new Map<TileArtwork, THREE.CanvasTexture>()
  const face = (kind: TileArtwork) => {
    const existing = artworks.get(kind); if (existing) return existing
    const c = canvas(), ctx = c.getContext('2d')!
    const map = texture(c); artworks.set(kind, map)
    const clip = () => { ctx.beginPath(); ctx.roundRect(8, 8, 496, 496, 62); ctx.clip() }
    if (kind === 'live') {
      ctx.save(); clip(); ctx.fillStyle = '#221411'; ctx.fillRect(0, 0, 512, 512); ctx.restore()
      const image = new Image(); image.src = '/textures/live-session.webp'
      image.onload = () => {
        if (disposed) return
        ctx.save(); clip(); ctx.drawImage(image, 0, 0, 512, 512)
        const shade = ctx.createLinearGradient(0, 350, 0, 512); shade.addColorStop(0, 'transparent'); shade.addColorStop(1, 'rgba(8,7,6,.8)')
        ctx.fillStyle = shade; ctx.fillRect(0, 0, 512, 512)
        ctx.fillStyle = '#eee0ce'; ctx.font = '600 20px Arial'; ctx.letterSpacing = '4px'; ctx.fillText('LIVE / AFTER HOURS', 34, 467)
        ctx.restore(); map.needsUpdate = true
      }
    } else if (kind === 'poster') {
      ctx.save(); clip(); ctx.drawImage(paperCanvas, 0, 0)
      ctx.fillStyle = '#1a1918'; ctx.font = '900 85px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.letterSpacing = '-5px'
      ;['REAL', 'ARTISTS.', 'REAL', 'CHANGE.'].forEach((word, i) => { ctx.save(); ctx.translate(39, 115 + i * 91); ctx.rotate(-.035); ctx.fillText(word, 0, 0); ctx.restore() })
      ctx.globalCompositeOperation = 'destination-out'
      for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(0,0,0,${random() * .65})`; ctx.fillRect(random() * 512, random() * 512, 1 + random() * 3, random() * 2) }
      ctx.restore()
    } else if (kind === 'brand') {
      const image = new Image(); image.src = '/brand/musync-symbol-white.svg'
      image.onload = () => {
        if (disposed) return
        ctx.drawImage(image, 95, 72, 322, 365); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#111216'; ctx.fillRect(0, 0, 512, 512)
        ctx.globalCompositeOperation = 'destination-out'
        for (let i = 0; i < 330; i++) ctx.fillRect(random() * 512, random() * 512, .5 + random() * 2.5, 1)
        ctx.globalCompositeOperation = 'source-over'; map.needsUpdate = true
      }
    } else {
      ctx.fillStyle = '#0b0b0b'; ctx.beginPath(); ctx.arc(256, 256, 210, 0, Math.PI * 2); ctx.fill()
      for (let r = 70; r < 207; r += 3) { ctx.strokeStyle = r % 2 ? '#242221' : '#171717'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(256, 256, r, 0, Math.PI * 2); ctx.stroke() }
      const light = ctx.createLinearGradient(70, 440, 410, 80); light.addColorStop(0, 'rgba(255,228,203,.0)'); light.addColorStop(.43, 'rgba(255,228,203,.03)'); light.addColorStop(.5, 'rgba(255,228,203,.24)'); light.addColorStop(.57, 'rgba(255,228,203,.03)'); light.addColorStop(1, 'rgba(255,228,203,.0)')
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(256, 256, 210, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#d8bc9e'; ctx.beginPath(); ctx.arc(256, 256, 63, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1c1714'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.fillText('MUSYNC', 256, 236); ctx.font = '9px Arial'; ctx.fillText('SIDE A · 33 RPM', 256, 280)
      ctx.beginPath(); ctx.arc(256, 256, 8, 0, Math.PI * 2); ctx.fill()
    }
    map.needsUpdate = true
    return map
  }
  return { ...maps, face, dispose() { disposed = true; textures.forEach(map => map.dispose()) } }
}
