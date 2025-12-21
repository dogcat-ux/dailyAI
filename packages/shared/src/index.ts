export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export interface JournalEntry {
  id: string;
  content: string;
  moodScore: number;
  tags: string[];
  createdAt: Date;
}

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: Date;
}
