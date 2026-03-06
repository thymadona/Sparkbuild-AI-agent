import OpenAI from 'openai'

export const SYSTEM_PROMPT = `You are a code generator for students learning to build web apps.
Always return a SINGLE complete HTML file with all CSS in a <style> tag
and all JavaScript in a <script> tag. No markdown. No explanation.
No code fences. Return raw HTML only starting with <!DOCTYPE html>.
When editing existing code, return the full updated file, not a diff.`

export const MODEL = 'google/gemini-2.5-flash-preview'

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
})
