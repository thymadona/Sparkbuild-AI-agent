import OpenAI from 'openai'

// Pinned for cost control — do not change providers or models without approval.
export const MODEL = 'deepseek-flash'

export const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY!,
})
