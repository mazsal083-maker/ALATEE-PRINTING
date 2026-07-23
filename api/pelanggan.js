// api/pelanggan.js — Alatee Printing Customer Service AI (Gemini Primary)
// Handler utama: Gemini Flash + TTS gratis via Web Speech API (server-side signal)

export const config = { runtime: 'edge' };

const GEMINI_API_KEY = process.env.TAHU;
const WA_NUMBER = '6287765146075';

const SYSTEM_PROMPT = `Kamu adalah Ayla, CS di Alatee Printing. Kamu manusia biasa, perempuan, bukan AI.

CARA BICARA & KEPRIBADIAN:
- Natural banget kayak chat WA beneran, bukan customer service robot
- Singkat dan to the point. Kalau pertanyaannya pendek, jawab pendek juga
- Sesekali pakai emoji tapi jangan lebay
- Panggil "kak" tapi jangan di setiap kalimat, cukup sekali per respons
- JANGAN mulai respons dengan "Halo kak!" terus menerus — variasikan: "Siap kak", "Oh itu bisa kak", "Boleh kak", "Oke kak", dll
- Boleh sesekali sedikit gombal: "Desainnya pasti kece kak kalau di cetak sini 😊"
- Boleh sedikit ketus kalau user udah tanya banyak banget tapi kayaknya gak jadi beli — sindir HALUS: "Wah banyak banget pertanyaannya, semoga nanti jadinya order ya kak hehe 😄" atau "Kalau udah mantap kak, langsung aja chat WA kita, gak akan nyesel 😉"
- Kalau user singkat, kamu juga singkat. Kalau user detail, kamu detail.
- Sesekali boleh bercanda ringan biar akrab
- JANGAN bertele-tele. Maksimal 2-3 kalimat kecuali user minta penjelasan panjang

LAYANAN ALATEE PRINTING:
- Banner & Spanduk (indoor/outdoor, berbagai ukuran)
- Kartu Nama (glossy, matte, premium)
- Brosur & Flyer (A4, A5, lipat 3)
- Stiker & Label (vinyl, kertas, transparant)
- Roll Up Banner (85x200cm, 100x200cm)
- Cetak Buku (saddle stitch, perfect binding)
- Undangan & Souvenir
- Nota & Kwitansi
- Spanduk MMT, Flexi Korea

HARGA ESTIMASI:
- Banner MMT: mulai Rp 15.000/m²
- Kartu Nama 1 box (100 lembar): mulai Rp 25.000
- Flyer A5 100 lembar: mulai Rp 45.000
- Roll Up Banner: mulai Rp 150.000
- Stiker vinyl per m²: mulai Rp 50.000

PROSES PEMESANAN:
1. Konsultasi desain/ukuran
2. Kirim file desain (CDR, AI, PDF, PNG resolusi tinggi)
3. Konfirmasi harga & bayar DP
4. Proses cetak 1-3 hari kerja
5. Ambil/kirim ke lokasi

KONTAK:
- WhatsApp: ${WA_NUMBER}
- Lokasi: Pamekasan, Madura, Jawa Timur

ATURAN:
- Hanya topik Alatee Printing & cetak. Kalau nanya di luar, alihkan santai
- JANGAN ngaku AI/robot/program
- Kalau ditanya harga, kasih estimasi tapi sarankan konfirmasi via WA untuk pasti
- Kalau ada foto/file dikirim, komentari dari sisi cetaknya
- Untuk panggilan suara: jawaban HARUS lebih pendek, seperti ngobrol langsung, maks 1-2 kalimat`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders()
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json();
    const { messages, stream = true, imageBase64, imageMimeType, tts = false } = body;

    if (!messages || !Array.isArray(messages)) {
      return jsonResponse({ error: 'Messages required' }, 400);
    }

    // Build Gemini contents
    const contents = buildGeminiContents(messages, imageBase64, imageMimeType);

    // Call Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${GEMINI_API_KEY}`;

    const geminiBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 512,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
      signal: AbortSignal.timeout(25000)
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', errText);
      return jsonResponse({ error: 'GEMINI_FAILED', details: errText }, 502);
    }

    if (stream) {
      // Forward streaming response
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const reader = geminiRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullText = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              // alt=sse format: each line is "data: {...}" 
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const jsonStr = trimmed.slice(6).trim();
                if (!jsonStr) continue;

                try {
                  const chunk = JSON.parse(jsonStr);
                  const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  if (text) {
                    fullText += text;
                    const sseData = JSON.stringify({ text, done: false });
                    controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                  }
                } catch {
                  // Skip malformed chunks
                }
              }
            }

            // Send done signal
            const doneData = JSON.stringify({ text: '', done: true, fullText, ttsEnabled: tts });
            controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          } catch (err) {
            const errData = JSON.stringify({ error: err.message, done: true });
            controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
          } finally {
            controller.close();
          }
        }
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders(),
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no'
        }
      });
    } else {
      // Non-streaming response
      const data = await geminiRes.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return jsonResponse({ text, success: true });
    }

  } catch (err) {
    console.error('Handler error:', err);
    if (err.name === 'TimeoutError') {
      return jsonResponse({ error: 'GEMINI_TIMEOUT' }, 504);
    }
    return jsonResponse({ error: 'INTERNAL_ERROR', message: err.message }, 500);
  }
}

// ===== TTS Endpoint (GET /api/pelanggan?tts=1&text=...) =====
// Web Speech API dihandle di frontend (gratis, native browser)
// Backend cukup return signal untuk frontend

function buildGeminiContents(messages, imageBase64, imageMimeType) {
  const contents = messages.map(msg => {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    
    if (msg.role === 'user' && imageBase64 && messages.indexOf(msg) === messages.length - 1) {
      // Last user message with image
      return {
        role,
        parts: [
          { text: msg.content },
          {
            inline_data: {
              mime_type: imageMimeType || 'image/jpeg',
              data: imageBase64
            }
          }
        ]
      };
    }

    return {
      role,
      parts: [{ text: msg.content || ' ' }]
    };
  });

  return contents;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json'
    }
  });
}
