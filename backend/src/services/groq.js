import Groq from 'groq-sdk';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const isTransient = (err) => err?.status === 429 || err?.status >= 500;

const withRetry = async (fn, { retries = 3, baseDelayMs = 300 } = {}) => {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isTransient(err)) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      attempt += 1;
    }
  }
};

// audioUrl is a presigned GET URL — fetch() streams it straight into the SDK, no manual buffering.
export const transcribeAudio = async (audioUrl) =>
  withRetry(async () => {
    const response = await fetch(audioUrl);
    const result = await client.audio.transcriptions.create({
      model: process.env.GROQ_STT_MODEL,
      file: response,
    });
    return result.text;
  });

export const translateText = async (text, targetLanguage) =>
  withRetry(async () => {
    const result = await client.chat.completions.create({
      model: process.env.GROQ_TRANSLATE_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a translation engine. Translate the user's message into ${targetLanguage}. Output only the translated text — no explanations, no quotes, no commentary.`,
        },
        { role: 'user', content: text },
      ],
    });
    return result.choices[0].message.content.trim();
  });
