import SignInPage from '../../sign-in/[[...sign-in]]/page'

export default function SignUpPage() {
  // We use the exact same custom OAuth UI for sign-ups as we do for sign-ins,
  // because Clerk's OAuth flow automatically creates accounts for new users.
  return <SignInPage />
}
