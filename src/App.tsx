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
  CheckCircle2,
  Filter,
  Mic2,
  Copy,
  Eraser
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
  const [activeTab, setActiveTab] = useState<'tts' | 'filter'>('tts');
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

  // Text Filtering State
  const [filterInput, setFilterInput] = useState('');
  const [filterOutput, setFilterOutput] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    removeNumbers: false,
    removeSpecial: false,
    removeExtraSpaces: true,
    lowercase: false,
    uppercase: false,
    useManualTranscription: true,
    filterStoryTrash: true,
    deleteChapterTitles: true,
    deleteTrailingNumbers: true,
    readNumbers: false,
    removeEmptyLines: true,
    trimLines: true,
    capitalizeSentences: false,
    removeLinks: true,
    removeAds: true
  });

  const [pronunciationDict, setPronunciationDict] = useState<{ original: string; replacement: string }[]>([
    { original: 'POKEMON MASTER', replacement: 'pô kê mon mát tơ' },
    { original: 'RONALDO', replacement: 'rô nan đô' },
    { original: 'MADRID', replacement: 'ma rít' },
    { original: 'TOTTENHAM', replacement: 'tốt ten ham' }
  ]);
  const [newOriginal, setNewOriginal] = useState('');
  const [newReplacement, setNewReplacement] = useState('');

  const DEFAULT_TRASH_KEYWORDS = 'comment, 0 comment, Vote, SEND GIFT, bình luận, 0 bình luận, bỏ phiếu, gửi quà tặng, P@treon, PinkSnake, chương phía trước, vui lòng theo dõi tôi, p@treon.com/PinkSnake, nhận xét, còn lại, SUY NGHĨ CỦA NGƯỜI SÁNG TẠO, Rắn hồng, discord.gg, https://discord.gg/7mNvAaTtkf, Power Stones, Đánh giá, Bonus, 1 left, 2 left, 3 left, 4 left, 5 left, 6 left, 7 left, 8 left, 9 left, discord.com/invite, TruyenFull.vn, truyenfull, metruyenchu, sstruyen, tangthuvien, truyencv, đọc truyện tại, chúc bạn đọc truyện vui vẻ';

  const [trashKeywords, setTrashKeywords] = useState<string>(DEFAULT_TRASH_KEYWORDS);

  const addDictItem = () => {
    if (newOriginal.trim() && newReplacement.trim()) {
      setPronunciationDict([...pronunciationDict, { original: newOriginal.trim(), replacement: newReplacement.trim() }]);
      setNewOriginal('');
      setNewReplacement('');
    }
  };

  const removeDictItem = (index: number) => {
    setPronunciationDict(pronunciationDict.filter((_, i) => i !== index));
  };

  const handleFilter = () => {
    let result = filterInput;

    // 1. Remove Links
    if (filterOptions.removeLinks) {
      result = result.replace(/https?:\/\/[^\s]+/gi, '');
      result = result.replace(/www\.[^\s]+/gi, '');
    }

    // 2. Trash Keywords & Story Trash
    if (filterOptions.filterStoryTrash) {
      const keywords = trashKeywords.split(',').map(k => k.trim()).filter(k => k);
      keywords.forEach(keyword => {
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        result = result.replace(regex, '');
      });
    }

    // 3. Remove Ads (Common patterns)
    if (filterOptions.removeAds) {
      const adPatterns = [
        /truyện được copy tại.*/gi,
        /nguồn:.*/gi,
        /đọc truyện tại.*/gi,
        /chúc bạn đọc truyện vui vẻ.*/gi,
        /mọi người nhớ vote.*/gi
      ];
      adPatterns.forEach(pattern => {
        result = result.replace(pattern, '');
      });
    }

    // 4. Delete Chapter Titles
    if (filterOptions.deleteChapterTitles) {
      result = result.replace(/^(Chương|Chapter|Tiếp|Quyển|Hồi|Tập|Phần)\s*\d+.*$/gim, '');
    }

    // 5. Delete Trailing Numbers
    if (filterOptions.deleteTrailingNumbers) {
      result = result.replace(/\d+\s*$/gm, '');
    }

    // 6. Manual Transcription
    if (filterOptions.useManualTranscription) {
      pronunciationDict.forEach(item => {
        const regex = new RegExp(`\\b${item.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        result = result.replace(regex, item.replacement);
      });
    }

    // 7. Read Numbers (Simple implementation)
    if (filterOptions.readNumbers) {
      result = result.replace(/(\d+)\.000\.000/g, '$1 triệu');
      result = result.replace(/(\d+)\.000/g, '$1 nghìn');
    }

    // 8. Basic Filters
    if (filterOptions.removeNumbers) result = result.replace(/[0-9]/g, '');
    if (filterOptions.removeSpecial) result = result.replace(/[^a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s\n\r]/g, '');
    
    // 9. Line-based processing
    let lines = result.split(/\r?\n/);
    
    if (filterOptions.trimLines) {
      lines = lines.map(line => line.trim());
    }
    
    if (filterOptions.removeEmptyLines) {
      lines = lines.filter(line => line.length > 0);
    }

    if (filterOptions.capitalizeSentences) {
      lines = lines.map(line => {
        if (line.length === 0) return line;
        return line.charAt(0).toUpperCase() + line.slice(1);
      });
    }

    result = lines.join('\n');

    if (filterOptions.removeExtraSpaces) {
      result = result.replace(/[ \t]+/g, ' ').trim();
    }

    if (filterOptions.lowercase) result = result.toLowerCase();
    if (filterOptions.uppercase) result = result.toUpperCase();

    setFilterOutput(result);
  };

  const copyToClipboard = (val: string) => {
    navigator.clipboard.writeText(val);
    // Could add a toast here
  };

  // Load history and filter settings from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('tts_history');
    if (savedHistory) {
      try {
        setItems(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const savedFilterOptions = localStorage.getItem('filter_options');
    if (savedFilterOptions) {
      try {
        setFilterOptions(prev => ({ ...prev, ...JSON.parse(savedFilterOptions) }));
      } catch (e) {
        console.error("Failed to parse filter options", e);
      }
    }

    const savedDict = localStorage.getItem('pronunciation_dict');
    if (savedDict) {
      try {
        setPronunciationDict(JSON.parse(savedDict));
      } catch (e) {
        console.error("Failed to parse pronunciation dict", e);
      }
    }

    const savedTrash = localStorage.getItem('trash_keywords');
    if (savedTrash) {
      setTrashKeywords(savedTrash);
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('tts_history', JSON.stringify(items));
  }, [items]);

  // Save filter settings to localStorage
  useEffect(() => {
    localStorage.setItem('filter_options', JSON.stringify(filterOptions));
  }, [filterOptions]);

  useEffect(() => {
    localStorage.setItem('pronunciation_dict', JSON.stringify(pronunciationDict));
  }, [pronunciationDict]);

  useEffect(() => {
    localStorage.setItem('trash_keywords', trashKeywords);
  }, [trashKeywords]);

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

  const mergeAudios = async (itemsToMerge: HistoryItem[], originalText: string, partLabel?: string): Promise<HistoryItem | null> => {
    setIsMerging(true);
    setBatchProgress(prev => prev ? { ...prev, phase: partLabel ? `Đang hợp nhất ${partLabel}...` : 'Đang hợp nhất...' } : null);
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
      
      // Safety check: Browser limit for AudioBuffer is typically around 2GB or 1-2 billion samples.
      // 923,194,368 samples at 48kHz is ~5.3 hours, which is too much for a single buffer.
      // We'll set a limit of 300 million samples (~104 mins at 48kHz) to be safe.
      const MAX_SAMPLES = 300_000_000;
      if (totalLength > MAX_SAMPLES) {
        throw new Error(`Tổng độ dài âm thanh của phần này quá lớn (${Math.round(totalLength / buffers[0].sampleRate / 60)} phút). Vui lòng chia nhỏ văn bản hơn nữa.`);
      }

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
        id: Date.now() + Math.random(),
        text: `[${partLabel || 'GỘP TOÀN BỘ'}] ${originalText.slice(0, 100)}${originalText.length > 100 ? '...' : ''}`,
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
      setError(err instanceof Error ? err.message : "Không thể hợp nhất các đoạn âm thanh. Vui lòng tải từng phần.");
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
          const numParts = 4;
          const partSize = Math.ceil(successfulItems.length / numParts);
          const mergedParts: HistoryItem[] = [];

          for (let i = 0; i < numParts; i++) {
            const start = i * partSize;
            const end = Math.min((i + 1) * partSize, successfulItems.length);
            if (start >= end) continue;

            const partItems = successfulItems.slice(start, end);
            setBatchProgress({ current: i, total: numParts, phase: `Đang hợp nhất Phần ${i + 1}...` });
            const merged = await mergeAudios(partItems, inputText, `GỘP PHẦN ${i + 1}`);
            if (merged) mergedParts.push(merged);
          }

          // Reverse to keep chronological order (newest at top)
          const newItems: HistoryItem[] = [...mergedParts.reverse(), ...successfulItems];
          setItems(prev => [...newItems, ...prev]);
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
        {/* Tab Navigation */}
        <div className="flex items-center justify-center mb-12 p-1.5 bg-slate-900/30 border border-slate-800/50 rounded-2xl w-fit mx-auto">
          <button
            onClick={() => setActiveTab('tts')}
            className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'tts' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {activeTab === 'tts' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-900/20"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Mic2 className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">TTS Batch</span>
          </button>
          <button
            onClick={() => setActiveTab('filter')}
            className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'filter' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {activeTab === 'filter' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-900/20"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Filter className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Lọc chữ</span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'tts' ? (
            <motion.div
              key="tts-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <header className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-900/40 border border-indigo-500/30 rounded-2xl mb-4">
                  <FileAudio className="text-indigo-400 w-7 h-7" />
                </div>
                <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Sound of Text Proxy</h1>
                <p className="text-slate-500 text-xs mt-2 font-medium uppercase tracking-widest">TTS Tool • High Quality</p>
              </header>

              {/* Form Input */}
              <div className="bg-slate-900/20 rounded-3xl border border-slate-800/40 p-6 mb-10">
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
                      maxLength={100000}
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
              </div>

              {error && (
                <div className="mb-10 p-4 bg-rose-950/20 border border-rose-900/30 text-rose-400 rounded-xl flex items-start gap-3 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

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
            </motion.div>
          ) : (
            <motion.div
              key="filter-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* Filter Header */}
              <header className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-900/40 border border-indigo-500/30 rounded-2xl mb-4 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                  <Filter className="text-indigo-400 w-7 h-7" />
                </div>
                <h1 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 tracking-tighter uppercase">Lọc Văn Bản Pro</h1>
                <div className="w-24 h-1 bg-amber-500 mx-auto mt-2 rounded-full" />
              </header>

              {/* Input Section */}
              <div className="bg-slate-900/20 rounded-3xl border border-slate-800/40 p-6">
                <div className="flex justify-between items-center mb-3 px-1">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest">Văn bản đầu vào</label>
                  <button 
                    onClick={() => setFilterInput('')}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-rose-400 transition-colors uppercase tracking-widest"
                  >
                    <Eraser className="w-3 h-3" />
                    Xóa sạch
                  </button>
                </div>
                <textarea
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  maxLength={100000}
                  placeholder="Dán văn bản cần lọc vào đây..."
                  className="w-full h-44 p-5 rounded-2xl border border-slate-800/50 bg-black/40 focus:bg-black/60 focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/30 outline-none transition-all resize-none text-base leading-relaxed text-slate-300 placeholder:text-slate-700"
                />
              </div>

              {/* Logic Processing Section */}
              <div className="bg-slate-900/40 rounded-3xl border border-slate-800/40 p-8 space-y-6">
                <h3 className="flex items-center gap-2 text-amber-500 font-black text-xs uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Xử lý Logic
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'useManualTranscription', label: 'Sử dụng phiên âm thủ công' },
                    { key: 'filterStoryTrash', label: 'Lọc khối rác truyện' },
                    { key: 'deleteChapterTitles', label: 'Xóa tiêu đề Chapter' },
                    { key: 'deleteTrailingNumbers', label: 'Xóa số lẻ cuối dòng' },
                    { key: 'readNumbers', label: 'Đọc số: Nghìn/Triệu...' },
                    { key: 'removeEmptyLines', label: 'Xóa dòng trống' },
                    { key: 'trimLines', label: 'Xóa khoảng trắng đầu/cuối' },
                    { key: 'capitalizeSentences', label: 'Viết hoa đầu câu' },
                    { key: 'removeLinks', label: 'Xóa liên kết (Link)' },
                    { key: 'removeAds', label: 'Xóa quảng cáo' }
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setFilterOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key as keyof typeof prev] }))}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-slate-800/40 hover:border-slate-700/60 transition-all text-left group"
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                        filterOptions[opt.key as keyof typeof filterOptions]
                          ? 'bg-purple-600 border-purple-500'
                          : 'bg-slate-900 border-slate-800 group-hover:border-slate-600'
                      }`}>
                        {filterOptions[opt.key as keyof typeof filterOptions] && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-200 transition-colors">
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pronunciation Dictionary Section */}
              <div className="bg-slate-900/40 rounded-3xl border border-slate-800/40 p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-cyan-500 font-black text-xs uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    Từ điển phiên âm ({pronunciationDict.length})
                  </h3>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setPronunciationDict([])}
                      className="text-[9px] text-slate-600 hover:text-rose-500 font-bold uppercase tracking-widest transition-colors"
                    >
                      Xóa hết
                    </button>
                    <button 
                      onClick={() => setPronunciationDict([
                        { original: 'POKEMON MASTER', replacement: 'pô kê mon mát tơ' },
                        { original: 'RONALDO', replacement: 'rô nan đô' },
                        { original: 'MADRID', replacement: 'ma rít' },
                        { original: 'TOTTENHAM', replacement: 'tốt ten ham' }
                      ])}
                      className="text-[9px] text-slate-600 hover:text-cyan-500 font-bold uppercase tracking-widest transition-colors"
                    >
                      Mặc định
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={newOriginal}
                    onChange={(e) => setNewOriginal(e.target.value)}
                    placeholder="Từ gốc (En)"
                    className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-slate-800/60 text-sm text-slate-300 outline-none focus:border-cyan-500/50 transition-all"
                  />
                  <input
                    value={newReplacement}
                    onChange={(e) => setNewReplacement(e.target.value)}
                    placeholder="Phiên âm (Vi)"
                    className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-slate-800/60 text-sm text-slate-300 outline-none focus:border-cyan-500/50 transition-all"
                  />
                </div>
                <button
                  onClick={addDictItem}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                >
                  Thêm vào từ điển
                </button>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {pronunciationDict.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-black/40 border border-slate-800/40 flex justify-between items-center group">
                      <div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{item.original}</div>
                        <div className="text-sm font-bold text-cyan-400">{item.replacement}</div>
                      </div>
                      <button 
                        onClick={() => removeDictItem(idx)}
                        className="p-2 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trash Keywords Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-slate-500 font-black text-xs uppercase tracking-widest">Từ khóa rác</h3>
                  <button 
                    onClick={() => setTrashKeywords(DEFAULT_TRASH_KEYWORDS)}
                    className="text-[9px] text-slate-600 hover:text-amber-500 font-bold uppercase tracking-widest transition-colors"
                  >
                    Khôi phục mặc định
                  </button>
                </div>
                <div className="bg-slate-900/40 rounded-3xl border border-slate-800/40 p-8">
                  <textarea
                    value={trashKeywords}
                    onChange={(e) => setTrashKeywords(e.target.value)}
                    className="w-full h-32 bg-transparent border-none outline-none text-xs font-bold text-amber-600/80 leading-relaxed resize-none custom-scrollbar"
                    placeholder="Nhập các từ khóa rác, cách nhau bằng dấu phẩy..."
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleFilter}
                disabled={!filterInput.trim()}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 disabled:text-slate-700 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-[0_10px_30px_rgba(79,70,229,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Filter className="w-5 h-5" />
                Thực hiện lọc Pro
              </button>

              {/* Filter Output */}
              <AnimatePresence>
                {filterOutput && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-900/20 rounded-3xl border border-indigo-900/30 p-8 shadow-2xl shadow-indigo-900/10"
                  >
                    <div className="flex justify-between items-center mb-4 px-1">
                      <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Kết quả xử lý</label>
                      <button 
                        onClick={() => copyToClipboard(filterOutput)}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                      >
                        <Copy className="w-3 h-3" />
                        Sao chép
                      </button>
                    </div>
                    <div className="w-full p-6 rounded-2xl border border-slate-800/50 bg-black/60 text-base leading-relaxed text-slate-300 min-h-[150px] whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar">
                      {filterOutput}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default App;

