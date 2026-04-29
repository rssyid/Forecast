import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const { baselineWeek, scenarioResults, baselineCounts, baselinePct, userContext, wmActions } = await req.json();

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `
            Anda adalah pakar Water Management di perkebunan kelapa sawit. 
            Tugas Anda adalah membuat laporan analisis TMAT (Tinggi Muka Air Tanah) berdasarkan data berikut:

            DATA BASELINE (Minggu: ${baselineWeek}):
            - Distribusi Kondisi: 
              Banjir: ${baselineCounts['Banjir ( <0 )']} (${baselinePct['Banjir ( <0 )']}%)
              Tergenang: ${baselineCounts['Tergenang ( 0-40 )']} (${baselinePct['Tergenang ( 0-40 )']}%)
              A Tergenang: ${baselineCounts['A Tergenang ( 41-45 )']} (${baselinePct['A Tergenang ( 41-45 )']}%)
              Normal: ${baselineCounts['Normal ( 46-60 )']} (${baselinePct['Normal ( 46-60 )']}%)
              A Kering: ${baselineCounts['A Kering ( 61-65 )']} (${baselinePct['A Kering ( 61-65 )']}%)
              Kering: ${baselineCounts['Kering ( >65 )']} (${baselinePct['Kering ( >65 )']}%)

            HASIL PREDIKSI (FORECAST):
            ${scenarioResults.map(r => `
            Skenario Curah Hujan ${r.scenarioMm} mm:
            - Banjir: ${r.counts['Banjir ( <0 )']} (${r.pct['Banjir ( <0 )']}%)
            - Normal: ${r.counts['Normal ( 46-60 )']} (${r.pct['Normal ( 46-60 )']}%)
            - Kering: ${r.counts['Kering ( >65 )']} (${r.pct['Kering ( >65 )']}%)
            `).join('\n')}

            KONTEKS TAMBAHAN:
            - Cuaca/Lingkungan: ${userContext || 'Tidak ada catatan tambahan'}
            - Aksi Water Management: ${wmActions || 'Tidak ada catatan tambahan'}

            INSTRUKSI:
            1. Berikan ringkasan eksekutif tentang kondisi saat ini.
            2. Berikan analisis risiko berdasarkan hasil prediksi (terutama risiko kekeringan atau banjir).
            3. Berikan rekomendasi teknis Water Management (pintu air, pompa, dll) untuk menghadapi skenario curah hujan tersebut.
            4. Gunakan gaya bahasa profesional, lugas, dan teknis.
            5. Format dalam Markdown.
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                { role: "system", content: "Anda adalah asisten AI ahli agronomi dan water management sawit." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
        });

        return NextResponse.json({ report: response.choices[0].message.content });
    } catch (error) {
        console.error('AI Report Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
