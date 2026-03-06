import { GoogleGenerativeAI } from '@google/generative-ai'

export const SYSTEM_PROMPT = `You are a code generator for students learning to build web apps.
Always return a SINGLE complete HTML file with all CSS in a <style> tag
and all JavaScript in a <script> tag. No markdown. No explanation.
No code fences. Return raw HTML only starting with <!DOCTYPE html>.
When editing existing code, return the full updated file, not a diff.`

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
