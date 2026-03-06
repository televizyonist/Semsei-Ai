# Lokal Yüksek Kalite AI Sistemi — Yapılacaklar Listesi

**Tarih:** 2026-03-06
**Amaç:** Gemini API bağımlılığını kaldırıp tüm AI görevlerini RTX 4090 üzerinde lokalde çalıştırmak.

---

## Mimari Genel Bakış

```
DreamCanvas App
       ↓
   Task Router (yeni katman)
       ↓
┌──────────────────────────────────────────────┐
│  Görsel (ref yok)    → ComfyUI + FLUX.1 dev  │
│  Görsel (sahne ref)  → ComfyUI + ControlNet  │
│  Görsel (karakter)   → ComfyUI + PuLID       │
│  Görsel (ikisi de)   → ComfyUI + CN + PuLID  │
│  Ses → Yazı          → Whisper Large v3      │
│  Metin görevleri     → Ollama + Qwen2.5 7B   │
│  Sahne analizi       → Ollama + Qwen2.5-VL   │
└──────────────────────────────────────────────┘
```

---

## BÖLÜM 1 — Altyapı Kurulumu

### 1. ComfyUI Kur *(Görsel üretim motoru)*
- `git clone https://github.com/comfyanonymous/ComfyUI`
- PyTorch CUDA 12.x ile sanal ortam kur
- `python main.py --listen` ile başlat
- Servis adresi: `localhost:8188`

### 2. FLUX.1 dev İndir *(Ana görsel üretim modeli)*
- Hugging Face'den `black-forest-labs/FLUX.1-dev` lisansını kabul et
- İndirilecek dosya: `flux1-dev-Q8_0.gguf` (~12GB) — 4090'da konforlu çalışır
- Hedef klasör: ComfyUI `/models/unet/`

### 3. ControlNet for FLUX İndir *(Sahne/kompozisyon referansı)*
- Model: `Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro`
- Tek model, birden fazla kontrol türünü destekler (depth, canny, pose...)
- Hedef klasör: ComfyUI `/models/controlnet/`

### 4. PuLID for FLUX İndir *(Karakter/yüz kimliği referansı)*
- Model: `guozinan/PuLID-FLUX`
- Yüz kimliğini referans görsellerden çok iyi aktarır
- Hedef klasör: ComfyUI `/models/pulid/`
- Gerekli yardımcı modeller: EVA-CLIP, InsightFace antelopev2

### 5. Ollama Kur *(Metin görevleri)*
```bash
winget install Ollama.Ollama
# veya https://ollama.ai
```
- Servis adresi: `localhost:11434`
- OpenAI-uyumlu API sunar — minimal kod değişikliği gerektirir

### 6. Qwen2.5 7B Çek *(Prompt üretimi, senaryo, JSON)*
```bash
ollama pull qwen2.5:7b
```
- Türkçe dahil çok dilli, JSON çıktı desteği güçlü

### 7. Qwen2.5-VL 7B Çek *(Sahne analizi — görüntü anlama)*
```bash
ollama pull qwen2.5vl:7b
```
- Sinema sekmesindeki sahne analizi için kullanılacak

### 8. faster-whisper Server Kur *(Ses → Yazı)*
```bash
pip install faster-whisper
```
- Model: `large-v3` — Türkçe dahil tüm diller, state-of-the-art kalite
- Alternatif: `whisper-standalone-win` (Windows için hazır paket)
- Servis adresi: `localhost:9000`

---

## BÖLÜM 2 — ComfyUI Workflow'ları

Her senaryo için ayrı workflow JSON hazırlanacak. ComfyUI'ye `/prompt` endpoint üzerinden gönderilir.

| Workflow | Girdi | Modeller |
|---|---|---|
| **A** | Sadece metin | FLUX.1 dev |
| **B** | Metin + Sahne Ref | FLUX.1 dev + ControlNet |
| **C** | Metin + Karakter Ref | FLUX.1 dev + PuLID |
| **D** | Metin + Sahne Ref + Karakter Ref | FLUX.1 dev + ControlNet + PuLID |

Her workflow için JSON dosyaları: `src/workflows/` klasörüne kaydedilecek.

---

## BÖLÜM 3 — Uygulama Değişiklikleri

### 9. Local API Backend Yaz

`src/server/localAI.ts` — Gemini çağrılarını lokal servislere yönlendiren Express router.

**Routing mantığı:**
```typescript
// Görsel üretim
if (!charRef && !sceneRef)  → ComfyUI Workflow A (sadece FLUX)
if (sceneRef && !charRef)   → ComfyUI Workflow B (FLUX + ControlNet)
if (charRef && !sceneRef)   → ComfyUI Workflow C (FLUX + PuLID)
if (charRef && sceneRef)    → ComfyUI Workflow D (FLUX + ControlNet + PuLID)

// Metin görevleri
fetchPrompt / senaryo / JSON  → Ollama (qwen2.5:7b)

// Ses transkripsiyon
audio file                    → faster-whisper server

// Sahne analizi
görsel                        → Ollama (qwen2.5vl:7b)
```

### 10. `callGeminiAPI` → `callLocalImageAPI`

Mevcut fonksiyon yerine ref varlığına göre doğru ComfyUI workflow'unu seçen yeni fonksiyon yazılacak. ComfyUI'nin WebSocket tabanlı progress API'si entegre edilecek.

### 11. `fetchPromptFromGemini` → `callOllamaText`

Ollama'nın OpenAI-uyumlu `/api/chat` endpoint'i kullanılacak. Minimal kod değişikliği gerektirir.

### 12. Audio Transkripsiyon → Whisper

`runAudioPipeline` içindeki Gemini transkripsiyon çağrısı faster-whisper HTTP API ile değiştirilecek.

### 13. `handleCinemaAnalyze` → Qwen2.5-VL

Sahne görseli Ollama'nın vision endpoint'ine gönderilecek, JSON çekim önerileri alınacak.

### 14. UI'ya "Lokal Mod" Toggle Ekle

- Sağ panelin alt kısmına mod seçici eklenir
- **Bulut Modu:** Gemini API key ile çalışır (mevcut durum)
- **Lokal Mod:** Lokal servisler kullanılır, API key alanı gizlenir
- Seçim `localStorage`'a kaydedilir

---

## BÖLÜM 4 — VRAM Yönetimi (RTX 4090 — 24GB)

| Bileşen | Model | VRAM |
|---|---|---|
| Görsel üretim | FLUX.1 dev Q8 | ~12 GB |
| Sahne referansı | ControlNet Union Pro | +2 GB |
| Karakter referansı | PuLID FLUX | +2 GB |
| Metin görevleri | Qwen2.5 7B | ~5 GB |
| Sahne analizi | Qwen2.5-VL 7B | ~5 GB |
| Ses transkripsiyon | Whisper Large v3 | ~3 GB |

**Strateji:**
- Görsel üretim aktifken (~16GB) metin modelleri CPU'ya offload edilir
- Ollama modelleri kullanılmadığında VRAM'den otomatik boşaltılır (`OLLAMA_KEEP_ALIVE=0`)
- Whisper ayrı process'te çalışır, görsel üretimle çakışmaz

---

## Uygulama Sırası

1. ComfyUI + FLUX.1 dev kur, tek başına test et
2. ControlNet ekle, sahne referansıyla test et
3. PuLID ekle, karakter referansıyla test et
4. Ollama + Qwen2.5 kur, metin görevlerini test et
5. Whisper server kur, transkripsiyon test et
6. Workflow JSON'larını hazırla (A, B, C, D)
7. `localAI.ts` backend yaz
8. App.tsx API çağrılarını güncelle
9. UI'ya Lokal Mod toggle ekle
10. Uçtan uca test (tüm sekmeler)
