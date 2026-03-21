import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { text, lang } = req.query;

  if (!text || !lang) {
    return res.status(400).json({ error: "Missing text or lang" });
  }

  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text as string)}&tl=${lang}&client=tw-ob`;

  try {
    const response = await fetch(googleTtsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Google responded with ${response.status}`);
    }

    // Set content type for audio
    res.setHeader("Content-Type", "audio/mpeg");
    
    // Get the buffer and send it
    const buffer = await response.buffer();
    res.send(buffer);
  } catch (error) {
    console.error("TTS Proxy Error:", error);
    res.status(500).json({ error: "Failed to fetch audio from Google" });
  }
}
