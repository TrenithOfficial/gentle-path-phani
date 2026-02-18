import { User, DailyGuidance, HealingSheet, Protocol, CheckIn, Message } from '@/types/healing';

// Mock current user - in production this would come from auth
export const mockCurrentUser: User = {
  id: 'user-1',
  email: 'sarah@example.com',
  name: 'Sarah',
  role: 'client',
  startDate: '2024-12-10',
  currentPhase: 1,
};

export const mockAdminUser: User = {
  id: 'admin-1',
  email: 'admin@healingprogram.com',
  name: 'Dr. Williams',
  role: 'admin',
  startDate: '2024-01-01',
  currentPhase: 1,
};

export const mockUsers: User[] = [
  mockCurrentUser,
  {
    id: 'user-2',
    email: 'john@example.com',
    name: 'John',
    role: 'client',
    startDate: '2024-12-01',
    currentPhase: 2,
  },
  {
    id: 'user-3',
    email: 'emma@example.com',
    name: 'Emma',
    role: 'client',
    startDate: '2024-11-15',
    currentPhase: 3,
  },
];

export const mockGuidance: DailyGuidance[] = [
  {
    id: 'g1',
    phaseId: 1,
    day: 1,
    title: 'Welcome to Your Healing Journey',
    content: `Today marks the beginning of your transformation. Take a moment to set your intention for this journey.\n\nMorning Ritual:\n• Start with a glass of warm lemon water\n• Practice 5 minutes of deep breathing\n• Journal your feelings and expectations\n\nToday's Focus:\nGentle detox begins. Your body is preparing to release what no longer serves you. Stay hydrated and rest when needed.\n\nEvening Reflection:\nBefore sleep, place your hand on your heart and express gratitude for taking this step.`,
    audioUrl: undefined,
  },
  {
    id: 'g2',
    phaseId: 1,
    day: 2,
    title: 'Building Your Foundation',
    content: `Day 2 is about establishing the rhythms that will support your healing.\n\nMorning Protocol:\n• Continue with warm lemon water\n• Add chlorophyll drops to your water\n• 10 minutes of gentle stretching\n\nMindset:\nYour body knows how to heal. Trust the process and listen to its wisdom.\n\nNutrition Focus:\nPrioritize leafy greens and clean proteins today. Avoid processed foods and added sugars.`,
  },
];

export const mockHealingSheets: HealingSheet[] = [
  {
    id: 'hs1',
    name: 'Phase 1 - Detox Protocol Guide',
    phaseId: 1,
    fileUrl: '/sheets/phase1-guide.pdf',
    uploadedAt: '2024-12-01',
  },
  {
    id: 'hs2',
    name: 'Supplement Schedule - Week 1',
    phaseId: 1,
    fileUrl: '/sheets/supplements-week1.pdf',
    uploadedAt: '2024-12-01',
  },
  {
    id: 'hs3',
    name: 'Your Personalized Lab Results',
    userId: 'user-1',
    fileUrl: '/sheets/sarah-labs.pdf',
    uploadedAt: '2024-12-08',
  },
];

export const mockProtocols: Protocol[] = [
  {
    id: 'p1',
    userId: 'user-1',
    name: 'Chlorophyll Drops',
    dosage: '20 drops',
    timing: 'Morning, in water',
    notes: 'Take on empty stomach',
  },
  {
    id: 'p2',
    userId: 'user-1',
    name: 'Digestive Enzymes',
    dosage: '2 capsules',
    timing: 'Before each meal',
    shopUrl: 'https://example.com/enzymes',
  },
  {
    id: 'p3',
    userId: 'user-1',
    name: 'Probiotic Complex',
    dosage: '1 capsule',
    timing: 'Morning, with breakfast',
    notes: 'Keep refrigerated',
  },
  {
    id: 'p4',
    userId: 'user-1',
    name: 'BPC-157',
    dosage: '250mcg',
    timing: 'Twice daily, subcutaneous',
    notes: 'Peptide for gut healing',
  },
];

export const mockCheckIns: CheckIn[] = [
  {
    id: 'c1',
    userId: 'user-1',
    date: '2024-12-23',
    mood: 4,
    energy: 3,
    notes: 'Feeling good, slight headache in the afternoon',
    isTravelDay: false,
    missedProtocol: false,
    submittedAt: '2024-12-23T20:00:00',
  },
  {
    id: 'c2',
    userId: 'user-1',
    date: '2024-12-22',
    mood: 3,
    energy: 4,
    notes: 'More energy today!',
    isTravelDay: false,
    missedProtocol: false,
    submittedAt: '2024-12-22T21:00:00',
  },
];

export const mockMessages: Message[] = [
  {
    id: 'm1',
    userId: 'user-1',
    subject: 'Question about supplements',
    content: 'Should I take the probiotics with food or on an empty stomach?',
    sentAt: '2024-12-22T10:00:00',
    isRead: true,
    adminReply: 'Take the probiotic with breakfast for best absorption. Let me know if you have any other questions!',
    repliedAt: '2024-12-22T14:00:00',
  },
];
