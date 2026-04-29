import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const { prompt, systemPrompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: 'https://ai.dinoiki.com/v1',
        });

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt || "Anda adalah asisten AI ahli agronomi dan water management sawit." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
        });

        // The legacy code expected data.text, while OpenAI SDK returns choices[0].message.content
        return NextResponse.json({ 
            text: response.choices[0].message.content,
            report: response.choices[0].message.content 
        });
    } catch (error) {
        console.error('AI API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
