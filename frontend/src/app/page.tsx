'use client';

import { useEffect } from 'react';

export default function Root() {
  useEffect(() => {
    // Immediate hard redirect to bypass any Next.js routing issues
    window.location.replace('/login');
  }, []);

  return (
    <main style={{ 
      width: '100vw', height: '100vh', background: '#1d1d1d', 
      display: 'flex', alignItems: 'center', justifyContent: 'center' 
    }}>
      <div style={{ color: '#c8ff1d', fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '2px' }}>
        LOADING MOTOHUB...
      </div>
    </main>
  );
}
