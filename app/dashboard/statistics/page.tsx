import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { dashboardAccess } from '@/lib/dashboard-access'
import ProfileStatisticsClient from '@/components/ProfileStatisticsClient'

export const metadata = {
  title: 'Profile statistics | Dashboard',
  robots: { index: false, follow: false },
}

export default async function StatisticsPage() {
  const session = await getServerSession(authOptions)
  if (!(await dashboardAccess(session))) redirect('/auth/signin')
  return <ProfileStatisticsClient />
}
