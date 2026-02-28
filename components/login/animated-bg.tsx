"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

export function AnimatedBackground({ reducedMotion }: { reducedMotion: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (reducedMotion || !mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(2.5, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x6d5efc, wireframe: true });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    camera.position.z = 7;

    gsap.to(mesh.rotation, { y: Math.PI * 2, x: Math.PI, duration: 16, repeat: -1, ease: "none" });

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (mountRef.current?.contains(renderer.domElement)) mountRef.current.removeChild(renderer.domElement);
    };
  }, [reducedMotion]);

  return <div ref={mountRef} className="absolute inset-0 opacity-60" aria-hidden />;
}
