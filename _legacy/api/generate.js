export default async function handler(req, res) {
    // Hanya menerima metode POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Membaca kunci rahasia dari Environment Variables Vercel
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server tidak memiliki API Key OPENAI_API_KEY." });
        }

        const { prompt } = req.body;

        // Memanggil API khusus dari server kantor Anda
        const response = await fetch('https://ai.dinoiki.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-5.4', // Sesuai dengan spesifikasi kantor Anda
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7
            })
        });

        const data = await response.json();

        // Menangkap error jika server kantor menolak request (misal API key salah atau limit)
        if (!response.ok) {
            const serverError = data.error?.message || data.message || `HTTP Error: ${response.status}`;
            throw new Error(`Server Kantor: ${serverError}`);
        }

        // Mengembalikan hasil teks ke frontend (web) Anda
        return res.status(200).json({ text: data.choices[0].message.content });

    } catch (error) {
        console.error("Custom API Error:", error);

        const errorMessage = error.message || "Terjadi kesalahan saat menghubungi server AI kantor.";
        return res.status(500).json({ error: errorMessage });
    }
}