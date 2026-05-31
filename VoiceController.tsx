import React, { useEffect, useState, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, HelpCircle } from "lucide-react";
import { AudioFeedback } from "./AudioFeedback";

interface VoiceControllerProps {
  currentMode: "text" | "receipt" | "table" | "object";
  onChangeMode: (mode: "text" | "receipt" | "table" | "object") => void;
  onTriggerCapture: () => void;
  onSpeakText: (text: string) => void;
  onStopSpeech: () => void;
  onCycleTheme: () => void;
  onCycleFontSize: () => void;
  onClearData: () => void;
  currentResultText: string;
  isProcessing: boolean;
}

export const speakMessage = (text: string, onEnd?: () => void) => {
  if (!("speechSynthesis" in window)) {
    console.warn("Синтез речи не поддерживается браузером.");
    return;
  }

  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/[*#`_\-]/g, " ")
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "");

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "ru-RU";

  const prevVoices = window.speechSynthesis.getVoices();
  const ruVoice = prevVoices.find(v => v.lang.startsWith("ru"));
  if (ruVoice) {
    utterance.voice = ruVoice;
  }

  utterance.rate = 1.05;
  utterance.pitch = 1.05;

  if (onEnd) {
    utterance.onend = onEnd;
  }

  window.speechSynthesis.speak(utterance);
};

export const stopActiveSpeech = () => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};

export function VoiceController({
  currentMode,
  onChangeMode,
  onTriggerCapture,
  onSpeakText,
  onStopSpeech,
  onCycleTheme,
  onCycleFontSize,
  onClearData,
  currentResultText,
  isProcessing,
}: VoiceControllerProps) {
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [permissionError, setPermissionError] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "ru-RU";

      rec.onstart = () => {
        setIsListening(true);
        setVoiceTranscript("Слушаю вас...");
        AudioFeedback.playClick();
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error", event);
        if (event.error === "not-allowed") {
          setPermissionError(true);
        }
        setIsListening(false);
        setVoiceTranscript("");
        AudioFeedback.playErrorBuzz();
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event: any) => {
        const resultString = event.results[0][0].transcript.toLowerCase().trim();
        setVoiceTranscript(resultString);
        processVoiceCommand(resultString);
      };

      recognitionRef.current = rec;
    }

    const greet = () => {
      speakMessage(
        "Добро пожаловать в визуальный ассистент. Нажмите на микрофон или нажмите в любой части экрана дважды для голосового управления. Вы можете говорить команды: текст, чек, таблица, объект или инструкция."
      );
    };

    if ("speechSynthesis" in window) {
      if (window.speechSynthesis.getVoices().length > 0) {
        greet();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          greet();
          window.speechSynthesis.onvoiceschanged = null;
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopActiveSpeech();
    };
  }, []);

  // Ekrandagi har qanday joyni ikki marta bosganda ovozni yoqish (Mobil va Desktop)
  useEffect(() => {
    let lastTap = 0;
    const handleDoubleTap = (e: TouchEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" || 
        target.closest("button") || 
        target.tagName === "INPUT" || 
        target.tagName === "VIDEO"
      ) {
        return;
      }
      const now = Date.now();
      if (now - lastTap < 350) {
        e.preventDefault();
        toggleMicrophone();
      }
      lastTap = now;
    };

    window.addEventListener("click", handleDoubleTap);
    window.addEventListener("touchstart", handleDoubleTap);
    return () => {
      window.removeEventListener("click", handleDoubleTap);
      window.removeEventListener("touchstart", handleDoubleTap);
    };
  }, [isListening, currentMode, currentResultText]);

  const toggleMicrophone = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      stopActiveSpeech();
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.warn("SpeechRec already running or unavailable", e);
      }
    }
  };

  const processVoiceCommand = (command: string) => {
    if (command.includes("текст") || command.includes("книга") || command.includes("прочитай")) {
      onChangeMode("text");
      speakMessage("Режим чтения текста активирован. Направьте камеру и скажите слово снять.");
      return;
    }
    if (command.includes("чек") || command.includes("квитанци") || command.includes("покупка")) {
      onChangeMode("receipt");
      speakMessage("Режим чека к оплате активирован. Готов извлечь цены.");
      return;
    }
    if (command.includes("таблиц") || command.includes("столбец") || command.includes("строк")) {
      onChangeMode("table");
      speakMessage("Режим чтения таблиц активирован. Я зачитаю её логически.");
      return;
    }
    if (command.includes("объект") || command.includes("предмет") || command.includes("что передо мной") || command.includes("окружени")) {
      onChangeMode("object");
      speakMessage("Режим распознавания объектов активирован. Узнаем, что вокруг нас.");
      return;
    }

    if (command.includes("снять") || command.includes("фото") || command.includes("анализ") || command.includes("сканир") || command.includes("старт")) {
      speakMessage("Фотографирую и начинаю анализ. Пожалуйста, подождите.");
      
      // Global ulanish triggerini ishga tushiramiz
      if ((window as any).globalTriggerCapture) {
        (window as any).globalTriggerCapture();
      }
      onTriggerCapture();
      return;
    }

    if (command.includes("читай") || command.includes("озвуч") || command.includes("громко") || command.includes("слушать")) {
      if (currentResultText) {
        speakMessage("Зачитываю результаты: " + currentResultText);
      } else {
        speakMessage("Пока нет результатов для прочтения. Проведите сначала анализ изображения.");
      }
      return;
    }

    if (command.includes("стоп") || command.includes("останови") || command.includes("тише") || command.includes("замолчи")) {
      onStopSpeech();
      speakMessage("Озвучивание текста приостановлено.");
      return;
    }

    if (command.includes("тема") || command.includes("цвета") || command.includes("контраст")) {
      onCycleTheme();
      speakMessage("Тема контрастности изменена.");
      return;
    }

    if (command.includes("размер") || command.includes("шрифт") || command.includes("крупно") || command.includes("больше")) {
      onCycleFontSize();
      speakMessage("Размер текста изменен.");
      return;
    }

    if (command.includes("очистить") || command.includes("сбросить") || command.includes("удали")) {
      if ((window as any).globalTriggerClear) {
        (window as any).globalTriggerClear();
      }
      onClearData();
      speakMessage("Все данные очищены. Приложение сброшено.");
      return;
    }

    if (command.includes("помощь") || command.includes("инструкция") || command.includes("команд") || command.includes("что делать")) {
      speakMessage(
        "Вы можете произносить следующие фразы: " +
        "Первое: 'Текст', чтобы переключиться на режим чтения. " +
        "Второе: 'Чек', чтобы анализировать покупки и цены. " +
        "Третье: 'Таблица', чтобы зачитывать структурированные таблицы. " +
        "Четвертое: 'Объект', чтобы распознавать окружение. " +
        "Пятое: 'Снять' — чтобы сфотографировать. " +
        "Шестое: 'Читай' — чтобы повторить результаты. " +
        "Седьмое: 'Тема' — для изменения контраста. " +
        "Восьмое: 'Размер' — изменить шрифт."
      );
      return;
    }

    speakMessage(`Распознана фраза: "${command}". Будет отправлена при следующем анализе.`);
  };

  return (
    <div className="w-full flex flex-col items-center bg-zinc-900 text-white rounded-2xl p-6 border-4 border-yellow-400 shadow-2xl">
      <div className="text-center w-full">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white uppercase mb-1 flex items-center justify-center gap-2">
          <Mic className="animate-pulse text-yellow-400 w-6 h-6" />
          Голосовой Помощник (STT)
        </h2>
        <p className="text-xs md:text-sm text-zinc-400 mb-4 font-mono font-bold uppercase tracking-wider">
          Команды на русском языке • Двойное нажатие по экрану
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mb-4">
        <button
          onClick={() => {
            AudioFeedback.playClick();
            toggleMicrophone();
          }}
          className={`col-span-2 py-4 px-6 rounded-xl flex items-center justify-center gap-3 font-bold transition-all border-4 text-lg active:scale-95 ${
            isListening
              ? "bg-red-600 border-red-400 text-white animate-pulse"
              : "bg-yellow-400 border-yellow-300 text-zinc-950 hover:bg-yellow-500 hover:border-yellow-400"
          }`}
          aria-label={isListening ? "Остановить голосовое прослушивание" : "Начать голосовое управление"}
        >
          {isListening ? (
            <>
              <MicOff className="w-6 h-6 shrink-0" />
              <span>Остановить (Слушаю...)</span>
            </>
          ) : (
            <>
              <Mic className="w-6 h-6 shrink-0" />
              <span>Голосовая команда</span>
            </>
          )}
        </button>

        <button
          onClick={() => {
            AudioFeedback.playClick();
            if (currentResultText) {
              speakMessage(currentResultText);
            } else {
              speakMessage("Нет текста для чтения. Сканируйте документ.");
            }
          }}
          className="py-4 px-4 bg-zinc-800 border-4 border-zinc-700 hover:bg-zinc-700 text-zinc-100 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-sm"
          aria-label="Озвучить результат вслух"
        >
          <Volume2 className="w-5 h-5 text-yellow-400" />
          <span>Озвучить</span>
        </button>

        <button
          onClick={() => {
            AudioFeedback.playClick();
            onStopSpeech();
          }}
          className="py-4 px-4 bg-zinc-800 border-4 border-zinc-700 hover:bg-zinc-700 text-zinc-100 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-sm"
          aria-label="Остановить синтез речи"
        >
          <VolumeX className="w-5 h-5 text-red-500" />
          <span>Стоп звук</span>
        </button>
      </div>

      {voiceTranscript && (
        <div className="w-full bg-zinc-950 rounded-xl p-4 border-2 border-zinc-805 text-center">
          <p className="text-xs text-zinc-500 font-mono font-bold uppercase mb-1">Распознанная речь:</p>
          <p className="text-yellow-400 font-bold font-mono text-lg md:text-xl break-words">
            « {voiceTranscript} »
          </p>
        </div>
      )}

      {permissionError && (
        <p className="mt-2 text-xs text-red-400 font-semibold text-center">
          * Ошибка доступа к микрофону. Проверьте разрешения вашего браузера.
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-zinc-800 w-full flex items-center justify-between text-xs text-zinc-400 font-medium">
        <span className="flex items-center gap-1">
          <HelpCircle className="w-4 h-4 text-zinc-500" /> Совет: скажите «инструкция»
        </span>
        <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-500 font-mono uppercase font-bold">
          ru-RU Voice Engine
        </span>
      </div>
    </div>
  );
}