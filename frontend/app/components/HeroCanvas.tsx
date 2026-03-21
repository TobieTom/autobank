'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// ── Constants ──────────────────────────────────────────────
const NODE_COUNT      = 65
const MAX_DIST        = 7.5   // max edge distance
const MAX_CONN        = 5     // max connections per node
const PARTICLE_COUNT  = 90
const DRIFT_SPEED     = 0.008
const MOUSE_PULL      = 0.015

// ── Types ──────────────────────────────────────────────────
interface NodeData {
  pos:    THREE.Vector3
  vel:    THREE.Vector3
  active: boolean
  mesh:   THREE.Mesh
}

interface ParticleData {
  edgeIdx: number
  t:       number    // 0→1 along edge
  speed:   number
  dir:     1 | -1
  mesh:    THREE.Mesh
}

interface EdgeData { a: number; b: number }

export default function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ nx: 0, ny: 0 })  // normalized -1..1

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ── Renderer ──────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // ── Scene / Camera ────────────────────────────────────
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200
    )
    camera.position.z = 22

    // ── Nodes ─────────────────────────────────────────────
    const nodeGeom = new THREE.SphereGeometry(0.12, 6, 6)
    const nodes: NodeData[] = []

    for (let i = 0; i < NODE_COUNT; i++) {
      const active = Math.random() > 0.55
      const mat    = new THREE.MeshBasicMaterial({
        color: active ? 0x00D4FF : 0x2a2a3e,
      })
      const mesh = new THREE.Mesh(nodeGeom, mat)
      const pos  = new THREE.Vector3(
        (Math.random() - 0.5) * 32,
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 12
      )
      mesh.position.copy(pos)
      scene.add(mesh)

      nodes.push({
        pos,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * DRIFT_SPEED,
          (Math.random() - 0.5) * DRIFT_SPEED,
          (Math.random() - 0.5) * DRIFT_SPEED * 0.4
        ),
        active,
        mesh,
      })
    }

    // ── Edges ─────────────────────────────────────────────
    const edges: EdgeData[]  = []
    const connCount          = new Array(NODE_COUNT).fill(0)
    const edgePosArr: number[] = []

    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        if (connCount[i] >= MAX_CONN || connCount[j] >= MAX_CONN) continue
        const d = nodes[i].pos.distanceTo(nodes[j].pos)
        if (d < MAX_DIST) {
          edges.push({ a: i, b: j })
          connCount[i]++
          connCount[j]++
          const a = nodes[i].pos
          const b = nodes[j].pos
          edgePosArr.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
      }
    }

    const lineGeom = new THREE.BufferGeometry()
    const lineAttr = new THREE.Float32BufferAttribute(edgePosArr, 3)
    lineAttr.setUsage(THREE.DynamicDrawUsage)
    lineGeom.setAttribute('position', lineAttr)
    const lineMat  = new THREE.LineBasicMaterial({
      color: 0x00D4FF,
      transparent: true,
      opacity: 0.12,
    })
    const lineSegs = new THREE.LineSegments(lineGeom, lineMat)
    scene.add(lineSegs)

    // ── Particles ──────────────────────────────────────────
    const particleGeom = new THREE.SphereGeometry(0.07, 4, 4)
    const particleMat  = new THREE.MeshBasicMaterial({ color: 0x00D4FF })
    const particles: ParticleData[] = []

    for (let i = 0; i < Math.min(PARTICLE_COUNT, edges.length * 2); i++) {
      const mesh    = new THREE.Mesh(particleGeom, particleMat)
      const edgeIdx = Math.floor(Math.random() * edges.length)
      scene.add(mesh)
      particles.push({
        edgeIdx,
        t:     Math.random(),
        speed: 0.0015 + Math.random() * 0.003,
        dir:   Math.random() > 0.5 ? 1 : -1,
        mesh,
      })
    }

    // ── Mouse tracking ─────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.nx = (e.clientX / window.innerWidth)  * 2 - 1
      mouseRef.current.ny = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', onMouseMove)

    // ── Resize ─────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    // ── Animation loop ─────────────────────────────────────
    let rafId: number
    let time  = 0
    const _tmp = new THREE.Vector3()

    const animate = () => {
      rafId  = requestAnimationFrame(animate)
      time  += 0.004

      // Slow scene-level rotation
      scene.rotation.y = Math.sin(time * 0.18) * 0.18
      scene.rotation.x = Math.sin(time * 0.10) * 0.08

      // Mouse world position (z=0 plane)
      const mx = mouseRef.current.nx * 16
      const my = mouseRef.current.ny * 11

      // Update nodes
      nodes.forEach(node => {
        // Drift
        node.pos.add(node.vel)

        // Soft bounce at bounds
        if (Math.abs(node.pos.x) > 16) node.vel.x *= -1
        if (Math.abs(node.pos.y) > 11) node.vel.y *= -1
        if (Math.abs(node.pos.z) >  6) node.vel.z *= -1

        // Mouse pull (nearest 8 units)
        _tmp.set(mx, my, node.pos.z)
        const dist = _tmp.distanceTo(node.pos)
        if (dist < 8) {
          _tmp.sub(node.pos).normalize().multiplyScalar(MOUSE_PULL * (1 - dist / 8))
          node.pos.add(_tmp)
        }

        node.mesh.position.copy(node.pos)
      })

      // Update line positions
      const posAttr = lineGeom.attributes['position'] as THREE.BufferAttribute
      edges.forEach((edge, i) => {
        const a = nodes[edge.a].pos
        const b = nodes[edge.b].pos
        posAttr.setXYZ(i * 2,     a.x, a.y, a.z)
        posAttr.setXYZ(i * 2 + 1, b.x, b.y, b.z)
      })
      posAttr.needsUpdate = true

      // Update particles
      particles.forEach(p => {
        p.t += p.speed * p.dir
        if (p.t > 1 || p.t < 0) {
          p.dir     = (p.dir * -1) as 1 | -1
          p.t       = p.t > 1 ? 1 : 0
          p.edgeIdx = Math.floor(Math.random() * edges.length)
        }
        const edge = edges[p.edgeIdx]
        if (!edge) return
        p.mesh.position.lerpVectors(nodes[edge.a].pos, nodes[edge.b].pos, p.t)
      })

      renderer.render(scene, camera)
    }

    animate()

    // ── Cleanup ────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)

      // Dispose geometries and materials
      nodeGeom.dispose()
      lineGeom.dispose()
      particleGeom.dispose()
      ;(lineMat as THREE.Material).dispose()
      nodes.forEach(n => (n.mesh.material as THREE.Material).dispose())

      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  )
}
