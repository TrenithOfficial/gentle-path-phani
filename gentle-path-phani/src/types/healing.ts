export interface Phase {
  id: number;
  name: string;
  description: string;
  startDay: number;
  endDay: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'client' | 'admin';
  startDate: string;
  currentPhase: number;
}

export interface DailyGuidance {
  id: string;
  phaseId: number;
  day: number;
  title: string;
  content: string;
  audioUrl?: string;
}

export interface HealingSheet {
  id: string;
  name: string;
  phaseId?: number;
  userId?: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface Protocol {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  timing: string;
  notes?: string;
  shopUrl?: string;
}

export interface CheckIn {
  id: string;
  userId: string;
  date: string;
  mood: number;
  energy: number;
  notes?: string;
  isTravelDay: boolean;
  missedProtocol: boolean;
  submittedAt: string;
}

export interface Message {
  id: string;
  userId: string;
  subject: string;
  content: string;
  sentAt: string;
  isRead: boolean;
  adminReply?: string;
  repliedAt?: string;
}

export const PHASES: Phase[] = [
  { id: 1, name: "Deep Detox & Pathogen Purge", description: "Cleanse and reset your body's foundation", startDay: 1, endDay: 15 },
  { id: 2, name: "Gut Rebalancing & Microbiome Support", description: "Restore digestive harmony", startDay: 16, endDay: 30 },
  { id: 3, name: "Immune System Strengthening", description: "Build resilient natural defenses", startDay: 31, endDay: 45 },
  { id: 4, name: "Cellular Energy & Mito Boost", description: "Energize at the cellular level", startDay: 46, endDay: 60 },
  { id: 5, name: "Stored Trauma & Emotional Imprints", description: "Release and heal emotional patterns", startDay: 61, endDay: 75 },
  { id: 6, name: "Transformation & Spiritual Alignment", description: "Integrate and embody your transformation", startDay: 76, endDay: 90 },
];

export const getCurrentDay = (startDate: string): number => {
  const start = new Date(startDate);
  const today = new Date();
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(diffDays, 1), 90);
};

export const getPhaseForDay = (day: number): Phase => {
  return PHASES.find(p => day >= p.startDay && day <= p.endDay) || PHASES[0];
};
