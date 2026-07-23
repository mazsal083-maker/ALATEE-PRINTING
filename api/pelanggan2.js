// api/pelanggan2.js — Alatee Printing Customer Service AI (Groq Fallback)
// Fallback handler: Groq (llama-3.3-70b-versatile) jika Gemini tidak merespons

export const config = { runtime: 'edge' };

const GROQ_API_KEY = process.env.BULAT;
const WA_NUMBER = '6287765146075';

const SYSTEM_PROMPT = `Kamu adalah Ayla, CS di Alatee Printing. Kamu manusia biasa, perempuan, bukan AI.

CARA BICARA & KEPRIBADIAN:
- Natural banget kayak chat WA beneran, bukan customer service robot
- Singkat dan to the point. Kalau pertanyaannya pendek, jawab pendek juga
- Sesekali pakai emoji tapi jangan lebay
- Panggil "kak" tapi jangan di setiap kalimat, cukup sekali per respons
- JANGAN mulai respons dengan "Halo kak!" terus menerus — variasikan: "Siap kak", "Oh itu bisa kak", "Boleh kak", "Oke kak", dll
- Boleh sesekali sedikit gombal: "Desainnya pasti kece kak kalau di cetak sini 😊"
- Boleh sedikit ketus kalau user udah tanya banyak banget tapi kayaknya gak jadi beli — sindir HALUS: "Wah banyak banget pertanyaannya, semoga nanti jadinya order ya kak hehe 😄"
- Kalau user singkat, kamu juga singkat. Kalau user detail, kamu detail.
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
- Kalau ditanya harga, kasih estimasi tapi sarankan konfirmasi via WA untuk pasti`;

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
    const { messages, stream = true } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'Messages required' }, 400);
    }

    // Build messages for Groq (OpenAI-compatible format)
    const groqMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: String(msg.content || ' ')
      }))
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: 512,
        stream: stream,
        top_p: 0.9
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq error:', errText);
      return jsonResponse({
        error: 'GROQ_FAILED',
        fallback: true,
        waNumber: WA_NUMBER,
        message: `Maaf kak, sistem kami sedang sibuk. Untuk bantuan lebih lanjut, silakan chat langsung ke WhatsApp kami ya! 😊`,
      }, 502);
    }

    if (stream) {
      // Forward Groq SSE stream
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const reader = groqRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullText = '';
          let doneSent = false;

          function sendSSE(obj) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed === 'data: [DONE]') {
                  if (!doneSent) {
                    doneSent = true;
                    sendSSE({ text: '', done: true, fullText });
                  }
                  continue;
                }

                if (trimmed.startsWith('data: ')) {
                  try {
                    const jsonStr = trimmed.slice(6).trim();
                    if (!jsonStr || jsonStr === '[DONE]') continue;
                    const chunk = JSON.parse(jsonStr);
                    const text = chunk?.choices?.[0]?.delta?.content || '';
                    const finishReason = chunk?.choices?.[0]?.finish_reason;

                    if (text) {
                      fullText += text;
                      sendSSE({ text, done: false });
                    }

                    if (finishReason && finishReason !== 'null' && !doneSent) {
                      doneSent = true;
                      sendSSE({ text: '', done: true, fullText });
                    }
                  } catch (_) {
                    // Skip malformed JSON chunks
                  }
                }
              }
            }

            // Ensure done signal is always sent
            if (!doneSent) {
              sendSSE({ text: '', done: true, fullText });
            }
          } catch (err) {
            sendSSE({ error: err.message, done: true, fullText });
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
      // Non-streaming
      const data = await groqRes.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (!text) {
        return jsonResponse({
          error: 'EMPTY_RESPONSE',
          fallback: true,
          waNumber: WA_NUMBER,
          message: 'Maaf kak, ada gangguan kecil. Silakan coba lagi atau hubungi kami via WhatsApp ya! 😊'
        }, 502);
      }
      return jsonResponse({ text, success: true });
    }

  } catch (err) {
    console.error('Groq handler error:', err);
    if (err.name === 'TimeoutError') {
      return jsonResponse({
        error: 'GROQ_TIMEOUT',
        fallback: true,
        waNumber: WA_NUMBER,
        message: 'Maaf kak, respons terlalu lama. Silakan hubungi kami via WhatsApp ya kak! 😊'
      }, 504);
    }
    // Both APIs failed — return WA fallback
    return jsonResponse({
      error: 'ALL_FAILED',
      fallback: true,
      waNumber: WA_NUMBER,
      message: `Aduh maaf kak, koneksi kami lagi gangguan nih 😅 Untuk informasi lebih lanjut, hubungi kami langsung via WhatsApp ya kak!`
    }, 503);
  }
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
