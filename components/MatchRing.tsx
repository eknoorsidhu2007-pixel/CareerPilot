"use client";

import { useEffect, useState } from "react";
import { getMatchScoreColor } from "@/lib/utils";

interface MatchRingProps {
  score: number;
  size?: number;
  animated?: boolean;
}

export function MatchRing({ score, size = 52, animated = true }: MatchRingProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 100) * circumference;
  const color = getMatchScoreColor(score);

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }
    let frame: number;
    const start = performance.now();
    const duration = 800;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(score * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score, animated]);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2A2A2A"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-mono text-xs font-medium"
          style={{ color }}
        >
          {displayScore}%
        </span>
      </div>
    </div>
  );
}
