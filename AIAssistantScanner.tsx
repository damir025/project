import React, { useRef, useState, useEffect } from "react";
import { Camera, RefreshCw, Upload, Eye, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { AudioFeedback } from "./AudioFeedback";

interface AIAssistantScannerProps {
  onImageSelected: (base64Data: string) => void;
  isProcessing: boolean;
  selectedImage: string | null;
  onClear: () => void;
}

export function AIAssistantScanner({
  onImageSelected,
  isProcessing,
  selectedImage,
  onClear,
}: AIAssistantScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);

  const updateCameraDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");
      setAvailableCameras(videoDevices);
      if (videoDevices.length > 0 && !activeCameraId) {
        setActiveCameraId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.warn("Unable to inspect physical capture devices:", err);
    }
  };

  useEffect(() => {
    updateCameraDevices();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    stopCamera();

    try {
      let mediaStream: MediaStream;

      if (activeCameraId && activeCameraId.trim() !== "") {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: activeCameraId } },
            audio: false,
          });
        } catch (e) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      } else {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
        } catch (e) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      setStream(mediaStream);
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error("Video play error:", e));
        };
      }

      AudioFeedback.playClick();
      await updateCameraDevices();

    } catch (err: any) {
      console.error("Camera startup error:", err);
      setCameraError("Не удалось получить доступ к камере. Проверьте разрешения.");
      setCameraActive(false);
      AudioFeedback.playErrorBuzz();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const cycleCamera = async () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex((cam) => cam.deviceId === activeCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamId = availableCameras[nextIndex].deviceId;
    setActiveCameraId(nextCamId);

    if (cameraActive) {
      setTimeout(() => {
        startCamera();
      }, 150);
    }
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video || !cameraActive) return;

    AudioFeedback.playCaptureSnap();

    const canvas = document.createElement("canvas");
    const width = video.videoWidth > 0 ? video.videoWidth : 640;
    const height = video.videoHeight > 0 ? video.videoHeight : 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      // SIFATNI 0.4 GA TUSHIRAMIZ: Rasm hajmi 10 barobarga kamayadi va internetda chaqmoqdek tez yuklanadi!
      const base64Data = canvas.toDataURL("image/jpeg", 0.4);
      onImageSelected(base64Data);
      stopCamera();
    }
  };

  useEffect(() => {
    (window as any).globalTriggerCapture = () => {
      if (cameraActive) {
        captureSnapshot();
      } else {
        startCamera();
      }
    };
    (window as any).globalTriggerClear = () => {
      onClear();
      startCamera();
    };
    return () => {
      delete (window as any).globalTriggerCapture;
      delete (window as any).globalTriggerClear;
    };
  }, [cameraActive, activeCameraId, availableCameras]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      AudioFeedback.playErrorBuzz();
      alert("Пожалуйста, загрузите только файлы формата изображения.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onImageSelected(reader.result);
        AudioFeedback.playSuccessBeep();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full bg-zinc-900 border-4 border-yellow-400 rounded-2xl p-6 shadow-2xl flex flex-col gap-6">
      <div className="flex items-center justify-between w-full border-b border-zinc-800 pb-4">
        <h2 className="text-xl md:text-2xl font-bold text-yellow-400 flex items-center gap-2">
          <Camera className="w-6 h-6 text-yellow-400" />
          Сканирование изображений
        </h2>
        {selectedImage && (
          <button
            onClick={() => {
              AudioFeedback.playClick();
              onClear();
            }}
            className="px-4 py-2 bg-red-650 border-2 border-red-500 hover:bg-red-750 text-white font-bold rounded-lg text-sm transition-all focus:ring-4 focus:ring-red-400"
          >
            Удалить фото
          </button>
        )}
      </div>

      <div className="relative w-full aspect-video min-h-[240px] md:min-h-[350px] bg-zinc-950 border-4 border-dashed border-zinc-700 rounded-xl overflow-hidden flex flex-col justify-center items-center text-center p-4">
        
        <div className="absolute inset-0 pointer-events-none opacity-10 flex flex-wrap">
          <div className="w-1/4 h-1/4 border-b border-r border-yellow-400/20"></div>
          <div className="w-1/4 h-1/4 border-b border-r border-yellow-400/20"></div>
          <div className="w-1/4 h-1/4 border-b border-r border-yellow-400/20"></div>
          <div className="w-1/4 h-1/4 border-b border-yellow-400/20"></div>
          <div className="w-1/4 h-1/4 border-b border-r border-yellow-400/20"></div>
          <div className="w-1/4 h-1/4 border-b border-r border-yellow-400/20"></div>
          <div className="w-1/4 h-1/4 border-b border-r border-yellow-400/20"></div>
          <div className="w-1/4 h-1/4 border-b border-yellow-400/20"></div>
        </div>

        {selectedImage ? (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-zinc-950">
            <img
              src={selectedImage}
              alt="Сканированный объект"
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-6 left-6 w-16 h-16 border-t-4 border-l-4 border-yellow-450 z-10"></div>
            <div className="absolute top-6 right-6 w-16 h-16 border-t-4 border-r-4 border-yellow-450 z-10"></div>
            <div className="absolute bottom-6 left-6 w-16 h-16 border-b-4 border-l-4 border-yellow-450 z-10"></div>
            <div className="absolute bottom-6 right-6 w-16 h-16 border-b-4 border-r-4 border-yellow-450 z-10"></div>

            <div className="absolute bottom-4 left-4 bg-zinc-900/95 border-2 border-yellow-400 text-yellow-400 text-xs md:text-sm font-bold font-mono py-1.5 px-3 rounded-lg flex items-center gap-2">
              <Eye className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>Фотография готова к анализу</span>
            </div>
          </div>
        ) : cameraActive ? (
          <div className="absolute inset-0 w-full h-full bg-black">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              aria-label="Режим видоискателя камеры"
            />
            <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-yellow-400 pointer-events-none"></div>
            <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-yellow-400 pointer-events-none"></div>
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-yellow-400 pointer-events-none"></div>
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-yellow-400 pointer-events-none"></div>

            <div className="absolute bottom-6 inset-x-0 flex justify-center gap-4 px-4 z-10">
              <button
                onClick={captureSnapshot}
                className="py-3 px-8 bg-yellow-400 hover:bg-yellow-500 border-4 border-yellow-300 text-zinc-950 font-black text-lg md:text-xl rounded-full shadow-lg active:scale-95 flex items-center gap-2 transition-all"
                aria-label="Сделать снимок сейчас"
              >
                <Camera className="w-6 h-6 text-zinc-950 shrink-0" />
                Сделать снимок
              </button>
              {availableCameras.length > 1 && (
                <button
                  onClick={cycleCamera}
                  className="p-3 bg-zinc-800 hover:bg-zinc-700 border-4 border-zinc-600 text-yellow-400 rounded-full shadow-lg active:scale-95 transition-all"
                  aria-label="Переключить камеру"
                  title="Переключить камеру"
                >
                  <RefreshCw className="w-5 h-5 shrink-0" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`absolute inset-0 w-full h-full flex flex-col justify-center items-center transition-all ${
              dragActive ? "bg-yellow-400/10 border-yellow-400" : ""
            }`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4 max-w-md px-6">
              <ImageIcon className="w-16 h-16 text-zinc-600" />
              <div>
                <p className="text-lg md:text-xl font-bold text-zinc-200">
                  Положите файл сюда или активируйте камеру
                </p>
                <p className="text-xs md:text-sm text-zinc-500 mt-1">
                  Поддерживаются форматы JPEG, PNG, WEBP
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full mt-4">
                <button
                  onClick={startCamera}
                  className="flex-1 py-3 px-5 bg-yellow-400 hover:bg-yellow-500 border-4 border-yellow-300 text-zinc-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md text-base"
                >
                  <Eye className="w-5 h-5 text-zinc-950 shrink-0" />
                  Включить камеру
                </button>

                <button
                  onClick={() => {
                    AudioFeedback.playClick();
                    fileInputRef.current?.click();
                  }}
                  className="flex-1 py-3 px-5 bg-zinc-800 hover:bg-zinc-700 border-4 border-zinc-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md text-base"
                >
                  <Upload className="w-5 h-5 text-yellow-400 shrink-0" />
                  Выбрать файл
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Загрузить изображение"
            />
          </div>
        )}
      </div>

      {cameraError && (
        <div className="p-4 bg-red-950/80 border-2 border-red-500 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-200 text-sm md:text-base">Предупреждение доступа</p>
            <p className="text-xs md:text-sm text-red-300 mt-0.5">{cameraError}</p>
          </div>
        </div>
      )}

      <div className="bg-zinc-950 border-2 border-zinc-800 rounded-xl p-4">
        <p className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-2">Голосовые команды для камеры:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm text-zinc-300">
          <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg">
            <span className="font-mono font-bold text-yellow-400">« Снять »</span>
            <span className="text-zinc-500">•</span>
            <span>Делает моментальный снимок</span>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg">
            <span className="font-mono font-bold text-yellow-400">« Очистить »</span>
            <span className="text-zinc-500">•</span>
            <span>Сбрасывает текущее фото</span>
          </div>
        </div>
      </div>
    </div>
  );
}