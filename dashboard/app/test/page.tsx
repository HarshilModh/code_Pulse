'use client'
import { useSignIn } from '@clerk/nextjs'
import { useEffect } from 'react'

export default function TestPage() {
  const signInHook = useSignIn()
  
  useEffect(() => {
    console.log("useSignIn return:", signInHook)
  }, [signInHook])

  return <div>Check console</div>
}
