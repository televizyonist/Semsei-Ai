/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Sparkles, 
  Image as ImageIcon, 
  Download, 
  Loader2, 
  History,
  Maximize2,
  Trash2,
  Layout,
  Camera,
  Music,
  FileText,
  Settings,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Info,
  Monitor,
  Share2,
  Square,
  Play,
  RotateCcw,
  Ghost
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import JSZip from 'jszip';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { PERSONAS, STYLES } from './constants';
import { generateImageLocal, generateTextLocal, analyzeImageLocal, transcribeAudioLocal } from './server/localAI';

// PDF.js Worker Setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey?: () => Promise<boolean>;
      openSelectKey?: () => Promise<void>;
    };
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'manual' | 'story' | 'audio' | 'cinema'>('manual');
  const [genMode, setGenMode] = useState<'single' | 'multi' | 'maxi'>('single');
  const [imageQueue, setImageQueue] = useState<QueueItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isQueuePaused, setIsQueuePaused] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [cooldownProgress, setCooldownProgress] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [logs, setLogs] = useState<{ id: string; sender: string; msg: string; type: string; time: string }[]>([]);
  const [isLogsMinimized, setIsLogsMinimized] = useState(true);
  
  // Inputs
  const [requestInput, setRequestInput] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [aspectRatio, setAspectRatio] = useState('native');
  const [manualAr, setManualAr] = useState({ width: 1024, height: 1024 });
  const [seed, setSeed] = useState<number | ''>('');
  const [isRandomSeed, setIsRandomSeed] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState('');
  const [styleMode, setStyleMode] = useState<'direct' | 'flow'>('direct');
  const [imgCount, setImgCount] = useState(1);
  const [selectedPersona, setSelectedPersona] = useState('');
  const [selectedPersonaCategory, setSelectedPersonaCategory] = useState('');

  // References
  const [sceneRef, setSceneRef] = useState<string | null>(null);
  const [charRef, setCharRef] = useState<string | null>(null);
  const [maskedImage, setMaskedImage] = useState<string | null>(null);
  const [isMaskActive, setIsMaskActive] = useState(false);
  const [hasSelectedKey, setHasSelectedKey] = useState(false);

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

  // Local AI mode
  const [localMode, setLocalMode] = useState(() => localStorage.getItem('localMode') === 'true');

  // Story State
  const [storyText, setStoryText] = useState<string | null>(null);
  const [storyFileName, setStoryFileName] = useState('');
  const [storyUrl, setStoryUrl] = useState('');
  const [isProcessAll, setIsProcessAll] = useState(true);
  const [editableStoryText, setEditableStoryText] = useState('');
  const [storyDream, setStoryDream] = useState('');
  const [storyAr, setStoryAr] = useState('native');
  const [storyManualAr, setStoryManualAr] = useState({ width: 1024, height: 1024 });
  const [storyPersona, setStoryPersona] = useState('');
  const [storyPersonaCategory, setStoryPersonaCategory] = useState('');
  const [storyStyle, setStoryStyle] = useState('');
  const [storyStyleMode, setStoryStyleMode] = useState<'direct' | 'flow'>('direct');
  const [storyImgCount, setStoryImgCount] = useState(1);
  const [storySceneRef, setStorySceneRef] = useState<string | null>(null);
  const [storyCharRef, setStoryCharRef] = useState<string | null>(null);

  // Cinema State
  const [cinemaSceneRef, setCinemaSceneRef] = useState<string | null>(null);
  const [cinemaVarCount, setCinemaVarCount] = useState(1);
  const [cinemaAnalysis, setCinemaAnalysis] = useState<any[]>([]);
  const [isCinemaAnalyzing, setIsCinemaAnalyzing] = useState(false);
  const [selectedCinemaShots, setSelectedCinemaShots] = useState<number[]>([]);

  // Maxi State
  const [maxiSelectedMasters, setMaxiSelectedMasters] = useState<string[]>([]);
  const [maxiImgCount, setMaxiImgCount] = useState(1);
  const [maxiAr, setMaxiAr] = useState('native');
  const [maxiStyle, setMaxiStyle] = useState('');
  const [maxiMode, setMaxiMode] = useState<'direct' | 'flow'>('direct');

  // Audio Pipeline State
  const [audioFile, setAudioFile] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [audioTranscript, setAudioTranscript] = useState('');
  const [audioScenario, setAudioScenario] = useState('');
  const [audioPrompts, setAudioPrompts] = useState<string[]>([]);
  const [audioImages, setAudioImages] = useState<string[]>([]);
  const [audioStepStatus, setAudioStepStatus] = useState<Record<number, 'pending' | 'processing' | 'done' | 'error'>>({
    1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending'
  });

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasSelectedKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasSelectedKey(true);
    }
  };

  // --- HELPERS ---

  const logMessage = (sender: string, msg: string, type = 'info') => {
    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ id: Math.random().toString(36).substr(2, 9), sender, msg, type, time }, ...prev]);
  };

  const startCooldown = (seconds: number) => {
    setIsCoolingDown(true);
    setCooldownProgress(100);
    setCooldownSeconds(seconds);
    
    const startTime = Date.now();
    const duration = seconds * 1000;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const progress = (remaining / duration) * 100;
      
      setCooldownProgress(progress);
      setCooldownSeconds(Math.ceil(remaining / 1000));
      
      if (remaining <= 0) {
        clearInterval(interval);
        setIsCoolingDown(false);
        setCooldownProgress(0);
        setCooldownSeconds(0);
      }
    }, 100);
  };

  const getActiveApiKey = () => {
    if (customApiKey.trim().length > 5) return customApiKey;
    return (process.env as any).API_KEY || process.env.GEMINI_API_KEY!;
  };

  const generateRandomSeed = () => Math.floor(Math.random() * 2000000000);

  const parseRatio = (ratioStr: string) => {
    if (!ratioStr || ratioStr === 'native') return null;
    if (ratioStr.startsWith('manual:')) {
      const parts = ratioStr.split(':');
      const w = parseInt(parts[1]);
      const h = parseInt(parts[2]);
      return h !== 0 ? w / h : 1;
    }
    const parts = ratioStr.split(':');
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    return h !== 0 ? w / h : 1;
  };

  const createBlankCanvas = (ratioStr: string) => {
    let w, h;
    if (ratioStr.startsWith('manual:')) {
      const parts = ratioStr.split(':');
      w = parseInt(parts[1]) || 1024;
      h = parseInt(parts[2]) || 1024;
    } else {
      const ratio = parseRatio(ratioStr);
      if (!ratio) return null;
      const baseSize = 1024;
      if (ratio > 1) { w = Math.round(baseSize * ratio); h = baseSize; }
      else { w = baseSize; h = Math.round(baseSize / ratio); }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h); }
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const prepareCanvasWithRatio = async (refImageBase64: string, ratioStr: string) => {
    if (!refImageBase64 || ratioStr === 'native') return refImageBase64;
    const targetRatio = parseRatio(ratioStr);
    if (!targetRatio) return refImageBase64;

    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const inputRatio = img.width / img.height;
        let canvasW, canvasH;
        if (inputRatio > targetRatio) {
          canvasW = img.width; canvasH = Math.round(img.width / targetRatio);
        } else {
          canvasH = img.height; canvasW = Math.round(img.height * targetRatio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = canvasW; canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvasW, canvasH);
          const x = (canvasW - img.width) / 2; const y = (canvasH - img.height) / 2;
          ctx.drawImage(img, x, y);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.src = refImageBase64;
    });
  };

  // --- API CALLS ---

  const callGeminiAPI = async (fullPrompt: string, inputImageBase64: string | null = null, charRefBase64: string | null | boolean = null, signal?: AbortSignal) => {
    const activeKey = getActiveApiKey();
    const ai = new GoogleGenAI({ apiKey: activeKey });

    const modelsToTry = [
      { name: 'gemini-2.5-flash-image', type: 'gemini' },
      { name: 'imagen-4.0-generate-001', type: 'imagen' }
    ];

    let lastError;

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelInfo = modelsToTry[i];
      try {
        if (i > 0) {
          logMessage('SİSTEM', `Kota dolduğu için alternatif modele geçiliyor: ${modelInfo.name}`, 'info');
        }

        if (modelInfo.type === 'gemini') {
          const contentParts: any[] = [{ text: fullPrompt }];

          // Character Ref
          const effectiveCharRef = (charRefBase64 === false) ? null : (typeof charRefBase64 === 'string' ? charRefBase64 : charRef);
          if (effectiveCharRef) {
            let charMime = "image/jpeg";
            if (effectiveCharRef.startsWith("data:image/png")) charMime = "image/png";
            contentParts.push({ text: "Character Reference Image:" });
            contentParts.push({ inlineData: { mimeType: charMime, data: effectiveCharRef.split(',')[1] } });
          }

          // Scene Ref
          if (inputImageBase64) {
            let mimeType = "image/jpeg";
            if (inputImageBase64.startsWith("data:image/png")) mimeType = "image/png";
            contentParts.push({ text: "Scene/Composition Reference Image:" });
            contentParts.push({ inlineData: { mimeType: mimeType, data: inputImageBase64.split(',')[1] } });
          }

          const response = await ai.models.generateContent({
            model: modelInfo.name,
            contents: { parts: contentParts },
            config: { responseModalities: ['IMAGE'] },
          });

          const base64Data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
          if (!base64Data) throw new Error("Görsel verisi alınamadı.");
          return `data:image/png;base64,${base64Data}`;
        } else if (modelInfo.type === 'imagen') {
          // Imagen fallback
          const response = await ai.models.generateImages({
              model: modelInfo.name,
              prompt: fullPrompt,
              config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
              },
          });
          const base64Data = response.generatedImages?.[0]?.image?.imageBytes;
          if (!base64Data) throw new Error("Görsel verisi alınamadı.");
          return `data:image/jpeg;base64,${base64Data}`;
        }
      } catch (err: any) {
        lastError = err;
        if (err.name === 'AbortError') throw err;
        
        // Hata ne olursa olsun (kota, server hatası vs.) bir sonraki modele geç
        if (i < modelsToTry.length - 1) {
          console.warn(`Model ${modelInfo.name} başarısız oldu, alternatif deneniyor... Hata:`, err.message || err);
          continue;
        }
        
        throw err;
      }
    }
    
    throw lastError;
  };

  const fetchPromptFromGemini = async (dreamText: string, personaKey: string) => {
    const personaPrompt = personaKey ? (Object.values(PERSONAS).flatMap(c => Object.entries(c)).find(([k]) => k === personaKey)?.[1] as any)?.prompt : "Standard visual interpretation.";

    const instruction = `You are an expert prompt engineer. User Input: "${dreamText}" ${personaPrompt}
    Task: Convert into high-quality Stable Diffusion style prompt in English and Turkish explanation.
    Output JSON: { "english_prompt": "...", "turkish_explanation": "..." }`;

    if (localMode) {
      const text = await generateTextLocal({ prompt: instruction, json: true });
      return JSON.parse(text);
    }

    const activeKey = getActiveApiKey();
    const ai = new GoogleGenAI({ apiKey: activeKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: instruction,
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || '{}');
  };

  // --- QUEUE LOGIC ---

  const createQueueItem = (prompt: string, overrideTitle: string | null = null, settings: any = {}, meta: any = {}, autoSelect = true, overrideRefs: any = null) => {
    const currentSeed = isRandomSeed ? generateRandomSeed() : Number(seed);
    const effectiveMode = settings.mode || styleMode;
    const effStyle = settings.style || "";
    const effectiveAspectRatio = settings.aspectRatio || aspectRatio;

    let useSceneRef = overrideRefs ? overrideRefs.refImage : sceneRef;
    const useMasked = overrideRefs ? overrideRefs.maskedImage : (isMaskActive ? maskedImage : null);
    const useMaskActive = overrideRefs ? (!!overrideRefs.maskedImage) : isMaskActive;
    let useCharRef = overrideRefs ? overrideRefs.charRefImage : charRef;

    if (meta && meta.is_main_char_present === false) useCharRef = null;

    if (!useSceneRef && effectiveAspectRatio && effectiveAspectRatio !== 'native') {
      useSceneRef = createBlankCanvas(effectiveAspectRatio);
    }

    const isCinemaMode = !!(settings.isCinemaMode);
    let visualPrompt = prompt;
    
    let parts = [];
    if (isCinemaMode) {
      parts.push("You are a camera operator. Fixed positions. Move camera only.");
      if (useCharRef) parts.push("Preserve face identity.");
      parts.push(visualPrompt);
    } else {
      if (useCharRef) parts.push("CHARACTER REFERENCE AUTHORITY: Use provided face.");
      if (useMaskActive && useMasked) parts.push("INSTRUCTION: Modify masked area only.");
      else if (useSceneRef) parts.push("SCENE COMPOSITION GUIDE: Use structural reference.");
      parts.push(visualPrompt);
    }

    if (effectiveMode === 'direct' && effStyle) {
      parts.push(`Style: ${effStyle}`);
    }

    const cleanPrompt = parts.join(". ");

    const item: QueueItem = {
      id: Math.random().toString(36).substr(2, 9),
      cleanPrompt,
      originalPromptText: visualPrompt,
      prompt,
      seed: currentSeed,
      status: 'pending',
      retryCount: 0,
      refImage: useSceneRef,
      charRefImage: useCharRef || undefined,
      maskedImage: useMaskActive ? useMasked : null,
      resultBase64: null,
      timestamp: new Date(),
      displayName: overrideTitle || `Artwork #${imageQueue.length + 1}`,
      meta,
      styleConfig: (effectiveMode === 'flow' && effStyle) ? { prompt: effStyle, name: "Flow Style" } : null,
      isStyled: false,
      styleName: effStyle ? "Stil" : "Yok",
      groupId: settings.groupId || null,
      groupName: settings.groupName || null,
      aspectRatio: effectiveAspectRatio
    };

    setImageQueue(prev => [item, ...prev]);
    if (autoSelect) setSelectedItemId(item.id);
  };

  useEffect(() => {
    if (!isProcessing && !isQueuePaused && !isCoolingDown) {
      const nextItem = imageQueue.find(i => i.status === 'pending');
      if (nextItem) {
        processItem(nextItem);
      } else if (imageQueue.length > 0 && imageQueue.every(i => i.status === 'completed' || i.status === 'error')) {
        if (genMode === 'maxi' || cinemaAnalysis.length > 0) {
          setIsJobCompleteModalOpen(true);
        }
      }
    }
  }, [imageQueue, isProcessing, isQueuePaused, isCoolingDown]);

  const processItem = async (item: QueueItem) => {
    setIsProcessing(true);
    setImageQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i));
    
    abortControllerRef.current = new AbortController();

    try {
      logMessage('SİSTEM', `"${item.displayName}" oluşturuluyor...`, 'info');
      let baseInput = item.maskedImage || item.refImage;
      if (baseInput && item.aspectRatio !== 'native') {
        baseInput = await prepareCanvasWithRatio(baseInput, item.aspectRatio);
      }

      let result: string;
      if (localMode) {
        const sceneBase64 = baseInput?.split(',')[1] ?? undefined;
        const charBase64 = typeof item.charRefImage === 'string' ? item.charRefImage.split(',')[1] : undefined;
        const { imageBase64 } = await generateImageLocal({
          prompt: item.cleanPrompt,
          seed: item.seed,
          sceneRefBase64: sceneBase64,
          charRefBase64: charBase64,
        });
        result = `data:image/png;base64,${imageBase64}`;
      } else {
        result = await callGeminiAPI(item.cleanPrompt, baseInput, item.charRefImage, abortControllerRef.current.signal);
      }
      
      setImageQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed', resultBase64: result } : i));
      logMessage('BAŞARI', `"${item.displayName}" tamamlandı.`, 'success');

      // Auto Style Transfer
      if (item.styleConfig) {
        const stylePrompt = `Apply ${item.styleConfig.prompt} style to the provided image. Maintain the original content: ${item.originalPromptText}`;
        createQueueItem(stylePrompt, `${item.displayName} (Stilize)`, { mode: 'direct' }, item.meta, false, { refImage: result });
      }

      startCooldown(12); // 12 saniye bekleme süresi

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setImageQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'pending' } : i));
      } else {
        let errorMsg = err.message;
        if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
          errorMsg = "Kota doldu. Lütfen kendi API anahtarınızı seçin.";
          logMessage('SİSTEM', "Kota aşımı! Ücretli bir proje anahtarı seçmeniz önerilir.", 'error');
          startCooldown(30); // Hata durumunda daha uzun bekle
        } else {
          startCooldown(5);
        }
        setImageQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', errorMsg: errorMsg } : i));
        logMessage('HATA', errorMsg, 'error');
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  // --- ACTIONS ---

  const handleGenerateManual = async () => {
    if (genMode === 'maxi') {
      setIsMaxiModalOpen(true);
      return;
    }

    if (genMode === 'multi') {
      logMessage('MULTI', `${imgCount} varyasyon üretiliyor...`, 'info');
      for (let i = 0; i < imgCount; i++) {
        const result = await fetchPromptFromGemini(requestInput, selectedPersona);
        createQueueItem(result.english_prompt, `Varyasyon #${i + 1}`, { style: selectedStyle }, { source_text: requestInput, turkish_explanation: result.turkish_explanation }, i === 0);
      }
      return;
    }

    // Single
    if (!promptInput) {
      logMessage('SİSTEM', 'Prompt üretiliyor...', 'info');
      const result = await fetchPromptFromGemini(requestInput, selectedPersona);
      setPromptInput(result.english_prompt);
      createQueueItem(result.english_prompt, null, { style: selectedStyle }, { source_text: requestInput, turkish_explanation: result.turkish_explanation });
    } else {
      createQueueItem(promptInput, null, { style: selectedStyle });
    }
  };

  const handleStoryStart = async () => {
    if (!storyText) return;
    logMessage('SENARYO', 'Metin analiz ediliyor...', 'info');
    
    try {
      const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
      
      const personaPrompt = storyPersona ? (Object.values(PERSONAS).flatMap(c => Object.entries(c)).find(([k]) => k === storyPersona)?.[1] as any)?.prompt : "";
      
      const instruction = `Analyze this story and extract visual scenes. 
      Story: ${editableStoryText}
      ${storyDream ? `Additional User Dream/Details: ${storyDream}` : ''}
      ${personaPrompt ? `Apply this persona/style guide to the generated prompts: ${personaPrompt}` : ''}
      Output JSON array of objects with 'scene_id', 'english_prompt', 'turkish_explanation', 'source_text'.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: instruction,
        config: { responseMimeType: "application/json" }
      });
      const scenes = JSON.parse(response.text || '[]');
      logMessage('SENARYO', `${scenes.length} sahne bulundu.`, 'success');
      
      scenes.forEach((s: any, idx: number) => {
        for (let i = 0; i < storyImgCount; i++) {
          createQueueItem(
            s.english_prompt, 
            `Sahne ${s.scene_id}${storyImgCount > 1 ? ` (Var ${i+1})` : ''}`, 
            { 
              aspectRatio: storyAr === 'manual' ? `manual:${storyManualAr.width}:${storyManualAr.height}` : storyAr,
              style: storyStyle,
              mode: storyStyleMode
            }, 
            { 
              source_text: s.source_text, 
              turkish_explanation: s.turkish_explanation 
            }, 
            idx === 0 && i === 0,
            { refImage: storySceneRef, charRefImage: storyCharRef }
          );
        }
      });
    } catch (err: any) {
      logMessage('HATA', err.message, 'error');
    }
  };

  const handleCinemaAnalyze = async () => {
    if (!cinemaSceneRef) return;
    setIsCinemaAnalyzing(true);
    try {
      const cinemaPrompt = "Analyze this scene and suggest 10 cinematic camera angles. Output JSON array of objects with shot_type, shot_name_tr, english_prompt, turkish_explanation, is_char_visible, shot_icon.";
      let shots: any[];
      if (localMode) {
        const imageBase64 = cinemaSceneRef.split(',')[1];
        const raw = await analyzeImageLocal(imageBase64, cinemaPrompt);
        shots = JSON.parse(raw);
      } else {
        const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: cinemaPrompt,
          config: { responseMimeType: "application/json" }
        });
        shots = JSON.parse(response.text || '[]');
      }
      setCinemaAnalysis(shots);
      setSelectedCinemaShots(shots.map((_: any, i: number) => i));
    } catch (err: any) {
      logMessage('HATA', err.message, 'error');
    } finally {
      setIsCinemaAnalyzing(false);
    }
  };

  const handleCinemaStart = () => {
    const shots = cinemaAnalysis.filter((_, i) => selectedCinemaShots.includes(i));
    shots.forEach((s, idx) => {
      createQueueItem(s.english_prompt, `🎬 ${s.shot_name_tr}`, { isCinemaMode: true }, { turkish_explanation: s.turkish_explanation }, idx === 0, { refImage: cinemaSceneRef });
    });
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const completed = imageQueue.filter(i => i.status === 'completed' && i.resultBase64);
    completed.forEach(item => {
      const data = item.resultBase64!.split(',')[1];
      zip.file(`${item.displayName.replace(/\s+/g, '_')}.png`, data, { base64: true });
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'Semsei_Batch.zip';
    link.click();
  };

  // --- FILE HANDLERS ---

  const handleTextUpload = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    setStoryFileName(file.name);
    
    if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n\n";
      }
      setStoryText(fullText);
      setEditableStoryText(fullText);
      setActiveTab('story');
      setExpandedTab('story');
    } else if (extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      setStoryText(result.value);
      setEditableStoryText(result.value);
      setActiveTab('story');
      setExpandedTab('story');
    } else {
      const text = await file.text();
      setStoryText(text);
      setEditableStoryText(text);
      setActiveTab('story');
      setExpandedTab('story');
    }
  };

  // --- AUDIO PIPELINE LOGIC ---

  const runAudioPipeline = async () => {
    if (!audioFile) return;
    setAudioStepStatus(prev => ({ ...prev, 2: 'processing' }));
    
    try {
      let transcript: string;

      if (localMode) {
        // 1. Transcribe via Whisper
        const result = await transcribeAudioLocal(audioFile.base64);
        transcript = result.text;
      } else {
        const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
        const transResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            { text: 'Transcribe this audio file accurately. Label speakers.' },
            { inlineData: { mimeType: audioFile.mimeType, data: audioFile.base64 } }
          ]
        });
        transcript = transResponse.text || '';
      }
      setAudioTranscript(transcript);
      setAudioStepStatus(prev => ({ ...prev, 2: 'done', 3: 'processing' }));

      // 2. Scenario
      let scenario: string;
      if (localMode) {
        scenario = await generateTextLocal({
          prompt: `Create a visual storyboard from this transcript. Output JSON array of scenes. Transcript: ${transcript}`,
          json: true,
        });
      } else {
        const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
        const scenResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Create a visual storyboard from this transcript. Output JSON array of scenes. Transcript: ${transcript}`,
          config: { responseMimeType: "application/json" }
        });
        scenario = scenResponse.text || '';
      }
      setAudioScenario(scenario);
      setAudioStepStatus(prev => ({ ...prev, 3: 'done', 4: 'processing' }));

      // 3. Prompts
      let prompts: string[];
      if (localMode) {
        const raw = await generateTextLocal({
          prompt: `Convert these scenes into English image prompts. Output JSON array of strings. Scenes: ${scenario}`,
          json: true,
        });
        prompts = JSON.parse(raw);
      } else {
        const ai = new GoogleGenAI({ apiKey: getActiveApiKey() });
        const promptResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Convert these scenes into English image prompts. Output JSON array of strings. Scenes: ${scenario}`,
          config: { responseMimeType: "application/json" }
        });
        prompts = JSON.parse(promptResponse.text || '[]');
      }
      setAudioPrompts(prompts);
      setAudioStepStatus(prev => ({ ...prev, 4: 'done', 5: 'processing' }));

      // 4. Images
      const images: string[] = [];
      for (const p of prompts) {
        let img: string;
        if (localMode) {
          const { imageBase64 } = await generateImageLocal({ prompt: p });
          img = `data:image/png;base64,${imageBase64}`;
        } else {
          img = await callGeminiAPI(p);
        }
        images.push(img);
        setAudioImages([...images]);
        createQueueItem(p, `Audio Scene ${images.length}`, {}, { source_text: "Audio Pipeline" }, false);
      }
      setAudioStepStatus(prev => ({ ...prev, 5: 'done' }));

    } catch (err: any) {
      logMessage('HATA', err.message, 'error');
    }
  };

  // --- RENDER HELPERS ---

  const selectedItem = useMemo(() => imageQueue.find(i => i.id === selectedItemId), [imageQueue, selectedItemId]);

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-[#ececec] font-sans overflow-hidden p-4 gap-4">
      
      {/* LEFT PANEL: GALLERY & QUEUE */}
      <div className="w-80 flex flex-col glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <History className="w-4 h-4" /> Galeri / Kuyruk
          </h2>
          <div className="flex gap-1 items-center">
            <button onClick={() => setIsAboutModalOpen(true)} className="text-[9px] font-bold text-zinc-500 hover:text-white transition-colors mr-2">HAKKINDA</button>
            <button onClick={handleDownloadAll} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Tümünü İndir"><Download className="w-4 h-4" /></button>
            <button onClick={() => setIsQueuePaused(!isQueuePaused)} className="p-1.5 hover:bg-white/10 rounded transition-colors" title={isQueuePaused ? "Devam Et" : "Durdur"}>
              {isQueuePaused ? <Play className="w-4 h-4 text-green-500" /> : <Square className="w-4 h-4 text-yellow-500" />}
            </button>
            <button onClick={() => setImageQueue([])} className="p-1.5 hover:bg-white/10 rounded transition-colors text-red-500" title="Temizle"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {imageQueue.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-50 text-center p-8">
              <ImageIcon className="w-12 h-12 mb-2" />
              <p className="text-[10px] uppercase tracking-widest">Kuyruk Boş</p>
            </div>
          ) : (
            imageQueue.map(item => (
              <motion.div
                layout
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={cn(
                  "p-2 rounded-xl border cursor-pointer transition-all flex items-center gap-3 group relative",
                  selectedItemId === item.id ? "bg-white/10 border-white/20" : "bg-white/5 border-white/5 hover:border-white/10",
                  item.status === 'processing' && "border-yellow-500/50 bg-yellow-500/5",
                  item.status === 'completed' && "border-green-500/50 bg-green-500/5",
                  item.status === 'error' && "border-red-500/50 bg-red-500/5"
                )}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-white/5">
                  {item.resultBase64 ? (
                    <img src={item.resultBase64} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : item.refImage ? (
                    <img src={item.refImage} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-zinc-800" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate">{item.displayName}</p>
                  <p className={cn(
                    "text-[9px] uppercase font-medium",
                    item.status === 'pending' && "text-zinc-500",
                    item.status === 'processing' && "text-yellow-500 animate-pulse",
                    item.status === 'completed' && "text-green-500",
                    item.status === 'error' && "text-red-500"
                  )}>
                    {item.status === 'pending' ? 'Bekliyor' : item.status === 'processing' ? 'İşleniyor' : item.status === 'completed' ? 'Tamamlandı' : 'Hata'}
                  </p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setImageQueue(prev => prev.filter(i => i.id !== item.id)); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded text-red-500 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))
          )}
        </div>

        {/* COOLDOWN PROGRESS */}
        <AnimatePresence>
          {isCoolingDown && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 pb-3 border-t border-white/5 bg-black/20 pt-3"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Kota Beklemesi
                </span>
                <span className="text-[10px] font-mono text-zinc-400">{cooldownSeconds}s</span>
              </div>
              <div className="h-1.5 w-full bg-black rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="h-full bg-yellow-500"
                  style={{ width: `${cooldownProgress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* API KEY / LOCAL MODE */}
        <div className="p-3 border-t border-white/5 bg-black/20 space-y-3">
          {/* Local Mode Toggle */}
          <button
            onClick={() => {
              const next = !localMode;
              setLocalMode(next);
              localStorage.setItem('localMode', String(next));
            }}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-between gap-2 border",
              localMode
                ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                : "bg-black/30 border-white/10 text-zinc-500 hover:border-white/20"
            )}
          >
            <span className="flex items-center gap-2">
              <Monitor className="w-3 h-3" />
              {localMode ? "Lokal Mod Aktif" : "Bulut Modu Aktif"}
            </span>
            <span className={cn(
              "w-7 h-4 rounded-full relative transition-colors",
              localMode ? "bg-violet-500" : "bg-zinc-700"
            )}>
              <span className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                localMode ? "translate-x-3.5" : "translate-x-0.5"
              )} />
            </span>
          </button>

          {!localMode && (
            <>
              {!hasSelectedKey && (
                <button
                  onClick={handleOpenKeySelector}
                  className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3 h-3" /> Ücretli API Anahtarı Seç
                </button>
              )}
              <input
                type="password"
                placeholder="Manuel API Key (Opsiyonel)..."
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-[10px] focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </>
          )}
        </div>
      </div>

      {/* CENTER PANEL: PREVIEW */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex-1 glass-panel relative overflow-hidden flex flex-col items-center justify-center p-8">
          <AnimatePresence mode="wait">
            {!selectedItem ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center text-zinc-800"
              >
                <Monitor className="w-24 h-24 mb-4 opacity-10" />
                <p className="text-xs uppercase tracking-[0.3em] font-light">Semsei Tuval</p>
              </motion.div>
            ) : (
              <motion.div 
                key={selectedItem.id}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="w-full h-full flex flex-col items-center justify-center relative"
              >
                {selectedItem.status === 'processing' ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
                      <Sparkles className="w-8 h-8 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 animate-pulse">Piksel piksel işleniyor...</p>
                  </div>
                ) : selectedItem.resultBase64 ? (
                  <div className="relative w-full h-full flex items-center justify-center group">
                    <img 
                      src={selectedItem.resultBase64} 
                      className="max-w-full max-h-full object-contain rounded-xl shadow-2xl cursor-zoom-in" 
                      onClick={() => { setFullscreenSrc(selectedItem.resultBase64!); setIsFullscreenOpen(true); }}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                      <button className="p-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-emerald-500 hover:text-black transition-all">
                        <Download className="w-5 h-5" />
                      </button>
                      <button className="p-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white hover:text-black transition-all">
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-500 flex flex-col items-center gap-2">
                    <Info className="w-12 h-12 opacity-20" />
                    <p className="text-xs font-bold uppercase">Hata Oluştu</p>
                    <p className="text-[10px] text-zinc-500 max-w-xs text-center">{selectedItem.errorMsg}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* INFO PANEL */}
        {selectedItem && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="h-48 glass-panel p-6 flex gap-8"
          >
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Info className="w-4 h-4" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider">Sahne Açıklaması</h3>
              </div>
              <p className="text-sm italic text-zinc-300 leading-relaxed border-l-2 border-purple-500/30 pl-4">
                {selectedItem.meta?.turkish_explanation || "Açıklama bulunmuyor."}
              </p>
            </div>
            <div className="w-1/3 space-y-4 border-l border-white/5 pl-8">
              <div className="flex items-center gap-2 text-emerald-400">
                <FileText className="w-4 h-4" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider">Kaynak Metin</h3>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5 h-24 overflow-y-auto">
                <p className="text-[10px] font-mono text-zinc-500 leading-relaxed">
                  {selectedItem.meta?.source_text || "Kaynak metin yok."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* RIGHT PANEL: CONTROLS */}
      <div className="w-96 flex flex-col gap-4 overflow-hidden">
        <div className="flex-1 glass-panel flex flex-col overflow-hidden">
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

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* TAB CONTENT */}
            {activeTab === 'manual' && (
              <div className="space-y-6">
                {/* MODE SWITCHER */}
                <div className="bg-black/40 p-1 rounded-xl border border-white/5 flex relative">
                  <motion.div 
                    layoutId="mode-bg"
                    className={cn(
                      "absolute inset-1 rounded-lg shadow-lg",
                      genMode === 'single' ? "bg-blue-500/20 border border-blue-500/30" : 
                      genMode === 'multi' ? "bg-purple-500/20 border border-purple-500/30" : 
                      "bg-amber-500/20 border border-amber-500/30"
                    )}
                    style={{ 
                      width: 'calc(33.33% - 8px)', 
                      left: genMode === 'single' ? '4px' : genMode === 'multi' ? '33.33%' : '66.66%' 
                    }}
                  />
                  {(['single', 'multi', 'maxi'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setGenMode(mode)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider z-10 transition-colors",
                        genMode === mode ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Hayalin</label>
                  <textarea 
                    value={requestInput}
                    onChange={(e) => setRequestInput(e.target.value)}
                    placeholder="Ne hayal ediyorsun? Örn: Gelecekten bir İstanbul manzarası..."
                    className="w-full h-24 bg-black/50 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Prompt (İngilizce)</label>
                    <button 
                      onClick={() => setPromptInput('')}
                      className="text-[8px] text-zinc-500 hover:text-white transition-colors uppercase font-bold"
                    >
                      Temizle
                    </button>
                  </div>
                  <textarea 
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Direkt İngilizce prompt girin veya Hayalin'den üretilmesini bekleyin..."
                    className="w-full h-24 bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-purple-500 transition-all resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Ustalar</label>
                  <div className="grid grid-cols-5 gap-1">
                    {Object.keys(PERSONAS).map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setSelectedPersonaCategory(cat); setSelectedPersona(''); }}
                        className={cn(
                          "py-2 rounded-lg text-[8px] font-bold uppercase border transition-all",
                          selectedPersonaCategory === cat ? "bg-amber-500 border-amber-500 text-black" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20"
                        )}
                      >
                        {cat === 'cinema' ? 'Sinema' : cat === 'anime' ? 'Anime' : cat === 'photo' ? 'Foto' : cat === 'oil' ? 'Yağlı' : 'Özel'}
                      </button>
                    ))}
                  </div>
                  <select 
                    disabled={!selectedPersonaCategory}
                    value={selectedPersona}
                    onChange={(e) => setSelectedPersona(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-30"
                  >
                    <option value="">— Persona Seç —</option>
                    {selectedPersonaCategory && Object.entries((PERSONAS as any)[selectedPersonaCategory]).map(([key, p]: any) => (
                      <option key={key} value={key}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">En / Boy Oranı</label>
                  <div className="grid grid-cols-5 gap-1">
                    {['native', '1:1', '16:9', '9:16', 'manual'].map(ratio => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={cn(
                          "py-2 rounded-lg text-[8px] font-bold uppercase border transition-all",
                          aspectRatio === ratio ? "bg-emerald-500 border-emerald-500 text-black" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20"
                        )}
                      >
                        {ratio === 'native' ? 'Orj' : ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Görsel Stil</label>
                    <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 scale-90 origin-right">
                      <button onClick={() => setStyleMode('direct')} className={cn("px-2 py-1 rounded text-[8px] font-bold uppercase", styleMode === 'direct' ? "bg-white/10 text-white" : "text-zinc-600")}>Direkt</button>
                      <button onClick={() => setStyleMode('flow')} className={cn("px-2 py-1 rounded text-[8px] font-bold uppercase", styleMode === 'flow' ? "bg-white/10 text-white" : "text-zinc-600")}>Flow</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStyle(s.value)}
                        className={cn(
                          "py-2 px-1 rounded-lg text-[8px] font-bold uppercase border transition-all text-center leading-tight h-10 flex items-center justify-center",
                          selectedStyle === s.value ? "bg-emerald-500 border-emerald-500 text-black" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20"
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sahne Ref</label>
                    <div className="aspect-square rounded-xl border border-white/10 bg-black/50 overflow-hidden relative group">
                      {sceneRef ? (
                        <>
                          <img src={sceneRef} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button onClick={() => {
                              const canvas = maskCanvasRef.current;
                              if (canvas) {
                                canvas.width = 1024; canvas.height = 1024; // Default
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  const img = new Image();
                                  img.onload = () => {
                                    canvas.width = img.width; canvas.height = img.height;
                                    ctx.drawImage(img, 0, 0);
                                  };
                                  img.src = sceneRef;
                                }
                              }
                              setIsMaskingModalOpen(true);
                            }} className="p-2 bg-blue-500 rounded-lg text-black"><Ghost className="w-4 h-4" /></button>
                            <button onClick={() => setSceneRef(null)} className="p-2 bg-red-500 rounded-lg text-white"><X className="w-4 h-4" /></button>
                          </div>
                        </>
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                          <Camera className="w-6 h-6 text-zinc-700" />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setSceneRef(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
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
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button onClick={() => {
                              const canvas = faceCanvasRef.current;
                              if (canvas) {
                                canvas.width = 512; canvas.height = 512;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  const img = new Image();
                                  img.onload = () => ctx.drawImage(img, 0, 0, 512, 512);
                                  img.src = charRef;
                                }
                              }
                              setIsFaceModalOpen(true);
                            }} className="p-2 bg-emerald-500 rounded-lg text-black"><Camera className="w-4 h-4" /></button>
                            <button onClick={() => setCharRef(null)} className="p-2 bg-red-500 rounded-lg text-white"><X className="w-4 h-4" /></button>
                          </div>
                        </>
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                          <Plus className="w-6 h-6 text-zinc-700" />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setCharRef(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

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

                {/* Transkript önizleme (yüklendiyse) */}
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

            {activeTab === 'cinema' && (
              <div className="space-y-6">
                {/* Refs */}
                <div className="grid grid-cols-1 gap-4">
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
          </div>

          {/* ACTION BUTTON (MANUAL) */}
          {activeTab === 'manual' && (
            <div className="p-4 border-t border-white/5 bg-black/20 space-y-3">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Üretim Adedi</label>
                <input 
                  type="number" 
                  value={imgCount} 
                  onChange={(e) => setImgCount(Number(e.target.value))}
                  min={1} max={10}
                  className="w-12 bg-black/50 border border-white/10 rounded-lg text-center text-xs py-1"
                />
              </div>
              <button 
                onClick={handleGenerateManual}
                disabled={isProcessing || (!requestInput.trim() && !promptInput.trim())}
                className="w-full py-4 btn-premium btn-purple-glow btn-shine uppercase tracking-[0.2em] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `OLUŞTUR (${genMode.toUpperCase()})`}
              </button>
            </div>
          )}
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
          {activeTab === 'audio' && (
            <div className="p-4 border-t border-white/5 bg-black/20 space-y-3">
              <button
                onClick={runAudioPipeline}
                disabled={!audioFile || Object.values(audioStepStatus).some(s => s === 'processing')}
                className="w-full py-4 btn-premium btn-purple-glow btn-shine uppercase tracking-[0.2em] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {audioStepStatus[2] === 'processing' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'PIPELINE BAŞLAT'}
              </button>
            </div>
          )}
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
        </div>

        {/* LOG PANEL */}
        <div className={cn("glass-panel flex flex-col transition-all duration-500", isLogsMinimized ? "h-14" : "h-64")}>
          <div className="p-4 flex items-center justify-between bg-white/5 cursor-pointer" onClick={() => setIsLogsMinimized(!isLogsMinimized)}>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Sistem Logları
            </h2>
            <div className="flex gap-1">
              <button onClick={(e) => { e.stopPropagation(); setLogs([]); }} className="p-1 hover:bg-white/10 rounded"><Trash2 className="w-3 h-3" /></button>
              {isLogsMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
          {!isLogsMinimized && (
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] space-y-1">
              {logs.length === 0 ? (
                <p className="text-zinc-700 italic">Sistem hazır...</p>
              ) : (
                logs.map(log => (
                  <div key={log.id} className={cn("flex gap-2 border-l-2 pl-2 py-0.5", 
                    log.type === 'error' ? "border-red-500 text-red-400 bg-red-500/5" : 
                    log.type === 'success' ? "border-green-500 text-green-400 bg-green-500/5" : 
                    "border-blue-500 text-blue-400 bg-blue-500/5"
                  )}>
                    <span className="opacity-30 shrink-0">{log.time}</span>
                    <span className="font-bold shrink-0">{log.sender}</span>
                    <span className="text-zinc-300 break-all">{log.msg}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}

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
                    disabled={!audioFile || Object.values(audioStepStatus).some(s => s === 'processing')}
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

              {/* AUDIO EXPANDED */}
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
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Varyasyon</label>
                        <input type="number" value={cinemaVarCount} onChange={(e) => setCinemaVarCount(Number(e.target.value))} min={1} max={5}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-center text-sm focus:outline-none focus:border-emerald-500" />
                      </div>
                    </div>
                  </div>
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

      {/* FULLSCREEN MODAL */}
      <AnimatePresence>
        {isFullscreenOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-8 cursor-zoom-out"
            onClick={() => setIsFullscreenOpen(false)}
          >
            <motion.img 
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              src={fullscreenSrc} className="max-w-full max-h-full object-contain shadow-2xl rounded-xl" 
              referrerPolicy="no-referrer"
            />
            <button className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all">
              <X className="w-8 h-8" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ABOUT MODAL */}
      <AnimatePresence>
        {isAboutModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsAboutModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm glass-panel p-8 text-center relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-emerald-500/20">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Semsei Art Studio</h2>
              <p className="text-[10px] font-mono text-zinc-500 mb-6 uppercase tracking-[0.2em]">Version 0.1.6 (React Edition)</p>
              <p className="text-sm text-zinc-400 leading-relaxed mb-8">
                Bu yazılım <strong className="text-emerald-400">Semih Çağatay</strong> tarafından <strong className="text-blue-400">Gemini</strong> yapay zeka aracı ile hazırlanmıştır.
              </p>
              <button 
                onClick={() => setIsAboutModalOpen(false)}
                className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors uppercase text-xs tracking-widest"
              >
                Harika
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAXI MODE MODAL */}
      <AnimatePresence>
        {isMaxiModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl glass-panel overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" /> Maxi Üretim Ayarları
                </h2>
                <button onClick={() => setIsMaxiModalOpen(false)}><X className="w-6 h-6 text-zinc-500" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Seçili Ustalar</label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(PERSONAS).flatMap(([cat, ps]) => Object.entries(ps as any)).map(([key, p]: any) => (
                      <button
                        key={key}
                        onClick={() => {
                          if (maxiSelectedMasters.includes(key)) setMaxiSelectedMasters(maxiSelectedMasters.filter(k => k !== key));
                          else setMaxiSelectedMasters([...maxiSelectedMasters, key]);
                        }}
                        className={cn(
                          "p-3 rounded-xl border text-[10px] font-bold transition-all text-center leading-tight",
                          maxiSelectedMasters.includes(key) ? "bg-amber-500 border-amber-500 text-black" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/20"
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-black/20 flex gap-4">
                <button onClick={() => setIsMaxiModalOpen(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold uppercase text-xs tracking-widest transition-all">İptal</button>
                <button onClick={() => {
                  setIsMaxiModalOpen(false);
                  maxiSelectedMasters.forEach(master => {
                    createQueueItem(requestInput, `Maxi: ${master}`, { persona: master, aspectRatio: maxiAr }, { source_text: requestInput }, false);
                  });
                }} className="flex-[2] py-3 bg-amber-600 hover:bg-amber-500 text-black rounded-xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-amber-500/20">Üretimi Başlat</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JOB COMPLETE MODAL */}
      <AnimatePresence>
        {isJobCompleteModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm glass-panel p-8 text-center"
            >
              <div className="w-20 h-20 bg-emerald-500 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl shadow-emerald-500/20">
                <Play className="w-10 h-10 text-black" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Görev Tamamlandı!</h2>
              <p className="text-sm text-zinc-400 mb-8">Tüm üretimler başarıyla kuyruktan geçti.</p>
              <button 
                onClick={() => setIsJobCompleteModalOpen(false)}
                className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors uppercase text-xs tracking-widest"
              >
                Kapat
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MASKING MODAL */}
      <AnimatePresence>
        {isMaskingModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Ghost className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Maskeleme Editörü</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Görselin Sadece Belirli Bir Alanını Değiştir</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    const canvas = maskCanvasRef.current;
                    if (canvas) {
                      setMaskedImage(canvas.toDataURL('image/png'));
                      setIsMaskActive(true);
                      setIsMaskingModalOpen(false);
                      logMessage('SİSTEM', 'Maske uygulandı.', 'success');
                    }
                  }}
                  className="px-8 py-3 bg-blue-500 hover:bg-blue-400 text-black font-bold rounded-xl uppercase text-xs tracking-widest transition-all"
                >
                  Maskeyi Uygula
                </button>
                <button onClick={() => setIsMaskingModalOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
               <div className="relative glass-panel p-2">
                  <canvas 
                    ref={maskCanvasRef}
                    className="max-w-full max-h-[70vh] cursor-crosshair bg-black rounded-lg"
                    onMouseDown={(e) => {
                      const canvas = maskCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      ctx.strokeStyle = 'white';
                      ctx.lineWidth = 40;
                      ctx.lineCap = 'round';
                      ctx.beginPath();
                      const rect = canvas.getBoundingClientRect();
                      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                      ctx.moveTo(x, y);
                      (canvas as any).isDrawing = true;
                    }}
                    onMouseMove={(e) => {
                      const canvas = maskCanvasRef.current;
                      if (!canvas || !(canvas as any).isDrawing) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                      ctx.lineTo(x, y);
                      ctx.stroke();
                    }}
                    onMouseUp={() => {
                      const canvas = maskCanvasRef.current;
                      if (canvas) (canvas as any).isDrawing = false;
                    }}
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <button onClick={() => {
                      const canvas = maskCanvasRef.current;
                      if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.clearRect(0, 0, canvas.width, canvas.height);
                          if (sceneRef) {
                            const img = new Image();
                            img.onload = () => ctx.drawImage(img, 0, 0);
                            img.src = sceneRef;
                          }
                        }
                      }
                    }} className="p-2 bg-black/60 rounded-lg hover:bg-black transition-colors"><RotateCcw className="w-4 h-4" /></button>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FACE MODAL */}
      <AnimatePresence>
        {isFaceModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Camera className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Yüz Referansı Editörü</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Karakterin Yüzünü Sabitle</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    const canvas = faceCanvasRef.current;
                    if (canvas) {
                      if (activeTab === 'story') {
                        setStoryCharRef(canvas.toDataURL('image/png'));
                      } else {
                        setCharRef(canvas.toDataURL('image/png'));
                      }
                      setIsFaceModalOpen(false);
                      logMessage('SİSTEM', 'Yüz referansı güncellendi.', 'success');
                    }
                  }}
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl uppercase text-xs tracking-widest transition-all"
                >
                  Yüzü Kaydet
                </button>
                <button onClick={() => setIsFaceModalOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
               <div className="relative glass-panel p-2">
                  <canvas 
                    ref={faceCanvasRef}
                    className="max-w-full max-h-[70vh] bg-black rounded-lg"
                  />
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
