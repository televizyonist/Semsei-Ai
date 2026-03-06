# Tab UI Consistency — Tasarım Dokümanı

**Tarih:** 2026-03-06
**Konu:** Manuel, Senaryo, Audio, Sinema sekmelerinin UI/UX tutarlılığı

---

## Problem

Dört sekmenin UI mimarisi birbirinden farklı:
- **Manuel** → Tam inline kontrol paneli. Referans tasarım.
- **Senaryo** → Dosya dropzone görünür, ayarlar tam ekran modal'da açılıyor (`isStoryModalOpen`).
- **Audio** → Sadece açıklama + "Pipeline'ı Aç" butonu; asıl içerik tam ekran modal'da (`isAudioPipelineOpen`).
- **Sinema** → Kısmen inline, ama buton boyutları/yapısı Manuel ile tutarsız.

## Hedef

Tüm sekmeler iki modda çalışsın:
1. **Compact Mode** — Mevcut sağ panel (w-96) içinde, Manuel sekmesi referansıyla tutarlı inline kontrol paneli.
2. **Expanded Mode** — Tam ekran workspace (fixed inset-0 z-[100]), sekmeye özel detaylı çalışma alanı.

---

## Tasarım Kararları

### Expand Mekanizması

- Her sekme header'ında (tab switcher'ın hemen altında) sağ köşede `Maximize2` ikonu.
- State: `isExpanded: boolean` — her sekme bağımsız state tutar (veya tek `expandedTab` state).
- Expanded view kapanışı: sağ üst köşede `X` butonu, `Escape` key de çalışır.
- Transition: `motion` ile `opacity + scale` animasyon (mevcut modal pattern ile aynı).

### Buton Tutarlılığı (Tüm Sekmeler)

| Element | Class |
|---------|-------|
| Label | `text-[10px] font-bold text-[color]-400 uppercase tracking-widest` |
| Textarea | `w-full h-24 bg-black/50 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-[color]-500 transition-all resize-none` |
| Grid buton | `py-2 rounded-lg text-[8px] font-bold uppercase border transition-all` |
| Select | `w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] focus:outline-none` |
| Ref görsel kutusu | `aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group` |
| Action butonu (footer) | `w-full py-4 btn-premium uppercase tracking-[0.2em] text-xs font-bold` |
| Footer container | `p-4 border-t border-white/5 bg-black/20 space-y-3` |

---

## Sekme Detayları

### Manuel Sekmesi

**Compact (değişmez — referans):**
- Mode switcher (single/multi/maxi)
- Hayalin textarea
- Prompt textarea
- Ustalar (persona kategori grid + select)
- Aspect Ratio grid
- Görsel Stil (Direkt/Flow toggle + stil grid)
- Sahne Ref / Karakter Ref (2 col grid)
- Footer: Üretim Adedi + OLUŞTUR butonu

**Expanded — Değişiklik:**
- Sadece `Maximize2` butonu eklenir header'a
- Layout: İki sütun
  - Sol (1/2): Hayalin + Prompt (büyük textarea, h-40)
  - Sağ (1/2): Ustalar + Stil + Aspect Ratio dikey
  - Alt satır (full): Sahne Ref + Karakter Ref + seed ayarları
- Footer: aynı

---

### Senaryo Sekmesi

**`isStoryModalOpen` state ve Story Settings Modal tamamen kaldırılır.**

**Compact:**
```
[Dosya Yükle Dropzone — küçük, h-24]
[Hayalin textarea]
[Ustalar — kategori grid + select]
[Görsel Stil — toggle + grid]
[Aspect Ratio grid]
[Sahne Ref | Karakter Ref — 2 col]
Footer: [Üretim Adedi] [Analiz Et ve Başlat]
```

**Expanded:**
- Sol panel (1/3, dar): Hayalin + Ustalar + Stil + AR + Refs + Üretim Adedi
- Sağ alan (2/3, geniş): Metin içeriği (büyük editable textarea, h-full)
- Footer: İptal + "Analiz Et ve Başlat"

---

### Audio Sekmesi

**`isAudioPipelineOpen` state ve modal kaldırılır. `setIsAudioPipelineOpen(true)` çağrıları `setIsExpanded(true)` olur.**

**Compact:**
```
[Ses Dosyası Yükleme — küçük dropzone]
[Step Progress — 5 nokta göstergesi]
  ● SES  ○ METİN  ○ SENARYO  ○ PROMPT  ○ GÖRSEL
Footer: [Pipeline Başlat] butonu
```

**Expanded (değişmez — mevcut 5 sütunlu layout):**
- Header: başlık + "Tümünü Başlat" + X (close)
- 5 sütun: Ses | Transkripsiyon | Senaryo | Promptlar | Görseller
- Mevcut UI korunur

---

### Sinema Sekmesi

**Compact — Manuel ile aynı pattern:**
```
[Sahne Ref — aspect-video]
[Karakter Ref — 2 col grid: aspect-square (dar)]
[Persona — kategori grid + select]  ← YENİ EKLEME
Footer: [Sahneyi Analiz Et] butonu (py-4, full width)
[Analiz sonrası: çekim listesi + Çekimleri Başlat]
```

**Expanded:**
- Sol panel (1/3): Sahne Ref (büyük) + Karakter Ref + Persona seçimi
- Sağ alan (2/3): Analiz sonuçları büyük grid + çekim checkbox listesi
- Footer: "Çekimleri Başlat"

---

## State Değişiklikleri

### Kaldırılacak State
- `isStoryModalOpen` → kaldırılır
- `isAudioPipelineOpen` → kaldırılır

### Eklenecek State
```typescript
const [expandedTab, setExpandedTab] = useState<'manual' | 'story' | 'audio' | 'cinema' | null>(null);
```

### Kaldırılacak JSX
- Story Settings Modal (line 1256–1475)
- Audio Pipeline Modal (line 1477–1582)

### Korunacak JSX
- Audio Pipeline içeriği (5 sütunlu layout) → expanded view olarak taşınır
- Story modal içeriği → expanded view olarak yeniden düzenlenir

---

## Silinen Modallar için Geçiş

`handleTextUpload()` → Dosya yüklenince `setIsStoryModalOpen(true)` yerine doğrudan story state'ini set et, expanded view açılmasın (kullanıcı kendisi açar).

---

## Dosya Etkisi

Sadece `src/App.tsx` değişir. Yeni dosya oluşturulmaz.
