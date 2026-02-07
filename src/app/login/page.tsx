import { type Metadata } from 'next'
import AnimatedBackground from '@/components/ui/animated-background'
import LoginContainer from '@/components/auth/LoginContainer'

export const metadata: Metadata = {
  title: 'Login - Canopy',
  description: 'Sign in to your Canopy account',
}

export default function LoginPage() {
  return (
    <>
      <AnimatedBackground />
      <LoginContainer />
    </>
  )
}
