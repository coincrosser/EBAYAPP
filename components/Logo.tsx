
import React from 'react';

export const Logo = ({ className = "h-12 w-12" }: { className?: string }) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="mindBendingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#d946ef" /> {/* Fuchsia */}
        <stop offset="50%" stopColor="#8b5cf6" /> {/* Violet */}
        <stop offset="100%" stopColor="#06b6d4" /> {/* Cyan */}
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    <g filter="url(#glow)">
      {/* Outer Hexagon - Rotating */}
      <path
        d="M50 5 L93.3 30 V80 L50 105 L6.7 80 V30 Z"
        stroke="url(#mindBendingGradient)"
        strokeWidth="4"
        className="origin-center animate-[spin_10s_linear_infinite]"
        strokeLinecap="round"
      />
      
      {/* Inner Speed Lines */}
      <path
        d="M30 40 L70 40 M20 50 L80 50 M30 60 L70 60"
        stroke="url(#mindBendingGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-80"
      />
      
      {/* The 'R' Initial integrated */}
      <path 
        d="M40 25 V75 M40 25 H60 C75 25 75 50 60 50 H40 M60 50 L75 75"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);
