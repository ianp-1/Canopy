import { Suspense } from 'react'
import { getUserWallet } from '@/app/actions/auth'
import AccountSettingsClient from './account-settings-client'

export default async function AccountSettingsPage() {
  const walletAddress = await getUserWallet()
  
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading settings...</div>}>
      <AccountSettingsClient initialWalletAddress={walletAddress} />
    </Suspense>
  )
}
