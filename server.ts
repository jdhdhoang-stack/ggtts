import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fetch from "node-fetch";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy cho Google TTS
  app.get("/api/tts", async (req, res) => {
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

      // Chuyển tiếp audio stream về client
      res.setHeader("Content-Type", "audio/mpeg");
      response.body.pipe(res);
    } catch (error) {
      console.error("TTS Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch audio from Google" });
    }
  });

  // Vite middleware cho development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
