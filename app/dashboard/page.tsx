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

    // 2. Check staff_roles table (DB-driven, no hardcoded emails)
    const { data: staffRole, error: staffError } = await supabase
        .from('staff_roles')
        .select('role, is_active')
        .eq('user_id', user.id)
        .single()

    // 3. Fallback: Also check profiles table for backward compat
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    // Determine role: prefer staff_roles, fallback to profiles
    let role = 'unauthorized';

    if (staffRole && !staffError && staffRole.is_active) {
        role = staffRole.role;
    } else if (profile && !profileError) {
        // Legacy fallback: check hardcoded emails ONLY if staff_roles table doesn't exist yet
        const LEGACY_STAFF_EMAILS = [
            'yeswantsai9@gmail.com',
            'reliefreplyof21@gmail.com',
        ];

        if (user.email && LEGACY_STAFF_EMAILS.includes(user.email)) {
            role = profile.role;
        }
    }

    // 4. Verify authorized role
    const allowedRoles = ['manager', 'waiter', 'admin', 'kitchen']
    if (!allowedRoles.includes(role)) {
        redirect('/unauthorized')
    }

    // 5. Render the client-side dashboard with data
    return <DashboardContent user={user} role={role} />
}
