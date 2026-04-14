import OpenAI from 'openai';

export default async function handler(req, res) {
    // Hanya menerima metode POST
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        // Membaca kunci rahasia OpenAI dari Vercel
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server tidak memiliki API Key OPENAI_API_KEY." });
        }

        // Inisialisasi ChatGPT
        const openai = new OpenAI({ apiKey: apiKey });
        const { prompt } = req.body;

        // Memanggil model ChatGPT (gpt-4o-mini direkomendasikan karena murah & pintar)
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
        });

        // Mengembalikan jawaban ke web Anda
        return res.status(200).json({ text: response.choices[0].message.content });

    } catch (error) {
        console.error("OpenAI Error:", error);

        // Menangkap pesan error dari OpenAI jika saldo habis, dll
        const errorMessage = error.message || "Terjadi kesalahan pada server OpenAI.";

        // Jika saldo habis
        if (errorMessage.includes("insufficient_quota") || errorMessage.includes("balance")) {
            return res.status(402).json({ error: "Saldo OpenAI Anda habis. Silakan top-up saldo di dashboard OpenAI." });
        }

        return res.status(500).json({ error: errorMessage });
    }
}