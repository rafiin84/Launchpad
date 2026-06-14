export type UserRole = 'founder' | 'investor';
export type PostType = 'win' | 'advice' | 'introduction' | 'insight';
export type PostVisibility = 'portfolio' | 'private' | 'circle';
export type DealStage =
  | 'new'
  | 'reviewing'
  | 'meeting-scheduled'
  | 'due-diligence'
  | 'investment-committee'
  | 'approved'
  | 'rejected'
  | 'invested';
export type MilestoneType = 'revenue' | 'product' | 'team' | 'partnership' | 'award' | 'funding';
export type IntroductionStatus = 'pending' | 'facilitated' | 'connected' | 'declined';
export type IntroductionPurpose = 'customer' | 'partner' | 'advisor' | 'investor' | 'expert';
export type CompanyStage = 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'series-c' | 'growth';
export type KnowledgeCategory =
  | 'Product Strategy'
  | 'Pricing'
  | 'Fundraising'
  | 'Enterprise Sales'
  | 'AI'
  | 'Partnerships'
  | 'Marketing'
  | 'Scaling'
  | 'Operations'
  | 'Legal';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  bio: string;
  company?: Company;
  expertise: string[];
  linkedIn?: string;
  twitter?: string;
  location?: string;
  joinedAt: string;
  followersCount?: number;
}

export interface Company {
  id: string;
  name: string;
  logo: string;
  website: string;
  description: string;
  industry: string;
  stage: CompanyStage;
  foundedYear: number;
  location: string;
  founders: User[];
  publicMilestones: Milestone[];
  tags: string[];
  employeeCount?: number;
  shortDescription?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  createdAt: string;
  reactions: Reaction[];
}

export interface Post {
  id: string;
  type: PostType;
  author: User;
  company?: Company;
  content: string;
  visibility: PostVisibility;
  circleId?: string;
  createdAt: string;
  reactions: Reaction[];
  comments: Comment[];
  tags: string[];
  title?: string;
  metrics?: { label: string; value: string }[];
}

export interface Deal {
  id: string;
  company: Company;
  founder: User;
  stage: DealStage;
  fundingRequested: number;
  notes: string;
  documents: Document[];
  activities: Activity[];
  assignedTo: User;
  createdAt: string;
  updatedAt: string;
  priority: 'low' | 'medium' | 'high';
  industry: string;
  website: string;
}

export interface Application {
  id: string;
  company: Company;
  founder: User;
  stage: DealStage;
  fundingRequested: number;
  deck?: string;
  notes: string;
  submittedAt: string;
  reviewedBy?: User;
  industry: string;
  website: string;
}

export interface Investment {
  id: string;
  company: Company;
  amount: number;
  ownership: number;
  round: string;
  valuation: number;
  date: string;
  fund: Fund;
  notes: string;
  currentValuation?: number;
  moic?: number;
  status: 'active' | 'exited' | 'written-off';
}

export interface Fund {
  id: string;
  name: string;
  totalCapital: number;
  deployedCapital: number;
  vintage: number;
  currency: string;
  investments: Investment[];
  description: string;
  targetReturn?: string;
  focus?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  description: string;
  topic: string;
  author: User;
  participants: User[];
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  tags: string[];
  messageCount: number;
  isAnswered?: boolean;
}

export interface Message {
  id: string;
  author: User;
  content: string;
  createdAt: string;
  reactions: Reaction[];
  isAnswer?: boolean;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: KnowledgeCategory;
  author: User;
  sourceConversationId?: string;
  createdAt: string;
  tags: string[];
  helpful: number;
  views: number;
}

export interface Introduction {
  id: string;
  requestedBy: User;
  targetName: string;
  targetCompany: string;
  targetRole: string;
  purpose: string;
  purposeType: IntroductionPurpose;
  status: IntroductionStatus;
  facilitatedBy?: User;
  createdAt: string;
  notes: string;
  connectedAt?: string;
}

export interface Milestone {
  id: string;
  companyId: string;
  title: string;
  description: string;
  date: string;
  type: MilestoneType;
  isPublic: boolean;
  metrics?: { label: string; value: string }[];
}

export interface Activity {
  id: string;
  type: 'note' | 'meeting' | 'email' | 'call' | 'stage-change' | 'document';
  content: string;
  author: User;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface Document {
  id: string;
  name: string;
  type: 'pitch-deck' | 'financial-model' | 'legal' | 'due-diligence' | 'other';
  url: string;
  uploadedBy: User;
  uploadedAt: string;
  size: string;
}

export interface Circle {
  id: string;
  name: string;
  description: string;
  members: User[];
  createdBy: User;
  createdAt: string;
  tags: string[];
}

export interface AIInsight {
  id: string;
  type: 'summary' | 'suggestion' | 'trend' | 'alert';
  title: string;
  content: string;
  generatedAt: string;
  relevantEntities: string[];
}

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
}
