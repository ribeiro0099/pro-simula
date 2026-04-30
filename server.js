// ╔══════════════════════════════════════════════════════════════╗
// ║  AprovaçãoTotal — Backend Unificado                          ║
// ║  Rotas: POST /simulado  /idiomas  /redacao  /chat            ║
// ║  GET  /  → health check                                      ║
// ║                                                              ║
// ║  Variáveis de ambiente (painel do Render):                   ║
// ║    GEMINI_API_KEY   → sua chave do Google AI Studio          ║
// ║    OPENROUTER_API_KEY → sua chave do OpenRouter (redação)    ║
// ╚══════════════════════════════════════════════════════════════╝

import express from "express";
import cors    from "cors";
import fetch   from "node-fetch";

const app  = express();
const PORT = process.env.PORT || 3001; // Render injeta PORT automaticamente

// ── Chaves SEMPRE via variável de ambiente ──────────────────────
const GEMINI_KEY      = process.env.GEMINI_API_KEY      || "";
const OPENROUTER_KEY  = process.env.OPENROUTER_API_KEY  || "";

const GEMINI_URL      = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
const OPENROUTER_URL  = "https://openrouter.ai/api/v1/chat/completions";

app.use(cors());
app.use(express.json());

// ── Log de startup ──────────────────────────────────────────────
console.log("🔑 GEMINI_API_KEY:",     GEMINI_KEY     ? "configurada ✅" : "NÃO DEFINIDA ❌");
console.log("🔑 OPENROUTER_API_KEY:", OPENROUTER_KEY ? "configurada ✅" : "NÃO DEFINIDA ❌");

// ══════════════════════════════════════════════════════════════
// CACHE em memória — evita chamadas duplas para o mesmo prompt
// ══════════════════════════════════════════════════════════════
const cache    = new Map();
const CACHE_MS = 20 * 60 * 1000; // 20 min

function getCache(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_MS) { cache.delete(k); return null; }
  return e.v;
}
function setCache(k, v) {
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  cache.set(k, { v, ts: Date.now() });
}

// ══════════════════════════════════════════════════════════════
// FILA — evita 429 quando múltiplos usuários chamam juntos
// ══════════════════════════════════════════════════════════════
let queue = [], running = false;

async function runQueue() {
  if (running || !queue.length) return;
  running = true;
  const { fn, resolve, reject } = queue.shift();
  try   { resolve(await fn()); }
  catch (e) { reject(e); }
  finally {
    running = false;
    setTimeout(runQueue, 700); // 700ms entre chamadas
  }
}

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    runQueue();
  });
}

// ══════════════════════════════════════════════════════════════
// CHAMADA AO GEMINI (simulado, idiomas, chat)
// ══════════════════════════════════════════════════════════════
async function callGemini(prompt) {
  if (!GEMINI_KEY) throw { status: 500, msg: "GEMINI_API_KEY não configurada no servidor." };

  const r = await fetch(GEMINI_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      contents:         [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: "application/json" }
    }),
    signal: AbortSignal.timeout(40000)
  });

  if (r.status === 429) throw { status: 429, msg: "Limite de requisições. Tente em 1 minuto." };
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw { status: r.status, msg: e?.error?.message || `Erro ${r.status} na API Gemini.` };
  }

  const data = await r.json();
  const txt  = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!txt) throw { status: 500, msg: "Resposta vazia da IA. Tente novamente." };
  return txt;
}

// ══════════════════════════════════════════════════════════════
// CHAMADA AO OPENROUTER (redação — modelo gratuito)
// ══════════════════════════════════════════════════════════════
async function callOpenRouter(prompt) {
  if (!OPENROUTER_KEY) throw { status: 500, msg: "OPENROUTER_API_KEY não configurada no servidor." };

  const r = await fetch(OPENROUTER_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer":  "https://aprovacaototal.com.br",
      "X-Title":       "AprovaçãoTotal"
    },
    body: JSON.stringify({
      model:       "meta-llama/llama-3.1-8b-instruct:free",
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens:  1500
    }),
    signal: AbortSignal.timeout(40000)
  });

  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw { status: r.status, msg: e?.error?.message || `Erro ${r.status} no OpenRouter.` };
  }

  const data = await r.json();
  const txt  = data?.choices?.[0]?.message?.content;
  if (!txt) throw { status: 500, msg: "Resposta vazia do modelo de redação." };
  return txt;
}

// ══════════════════════════════════════════════════════════════
// REPARO DE JSON TRUNCADO
// ══════════════════════════════════════════════════════════════
function repairJson(raw) {
  let s = raw.replace(/```json|```/gi, "").trim();
  const fb = s.indexOf("{");
  if (fb > 0) s = s.slice(fb);
  try { return JSON.parse(s); } catch (_) {}

  // Recupera objetos completos do array questoes
  const ai = s.indexOf('"questoes"');
  if (ai === -1) return null;
  const bo = s.indexOf("[", ai);
  if (bo === -1) return null;
  let depth = 0, inStr = false, esc = false, last = -1;
  for (let i = bo; i < s.length; i++) {
    const c = s[i];
    if (esc)          { esc = false; continue; }
    if (c==="\\")     { esc = true;  continue; }
    if (c==='"')      { inStr = !inStr; continue; }
    if (inStr)        continue;
    if (c==="{")      depth++;
    if (c==="}") { depth--; if (!depth) last = i; }
  }
  if (last === -1) return null;
  try { return JSON.parse('{"questoes":' + s.slice(bo, last+1) + "]}"); }
  catch (_) { return null; }
}

// ══════════════════════════════════════════════════════════════
// ROTA: /simulado
// Body: { banca, materia, nivel, qtd }
// ══════════════════════════════════════════════════════════════
app.post("/simulado", async (req, res) => {
  const { banca, materia, nivel, qtd = 5 } = req.body;
  if (!banca || !materia || !nivel)
    return res.status(400).json({ erro: "Envie: banca, materia, nivel." });

  const ck = `sim:${banca}:${materia}:${nivel}:${qtd}`;
  const cached = getCache(ck);
  if (cached?.questoes?.length) return res.json({ cached: true, ...cached });

  const prompt = `Você é especialista em concursos públicos, estilo banca ${banca}.
Gere exatamente ${qtd} questões de múltipla escolha, nível ${nivel}, sobre: "${materia}".
Regras:
- Estilo fiel à banca ${banca}
- 5 alternativas por questão (A até E)
- Para idiomas: use texto base + gramática ou interpretação
- Enunciados objetivos e bem elaborados
- Explicação didática (2-3 linhas, cite a regra ou o fundamento)
Responda SOMENTE com JSON válido e completo:
{"questoes":[{"enunciado":"...","alternativas":["A) ...","B) ...","C) ...","D) ...","E) ..."],"gabarito":"A","explicacao":"..."}]}`;

  try {
    const raw  = await enqueue(() => callGemini(prompt));
    const data = repairJson(raw);
    if (!data?.questoes?.length)
      return res.status(502).json({ erro: "IA não retornou questões válidas. Tente novamente." });
    setCache(ck, data);
    res.json({ cached: false, ...data });
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.msg || e.message || "Erro interno." });
  }
});

// ══════════════════════════════════════════════════════════════
// ROTA: /idiomas
// Body: { idioma, topico, qtd }
// ══════════════════════════════════════════════════════════════
app.post("/idiomas", async (req, res) => {
  const { idioma, topico, qtd = 3 } = req.body;
  if (!idioma || !topico)
    return res.status(400).json({ erro: "Envie: idioma, topico." });

  const ck = `idi:${idioma}:${topico}:${qtd}`;
  const cached = getCache(ck);
  if (cached?.questoes?.length) return res.json({ cached: true, ...cached });

  const prompt = `Você é professor especialista em ${idioma} para concursos públicos brasileiros.
Crie ${qtd} questões de múltipla escolha sobre ${idioma} — tópico: ${topico}.
- Para interpretação: inclua um texto de até 8 linhas em ${idioma} antes das perguntas.
- Para gramática: crie frases contextualizadas e explique a regra na explicação.
Responda SOMENTE com JSON válido:
{"questoes":[{"enunciado":"...","alternativas":["A) ...","B) ...","C) ...","D) ...","E) ..."],"gabarito":"A","explicacao":"..."}]}`;

  try {
    const raw  = await enqueue(() => callGemini(prompt));
    const data = repairJson(raw);
    if (!data?.questoes?.length)
      return res.status(502).json({ erro: "IA não retornou questões válidas. Tente novamente." });
    setCache(ck, data);
    res.json({ cached: false, ...data });
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.msg || e.message || "Erro interno." });
  }
});

// ══════════════════════════════════════════════════════════════
// ROTA: /redacao
// Body: { texto, tema }
// ══════════════════════════════════════════════════════════════
app.post("/redacao", async (req, res) => {
  const { texto, tema = "não informado" } = req.body;
  if (!texto || texto.trim().length < 50)
    return res.status(400).json({ erro: "Texto muito curto. Mínimo 50 caracteres." });

  const prompt = `Você é um professor especialista em redação do ENEM e concursos públicos.
Corrija a redação abaixo e retorne APENAS JSON válido, sem texto extra, sem markdown.

Tema: ${tema}
Texto: ${texto}

Formato obrigatório:
{"nota_total":<0-1000>,"conceito":"<Insuficiente|Regular|Bom|Ótimo|Excelente>","competencias":[{"nome":"Domínio da norma culta","nota":<0-200>,"max":200},{"nome":"Compreensão do tema","nota":<0-200>,"max":200},{"nome":"Seleção e organização das informações","nota":<0-200>,"max":200},{"nome":"Mecanismos linguísticos","nota":<0-200>,"max":200},{"nome":"Proposta de intervenção","nota":<0-200>,"max":200}],"erros":[{"tipo":"...","descricao":"..."}],"pontos_positivos":"...","sugestao_melhoria":"..."}`;

  try {
    const raw   = await enqueue(() => callOpenRouter(prompt));
    const clean = raw.replace(/```json|```/gi, "").trim();
    const data  = JSON.parse(clean);
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.msg || e.message || "Erro interno." });
  }
});

// ══════════════════════════════════════════════════════════════
// ROTA: /chat  (tutor de idiomas — resposta em texto)
// Body: { mensagem, idioma }
// ══════════════════════════════════════════════════════════════
app.post("/chat", async (req, res) => {
  const { mensagem, idioma = "idiomas" } = req.body;
  if (!mensagem) return res.status(400).json({ erro: "Mensagem vazia." });

  // Chat não usa responseMimeType:json — override prompt para texto livre
  const prompt = `Você é professor de ${idioma} no AprovaçãoTotal.
Responda em português, de forma curta e didática.
Pergunta: ${mensagem}
Resposta (texto puro, sem JSON):`;

  try {
    const raw = await enqueue(() => callGemini(prompt));
    // Gemini pode retornar JSON mesmo sem responseMimeType — tenta extrair texto
    let resposta = raw.replace(/```json|```/gi, "").trim();
    try {
      const j = JSON.parse(resposta);
      resposta = j.resposta || j.text || j.message || resposta;
    } catch (_) {}
    res.json({ resposta });
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.msg || e.message || "Erro interno." });
  }
});

// ── Health check ────────────────────────────────────────────────
app.get("/", (_, res) => res.json({
  status:  "online ✅",
  servico: "AprovaçãoTotal Backend",
  rotas:   ["POST /simulado", "POST /idiomas", "POST /redacao", "POST /chat"],
  gemini:  GEMINI_KEY     ? "ok" : "não configurado",
  openrouter: OPENROUTER_KEY ? "ok" : "não configurado"
}));

app.listen(PORT, () => console.log(`✅ Backend rodando na porta ${PORT}`));