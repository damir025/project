export type AccessibilityTheme = "standard" | "high-contrast" | "warm-reader";

export type AnalysisMode = "text" | "receipt" | "table" | "object";

export type FontSizeSetting = "normal" | "large" | "extra-large";

export interface ScanHistoryItem {
  id: string;
  imageUrl: string;
  timestamp: string;
  text: string;
  mode: AnalysisMode;
  voiceInput?: string;
}

export interface VoiceCommand {
  phrases: string[];
  action: (param?: string) => void;
  description: string;
}
