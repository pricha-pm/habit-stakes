// Note embeddings via OpenAI text-embedding-3-small (1536 dims — must match
// the vector(1536) column). The model is recorded on every row, so switching
// providers later is a batch re-embed, not data loss.

export const EMBEDDING_MODEL = "text-embedding-3-small";

export async function embed(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn("OPENAI_API_KEY not set — note saved without embedding");
    return null;
  }
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) {
    console.error(`Embedding request failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data.data[0].embedding as number[];
}
