import { GoogleGenAI } from "@google/genai";

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server tidak memiliki API Key GEMINI_API_KEY." });
        }

        const ai = new GoogleGenAI({ apiKey: apiKey });
        const { prompt } = req.body;

        const MAX_RETRIES = 3;
        let attempt = 0;

        while (attempt < MAX_RETRIES) {
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });

                return res.status(200).json({ text: response.text });

            } catch (apiError) {
                attempt++;
                const errorMessage = String(apiError.message || apiError);

                // Cek apakah error karena kuota (429) atau server sibuk (503)
                const isRateLimited = errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota");
                const isBusy = errorMessage.includes("503") || errorMessage.includes("high demand");

                if ((isBusy || isRateLimited) && attempt < MAX_RETRIES) {
                    console.log(`Server sibuk/kuota penuh. Percobaan ulang (${attempt}/${MAX_RETRIES}) dalam 5 detik...`);
                    // Beri jeda agak lama (5 detik) agar kuota per menit bisa bernapas
                    await delay(5000);
                } else {
                    throw apiError;
                }
            }
        }

    } catch (error) {
        console.error("AI Generation Error:", error);

        // Menerjemahkan error mentah menjadi pesan UI yang ramah pengguna
        const errorStr = String(error.message || error);
        let cleanMessage = "Terjadi kesalahan pada server AI.";

        if (errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("RESOURCE_EXHAUSTED")) {
            cleanMessage = "⚠️ Kuota API gratis Anda habis atau terlalu banyak permintaan dalam 1 menit. Silakan tunggu sekitar 1 menit, lalu coba lagi.";
        } else if (errorStr.includes("503") || errorStr.includes("high demand")) {
            cleanMessage = "⚠️ Server Google AI sedang sibuk. Silakan tunggu beberapa saat dan coba lagi.";
        } else {
            // Menangkap sisa error lainnya
            cleanMessage = `Gagal memproses: ${errorStr}`;
        }

        return res.status(500).json({ error: cleanMessage });
    }
}