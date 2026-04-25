import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { key } = await request.json();
        const adminKey = process.env.ADMIN_KEY;

        if (!adminKey) {
            // Bypass authentication if no admin key is configured (useful for local development)
            return NextResponse.json({ success: true, bypassed: true });
        }

        if (key === adminKey) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Otentikasi gagal: Admin Key salah.' }, { status: 401 });
        }
    } catch (err) {
        return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
    }
}
