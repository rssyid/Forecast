import { GoogleGenAI } from "@google/genai";

// Fungsi pembantu untuk memberikan jeda waktu (delay)
const delay = (ms) => new Promise(res => setTimeout(res, ms));

export default async function handler(req, res) {
    // Hanya menerima metode POST
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

        // SISTEM AUTOMATIC RETRY (Maksimal 3x percobaan)
        const MAX_RETRIES = 3;
        let attempt = 0;

        while (attempt < MAX_RETRIES) {
            try {
                // Mencoba memanggil Google Gemini
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });

                // Jika berhasil, kembalikan hasil ke web
                return res.status(200).json({ text: response.text });

            } catch (apiError) {
                attempt++;

                // Mendeteksi apakah errornya adalah 503 (Server Sibuk) atau 429 (Terlalu banyak request)
                const errorMessage = String(apiError.message || apiError);
                const isBusy = errorMessage.includes("503") || errorMessage.includes("429") || errorMessage.includes("high demand");

                if (isBusy && attempt < MAX_RETRIES) {
                    console.log(`Server AI sibuk. Percobaan ulang (${attempt}/${MAX_RETRIES}) dalam 3 detik...`);
                    // Beri jeda 3 detik sebelum mencoba lagi agar server Google "bernapas"
                    await delay(3000);
                } else {
                    // Jika error lain (misal API Key salah), atau sudah coba 3x tapi tetap gagal, lempar error ke frontend
                    throw apiError;
                }
            }
        }

    } catch (error) {
        console.error("AI Generation Error:", error);
        // Membersihkan pesan error agar lebih rapi saat ditampilkan di web
        let cleanMessage = error.message;
        if (cleanMessage.includes("503") || cleanMessage.includes("high demand")) {
            cleanMessage = "Server Google AI sedang sangat sibuk (Overloaded). Kami telah mencoba 3x namun gagal. Silakan tunggu 1-2 menit dan coba klik Generate lagi.";
        }

        return res.status(500).json({ error: cleanMessage });
    }
}