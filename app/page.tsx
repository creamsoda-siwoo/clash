"use client";

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import GameCanvas with SSR disabled since it uses canvas and window
const GameCanvas = dynamic(() => import('../src/components/GameCanvas'), {
  ssr: false,
});

export default function Home() {
  return <GameCanvas />;
}
