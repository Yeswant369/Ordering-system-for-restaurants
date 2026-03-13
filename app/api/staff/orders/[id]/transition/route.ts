import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

type Action = 'accept' | 'reject' | 'preparing' | 'ready' | 'bill' | 'confirm_payment';

const ALLOWED_ROLES = new Set(['manager', 'waiter', 'admin', 'kitchen']);

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const authClient = createSupabaseServerClient();

    const {
        data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as {
        action?: Action;
        reason?: string;
        totalAmount?: number;
        paymentMode?: 'cash' | 'upi';
    } | null;

    if (!body?.action) {
        return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const db = (serviceRoleKey && supabaseUrl)
        ? createSupabaseClient(supabaseUrl, serviceRoleKey)
        : createSupabaseClient(supabaseUrl!, anonKey!);

    const { data: staffRole } = await db
        .from('staff_roles')
        .select('role, is_active')
        .eq('user_id', user.id)
        .maybeSingle();

    let role = staffRole?.is_active ? staffRole.role : null;

    if (!role) {
        const { data: profile } = await db
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        if (profile?.role && ALLOWED_ROLES.has(profile.role)) {
            role = profile.role;
            await db
                .from('staff_roles')
                .upsert({ user_id: user.id, email: user.email, role, is_active: true }, { onConflict: 'user_id' });
        }
    }

    if (!role || !ALLOWED_ROLES.has(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orderId = params.id;
    const now = new Date().toISOString();

    if (body.action === 'accept') {
        const { error } = await db.from('orders').update({ status: 'accepted', accepted_at: now, accepted_by: user.id }).eq('id', orderId).eq('status', 'pending');
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.action === 'reject') {
        const { error } = await db.from('orders').update({ status: 'rejected', rejected_at: now, rejection_reason: body.reason || 'Rejected by staff' }).eq('id', orderId).eq('status', 'pending');
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.action === 'preparing') {
        const { error } = await db.from('orders').update({ status: 'preparing' }).eq('id', orderId).eq('status', 'accepted');
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.action === 'ready') {
        const { error } = await db.from('orders').update({ status: 'ready', ready_at: now }).eq('id', orderId).eq('status', 'preparing');
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.action === 'bill') {
        if (typeof body.totalAmount !== 'number') {
            return NextResponse.json({ error: 'totalAmount is required' }, { status: 400 });
        }
        const { error } = await db.from('orders').update({ status: 'billed', total_amount: body.totalAmount, billed_at: now }).eq('id', orderId).eq('status', 'ready');
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.action === 'confirm_payment') {
        if (!body.paymentMode) {
            return NextResponse.json({ error: 'paymentMode is required' }, { status: 400 });
        }
        const { error } = await db.from('orders').update({ status: 'paid', payment_mode: body.paymentMode, paid_at: now, paid_verified_by: user.id }).eq('id', orderId).in('status', ['payment_submitted', 'cash_pending', 'billed']);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
}
