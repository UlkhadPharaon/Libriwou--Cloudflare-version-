import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.NVIDIA_API_KEY
});

async function test() {
    try {
        const response = await openai.models.list();
        const models = response.data.map(m => m.id);
        console.log("MODELS_LIST_START");
        console.log(JSON.stringify(models, null, 2));
        console.log("MODELS_LIST_END");
    } catch(e) {
        console.error("Error listing models:", e);
    }
}
test();
