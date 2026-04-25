import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { key } = await request.json();
        const adminKey = process.env.ADMIN_KEY || 'admin123';

        if (key === adminKey) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Otentikasi gagal: Admin Key salah.' }, { status: 401 });
        }
    } catch (err) {
        return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
    }
}
