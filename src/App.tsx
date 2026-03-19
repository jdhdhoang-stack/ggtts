import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  Download, 
  Trash2, 
  Play, 
  Loader2, 
  Plus, 
  History,
  Globe,
  AlertCircle,
  FileAudio,
  Upload,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Danh sách ngôn ngữ đầy đủ hơn từ Google Translate
const LANGUAGES = [
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)' },
  { code: 'en', name: 'English (Tiếng Anh)' },
  { code: 'ja', name: 'Japanese (Tiếng Nhật)' },
  { code: 'ko', name: 'Korean (Tiếng Hàn)' },
  { code: 'fr', name: 'French (Tiếng Pháp)' },
  { code: 'de', name: 'German (Tiếng Đức)' },
  { code: 'zh-CN', name: 'Chinese (Tiếng Trung)' },
  { code: 'th', name: 'Thai (Tiếng Thái)' },
  { code: 'es', name: 'Spanish (Tiếng Tây Ban Nha)' },
  { code: 'ru', name: 'Russian (Tiếng Nga)' },
  { code: 'it', name: 'Italian (Tiếng Ý)' },
];

interface HistoryItem {
  id: number;
  text: string;
  langCode: string;
  langName: string;
  url: string;
  timestamp: string;
  isMerged?: boolean;
  speed?: number;
  pitch?: number;
}

const App = () => {
  const [text, setText] = useState('');
  const [lang, setLang] = useState('vi');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; phase: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeAudio, setActiveAudio] = useState<{ id: number; source: HTMLAudioElement; ctx: AudioContext | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tts_history');
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('tts_history', JSON.stringify(items));
  }, [items]);

  // Helper to convert AudioBuffer to WAV Blob
  const audioBufferToWav = (buffer: AudioBuffer) => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const buffer_out = new ArrayBuffer(length);
    const view = new DataView(buffer_out);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);  // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    for (i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

    while (pos < length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([buffer_out], { type: "audio/wav" });
  };

  const mergeAudios = async (itemsToMerge: HistoryItem[], originalText: string): Promise<HistoryItem | null> => {
    setIsMerging(true);
    setBatchProgress(prev => prev ? { ...prev, phase: 'Đang hợp nhất...' } : null);
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffers: AudioBuffer[] = [];

      // Fetch and decode in sequence to avoid memory issues
      for (const item of itemsToMerge) {
        const response = await fetch(item.url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        buffers.push(audioBuffer);
      }

      if (buffers.length === 0) return null;

      const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
      const mergedBuffer = audioCtx.createBuffer(
        buffers[0].numberOfChannels,
        totalLength,
        buffers[0].sampleRate
      );

      let offset = 0;
      for (const buf of buffers) {
        for (let channel = 0; channel < buf.numberOfChannels; channel++) {
          mergedBuffer.getChannelData(channel).set(buf.getChannelData(channel), offset);
        }
        offset += buf.length;
      }

      const wavBlob = audioBufferToWav(mergedBuffer);
      const wavUrl = URL.createObjectURL(wavBlob);

      return {
        id: Date.now(),
        text: `[GỘP TOÀN BỘ] ${originalText.slice(0, 100)}${originalText.length > 100 ? '...' : ''}`,
        langCode: itemsToMerge[0].langCode,
        langName: itemsToMerge[0].langName,
        url: wavUrl,
        timestamp: new Date().toLocaleTimeString(),
        isMerged: true,
        speed: 1,
        pitch: 0
      };
    } catch (err) {
      console.error("Merge error:", err);
      setError("Không thể hợp nhất các đoạn âm thanh. Vui lòng tải từng phần.");
      return null;
    } finally {
      setIsMerging(false);
    }
  };

  const splitText = (input: string, maxLength: number = 200): string[] => {
    const chunks: string[] = [];
    let currentText = input.trim().replace(/\s+/g, ' ');
    
    while (currentText.length > 0) {
      if (currentText.length <= maxLength) {
        chunks.push(currentText);
        break;
      }

      // Try to find a good split point (sentence end or space)
      let splitIndex = -1;
      const lookback = currentText.substring(0, maxLength);
      
      // Look for sentence endings
      const sentenceEnds = /[.!?]\s/g;
      let match;
      let lastSentenceEnd = -1;
      while ((match = sentenceEnds.exec(lookback)) !== null) {
        lastSentenceEnd = match.index + 1;
      }

      if (lastSentenceEnd !== -1) {
        splitIndex = lastSentenceEnd;
      } else {
        // Look for last space
        splitIndex = lookback.lastIndexOf(' ');
      }

      // If no good split point, just cut at maxLength
      if (splitIndex <= 0) {
        splitIndex = maxLength;
      }

      chunks.push(currentText.substring(0, splitIndex).trim());
      currentText = currentText.substring(splitIndex).trim();
    }
    
    return chunks;
  };

  const processText = async (inputText: string, targetLang: string) => {
    const chunks = splitText(inputText);
    const results: (HistoryItem | null)[] = new Array(chunks.length).fill(null);
    const blobs: (Blob | null)[] = new Array(chunks.length).fill(null);
    const CONCURRENCY_LIMIT = 6;
    const MAX_RETRIES = 5;
    
    setLoading(true);
    setError(null);

    const runBatch = async (indices: number[], phaseName: string) => {
      let batchCompleted = 0;
      setBatchProgress({ current: 0, total: indices.length, phase: phaseName });
      
      const queue = [...indices];
      const worker = async () => {
        while (queue.length > 0) {
          const index = queue.shift();
          if (index === undefined) break;

          const chunk = chunks[index];
          try {
            const encodedText = encodeURIComponent(chunk);
            const audioUrl = `/api/tts?text=${encodedText}&lang=${targetLang}`;

            const response = await fetch(audioUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const blob = await response.blob();
            if (blob.size < 100) throw new Error("Audio blob too small (likely invalid)");
            
            blobs[index] = blob;
            const blobUrl = URL.createObjectURL(blob);

            results[index] = {
              id: Date.now() + index + Math.random(),
              text: chunk,
              langCode: targetLang,
              langName: LANGUAGES.find(l => l.code === targetLang)?.name || targetLang,
              url: blobUrl,
              timestamp: new Date().toLocaleTimeString()
            };
          } catch (err) {
            console.error(`Failed to process chunk ${index}:`, err);
          } finally {
            batchCompleted++;
            setBatchProgress(prev => prev ? { ...prev, current: batchCompleted } : null);
          }
        }
      };

      const workers = Array(Math.min(CONCURRENCY_LIMIT, queue.length))
        .fill(null)
        .map(() => worker());

      await Promise.all(workers);
    };

    // First pass
    await runBatch([...chunks.keys()], 'Đang tạo âm thanh...');

    // Retries for failed chunks
    let retryAttempt = 0;
    while (results.includes(null) && retryAttempt < MAX_RETRIES) {
      retryAttempt++;
      const failedIndices = results.map((val, idx) => val === null ? idx : -1).filter(idx => idx !== -1);
      await runBatch(failedIndices, `Thử lại phần lỗi (Lần ${retryAttempt}/${MAX_RETRIES})...`);
    }

    const successfulItems = results.filter((item): item is HistoryItem => item !== null);
    
    if (successfulItems.length > 0) {
      if (chunks.length === 1) {
        setItems(prev => [successfulItems[0], ...prev]);
      } else {
        if (successfulItems.length === chunks.length) {
          setBatchProgress({ current: 0, total: 1, phase: 'Đang hợp nhất các phần...' });
          const mergedItem = await mergeAudios(successfulItems, inputText);
          if (mergedItem) {
            // Merged item at the top, then individual chunks
            setItems(prev => [mergedItem, ...successfulItems, ...prev]);
          } else {
            setItems(prev => [...successfulItems, ...prev]);
          }
        } else {
          setItems(prev => [...successfulItems, ...prev]);
          setError(`Hoàn thành ${successfulItems.length}/${chunks.length} phần. Một số phần không thể tạo sau ${MAX_RETRIES} lần thử.`);
        }
      }
    } else {
      setError("Không thể tạo âm thanh cho bất kỳ đoạn văn bản nào. Vui lòng kiểm tra kết nối mạng.");
    }
    
    setLoading(false);
    setBatchProgress(null);
    setText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    processText(text, lang);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      setError("Vui lòng chỉ tải lên file định dạng .txt");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content.trim()) {
        processText(content, lang);
      }
    };
    reader.onerror = () => setError("Không thể đọc file.");
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteItem = (id: number) => {
    if (activeAudio?.id === id) {
      activeAudio.source.pause();
      activeAudio.source.src = '';
      setActiveAudio(null);
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateItemSettings = (id: number, speed: number, pitch: number) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, speed, pitch } : item
    ));

    // Live update if this item is currently playing
    if (activeAudio?.id === id) {
      activeAudio.source.playbackRate = speed;
      // We'll handle pitch via BiquadFilter in playAudio if needed, 
      // but for live updates, we'll just update speed for now as pitch shift is complex without artifacts
    }
  };

  const playAudio = async (item: HistoryItem) => {
    // Stop any currently playing audio
    if (activeAudio) {
      activeAudio.source.pause();
      activeAudio.source.src = '';
      if (activeAudio.ctx && activeAudio.ctx.state !== 'closed') {
        activeAudio.ctx.close();
      }
      setActiveAudio(null);
    }

    try {
      const audio = new Audio(item.url);
      audio.crossOrigin = "anonymous";
      audio.playbackRate = item.speed || 1;
      (audio as any).preservesPitch = true;
      
      if (item.isMerged && item.pitch !== 0) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Ensure context is running (required by some browsers)
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const source = audioCtx.createMediaElementSource(audio);
        const filter = audioCtx.createBiquadFilter();
        
        filter.type = 'peaking';
        filter.frequency.value = 1000;
        filter.Q.value = 1;
        filter.gain.value = (item.pitch || 0) * 1.5;
        
        source.connect(filter);
        filter.connect(audioCtx.destination);
        
        await audio.play();
        setActiveAudio({ id: item.id, source: audio, ctx: audioCtx });
      } else {
        await audio.play();
        setActiveAudio({ id: item.id, source: audio, ctx: null });
      }

      audio.onended = () => {
        if (activeAudio?.ctx) {
          activeAudio.ctx.close();
        }
        setActiveAudio(prev => prev?.id === item.id ? null : prev);
      };
    } catch (err) {
      console.error("Playback error:", err);
      setError('Không thể phát âm thanh này. Vui lòng thử lại hoặc tải xuống.');
    }
  };

  const downloadAudio = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.slice(0, 50).replace(/[^a-z0-9]/gi, '_')}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-slate-400 font-sans p-4 md:p-8 selection:bg-indigo-500/20 selection:text-indigo-300">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-900/40 border border-indigo-500/30 rounded-2xl mb-4">
            <FileAudio className="text-indigo-400 w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Sound of Text Proxy</h1>
          <p className="text-slate-500 text-xs mt-2 font-medium uppercase tracking-widest">TTS Tool • High Quality</p>
        </motion.header>

        {/* Form Input */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900/20 rounded-3xl border border-slate-800/40 p-6 mb-10"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-3 px-1">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest">Văn bản nguồn</label>
                <div className="flex items-center gap-4">
                   <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors uppercase tracking-widest"
                  >
                    <Upload className="w-3 h-3" />
                    Tải file .txt
                  </button>
                  <span className="text-[10px] font-bold text-slate-600">{text.length} ký tự</span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".txt" 
                  className="hidden" 
                />
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nhập hoặc dán văn bản..."
                className="w-full h-44 p-5 rounded-2xl border border-slate-800/50 bg-black/40 focus:bg-black/60 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 outline-none transition-all resize-none text-base leading-relaxed text-slate-300 placeholder:text-slate-700"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-800/50 bg-black/40 focus:bg-black/60 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 outline-none appearance-none text-sm font-semibold text-slate-400 cursor-pointer transition-all"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !text.trim()}
                className="px-10 py-3.5 bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-900 disabled:text-slate-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm active:scale-95 min-w-[180px]"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{batchProgress ? `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` : 'Đang xử lý...'}</span>
                  </div>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Tạo âm thanh
                  </>
                )}
              </button>
            </div>

            {/* Progress Bar */}
            <AnimatePresence>
              {batchProgress && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-3 pt-2"
                >
                  <div className="flex justify-between items-end px-1">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                      {batchProgress.phase}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600">
                      {batchProgress.current} / {batchProgress.total}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-slate-800/50">
                    <motion.div 
                      className="h-full bg-indigo-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-10 p-4 bg-rose-950/20 border border-rose-900/30 text-rose-400 rounded-xl flex items-start gap-3 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="flex items-center gap-2 text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase">
              <History className="w-3.5 h-3.5 text-indigo-500" />
              Lịch sử chuyển đổi
            </h2>
            <div className="flex items-center gap-3">
              {items.length > 0 && (
                <div className="flex items-center gap-3">
                  {showClearConfirm ? (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2">
                      <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Xóa tất cả?</span>
                      <button 
                        onClick={() => {
                          setItems([]);
                          setShowClearConfirm(false);
                        }}
                        className="text-[9px] text-rose-500 font-bold hover:underline uppercase tracking-widest"
                      >
                        Đồng ý
                      </button>
                      <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="text-[9px] text-slate-500 font-bold hover:underline uppercase tracking-widest"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowClearConfirm(true)}
                      className="text-[9px] text-slate-600 hover:text-rose-500 font-bold transition-colors uppercase tracking-widest"
                    >
                      Xóa lịch sử
                    </button>
                  )}
                </div>
              )}
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-500 px-2.5 py-0.5 rounded-full font-bold">{items.length}</span>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {items.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-slate-900/10 rounded-3xl border border-dashed border-slate-800/50 text-slate-700 text-xs font-bold uppercase tracking-widest"
                >
                  Trống
                </motion.div>
              ) : (
                items.map((item) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    key={item.id} 
                    className={`p-5 rounded-2xl border transition-all flex flex-col gap-5 ${
                      item.isMerged 
                        ? 'bg-amber-950/5 border-amber-900/30 shadow-lg shadow-amber-950/5' 
                        : 'bg-slate-900/10 border-slate-800/40 hover:border-slate-700/60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {item.isMerged && (
                            <span className="flex items-center gap-1 text-[8px] bg-amber-900/30 text-amber-500 px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-amber-800/20">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Hợp nhất
                            </span>
                          )}
                          <p className={`text-slate-200 font-medium leading-relaxed line-clamp-2 ${item.isMerged ? 'text-base' : 'text-sm'}`}>
                            {item.text}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest ${
                            item.isMerged ? 'bg-amber-900/20 text-amber-600' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {item.langCode}
                          </span>
                          <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">{item.timestamp}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => playAudio(item)}
                          className={`p-3 rounded-xl transition-all active:scale-90 flex items-center gap-2 ${
                            activeAudio?.id === item.id 
                              ? 'bg-indigo-600 text-white' 
                              : item.isMerged 
                                ? 'text-amber-500 bg-amber-900/10 hover:bg-amber-900/20' 
                                : 'text-indigo-400 bg-indigo-900/10 hover:bg-indigo-900/20'
                          }`}
                        >
                          {activeAudio?.id === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                          {item.isMerged && <span className="text-xs font-bold uppercase tracking-widest">Nghe</span>}
                        </button>
                        <button
                          onClick={() => downloadAudio(item.url, item.text)}
                          className={`p-3 rounded-xl transition-all active:scale-90 ${
                            item.isMerged ? 'text-amber-500 bg-amber-900/10 hover:bg-amber-900/20' : 'text-slate-400 bg-slate-800/40 hover:bg-slate-800/60'
                          }`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-3 text-slate-600 hover:text-rose-500 bg-slate-800/20 hover:bg-rose-950/20 rounded-xl transition-all active:scale-90"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Controls for Merged Audio */}
                    {item.isMerged && (
                      <div className="pt-5 border-t border-amber-900/20 grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-bold text-amber-600/80 uppercase tracking-[0.2em]">Tốc độ: {item.speed}x</label>
                            <button 
                              onClick={() => updateItemSettings(item.id, 1, item.pitch || 0)}
                              className="text-[8px] text-amber-700 font-bold hover:underline uppercase tracking-widest"
                            >
                              Reset
                            </button>
                          </div>
                          <input 
                            type="range" 
                            min="0.5" 
                            max="2" 
                            step="0.1" 
                            value={item.speed || 1}
                            onChange={(e) => updateItemSettings(item.id, parseFloat(e.target.value), item.pitch || 0)}
                            className="w-full h-1 bg-black rounded-lg appearance-none cursor-pointer accent-amber-600"
                          />
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-bold text-amber-600/80 uppercase tracking-[0.2em]">Tông giọng: {item.pitch > 0 ? `+${item.pitch}` : item.pitch}</label>
                            <button 
                              onClick={() => updateItemSettings(item.id, item.speed || 1, 0)}
                              className="text-[8px] text-amber-700 font-bold hover:underline uppercase tracking-widest"
                            >
                              Reset
                            </button>
                          </div>
                          <input 
                            type="range" 
                            min="-10" 
                            max="10" 
                            step="1" 
                            value={item.pitch || 0}
                            onChange={(e) => updateItemSettings(item.id, item.speed || 1, parseInt(e.target.value))}
                            className="w-full h-1 bg-black rounded-lg appearance-none cursor-pointer accent-amber-600"
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
