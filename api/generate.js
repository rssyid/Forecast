import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
    // Hanya menerima metode POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Mengambil API Key dari Environment Variable Vercel
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "Server tidak memiliki API Key GEMINI_API_KEY." });
        }

        // 2. Inisialisasi Google Gen AI
        const ai = new GoogleGenAI({ apiKey: apiKey });

        // 3. Mengambil prompt dari front-end web
        const { prompt } = req.body;

        // 4. Memanggil Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        // 5. Mengembalikan hasil teks ke web
        return res.status(200).json({ text: response.text });

    } catch (error) {
        console.error("AI Generation Error:", error);
        return res.status(500).json({ error: error.message });
    }
}