export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth="1" />
      <path
        d="M4 16 H8 L11 9 L15 23 L18 13 L21 18 H28"
        stroke="#059669" 
        strokeWidth="2.5"
        fill="none" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}
