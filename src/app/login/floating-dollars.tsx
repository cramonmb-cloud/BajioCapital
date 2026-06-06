'use client';

import { useEffect, useRef, useState } from 'react';

interface Dollar {
  id: number;
  left: number;
  size: number;
  opacity: number;
  blur: number;
  duration: number;
  delay: number;
  rotate: number;
  colorType: 'gold' | 'silver';
}

export function FloatingDollars() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dollars, setDollars] = useState<Dollar[]>([]);

  useEffect(() => {
    // Generate 55 random dollar particles
    const generated: Dollar[] = Array.from({ length: 55 }).map((_, i) => {
      const size = Math.floor(Math.random() * 50) + 14; // 14px to 64px
      // Calculate blur to simulate depth of field (smaller are farther and blurrier)
      const blur = Math.max(0, (64 - size) / 10);
      
      // Determine color type: 60% silver, 40% gold
      const colorType = Math.random() > 0.6 ? 'gold' : 'silver';
      
      // Increased opacity for visibility (0.08 to 0.22)
      const opacity = Math.random() * 0.14 + 0.08;

      return {
        id: i,
        left: Math.random() * 100, // percentage
        size,
        opacity,
        blur,
        duration: Math.floor(Math.random() * 25) + 15, // 15s to 40s
        delay: Math.floor(Math.random() * 20) * -1, // negative delay so they are spread out
        rotate: Math.floor(Math.random() * 60) - 30, // -30deg to 30deg
        colorType,
      };
    });
    setDollars(generated);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || dollars.length === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      const particles = container.getElementsByClassName('dollar-particle-inner');
      const cursorX = e.clientX;
      const cursorY = e.clientY;

      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i] as HTMLSpanElement;
        const rect = particle.getBoundingClientRect();
        
        // Geometric center of the particle on screen
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const diffX = centerX - cursorX;
        const diffY = centerY - cursorY;
        const distance = Math.sqrt(diffX * diffX + diffY * diffY);

        const maxDistance = 130; // repulsion radius in pixels
        if (distance < maxDistance && distance > 0) {
          // Stronger force when the cursor is closer
          const force = (maxDistance - distance) * 0.55; 
          const pushX = (diffX / distance) * force;
          const pushY = (diffY / distance) * force;

          // Apply translation while preserving rotation
          particle.style.transform = `translate(${pushX}px, ${pushY}px) rotate(var(--rot, 0deg))`;
        } else {
          // Return to original state (CSS transition handles smoothness)
          particle.style.transform = `translate(0px, 0px) rotate(var(--rot, 0deg))`;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dollars]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none z-0 select-none">
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-125vh);
          }
        }
        .animate-float {
          animation-name: floatUp;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
      {dollars.map((d) => (
        <div
          key={d.id}
          className="absolute animate-float"
          style={{
            left: `${d.left}%`,
            top: '105%',
            animationDuration: `${d.duration}s`,
            animationDelay: `${d.delay}s`,
          }}
        >
          <span
            className={`dollar-particle-inner block font-sans font-extrabold leading-none transition-transform duration-500 ease-out ${
              d.colorType === 'gold' 
                ? 'text-amber-500/80 drop-shadow-[0_2px_8px_rgba(245,158,11,0.2)]' 
                : 'text-slate-400/80 drop-shadow-[0_2px_8px_rgba(148,163,184,0.1)]'
            }`}
            style={{
              fontSize: `${d.size}px`,
              opacity: d.opacity,
              filter: `blur(${d.blur}px)`,
              // @ts-ignore
              '--rot': `${d.rotate}deg`,
              transform: `rotate(${d.rotate}deg)`,
            }}
          >
            $
          </span>
        </div>
      ))}
    </div>
  );
}
