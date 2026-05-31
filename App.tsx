import React, { useState, useEffect } from "react";
import {
  AccessibilityTheme,
  AnalysisMode,
  FontSizeSetting,
  ScanHistoryItem,
} from "./types";
import { VoiceController, speakMessage, stopActiveSpeech } from "./components/VoiceController";
import { AIAssistantScanner } from "./components/AIAssistantScanner";
import { AudioFeedback } from "./components/AudioFeedback";
import {
  BookOpen,
  Receipt,
  Grid3X3,
  Box,
  Brain,
  Volume2,
  VolumeX,
  Type,
  Maximize2,
  RefreshCw,
  Copy,
  Trash2,
  HelpCircle,
  Clock,
  Volume1,
  Sun,
  Eye,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // 1. Accessibility State Controls
  const [theme, setTheme] = useState<AccessibilityTheme>("standard");
  const [fontSize, setFontSize] = useState<FontSizeSetting>("large");
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  // 2. Main Scan State
  const [activeMode, setActiveMode] = useState<AnalysisMode>("text");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<string>("");
  const [additionalQuery, setAdditionalQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Initialize: Load history, play welcoming start chord
  useEffect(() => {
    const savedHistory = localStorage.getItem("assistant_scans_v1");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Unable to restore local scans cache:", e);
      }
    }
    // Play welcoming chord
    setTimeout(() => {
      AudioFeedback.playStartSynth();
    }, 500);
  }, []);

  const saveHistory = (updatedHistory: ScanHistoryItem[]) => {
    setHistory(updatedHistory);
    localStorage.setItem("assistant_scans_v1", JSON.stringify(updatedHistory));
  };

  // Helper selectors for dynamic tailwind accessibility sizes
  const getThemeClasses = () => {
    switch (theme) {
      case "high-contrast":
        return "bg-black text-yellow-300 min-h-screen selection:bg-yellow-300 selection:text-black";
      case "warm-reader":
        return "bg-[#1c1917] text-amber-100 min-h-screen selection:bg-amber-100 selection:text-black";
      default:
        // 'standard' theme now corresponds to the gorgeous 'Professional Polish' deep slate/black configuration
        return "bg-zinc-950 text-white min-h-screen selection:bg-yellow-400 selection:text-black";
    }
  };

  const getContainerBorder = () => {
    switch (theme) {
      case "high-contrast":
        return "border-4 border-yellow-300 bg-black";
      case "warm-reader":
        return "border-4 border-[#78350f] bg-[#292524]";
      default:
        // Professional Polish: deep zinc-900 backdrops with sturdy borders and sleek shadow
        return "border-4 border-zinc-700 bg-zinc-900 rounded-2xl shadow-2xl";
    }
  };

  const getButtonActive = (active: boolean) => {
    if (theme === "high-contrast") {
      return active
        ? "bg-yellow-300 border-yellow-300 text-black font-black"
        : "bg-black border-yellow-300 text-yellow-300 hover:bg-yellow-300/10";
    }
    if (theme === "warm-reader") {
      return active
        ? "bg-amber-400 border-amber-300 text-zinc-950 font-bold"
        : "bg-stone-800 border-stone-700 text-amber-100 hover:bg-[#292524]";
    }
    // Professional Polish Default: bold golden-yellow accents with pitch-black / zinc buttons
    return active
      ? "bg-yellow-400 border-yellow-400 text-black font-black shadow-[0_0_20px_rgba(250,204,21,0.3)] scale-[1.02]"
      : "bg-zinc-800 border-zinc-700 text-neutral-300 hover:bg-zinc-700 hover:text-white";
  };

  const getFontSizeClass = (part: "body" | "heading" | "sub") => {
    if (fontSize === "extra-large") {
      if (part === "heading") return "text-3xl md:text-5xl font-extrabold leading-tight";
      if (part === "sub") return "text-xl md:text-2xl font-semibold";
      return "text-xl md:text-2xl leading-relaxed font-bold";
    }
    if (fontSize === "large") {
      if (part === "heading") return "text-2xl md:text-3xl font-bold leading-tight";
      if (part === "sub") return "text-lg md:text-xl font-medium";
      return "text-lg md:text-xl leading-relaxed font-semibold";
    }
    // Normal / Base
    if (part === "heading") return "text-xl md:text-2xl font-bold leading-tight";
    if (part === "sub") return "text-base md:text-lg font-medium";
    return "text-base md:text-lg leading-relaxed";
  };

  const cycleTheme = () => {
    setTheme((prev) => {
      const themes: AccessibilityTheme[] = ["standard", "high-contrast", "warm-reader"];
      const nextIdx = (themes.indexOf(prev) + 1) % themes.length;
      return themes[nextIdx];
    });
    AudioFeedback.playClick();
  };

  const cycleFontSize = () => {
    setFontSize((prev) => {
      const sizes: FontSizeSetting[] = ["normal", "large", "extra-large"];
      const nextIdx = (sizes.indexOf(prev) + 1) % sizes.length;
      return sizes[nextIdx];
    });
    AudioFeedback.playClick();
  };

  // Submit image capture for serverside analysis
  const handleAnalyze = async (customVoiceInput?: string) => {
    if (!selectedImage) {
      AudioFeedback.playErrorBuzz();
      speakMessage("Пожалуйста, сначала включите камеру и сделайте снимок или загрузите файл.");
      return;
    }

    setIsAnalyzing(true);
    setCurrentResult("");
    stopActiveSpeech();
    AudioFeedback.playStartSynth();

    const voiceInputToUse = customVoiceInput || additionalQuery;

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: selectedImage,
          mode: activeMode,
          voiceInput: voiceInputToUse,
        }),
      });

      if (!response.ok) {
        throw new Error("Не удалось обработать на сервере.");
      }

      const data = await response.json();
      if (data.success) {
        setCurrentResult(data.text);
        AudioFeedback.playSuccessBeep();

        // Save into Scan History Cache
        const historyItem: ScanHistoryItem = {
          id: Date.now().toString(),
          imageUrl: selectedImage,
          timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          text: data.text,
          mode: activeMode,
          voiceInput: voiceInputToUse || undefined,
        };
        saveHistory([historyItem, ...history.slice(0, 19)]); // Keep top 20 items

        // AUTO-READ text aloud instantly for blind user
        speakMessage(data.text);
      } else {
        throw new Error(data.error || "Неизвестная ошибка на сервере.");
      }
    } catch (err: any) {
      console.error(err);
      AudioFeedback.playErrorBuzz();
      const errText = "Извините, произошла ошибка соединения с искусственным интеллектом.";
      setCurrentResult(errText);
      speakMessage(errText);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setCurrentResult("");
    setAdditionalQuery("");
    stopActiveSpeech();
    AudioFeedback.playClick();
  };

  const clearAllHistory = () => {
    saveHistory([]);
    AudioFeedback.playClick();
    speakMessage("История сканирования очищена.");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    AudioFeedback.playSuccessBeep();
    speakMessage("Текст скопирован в буфер обмена.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${getThemeClasses()} font-sans transition-colors duration-200 pb-16`}>
      {/* 1. Header controls & title */}
      <h1 className="sr-only">Визуальный ИИ Помощник для людей с ограничениями по зрению</h1>
      
      <header className="border-b-4 border-yellow-400 py-6 px-4 md:px-8 bg-zinc-900 text-white shadow-xl">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center shrink-0">
              <div className="w-6 h-6 border-4 border-black rounded-full"></div>
            </div>
            <div>
              <span className="text-3xl font-black tracking-tighter uppercase font-sans">
                VisionAI <span className="text-yellow-400">Голос</span>
              </span>
              <p className="text-zinc-400 font-mono text-xs uppercase tracking-widest font-bold mt-0.5">
                ВИЗУАЛЬНЫЙ ИИ-АССИСТЕНТ ДЛЯ СЛАБОВИДЯЩИХ
              </p>
            </div>
          </div>

          {/* Active Status Badge resembling high-end polished UI */}
          <div className="flex items-center gap-3 px-4 py-2 bg-green-950/50 border-2 border-green-500 rounded-xl">
            <div className="w-3.5 h-3.5 bg-green-500 rounded-full animate-pulse shrink-0"></div>
            <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-green-400">
              Микрофон Активен
            </span>
          </div>

          {/* Quick-reach physical accessibility buttons */}
          <div className="flex flex-wrap justify-center gap-2" role="toolbar" aria-label="Панель специальных возможностей">
            <button
              onClick={cycleTheme}
              className="py-3 px-4 bg-zinc-800 border-2 border-yellow-400 hover:bg-zinc-700 text-yellow-400 font-bold text-sm md:text-base rounded-xl flex items-center gap-2 focus:ring-4 focus:ring-yellow-500"
              aria-label="Сменить тему контраста"
            >
              <Sun className="w-5 h-5 shrink-0" />
              <span>Контраст</span>
            </button>

            <button
              onClick={cycleFontSize}
              className="py-3 px-4 bg-zinc-800 border-2 border-yellow-400 hover:bg-zinc-700 text-yellow-400 font-bold text-sm md:text-base rounded-xl flex items-center gap-2 focus:ring-4 focus:ring-yellow-500"
              aria-label="Сменить размер шрифта"
            >
              <Type className="w-5 h-5 shrink-0" />
              <span>Шрифт ({fontSize === "normal" ? "Обычный" : fontSize === "large" ? "Крупный" : "Огромный"})</span>
            </button>

            <button
              onClick={() => {
                AudioFeedback.playClick();
                stopActiveSpeech();
                speakMessage("Вы находитесь на веб-сайте Визуальный ИИ Помощник. Сайт разработан для незрячих. Нажмите в любом месте дважды для включения микрофона голоса.");
              }}
              className="py-3 px-4 bg-zinc-800 border-2 border-zinc-700 hover:bg-zinc-700 text-neutral-200 font-bold text-sm md:text-base rounded-xl flex items-center justify-center focus:ring-4 focus:ring-zinc-500"
              aria-label="Инструкция по сайту"
              title="Инструкция по сайту"
            >
              <HelpCircle className="w-5 h-5 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Dashboard Layout */}
      <main className="max-w-6xl mx-auto px-4 mt-8 flex flex-col gap-8">
        
        {/* Voice control interface section */}
        <VoiceController
          currentMode={activeMode}
          onChangeMode={(mode) => {
            setActiveMode(mode);
            AudioFeedback.playClick();
          }}
          onTriggerCapture={() => {
            // Find call inside AIAssistantScanner context if triggered asynchronously.
            // Under normal usage, selecting Voice Command "Снять" acts exactly as clicking the analyze/capture button.
            if (selectedImage) {
              handleAnalyze();
            } else {
              speakMessage("Пожалуйста, включите камеру и сделайте снимок кнопками на экране.");
            }
          }}
          onSpeakText={speakMessage}
          onStopSpeech={stopActiveSpeech}
          onCycleTheme={cycleTheme}
          onCycleFontSize={cycleFontSize}
          onClearData={handleClear}
          currentResultText={currentResult}
          isProcessing={isAnalyzing}
        />

        {/* Category Toggles - extra large high-contrast blocks */}
        <section className="w-full flex flex-col gap-4">
          <h2 className={`${getFontSizeClass("sub")} font-bold text-yellow-400 uppercase tracking-wide px-1`}>
            Выберите задачу для искусственного интеллекта:
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => {
                AudioFeedback.playClick();
                setActiveMode("text");
                speakMessage("Выбран режим чтения текста. Сделайте фото документов или вывески.");
              }}
              className={`p-6 border-4 rounded-2xl flex flex-col items-center text-center justify-center gap-3 transition-all cursor-pointer ${getButtonActive(
                activeMode === "text"
              )}`}
              aria-label="Режим Чтение обычного текста"
            >
              <BookOpen className="w-8 h-8 shrink-0" />
              <span className={`font-black uppercase tracking-wider text-sm md:text-base`}>
                Чтение текста
              </span>
            </button>

            <button
              onClick={() => {
                AudioFeedback.playClick();
                setActiveMode("receipt");
                speakMessage("Выбран режим анализа кассовых чеков. Готов озвучить цены и товары.");
              }}
              className={`p-6 border-4 rounded-2xl flex flex-col items-center text-center justify-center gap-3 transition-all cursor-pointer ${getButtonActive(
                activeMode === "receipt"
              )}`}
              aria-label="Режим Счета и кассовые чеки"
            >
              <Receipt className="w-8 h-8 shrink-0" />
              <span className="font-black uppercase tracking-wider text-sm md:text-base">
                Кассовый Чек
              </span>
            </button>

            <button
              onClick={() => {
                AudioFeedback.playClick();
                setActiveMode("table");
                speakMessage("Выбран режим разбора таблиц построчно.");
              }}
              className={`p-6 border-4 rounded-2xl flex flex-col items-center text-center justify-center gap-3 transition-all cursor-pointer ${getButtonActive(
                activeMode === "table"
              )}`}
              aria-label="Режим Чтение таблиц построчно"
            >
              <Grid3X3 className="w-8 h-8 shrink-0" />
              <span className="font-black uppercase tracking-wider text-sm md:text-base">
                Таблицы
              </span>
            </button>

            <button
              onClick={() => {
                AudioFeedback.playClick();
                setActiveMode("object");
                speakMessage("Выбран режим гида-поводыря по объектам окружения.");
              }}
              className={`p-6 border-4 rounded-2xl flex flex-col items-center text-center justify-center gap-3 transition-all cursor-pointer ${getButtonActive(
                activeMode === "object"
              )}`}
              aria-label="Режим Описание окружения и объектов"
            >
              <Box className="w-8 h-8 shrink-0" />
              <span className="font-black uppercase tracking-wider text-sm md:text-base">
                Объекты
              </span>
            </button>
          </div>
        </section>

        {/* Interactive capture view (Split view: Left: Camera, Right: Display Analysis) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 flex flex-col gap-6">
            <AIAssistantScanner
              onImageSelected={(base64) => {
                setSelectedImage(base64);
                // Prompt user to initiate standard scanning
                speakMessage("Фотография готова к обработке ИИ. Вы можете добавить текстовый вопрос или нажать кнопку Анализировать.");
              }}
              isProcessing={isAnalyzing}
              selectedImage={selectedImage}
              onClear={handleClear}
            />

            {/* Custom additional queries to feed the analysis (e.g. Find specific price) */}
            {selectedImage && (
              <div className={`${getContainerBorder()} p-6 rounded-2xl flex flex-col gap-4`}>
                <label
                  htmlFor="queryInput"
                  className={`block uppercase font-black text-yellow-400 font-mono tracking-wider ${getFontSizeClass("sub")}`}
                >
                  Спросить конкретную деталь (необязательно):
                </label>
                <input
                  id="queryInput"
                  type="text"
                  placeholder="Например: какая итоговая цена? или: прочитай только вторую строку."
                  value={additionalQuery}
                  onChange={(e) => setAdditionalQuery(e.target.value)}
                  className="w-full py-4 px-4 bg-zinc-950 border-4 border-zinc-700 text-yellow-300 font-bold rounded-xl space-x-2 focus:ring-4 focus:ring-yellow-500 font-sans"
                />
                
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing}
                  className="w-full py-5 px-6 bg-yellow-400 hover:bg-yellow-500 text-zinc-950 font-black tracking-wide rounded-xl flex items-center justify-center gap-3 transition-all text-xl md:text-2xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-4 border-yellow-300"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-8 h-8 animate-spin shrink-0" />
                      <span>Обработка ИИ...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-8 h-8 text-zinc-950 shrink-0" />
                      <span>Анализировать ИИ</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right Column: AI Analysis Result Display Panel */}
          <div className="lg:col-span-6">
            <div className={`${getContainerBorder()} p-6 md:p-8 rounded-2xl flex flex-col gap-6 min-h-[350px] relative overflow-hidden transition-all duration-300`}>
              
              {/* Header result actions */}
              <div className="flex justify-between items-center w-full border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-yellow-400 rounded-full animate-ping shrink-0" />
                  <h3 className="text-xl font-bold text-yellow-400 uppercase tracking-widest font-sans">
                    Результаты анализа
                  </h3>
                </div>
                {currentResult && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(currentResult)}
                      className="p-3 bg-zinc-800 border bg-opacity-30 border-zinc-700 text-zinc-200 rounded-xl hover:bg-zinc-700 hover:text-white transition-all focus:ring-4 focus:ring-zinc-600"
                      aria-label="Скопировать расшифровку в буфер обмена"
                      title="Скопировать"
                    >
                      {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-yellow-400" />}
                    </button>
                    <button
                      onClick={() => speakMessage(currentResult)}
                      className="p-3 bg-zinc-800 border bg-opacity-30 border-zinc-700 text-zinc-200 rounded-xl hover:bg-zinc-700 hover:text-white transition-all focus:ring-4 focus:ring-zinc-600 animate-pulse"
                      aria-label="Прочесть результаты повторно"
                      title="Прочесть"
                    >
                      <Volume2 className="w-5 h-5 text-yellow-400" />
                    </button>
                  </div>
                )}
              </div>

              {/* Core Output display */}
              <div className="flex-1 w-full" aria-live="assertive">
                {isAnalyzing ? (
                  <div className="h-full flex flex-col justify-center items-center text-center gap-4 py-12">
                    <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-xl font-black text-yellow-400 uppercase tracking-widest animate-pulse">
                      Искусственный Интеллект анализирует картинку...
                    </p>
                    <p className="text-zinc-400 max-w-sm text-sm">
                      Мы извлекаем слова, структуру цен, таблицы или окружающие вас объекты. Это займет несколько секунд.
                    </p>
                  </div>
                ) : currentResult ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`${getFontSizeClass("body")} leading-relaxed tracking-wide whitespace-pre-wrap select-text`}
                  >
                    {/* Visual highlighted parts based on active mode helper tags */}
                    <div className="p-4 bg-zinc-950/80 rounded-xl border border-zinc-800 font-mono text-xs text-yellow-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                      <span>Режим: {activeMode === "text" ? "Документ / Текст" : activeMode === "receipt" ? "Кассовый Чек" : activeMode === "table" ? "Логическая Таблица" : "Гид-поводырь"}</span>
                      <span>Статус: Готово</span>
                    </div>
                    {currentResult}
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col justify-center items-center text-center gap-4 py-16 text-zinc-500">
                    <Brain className="w-16 h-16 text-zinc-700 mb-2" />
                    <p className={`${getFontSizeClass("sub")} font-bold text-zinc-400`}>
                      Здесь появится подробный анализ
                    </p>
                    <p className="max-w-xs text-xs md:text-sm">
                      Сделайте четкое фото с помощью панели слева, проверьте выбранный режим и запустите ИИ.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Scan History Cache List */}
        {history.length > 0 && (
          <section className="mt-8 border-t-4 border-zinc-800 pt-8">
            <div className="flex items-center justify-between w-full mb-6">
              <h2 className={`${getFontSizeClass("sub")} font-black text-yellow-400 uppercase tracking-wider flex items-center gap-2`}>
                <Clock className="w-6 h-6 text-yellow-400 shrink-0" />
                Архив ваших сканирований ({history.length})
              </h2>
              <button
                onClick={clearAllHistory}
                className="py-2.5 px-4 bg-red-950 hover:bg-red-900 border-2 border-red-700 text-red-200 font-bold text-xs md:text-sm rounded-xl flex items-center gap-2 cursor-pointer focus:ring-4 focus:ring-red-400 transition-all font-mono uppercase"
                aria-label="Полностью очистить сохраненную историю"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Сбросить архив</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`${getContainerBorder()} p-5 rounded-2xl flex flex-col md:flex-row gap-4 transition-all hover:scale-[1.01]`}
                >
                  {/* Small snapshot preview */}
                  <div className="w-24 h-24 bg-zinc-950 rounded-lg overflow-hidden shrink-0 hidden sm:block border-2 border-zinc-700">
                    <img src={item.imageUrl} alt="Превью" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>

                  <div className="flex-1 flex flex-col justify-between gap-3 overflow-hidden">
                    <div>
                      <div className="flex items-center justify-between w-full text-xs font-mono font-bold uppercase text-zinc-500 mb-2">
                        <span>{item.timestamp} • {item.mode === "text" ? "Текст" : item.mode === "receipt" ? "Чек" : item.mode === "table" ? "Таблица" : "Гид"}</span>
                        {item.voiceInput && <span className="bg-yellow-400/20 text-yellow-400 py-0.5 px-1.5 rounded">Доп. вопрос</span>}
                      </div>
                      <p className="text-sm md:text-base leading-relaxed line-clamp-3 font-medium break-words">
                        {item.text}
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-zinc-800">
                      <button
                        onClick={() => {
                          AudioFeedback.playClick();
                          speakMessage(item.text);
                        }}
                        className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-yellow-400 font-bold rounded-lg flex items-center gap-1.5 text-xs focus:ring-4 focus:ring-zinc-600"
                        aria-label="Повторить озвучивание для этого элемента"
                      >
                        <Volume1 className="w-4 h-4 text-yellow-400 shrink-0" />
                        <span>Озвучить</span>
                      </button>
                      <button
                        onClick={() => {
                          AudioFeedback.playClick();
                          setSelectedImage(item.imageUrl);
                          setCurrentResult(item.text);
                          setActiveMode(item.mode);
                          if (item.voiceInput) setAdditionalQuery(item.voiceInput);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 font-bold rounded-lg flex items-center gap-1.5 text-xs focus:ring-4 focus:ring-zinc-600"
                        aria-label="Восстановить в главное поле"
                      >
                        <Maximize2 className="w-4 h-4 shrink-0" />
                        <span>Развернуть</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4. Large Informational Access Guide */}
        <footer className="mt-12 bg-zinc-900 text-white rounded-2xl p-6 border-4 border-zinc-800 shadow-xl">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3 mb-4">
            <HelpCircle className="w-6 h-6 text-yellow-400 shrink-0" />
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-yellow-400 uppercase">
              Информационно-тактильное руководство
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm mb-4">
            <div>
              <p className="font-bold text-yellow-400 uppercase font-mono text-xs mb-2">Общие инструкции:</p>
              <ul className="list-disc pl-5 space-y-2 text-zinc-300">
                <li>Дважды кликните по любому пустому месту экрана для активации микрофона в любой удобный момент.</li>
                <li>Измените режим вверху, чтобы настроить поведение анализатора ИИ.</li>
                <li>Используйте кнопки «Контраст» и «Шрифт» для адаптации под ваши индивидуальные требования зрения.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-yellow-400 uppercase font-mono text-xs mb-2">Возможные речевые действия:</p>
              <ul className="list-disc pl-5 space-y-2 text-zinc-300">
                <li>Скажите <span className="font-bold text-white font-mono">«текст»</span> / <span className="font-bold text-white font-mono">«чек»</span> / <span className="font-bold text-white font-mono">«таблица»</span> / <span className="font-bold text-white font-mono">«объект»</span> для переключения.</li>
                <li>Скажите <span className="font-bold text-white font-mono">«снять»</span> чтобы запустить фотографирование.</li>
                <li>Скажите <span className="font-bold text-white font-mono">«читай»</span> для повтора текста.</li>
              </ul>
            </div>
          </div>
          
          <div className="text-center pt-4 border-t border-zinc-900 text-xs text-zinc-500 font-semibold uppercase tracking-wider font-mono">
  
          </div>
        </footer>

      </main>
    </div>
  );
}
