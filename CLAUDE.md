# DreamCanvas AI — CLAUDE.md

## Proje Tanımı

**DreamCanvas AI** — Yapay zeka destekli görsel üretim platformu. Google Gemini API kullanarak prompt'tan görsel oluşturur.

- **Repo:** `C:\Users\semihcagatay\CLAUDE\Semsei-Ai`
- **Entry Point:** `src/main.tsx` → `src/App.tsx` (tek büyük bileşen)
- **Deployed:** Google AI Studio (`ai.studio/apps/bc5f736e-543d-422d-a141-19a63ae30dc2`)

---

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Framework | React 19 + TypeScript 5.8 |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 (Vite plugin) |
| AI SDK | `@google/genai` ^1.29.0 |
| Animasyon | `motion/react` (Framer Motion) |
| İkonlar | `lucide-react` |
| CSS Utils | `clsx` + `tailwind-merge` |
| Dosya | `jszip`, `mammoth` (DOCX), `pdfjs-dist` (PDF) |

---

## Proje Yapısı

```
src/
  App.tsx        # Tüm uygulama — tek büyük bileşen (~700+ satır)
  constants.ts   # PERSONAS ve STYLES sabitleri
  main.tsx       # React root render
  index.css      # Global stiller
vite.config.ts   # Vite + Tailwind + Gemini API key inject
.env.example     # GEMINI_API_KEY, APP_URL
metadata.json    # App meta (AI Studio için)
```

---

## Temel Mimari

### API Katmanı

```typescript
// Görsel üretim — gemini-2.5-flash-image modeli
callGeminiAPI(fullPrompt, inputImageBase64?, charRefBase64?, signal?)

// Prompt geliştirme — gemini-3-flash-preview modeli
fetchPromptFromGemini(dreamText, personaKey)

// Aktif API key (custom key > env key)
getActiveApiKey()  // customApiKey (>5 char) || GEMINI_API_KEY env
```

### State Yönetimi

Tüm state `App.tsx` içinde React hooks ile yönetilir, global store yok.

| State | Tip | Açıklama |
|-------|-----|----------|
| `imageQueue` | `QueueItem[]` | Görsel kuyruğu (unshift ile eklenir) |
| `activeTab` | `'manual' \| 'story' \| 'audio' \| 'cinema'` | Aktif sekme |
| `genMode` | `'single' \| 'multi' \| 'maxi'` | Üretim modu |
| `logs` | `array` | Log kayıtları |

### Loglama

```typescript
logMessage(sender: string, msg: string, type = 'info')
// type: 'info' | 'success' | 'error' | 'warn'
```

### Kuyruk Yönetimi

- `createQueueItem()` — yeni item oluştur, `imageQueue`'ya **unshift** ile ekle
- `processItem()` — kuyruktaki itemi işle
- `AbortController` ile iptal desteği var

---

## Sekmeler ve Modlar

### Sekmeler (activeTab)
- **manual** — Elle prompt girişi, tek/çoklu üretim
- **story** — Metin dosyası (TXT/DOCX/PDF) yükle, sahnelere böl
- **audio** — Ses → Metin → Senaryo → Prompt → Görsel pipeline
- **cinema** — Yönetmen persona'larıyla sinematik görsel

### Üretim Modları (genMode)
- **single** — 1 prompt → 1 görsel
- **multi** — 1 prompt → N görsel (imgCount)
- **maxi** — Çoklu master persona kombinasyonu

---

## Constants (src/constants.ts)

### PERSONAS
Kategoriler: `cinema`, `anime`, `photo`, `oil`, `custom`

Özel personalar: `semih`, `kazim`, `batuhan`, `kutay`, `oguzhan`, `evliya`, `detayci`, `saadet`

### STYLES
`none`, `photo` (Ultra Gerçekçi), `oil` (Yağlı Boya), `anime`, `3d`, `pixel`, `vector`, `grunge`, `double`

---

## API Key Yapılandırma

```bash
# .env.local dosyası oluştur (git'e eklenmez)
GEMINI_API_KEY="your_key_here"
```

Uygulama önce custom API key input'u kontrol eder (>5 karakter), sonra env değişkenini kullanır.

---

## Geliştirme Komutları

```bash
npm install          # Bağımlılıkları yükle
npm run dev          # Dev server — http://localhost:3000
npm run build        # Production build → dist/
npm run lint         # TypeScript tip kontrolü (tsc --noEmit)
npm run preview      # Build önizleme
```

---

## Kodlama Kuralları

- **Dosya sayısı:** Yeni dosya oluşturmaktan kaçın. Değişiklikler önce `App.tsx` ve `constants.ts`'e yapılır.
- **State:** Global store ekleme; React hooks yeterli.
- **Loglama:** `logMessage()` kullan — `console.log` değil.
- **Kuyruk ekleme:** `imageQueue.unshift()` — `push()` değil.
- **API model isimleri:** Mevcut model isimlerini koru (`gemini-2.5-flash-image`, `gemini-3-flash-preview`).
- **Persona/Style eklemek:** `src/constants.ts` dosyasını düzenle.
- **TypeScript:** `any` tipten kaçın; mümkünse `interface` veya `type` tanımla.
- **UI:** Tailwind CSS class'ları kullan, inline style'dan kaçın.

---

## QueueItem Interface

```typescript
interface QueueItem {
  id: string;
  displayName: string;
  cleanPrompt: string;
  originalPromptText: string;
  prompt: string;
  seed: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  retryCount: number;
  refImage: string | null;
  charRefImage?: string | boolean;
  maskedImage: string | null;
  resultBase64: string | null;
  timestamp: Date;
  meta: any;
  styleConfig: any;
  isStyled: boolean;
  styleName: string;
  groupId: string | null;
  groupName: string | null;
  aspectRatio: string;
  errorMsg?: string;
}
```
