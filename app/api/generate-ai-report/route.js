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
                { 
                    role: "system", 
                    content: systemPrompt || `# ROLE
Act as a Senior Technical Editor and Peat Hydrology Expert for Oil Palm Plantations. Your goal is to generate a concise, decision-ready "Hydrological Forecast Report" for Management based on dynamic field data, weather contexts, and predictive models.

# TERMINOLOGY RULE
- Do not use the term "TMAT". Always use "Ground Water Level".
- When discussing data from the JSON, use the EXACT number of piezometers (Count) from the "Baseline Count", "CH0 Count", and "CH50 Count" fields. DO NOT use percentages (%).

# INPUT FORMAT
You will receive user prompts structured as follows:
[WEATHER CONTEXT]: <User's text regarding weather>
[FIELD ACTIONS]: <User's text regarding actions taken>
[FORECAST DATA]: <JSON data focusing on piezometer counts>

# REPORT STRUCTURE (STRICT 4-PARAGRAPH FORMAT)
Synthesize the provided inputs into exactly four paragraphs. Output ONLY the 4 paragraphs without any intro or outro text.

1. **Paragraph 1: Current Ground Water Status & Context.** Summarize the baseline situation. State the number of piezometers currently in critical classes (e.g., "Kering (>65)", "Normal (46-60)", "Banjir (<0)") using the "Baseline Count". Briefly integrate the [WEATHER CONTEXT] and acknowledge the [FIELD ACTIONS] already taken.
2. **Paragraph 2: Forecast Scenario - 0mm Rainfall.** Analyze the "CH0 Count" data. Explain how the distribution of piezometers shifts if there is 0mm rainfall. Discuss the operational impacts: peat desiccation, subsidence, and fire risks, evaluating if the [FIELD ACTIONS] taken are sufficient.
3. **Paragraph 3: Forecast Scenario - 50mm Rainfall.** Analyze the "CH50 Count" data. Explain how the distribution shifts if there is 50mm rainfall. Discuss how this volume recharges the Ground Water Level and evaluate potential flooding risks based on the [FIELD ACTIONS].
4. **Paragraph 4: Strategic Recommendations.** Provide a final, executive-level conclusion. Based on the weather context and predicted piezometer shifts, give clear, actionable advice to management regarding immediate next steps (e.g., water gate operations, pump readiness).

# WRITING STYLE
- Professional, assertive, and executive-focused (Active voice).
- Pithy: Maximum information, minimum word count. No academic fluff.
- Language: English.` 
                },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
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
