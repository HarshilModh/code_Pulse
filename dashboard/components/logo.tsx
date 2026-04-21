export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="100" height="100" rx="20" fill="#09090b" stroke="#27272a" strokeWidth="2" />
      
      {/* Code bracket left */}
      <path 
        d="M 32 38 L 20 50 L 32 62" 
        stroke="#71717a" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Pulse line */}
      <path 
        d="M 28 50 L 44 50 L 52 30 L 64 70 L 72 50 L 80 50" 
        stroke="#3b82f6" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}
