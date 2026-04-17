/**
 * Local AI Backend
 * Routes tasks to local services:
 *   Image generation → ComfyUI (localhost:8188)
 *   Text tasks       → Ollama / qwen2.5:7b (localhost:11434)
 *   Vision analysis  → Ollama / qwen2.5vl:7b (localhost:11434)
 *   Transcription    → Whisper server (localhost:9000)
 */

// --- Types ---

export interface ImageGenParams {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  sceneRefBase64?: string;   // scene/composition reference
  charRefBase64?: string;    // character/face reference
}

export interface ImageGenResult {
  imageBase64: string;
  filename: string;
}

export interface TextParams {
  prompt: string;
  systemPrompt?: string;
  json?: boolean;
}

export interface TranscribeResult {
  text: string;
  language: string;
  duration: number;
}

// --- Constants ---

const COMFY_URL = '/comfy';
const OLLAMA_URL = '/ollama';
const WHISPER_URL = '/whisper';
const TEXT_MODEL = 'qwen2.5:7b';
const VISION_MODEL = 'qwen2.5vl:7b';

const WORKFLOW_PATHS = {
  A: '/src/workflows/workflow_A_flux_only.json',
  B: '/src/workflows/workflow_B_flux_controlnet.json',
  C: '/src/workflows/workflow_C_flux_pulid.json',
  D: '/src/workflows/workflow_D_flux_controlnet_pulid.json',
} as const;

// --- Helpers ---

async function loadWorkflow(key: keyof typeof WORKFLOW_PATHS): Promise<Record<string, unknown>> {
  const res = await fetch(WORKFLOW_PATHS[key]);
  if (!res.ok) throw new Error(`Workflow ${key} yüklenemedi`);
  return res.json();
}

function fillTemplate(workflow: Record<string, unknown>, vars: Record<string, unknown>): Record<string, unknown> {
  const str = JSON.stringify(workflow);
  const filled = str.replace(/"{{(\w+)}}"/g, (_, key) => {
    const val = vars[key];
    if (val === undefined) throw new Error(`Workflow değişkeni eksik: ${key}`);
    return typeof val === 'string' ? JSON.stringify(val) : String(val);
  });
  return JSON.parse(filled);
}

async function uploadRefImage(base64: string): Promise<string> {
  const blob = await fetch(`data:image/png;base64,${base64}`).then(r => r.blob());
  const form = new FormData();
  form.append('image', blob, 'ref.png');
  form.append('type', 'input');
  const res = await fetch(`${COMFY_URL}/upload/image`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Referans görsel yüklenemedi');
  const data = await res.json() as { name: string };
  return data.name;
}

async function runComfyWorkflow(prompt: Record<string, unknown>): Promise<ImageGenResult> {
  // Submit
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`ComfyUI hata: ${res.statusText}`);
  const { prompt_id } = await res.json() as { prompt_id: string };

  // Poll for completion
  let attempts = 0;
  while (attempts < 300) {
    await new Promise(r => setTimeout(r, 2000));
    const histRes = await fetch(`${COMFY_URL}/history/${prompt_id}`);
    if (!histRes.ok) { attempts++; continue; }
    const hist = await histRes.json() as Record<string, { outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }> }>;
    const job = hist[prompt_id];
    if (!job?.outputs) { attempts++; continue; }

    // Find SaveImage output
    for (const nodeOut of Object.values(job.outputs)) {
      if (nodeOut.images?.length) {
        const img = nodeOut.images[0];
        const imgRes = await fetch(`${COMFY_URL}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`);
        const buf = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
        const imageBase64 = btoa(binary);
        return { imageBase64, filename: img.filename };
      }
    }
    attempts++;
  }
  throw new Error('ComfyUI: görsel üretimi zaman aşımına uğradı');
}

// --- Public API ---

/**
 * Generate image via ComfyUI.
 * Selects workflow A/B/C/D based on available references.
 */
export async function generateImageLocal(params: ImageGenParams): Promise<ImageGenResult> {
  const { prompt, width = 1024, height = 1024, sceneRefBase64, charRefBase64 } = params;
  const seed = params.seed ?? Math.floor(Math.random() * 2 ** 32);

  const hasScene = Boolean(sceneRefBase64);
  const hasChar = Boolean(charRefBase64);

  let workflowKey: keyof typeof WORKFLOW_PATHS;
  if (!hasScene && !hasChar) workflowKey = 'A';
  else if (hasScene && !hasChar) workflowKey = 'B';
  else if (!hasScene && hasChar) workflowKey = 'C';
  else workflowKey = 'D';

  const workflow = await loadWorkflow(workflowKey);

  const vars: Record<string, unknown> = {
    POSITIVE_PROMPT: prompt,
    WIDTH: width,
    HEIGHT: height,
    SEED: seed,
  };

  if (hasScene && sceneRefBase64) {
    vars.SCENE_REF_PATH = await uploadRefImage(sceneRefBase64);
  }
  if (hasChar && charRefBase64) {
    vars.CHAR_REF_PATH = await uploadRefImage(charRefBase64);
  }

  const filled = fillTemplate(workflow, vars);
  return runComfyWorkflow(filled);
}

/**
 * Generate text via Ollama qwen2.5:7b.
 * Use for: prompt generation, scenario writing, JSON output.
 */
export async function generateTextLocal(params: TextParams): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (params.systemPrompt) {
    messages.push({ role: 'system', content: params.systemPrompt });
  }
  messages.push({ role: 'user', content: params.prompt });

  const body: Record<string, unknown> = {
    model: TEXT_MODEL,
    messages,
    stream: false,
  };
  if (params.json) {
    body.format = 'json';
  }

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ollama hata: ${res.statusText}`);
  const data = await res.json() as { message: { content: string } };
  return data.message.content;
}

/**
 * Analyze image via Ollama qwen2.5vl:7b.
 * Use for: cinema scene analysis.
 */
export async function analyzeImageLocal(imageBase64: string, prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [{
        role: 'user',
        content: prompt,
        images: [imageBase64],
      }],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama vision hata: ${res.statusText}`);
  const data = await res.json() as { message: { content: string } };
  return data.message.content;
}

/**
 * Transcribe audio via faster-whisper server.
 * Accepts base64 audio string.
 */
export async function transcribeAudioLocal(audioBase64: string): Promise<TranscribeResult> {
  const res = await fetch(`${WHISPER_URL}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_base64: audioBase64 }),
  });
  if (!res.ok) throw new Error(`Whisper hata: ${res.statusText}`);
  return res.json() as Promise<TranscribeResult>;
}

/**
 * Health check for all local services.
 */
export async function checkLocalServices(): Promise<{
  comfyui: boolean;
  ollama: boolean;
  whisper: boolean;
}> {
  const check = async (url: string) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  };

  const [comfyui, ollama, whisper] = await Promise.all([
    check(`${COMFY_URL}/system_stats`),
    check(`${OLLAMA_URL}/api/tags`),
    check(`${WHISPER_URL}/health`),
  ]);

  return { comfyui, ollama, whisper };
}
