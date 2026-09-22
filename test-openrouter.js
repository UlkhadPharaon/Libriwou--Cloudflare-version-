import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        ...(process.env.APP_URL ? { "HTTP-Referer": process.env.APP_URL } : {}),
        "X-Title": "Libriwouo NEO Assistant",
    },
});

const MODEL = process.env.OPENROUTER_CHAT_MODEL || "inclusionai/ling-3.0-flash-vl:free";

async function test() {
    try {
        console.log(`Testing OpenRouter model: ${MODEL}`);
        const response = await openai.chat.completions.create({
            model: MODEL,
            messages: [{ role: "user", content: "Salut, réponds en français en une phrase." }],
            temperature: 0.3,
            max_tokens: 1500,
        });
        console.log("CHAT_OK");
        console.log(response.choices[0]?.message?.content || response.choices[0]?.message?.reasoning);
    } catch (e) {
        console.error("Error testing OpenRouter:", e?.message || e);
    }
}
test();
