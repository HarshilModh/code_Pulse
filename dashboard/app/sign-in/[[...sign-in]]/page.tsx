import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full bg-[var(--canvas)] flex items-center justify-center">
      <SignIn afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard" />
    </div>
  )
}
