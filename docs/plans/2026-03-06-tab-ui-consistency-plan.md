# Tab UI Consistency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tüm sekmeleri (Manuel, Senaryo, Audio, Sinema) tutarlı hale getir — her sekme compact inline panel + genişletilebilir tam ekran workspace moduna sahip olsun.

**Architecture:** Tek `expandedTab` state ile tüm sekmelerin expanded/compact geçişi yönetilir. Story ve Audio modal'ları kaldırılır, içerikleri expanded view'a taşınır. Manuel referans tasarım olarak kullanılır.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, motion/react, lucide-react

**Dosya:** Sadece `src/App.tsx` değişir.

---

## Task 1: State Refactor — `isStoryModalOpen` ve `isAudioPipelineOpen` kaldır, `expandedTab` ekle

**Files:**
- Modify: `src/App.tsx:113-122`

**Step 1: State değişikliklerini yap**

`src/App.tsx` satır 113-122'deki Modals bloğunu bul:
```typescript
// Modals
const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
const [isMaxiModalOpen, setIsMaxiModalOpen] = useState(false);
const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
const [fullscreenSrc, setFullscreenSrc] = useState('');
const [isMaskingModalOpen, setIsMaskingModalOpen] = useState(false);
const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
const [isAudioPipelineOpen, setIsAudioPipelineOpen] = useState(false);
const [isJobCompleteModalOpen, setIsJobCompleteModalOpen] = useState(false);
```

Şu hale getir (sadece `isStoryModalOpen` ve `isAudioPipelineOpen` satırları kaldır, `expandedTab` ekle):
```typescript
// Modals
const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
const [isMaxiModalOpen, setIsMaxiModalOpen] = useState(false);
const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
const [fullscreenSrc, setFullscreenSrc] = useState('');
const [isMaskingModalOpen, setIsMaskingModalOpen] = useState(false);
const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
const [isJobCompleteModalOpen, setIsJobCompleteModalOpen] = useState(false);

// Expanded tab state
const [expandedTab, setExpandedTab] = useState<'manual' | 'story' | 'audio' | 'cinema' | null>(null);
```

**Step 2: TypeScript kontrolü yap**

```bash
cd "C:/Users/semihcagatay/CLAUDE/Semsei-Ai" && npm run lint 2>&1 | head -30
```

Beklenen: TypeScript hataları — `isStoryModalOpen` ve `isAudioPipelineOpen` artık tanımlı değil. Bu normaldir, sonraki task'larda düzeltilecek.

---

## Task 2: `handleTextUpload` fonksiyonunu güncelle

**Files:**
- Modify: `src/App.tsx:564-592`

**Step 1:** `handleTextUpload` fonksiyonundaki tüm `setIsStoryModalOpen(true)` çağrılarını `setExpandedTab('story')` ile değiştir.

Mevcut (satır 579, 585, 590):
```typescript
setIsStoryModalOpen(true);
```

Yeni:
```typescript
setExpandedTab('story');
```

Üç yerde değiştirilmeli (PDF, DOCX, TXT branch'leri).

**Step 2:** Lint kontrolü:
```bash
cd "C:/Users/semihcagatay/CLAUDE/Semsei-Ai" && npm run lint 2>&1 | grep "isStoryModalOpen\|isAudioPipelineOpen"
```
Beklenen: Bu iki referans için hata kalmamalı (Task 1'den kalan hata sayısı azalmış olmalı).

---

## Task 3: Tab header'a Maximize2 butonu ekle

**Files:**
- Modify: `src/App.tsx:830-848` (tab switcher bölümü)

**Step 1:** Mevcut tab switcher header'ını bul (satır ~833):
```tsx
<div className="p-2 border-b border-white/5 flex items-center justify-between bg-white/5">
  <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 w-full">
    {(['manual', 'story', 'audio', 'cinema'] as const).map(tab => (
      ...
    ))}
  </div>
</div>
```

Şu hale getir (Maximize2 butonu ekle, `w-full` kaldır):
```tsx
<div className="p-2 border-b border-white/5 flex items-center gap-2 bg-white/5">
  <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 flex-1">
    {(['manual', 'story', 'audio', 'cinema'] as const).map(tab => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={cn(
          "flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all",
          activeTab === tab ? "bg-white/10 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
        )}
      >
        {tab === 'manual' ? 'Manuel' : tab === 'story' ? 'Senaryo' : tab === 'audio' ? 'Audio' : 'Sinema'}
      </button>
    ))}
  </div>
  <button
    onClick={() => setExpandedTab(activeTab)}
    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-zinc-500 hover:text-white flex-shrink-0"
    title="Tam Ekran"
  >
    <Maximize2 className="w-4 h-4" />
  </button>
</div>
```

---

## Task 4: Senaryo sekmesi compact view'u yeniden yaz

**Files:**
- Modify: `src/App.tsx:1066-1083` (story tab content)

**Step 1:** Mevcut story tab içeriğini (satır 1066-1083) tamamen değiştir:

```tsx
{activeTab === 'story' && (
  <div className="space-y-6">
    {/* Dosya Yükleme */}
    <div>
      <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-3">Senaryo Dosyası</label>
      <div
        className={cn(
          "p-4 border-2 border-dashed rounded-xl flex items-center gap-4 transition-all cursor-pointer group",
          storyText ? "border-purple-500/40 bg-purple-500/5" : "border-white/10 hover:bg-white/5"
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleTextUpload(file); }}
      >
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", storyText ? "bg-purple-500/20" : "bg-white/5 group-hover:bg-purple-500/10")}>
          <FileText className={cn("w-5 h-5", storyText ? "text-purple-400" : "text-zinc-600")} />
        </div>
        <div className="flex-1 min-w-0">
          {storyText ? (
            <>
              <p className="text-xs font-bold text-purple-400 truncate">{storyFileName}</p>
              <p className="text-[9px] text-zinc-500">{editableStoryText.length} karakter yüklendi</p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-zinc-400">PDF, DOCX veya TXT</p>
              <p className="text-[9px] text-zinc-600">Sürükle veya seç</p>
            </>
          )}
        </div>
        <label className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest cursor-pointer transition-all flex-shrink-0">
          {storyText ? 'Değiştir' : 'Seç'}
          <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleTextUpload(file); }} />
        </label>
      </div>
    </div>

    {/* Hayalin */}
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Hayalin</label>
      <textarea
        value={storyDream}
        onChange={(e) => setStoryDream(e.target.value)}
        placeholder="Senaryoya eklemek istediğiniz ekstra detaylar..."
        className="w-full h-20 bg-black/50 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500 transition-all resize-none"
      />
    </div>

    {/* Ustalar */}
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Ustalar</label>
      <div className="grid grid-cols-5 gap-1">
        {Object.keys(PERSONAS).map(cat => (
          <button
            key={cat}
            onClick={() => { setStoryPersonaCategory(cat); setStoryPersona(''); }}
            className={cn(
              "py-2 rounded-lg text-[8px] font-bold uppercase border transition-all",
              storyPersonaCategory === cat ? "bg-amber-500 border-amber-500 text-black" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20"
            )}
          >
            {cat === 'cinema' ? 'Sinema' : cat === 'anime' ? 'Anime' : cat === 'photo' ? 'Foto' : cat === 'oil' ? 'Yağlı' : 'Özel'}
          </button>
        ))}
      </div>
      <select
        disabled={!storyPersonaCategory}
        value={storyPersona}
        onChange={(e) => setStoryPersona(e.target.value)}
        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-30"
      >
        <option value="">— Persona Seç —</option>
        {storyPersonaCategory && Object.entries((PERSONAS as any)[storyPersonaCategory]).map(([key, p]: any) => (
          <option key={key} value={key}>{p.name}</option>
        ))}
      </select>
    </div>

    {/* Görsel Stil */}
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Görsel Stil</label>
        <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 scale-90 origin-right">
          <button onClick={() => setStoryStyleMode('direct')} className={cn("px-2 py-1 rounded text-[8px] font-bold uppercase", storyStyleMode === 'direct' ? "bg-white/10 text-white" : "text-zinc-600")}>Direkt</button>
          <button onClick={() => setStoryStyleMode('flow')} className={cn("px-2 py-1 rounded text-[8px] font-bold uppercase", storyStyleMode === 'flow' ? "bg-white/10 text-white" : "text-zinc-600")}>Flow</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {STYLES.map(s => (
          <button
            key={s.id}
            onClick={() => setStoryStyle(s.value)}
            className={cn(
              "py-2 px-1 rounded-lg text-[8px] font-bold uppercase border transition-all text-center h-10 flex items-center justify-center",
              storyStyle === s.value ? "bg-purple-500 border-purple-500 text-white" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>

    {/* Aspect Ratio */}
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">En / Boy Oranı</label>
      <div className="grid grid-cols-5 gap-1">
        {['native', '1:1', '16:9', '9:16', 'manual'].map(ratio => (
          <button
            key={ratio}
            onClick={() => setStoryAr(ratio)}
            className={cn(
              "py-2 rounded-lg text-[8px] font-bold uppercase border transition-all",
              storyAr === ratio ? "bg-purple-500 border-purple-500 text-white" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20"
            )}
          >
            {ratio === 'native' ? 'Orj' : ratio}
          </button>
        ))}
      </div>
    </div>

    {/* Refs */}
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sahne Ref</label>
        <div className="aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
          {storySceneRef ? (
            <>
              <img src={storySceneRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => setStorySceneRef(null)} className="p-2 bg-red-500 rounded-lg text-white"><X className="w-4 h-4" /></button>
              </div>
            </>
          ) : (
            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
              <Camera className="w-6 h-6 text-zinc-700" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = (ev) => setStorySceneRef(ev.target?.result as string); r.readAsDataURL(file); }}} />
            </label>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Karakter Ref</label>
        <div className="aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
          {storyCharRef ? (
            <>
              <img src={storyCharRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => setStoryCharRef(null)} className="p-2 bg-red-500 rounded-lg text-white"><X className="w-4 h-4" /></button>
              </div>
            </>
          ) : (
            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
              <Plus className="w-6 h-6 text-zinc-700" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = (ev) => setStoryCharRef(ev.target?.result as string); r.readAsDataURL(file); }}} />
            </label>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

**Step 2:** Senaryo footer action butonunu ekle. Mevcut `{activeTab === 'manual' && (...)}` footer bloğunun (satır ~1197) hemen altına ekle:

```tsx
{activeTab === 'story' && (
  <div className="p-4 border-t border-white/5 bg-black/20 space-y-3">
    <div className="flex items-center justify-between px-1">
      <label className="text-[10px] font-bold text-zinc-500 uppercase">Üretim Adedi</label>
      <input
        type="number"
        value={storyImgCount}
        onChange={(e) => setStoryImgCount(Number(e.target.value))}
        min={1} max={10}
        className="w-12 bg-black/50 border border-white/10 rounded-lg text-center text-xs py-1"
      />
    </div>
    <button
      onClick={handleStoryStart}
      disabled={!storyText || isProcessing}
      className="w-full py-4 btn-premium btn-purple-glow btn-shine uppercase tracking-[0.2em] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'ANALİZ ET VE BAŞLAT'}
    </button>
  </div>
)}
```

---

## Task 5: Audio sekmesi compact view'u yeniden yaz

**Files:**
- Modify: `src/App.tsx:1085-1107` (audio tab content)

**Step 1:** Mevcut audio tab içeriğini (satır 1085-1107) değiştir:

```tsx
{activeTab === 'audio' && (
  <div className="space-y-6">
    {/* Ses Dosyası Yükleme */}
    <div>
      <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-3">Ses Dosyası</label>
      {!audioFile ? (
        <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-white/10 rounded-xl hover:bg-white/5 cursor-pointer transition-all group">
          <Music className="w-8 h-8 mb-2 text-zinc-700 group-hover:text-purple-500 transition-colors" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Ses Dosyası Seç</p>
          <p className="text-[8px] text-zinc-700 mt-1">MP3, WAV, M4A...</p>
          <input type="file" accept="audio/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                setAudioFile({ base64: (ev.target?.result as string).split(',')[1], mimeType: file.type, name: file.name });
                setAudioStepStatus(prev => ({ ...prev, 1: 'done' }));
              };
              reader.readAsDataURL(file);
            }
          }} />
        </label>
      ) : (
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-purple-400 truncate flex-1 mr-2">{audioFile.name}</p>
            <button onClick={() => { setAudioFile(null); setAudioStepStatus({ 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending' }); }} className="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-red-400 transition-all">
              <X className="w-3 h-3" />
            </button>
          </div>
          <audio controls className="w-full h-8" src={`data:${audioFile.mimeType};base64,${audioFile.base64}`} />
        </div>
      )}
    </div>

    {/* Pipeline Step Progress */}
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pipeline Durumu</label>
      <div className="flex items-center gap-1">
        {[
          { id: 1, label: 'SES' },
          { id: 2, label: 'METİN' },
          { id: 3, label: 'SENARYO' },
          { id: 4, label: 'PROMPT' },
          { id: 5, label: 'GÖRSEL' },
        ].map((step, i, arr) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-bold border transition-all",
                audioStepStatus[step.id] === 'done' ? "bg-emerald-500 border-emerald-500 text-black" :
                audioStepStatus[step.id] === 'processing' ? "bg-yellow-500 border-yellow-500 text-black animate-pulse" :
                audioStepStatus[step.id] === 'error' ? "bg-red-500 border-red-500 text-white" :
                "bg-black/50 border-white/10 text-zinc-600"
              )}>
                {step.id}
              </div>
              <p className="text-[7px] text-zinc-600 mt-1 uppercase font-bold">{step.label}</p>
            </div>
            {i < arr.length - 1 && (
              <div className={cn("h-px flex-1 mb-4 mx-1", audioStepStatus[step.id] === 'done' ? "bg-emerald-500/50" : "bg-white/5")} />
            )}
          </div>
        ))}
      </div>
    </div>

    {/* Transkript (done ise göster) */}
    {audioTranscript && (
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Transkripsiyon</label>
        <div className="bg-black/40 border border-white/5 rounded-xl p-3 max-h-24 overflow-y-auto">
          <p className="text-[9px] font-mono text-zinc-400 leading-relaxed">{audioTranscript.slice(0, 300)}{audioTranscript.length > 300 ? '...' : ''}</p>
        </div>
      </div>
    )}
  </div>
)}
```

**Step 2:** Audio footer action butonu ekle (story footer'ının altına):

```tsx
{activeTab === 'audio' && (
  <div className="p-4 border-t border-white/5 bg-black/20 space-y-3">
    <button
      onClick={runAudioPipeline}
      disabled={!audioFile || audioStepStatus[2] === 'processing'}
      className="w-full py-4 btn-premium btn-purple-glow btn-shine uppercase tracking-[0.2em] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {audioStepStatus[2] === 'processing' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'PIPELINE BAŞLAT'}
    </button>
  </div>
)}
```

---

## Task 6: Sinema sekmesi compact view'u normalize et

**Files:**
- Modify: `src/App.tsx:1109-1194` (cinema tab content)

**Step 1:** Mevcut cinema tab içeriğini değiştir. Persona seçimi eklenir, ref boyutları/layout Manuel ile hizalanır, footer action butonu ayrı bir blok olarak çıkarılır:

```tsx
{activeTab === 'cinema' && (
  <div className="space-y-6">
    {/* Refs — Manuel ile aynı 2 col grid */}
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sahne Ref</label>
        <div className="aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
          {cinemaSceneRef ? (
            <>
              <img src={cinemaSceneRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => setCinemaSceneRef(null)} className="p-2 bg-red-500 rounded-lg text-white"><X className="w-4 h-4" /></button>
              </div>
            </>
          ) : (
            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
              <Camera className="w-6 h-6 text-zinc-700" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = (ev) => setCinemaSceneRef(ev.target?.result as string); r.readAsDataURL(file); }}} />
            </label>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Karakter Ref</label>
        <div className="aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
          {cinemaCharRef ? (
            <>
              <img src={cinemaCharRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => setCinemaCharRef(null)} className="p-2 bg-red-500 rounded-lg text-white"><X className="w-4 h-4" /></button>
              </div>
            </>
          ) : (
            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
              <Plus className="w-6 h-6 text-zinc-700" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = (ev) => setCinemaCharRef(ev.target?.result as string); r.readAsDataURL(file); }}} />
            </label>
          )}
        </div>
      </div>
    </div>

    {/* Analiz Sonuçları */}
    {cinemaAnalysis.length > 0 && (
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Önerilen Çekimler</label>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {cinemaAnalysis.map((shot, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl">
              <input
                type="checkbox"
                checked={selectedCinemaShots.includes(i)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedCinemaShots([...selectedCinemaShots, i]);
                  else setSelectedCinemaShots(selectedCinemaShots.filter(idx => idx !== i));
                }}
                className="w-4 h-4 accent-emerald-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold truncate">{shot.shot_name_tr}</p>
                <p className="text-[8px] text-zinc-500 uppercase">{shot.shot_type}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

**Step 2:** Cinema footer action butonunu ekle (audio footer'ının altına):

```tsx
{activeTab === 'cinema' && (
  <div className="p-4 border-t border-white/5 bg-black/20 space-y-3">
    {cinemaAnalysis.length === 0 ? (
      <button
        onClick={handleCinemaAnalyze}
        disabled={!cinemaSceneRef || isCinemaAnalyzing}
        className="w-full py-4 btn-premium btn-purple-glow btn-shine uppercase tracking-[0.2em] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {isCinemaAnalyzing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'SAHNEYİ ANALİZ ET'}
      </button>
    ) : (
      <button
        onClick={handleCinemaStart}
        disabled={selectedCinemaShots.length === 0}
        className="w-full py-4 btn-premium btn-purple-glow btn-shine uppercase tracking-[0.2em] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ÇEKİMLERİ BAŞLAT ({selectedCinemaShots.length})
      </button>
    )}
  </div>
)}
```

---

## Task 7: Expanded View — Tüm Sekmeler İçin Tam Ekran Workspace Ekle

**Files:**
- Modify: `src/App.tsx:1254` (MODALS bölümünün başı)

**Step 1:** Story Settings Modal'ı (satır 1256-1475) ve Audio Pipeline Modal'ı (satır 1477-1582) **sil**. Yerine tek bir Expanded Tab Overlay ekle. Bu bloğu `{/* FULLSCREEN MODAL */}` bloğunun hemen **üstüne** yerleştir:

```tsx
{/* EXPANDED TAB OVERLAY */}
<AnimatePresence>
  {expandedTab && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col"
    >
      {/* Expanded Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shadow-lg",
            expandedTab === 'manual' ? "bg-blue-500 shadow-blue-500/20" :
            expandedTab === 'story' ? "bg-purple-500 shadow-purple-500/20" :
            expandedTab === 'audio' ? "bg-purple-600 shadow-purple-600/20" :
            "bg-emerald-500 shadow-emerald-500/20"
          )}>
            {expandedTab === 'manual' ? <Sparkles className="w-5 h-5 text-black" /> :
             expandedTab === 'story' ? <FileText className="w-5 h-5 text-black" /> :
             expandedTab === 'audio' ? <Music className="w-5 h-5 text-black" /> :
             <Camera className="w-5 h-5 text-black" />}
          </div>
          <div>
            <h2 className="text-base font-bold">
              {expandedTab === 'manual' ? 'Manuel Üretim' :
               expandedTab === 'story' ? 'Senaryo Üretimi' :
               expandedTab === 'audio' ? 'Audio Pipeline' :
               'Sinema Modu'}
            </h2>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Genişletilmiş Çalışma Alanı</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Expanded action buttons per tab */}
          {expandedTab === 'manual' && (
            <button
              onClick={() => { setExpandedTab(null); handleGenerateManual(); }}
              disabled={isProcessing || (!requestInput.trim() && !promptInput.trim())}
              className="px-6 py-2.5 bg-blue-500 hover:bg-blue-400 text-black font-bold rounded-xl uppercase text-xs tracking-widest transition-all disabled:opacity-30"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'OLUŞTUR'}
            </button>
          )}
          {expandedTab === 'story' && (
            <button
              onClick={() => { setExpandedTab(null); handleStoryStart(); }}
              disabled={!storyText || isProcessing}
              className="px-6 py-2.5 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl uppercase text-xs tracking-widest transition-all disabled:opacity-30"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ANALİZ ET VE BAŞLAT'}
            </button>
          )}
          {expandedTab === 'audio' && (
            <button
              onClick={runAudioPipeline}
              disabled={!audioFile || audioStepStatus[2] === 'processing'}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl uppercase text-xs tracking-widest transition-all disabled:opacity-30"
            >
              {audioStepStatus[2] === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : '▶ TÜMÜNÜ BAŞLAT'}
            </button>
          )}
          {expandedTab === 'cinema' && cinemaAnalysis.length > 0 && (
            <button
              onClick={() => { setExpandedTab(null); handleCinemaStart(); }}
              disabled={selectedCinemaShots.length === 0}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl uppercase text-xs tracking-widest transition-all disabled:opacity-30"
            >
              ÇEKİMLERİ BAŞLAT ({selectedCinemaShots.length})
            </button>
          )}
          {expandedTab === 'cinema' && cinemaAnalysis.length === 0 && (
            <button
              onClick={handleCinemaAnalyze}
              disabled={!cinemaSceneRef || isCinemaAnalyzing}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl uppercase text-xs tracking-widest transition-all disabled:opacity-30"
            >
              {isCinemaAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'SAHNEYİ ANALİZ ET'}
            </button>
          )}
          <button onClick={() => setExpandedTab(null)} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Expanded Body */}
      <div className="flex-1 overflow-hidden">

        {/* MANUAL EXPANDED */}
        {expandedTab === 'manual' && (
          <div className="h-full grid grid-cols-2 gap-6 p-6">
            {/* Sol: Prompt alanları */}
            <div className="flex flex-col gap-6 overflow-y-auto pr-2">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Hayalin</label>
                <textarea
                  value={requestInput}
                  onChange={(e) => setRequestInput(e.target.value)}
                  placeholder="Ne hayal ediyorsun?"
                  className="w-full h-40 bg-black/50 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Prompt (İngilizce)</label>
                  <button onClick={() => setPromptInput('')} className="text-[8px] text-zinc-500 hover:text-white transition-colors uppercase font-bold">Temizle</button>
                </div>
                <textarea
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Direkt İngilizce prompt..."
                  className="w-full h-40 bg-black/50 border border-white/10 rounded-xl p-4 text-sm font-mono focus:outline-none focus:border-purple-500 transition-all resize-none"
                />
              </div>
              {/* Refs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sahne Ref</label>
                  <div className="aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
                    {sceneRef ? (
                      <>
                        <img src={sceneRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => setSceneRef(null)} className="p-2 bg-red-500 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                        <Camera className="w-8 h-8 text-zinc-700" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = (ev) => setSceneRef(ev.target?.result as string); r.readAsDataURL(file); }}} />
                      </label>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Karakter Ref</label>
                  <div className="aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
                    {charRef ? (
                      <>
                        <img src={charRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => setCharRef(null)} className="p-2 bg-red-500 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                        <Plus className="w-8 h-8 text-zinc-700" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = (ev) => setCharRef(ev.target?.result as string); r.readAsDataURL(file); }}} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* Sağ: Persona + Stil + AR */}
            <div className="flex flex-col gap-6 overflow-y-auto pr-2">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Ustalar</label>
                <div className="grid grid-cols-5 gap-1">
                  {Object.keys(PERSONAS).map(cat => (
                    <button key={cat} onClick={() => { setSelectedPersonaCategory(cat); setSelectedPersona(''); }}
                      className={cn("py-2 rounded-lg text-[8px] font-bold uppercase border transition-all",
                        selectedPersonaCategory === cat ? "bg-amber-500 border-amber-500 text-black" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20")}>
                      {cat === 'cinema' ? 'Sinema' : cat === 'anime' ? 'Anime' : cat === 'photo' ? 'Foto' : cat === 'oil' ? 'Yağlı' : 'Özel'}
                    </button>
                  ))}
                </div>
                <select disabled={!selectedPersonaCategory} value={selectedPersona} onChange={(e) => setSelectedPersona(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-30">
                  <option value="">— Persona Seç —</option>
                  {selectedPersonaCategory && Object.entries((PERSONAS as any)[selectedPersonaCategory]).map(([key, p]: any) => (
                    <option key={key} value={key}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Görsel Stil</label>
                  <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5">
                    <button onClick={() => setStyleMode('direct')} className={cn("px-2 py-1 rounded text-[8px] font-bold uppercase", styleMode === 'direct' ? "bg-white/10 text-white" : "text-zinc-600")}>Direkt</button>
                    <button onClick={() => setStyleMode('flow')} className={cn("px-2 py-1 rounded text-[8px] font-bold uppercase", styleMode === 'flow' ? "bg-white/10 text-white" : "text-zinc-600")}>Flow</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {STYLES.map(s => (
                    <button key={s.id} onClick={() => setSelectedStyle(s.value)}
                      className={cn("py-2 px-1 rounded-lg text-[8px] font-bold uppercase border transition-all h-10 flex items-center justify-center",
                        selectedStyle === s.value ? "bg-emerald-500 border-emerald-500 text-black" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20")}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">En / Boy Oranı</label>
                <div className="grid grid-cols-5 gap-1">
                  {['native', '1:1', '16:9', '9:16', 'manual'].map(ratio => (
                    <button key={ratio} onClick={() => setAspectRatio(ratio)}
                      className={cn("py-2 rounded-lg text-[8px] font-bold uppercase border transition-all",
                        aspectRatio === ratio ? "bg-emerald-500 border-emerald-500 text-black" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20")}>
                      {ratio === 'native' ? 'Orj' : ratio}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Üretim Adedi</label>
                <input type="number" value={imgCount} onChange={(e) => setImgCount(Number(e.target.value))} min={1} max={10}
                  className="w-16 bg-black/50 border border-white/10 rounded-lg text-center text-sm py-1.5" />
              </div>
            </div>
          </div>
        )}

        {/* STORY EXPANDED */}
        {expandedTab === 'story' && (
          <div className="h-full grid grid-cols-3 gap-6 p-6">
            {/* Sol (1/3): Ayarlar */}
            <div className="flex flex-col gap-5 overflow-y-auto pr-2">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Hayalin</label>
                <textarea value={storyDream} onChange={(e) => setStoryDream(e.target.value)}
                  placeholder="Senaryoya eklemek istediğiniz ekstra detaylar..."
                  className="w-full h-24 bg-black/50 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500 transition-all resize-none" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Ustalar</label>
                <div className="grid grid-cols-5 gap-1">
                  {Object.keys(PERSONAS).map(cat => (
                    <button key={cat} onClick={() => { setStoryPersonaCategory(cat); setStoryPersona(''); }}
                      className={cn("py-2 rounded-lg text-[8px] font-bold uppercase border transition-all",
                        storyPersonaCategory === cat ? "bg-amber-500 border-amber-500 text-black" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20")}>
                      {cat === 'cinema' ? 'Sinema' : cat === 'anime' ? 'Anime' : cat === 'photo' ? 'Foto' : cat === 'oil' ? 'Yağlı' : 'Özel'}
                    </button>
                  ))}
                </div>
                <select disabled={!storyPersonaCategory} value={storyPersona} onChange={(e) => setStoryPersona(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-amber-500 disabled:opacity-30">
                  <option value="">— Persona Seç —</option>
                  {storyPersonaCategory && Object.entries((PERSONAS as any)[storyPersonaCategory]).map(([key, p]: any) => (
                    <option key={key} value={key}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Görsel Stil</label>
                  <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 scale-90 origin-right">
                    <button onClick={() => setStoryStyleMode('direct')} className={cn("px-2 py-1 rounded text-[8px] font-bold uppercase", storyStyleMode === 'direct' ? "bg-white/10 text-white" : "text-zinc-600")}>Direkt</button>
                    <button onClick={() => setStoryStyleMode('flow')} className={cn("px-2 py-1 rounded text-[8px] font-bold uppercase", storyStyleMode === 'flow' ? "bg-white/10 text-white" : "text-zinc-600")}>Flow</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {STYLES.map(s => (
                    <button key={s.id} onClick={() => setStoryStyle(s.value)}
                      className={cn("py-2 px-1 rounded-lg text-[8px] font-bold uppercase border transition-all h-10 flex items-center justify-center",
                        storyStyle === s.value ? "bg-purple-500 border-purple-500 text-white" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20")}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">En / Boy Oranı</label>
                <div className="grid grid-cols-5 gap-1">
                  {['native', '1:1', '16:9', '9:16', 'manual'].map(ratio => (
                    <button key={ratio} onClick={() => setStoryAr(ratio)}
                      className={cn("py-2 rounded-lg text-[8px] font-bold uppercase border transition-all",
                        storyAr === ratio ? "bg-purple-500 border-purple-500 text-white" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20")}>
                      {ratio === 'native' ? 'Orj' : ratio}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sahne Ref</label>
                  <div className="aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
                    {storySceneRef ? (
                      <>
                        <img src={storySceneRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => setStorySceneRef(null)} className="p-2 bg-red-500 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                        <Camera className="w-5 h-5 text-zinc-700" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setStorySceneRef(ev.target?.result as string); r.readAsDataURL(f); }}} />
                      </label>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Karakter Ref</label>
                  <div className="aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
                    {storyCharRef ? (
                      <>
                        <img src={storyCharRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => setStoryCharRef(null)} className="p-2 bg-red-500 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                        <Plus className="w-5 h-5 text-zinc-700" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setStoryCharRef(ev.target?.result as string); r.readAsDataURL(f); }}} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Üretim Adedi</label>
                <input type="number" value={storyImgCount} onChange={(e) => setStoryImgCount(Number(e.target.value))} min={1} max={10}
                  className="w-16 bg-black/50 border border-white/10 rounded-lg text-center text-sm py-1.5" />
              </div>
            </div>
            {/* Sağ (2/3): Metin İçeriği */}
            <div className="col-span-2 flex flex-col gap-3">
              <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Metin İçeriği</label>
              <textarea
                value={editableStoryText}
                onChange={(e) => setEditableStoryText(e.target.value)}
                className="flex-1 bg-black/50 border border-white/10 rounded-xl p-4 text-xs font-mono leading-relaxed focus:outline-none focus:border-purple-500 transition-all resize-none"
                placeholder="Senaryo metni burada görünecek..."
              />
            </div>
          </div>
        )}

        {/* AUDIO EXPANDED — mevcut 5 sütunlu layout */}
        {expandedTab === 'audio' && (
          <div className="h-full grid grid-cols-5 gap-4 p-6">
            {[
              { id: 1, title: "Ses Dosyası", icon: Music, content: (
                <div className="space-y-4">
                  {!audioFile ? (
                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/10 rounded-2xl hover:bg-white/5 cursor-pointer transition-all group">
                      <Music className="w-12 h-12 mb-4 text-zinc-700 group-hover:text-purple-500 transition-colors" />
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Dosya Seç</p>
                      <input type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setAudioFile({ base64: (ev.target?.result as string).split(',')[1], mimeType: file.type, name: file.name });
                            setAudioStepStatus(prev => ({ ...prev, 1: 'done' }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                  ) : (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-4">
                      <p className="text-xs font-bold text-emerald-400 truncate">✓ {audioFile.name}</p>
                      <audio controls className="w-full h-8" src={`data:${audioFile.mimeType};base64,${audioFile.base64}`} />
                    </div>
                  )}
                </div>
              )},
              { id: 2, title: "Transkripsiyon", icon: FileText, content: (
                <textarea value={audioTranscript} readOnly className="w-full h-full bg-black/40 border border-white/5 rounded-2xl p-4 text-[10px] font-mono leading-relaxed resize-none focus:outline-none" placeholder="Bekleniyor..." />
              )},
              { id: 3, title: "Senaryo", icon: Layout, content: (
                <textarea value={audioScenario} readOnly className="w-full h-full bg-black/40 border border-white/5 rounded-2xl p-4 text-[10px] font-mono leading-relaxed resize-none focus:outline-none" placeholder="Bekleniyor..." />
              )},
              { id: 4, title: "Promptlar", icon: Sparkles, content: (
                <div className="space-y-2 overflow-y-auto h-full pr-2">
                  {audioPrompts.map((p, i) => (
                    <div key={i} className="p-3 bg-white/5 border border-white/5 rounded-xl text-[9px] font-mono text-zinc-400 leading-tight">{p}</div>
                  ))}
                </div>
              )},
              { id: 5, title: "Görseller", icon: ImageIcon, content: (
                <div className="grid grid-cols-2 gap-2 overflow-y-auto h-full pr-2">
                  {audioImages.map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden border border-white/10 bg-black">
                      <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
              )}
            ].map(step => (
              <div key={step.id} className={cn(
                "flex flex-col glass-panel overflow-hidden transition-all duration-500",
                audioStepStatus[step.id] === 'processing' && "border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.1)]",
                audioStepStatus[step.id] === 'done' && "border-emerald-500/30"
              )}>
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <step.icon className="w-3 h-3" /> {step.id}. {step.title}
                  </h3>
                  <div className={cn("w-2 h-2 rounded-full",
                    audioStepStatus[step.id] === 'pending' && "bg-zinc-800",
                    audioStepStatus[step.id] === 'processing' && "bg-yellow-500 animate-pulse",
                    audioStepStatus[step.id] === 'done' && "bg-emerald-500",
                    audioStepStatus[step.id] === 'error' && "bg-red-500"
                  )} />
                </div>
                <div className="flex-1 p-4 overflow-hidden">
                  {step.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CINEMA EXPANDED */}
        {expandedTab === 'cinema' && (
          <div className="h-full grid grid-cols-3 gap-6 p-6">
            {/* Sol (1/3): Refs */}
            <div className="flex flex-col gap-5 overflow-y-auto pr-2">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sahne Referansı</label>
                <div className="aspect-video rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
                  {cinemaSceneRef ? (
                    <>
                      <img src={cinemaSceneRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => setCinemaSceneRef(null)} className="p-2 bg-red-500 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                      <Camera className="w-8 h-8 text-zinc-700 mb-2" />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Görsel Yükle</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setCinemaSceneRef(ev.target?.result as string); r.readAsDataURL(f); }}} />
                    </label>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Karakter Ref</label>
                  <div className="aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
                    {cinemaCharRef ? (
                      <>
                        <img src={cinemaCharRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => setCinemaCharRef(null)} className="p-2 bg-red-500 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                        <Plus className="w-5 h-5 text-zinc-700" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setCinemaCharRef(ev.target?.result as string); r.readAsDataURL(f); }}} />
                      </label>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Varyasyon</label>
                  <input type="number" value={cinemaVarCount} onChange={(e) => setCinemaVarCount(Number(e.target.value))} min={1} max={5}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-center text-sm focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
            </div>
            {/* Sağ (2/3): Analiz sonuçları */}
            <div className="col-span-2 flex flex-col gap-3 overflow-hidden">
              <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                {cinemaAnalysis.length > 0 ? `Önerilen Çekimler (${cinemaAnalysis.length})` : 'Sahneyi Analiz Et'}
              </label>
              {cinemaAnalysis.length > 0 ? (
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {cinemaAnalysis.map((shot, i) => (
                    <div key={i} className={cn(
                      "flex items-center gap-4 p-4 border rounded-xl transition-all cursor-pointer",
                      selectedCinemaShots.includes(i) ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/5 hover:border-white/10"
                    )} onClick={() => {
                      if (selectedCinemaShots.includes(i)) setSelectedCinemaShots(selectedCinemaShots.filter(idx => idx !== i));
                      else setSelectedCinemaShots([...selectedCinemaShots, i]);
                    }}>
                      <input type="checkbox" checked={selectedCinemaShots.includes(i)} readOnly className="w-4 h-4 accent-emerald-500" />
                      <div className="flex-1">
                        <p className="text-sm font-bold">{shot.shot_name_tr}</p>
                        <p className="text-[10px] text-zinc-500 uppercase mt-0.5">{shot.shot_type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-zinc-700 text-sm">Sahne yükle ve analiz et butonuna tıkla</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </motion.div>
  )}
</AnimatePresence>
```

---

## Task 8: Eski Story Modal ve Audio Modal bloklarını sil

**Files:**
- Modify: `src/App.tsx:1256-1582`

**Step 1:** Şu iki AnimatePresence bloğunu tamamen sil:
- `{/* STORY SETTINGS MODAL */}` bloğu (satır ~1256-1475)
- `{/* AUDIO PIPELINE MODAL */}` bloğu (satır ~1477-1582)

Bu bloklar Task 7'deki Expanded View ile replace edildi.

**Step 2:** TypeScript lint çalıştır:
```bash
cd "C:/Users/semihcagatay/CLAUDE/Semsei-Ai" && npm run lint 2>&1
```
Beklenen: Hata yok (veya sadece `any` tip uyarıları — bu kabul edilebilir).

**Step 3:** Dev server başlat ve tüm sekmeleri manuel test et:
```bash
cd "C:/Users/semihcagatay/CLAUDE/Semsei-Ai" && npm run dev
```

Kontrol listesi:
- [ ] Manuel sekmesi: compact view değişmemiş, Maximize2 butonu görünüyor, expand çalışıyor
- [ ] Senaryo sekmesi: dosya yükleme inline görünüyor, modal açılmıyor, footer butonu var
- [ ] Senaryo expanded: 3 sütun layout (ayarlar | metin) görünüyor
- [ ] Audio sekmesi: ses yükleme inline, progress göstergesi var, footer butonu var
- [ ] Audio expanded: 5 sütun pipeline görünüyor
- [ ] Sinema sekmesi: 2 col ref grid, footer analiz/başlat butonu
- [ ] Sinema expanded: 3 sütun (ref + analiz sonuçları)
- [ ] Tüm sekmelerde Maximize2 butonu aynı konumda
- [ ] `Escape` değil, X butonu ile expanded kapanıyor ✓
