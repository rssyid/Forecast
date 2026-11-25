import pg from 'pg';
import { runRecentSync } from '../../../lib/syncRecentData.js';

const { Pool } = pg;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
    return handleRequest(request);
}

export async function POST(request) {
    return handleRequest(request);
}

async function handleRequest(request) {
    const { searchParams } = new URL(request.url);
    const isStream = searchParams.get('stream') === 'true';

    // Auth check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const adminKey = process.env.ADMIN_KEY || 'admin123';
    const providedKey = request.headers.get('x-admin-key') || searchParams.get('key');

    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAdmin = providedKey === adminKey;

    if (!isCron && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    if (isStream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (msg) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ msg })}\n\n`));
                };
                try {
                    send('🚀 Memulai Update Data...');
                    const result = await runRecentSync(send, pool);
                    send(`🎉 SELESAI! Pzo: ${result.pTotal} | Rain: ${result.rTotal}`);
                    send('DONE');
                } catch (err) {
                    send(`❌ ERROR: ${err.message}`);
                } finally {
                    await pool.end();
                    controller.close();
                }
            }
        });
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    } else {
        try {
            const result = await runRecentSync(() => {}, pool);
            return new Response(JSON.stringify({ success: true, ...result }), { status: 200 });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        } finally {
            await pool.end();
        }
    }
}
