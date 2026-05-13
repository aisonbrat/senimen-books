import AdminLayoutClient from './AdminLayoutClient'

/** Avoid static prerender of /admin/* (client layouts were calling `createClient()` during SSG). */
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
