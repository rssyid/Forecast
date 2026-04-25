import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { key } = await request.json();
        const adminKey = process.env.ADMIN_KEY;

        if (!adminKey) {
            // If no admin key is configured in the environment, we might want to either allow all or deny all.
            // Denying is safer, but for development sometimes it's allowed. We'll deny.
            return NextResponse.json({ error: 'Konfigurasi server tidak lengkap (ADMIN_KEY hilang).' }, { status: 500 });
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
