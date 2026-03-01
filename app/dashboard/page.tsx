import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardContent from './DashboardContent'

export default async function DashboardPage() {
    const supabase = createClient()

    // 1. Fetch user securely
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // 2. Fetch profile role
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    // 3. Email-based Access Control (Authorized Staff Only)
    const STAFF_EMAILS = [
        'yeswantsai9@gmail.com',
        // Add more staff emails here
    ];

    if (!user.email || !STAFF_EMAILS.includes(user.email)) {
        redirect('/unauthorized')
    }

    if (error || !profile) {
        redirect('/unauthorized')
    }

    // 4. Verify RBAC check
    const allowedRoles = ['manager', 'waiter', 'admin']
    if (!allowedRoles.includes(profile.role)) {
        redirect('/unauthorized')
    }

    // 4. Render the client-side dashboard with data
    return <DashboardContent user={user} role={profile.role} />
}
