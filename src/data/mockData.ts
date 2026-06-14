import type {
  User,
  Company,
  Post,
  Deal,
  Application,
  Investment,
  Fund,
  Conversation,
  KnowledgeArticle,
  Introduction,
  Milestone,
  Circle,
} from '../types';

// ─── Users ────────────────────────────────────────────────────────────────────

export const mockInvestor: User = {
  id: 'inv-1',
  name: 'Sarah Chen',
  email: 'sarah@nexusventures.com',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SarahChen',
  role: 'investor',
  bio: 'Partner at Nexus Ventures. Focused on B2B SaaS, AI infrastructure, and developer tools. Former engineer at Stripe.',
  expertise: ['B2B SaaS', 'AI/ML', 'Developer Tools', 'Enterprise Sales'],
  linkedIn: 'https://linkedin.com/in/sarahchen',
  twitter: '@sarahchen_vc',
  location: 'San Francisco, CA',
  joinedAt: '2022-01-15',
  followersCount: 1240,
};

export const mockFounder: User = {
  id: 'f-1',
  name: 'Alex Rivera',
  email: 'alex@synthflow.io',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AlexRivera',
  role: 'founder',
  bio: 'CEO & Co-founder at SynthFlow. Building AI-native workflow automation for enterprise teams. Ex-Salesforce, Stanford CS.',
  expertise: ['AI Automation', 'Enterprise SaaS', 'Product Strategy'],
  linkedIn: 'https://linkedin.com/in/alexrivera',
  twitter: '@alexrivera',
  location: 'San Francisco, CA',
  joinedAt: '2023-03-10',
  followersCount: 320,
};

export const mockUsers: User[] = [
  mockFounder,
  {
    id: 'f-2',
    name: 'Maya Patel',
    email: 'maya@healthbridge.ai',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MayaPatel',
    role: 'founder',
    bio: 'CEO of HealthBridge. Transforming patient data interoperability with AI. Former product lead at Epic Systems.',
    expertise: ['HealthTech', 'AI', 'Product Management', 'Healthcare Ops'],
    location: 'Boston, MA',
    joinedAt: '2023-05-22',
    followersCount: 210,
  },
  {
    id: 'f-3',
    name: 'Jordan Kim',
    email: 'jordan@carbonledger.io',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JordanKim',
    role: 'founder',
    bio: 'Co-founder at CarbonLedger. Building carbon accounting infrastructure for enterprises. Ex-McKinsey, MIT Energy.',
    expertise: ['Climate Tech', 'ESG', 'Enterprise Sales', 'Carbon Markets'],
    location: 'New York, NY',
    joinedAt: '2023-07-01',
    followersCount: 415,
  },
  {
    id: 'f-4',
    name: 'Priya Sharma',
    email: 'priya@stackmind.dev',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PriyaSharma',
    role: 'founder',
    bio: 'CTO & Co-founder at StackMind. AI copilot for software engineering teams. YC W23.',
    expertise: ['Developer Tools', 'AI', 'Platform Engineering'],
    location: 'San Francisco, CA',
    joinedAt: '2023-02-14',
    followersCount: 560,
  },
  {
    id: 'f-5',
    name: 'Marcus Thompson',
    email: 'marcus@supplyvault.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MarcusThompson',
    role: 'founder',
    bio: 'CEO at SupplyVault. Reinventing supply chain visibility for mid-market manufacturers.',
    expertise: ['Supply Chain', 'Manufacturing Tech', 'IoT', 'Enterprise'],
    location: 'Chicago, IL',
    joinedAt: '2023-09-18',
    followersCount: 180,
  },
  {
    id: 'f-6',
    name: 'Lena Schmidt',
    email: 'lena@legalflow.ai',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LenaSchmidt',
    role: 'founder',
    bio: 'Founder at LegalFlow AI. Contract intelligence for in-house legal teams. Ex-Cleary partner.',
    expertise: ['LegalTech', 'AI', 'Enterprise Contracts', 'Compliance'],
    location: 'New York, NY',
    joinedAt: '2023-11-05',
    followersCount: 290,
  },
  mockInvestor,
  {
    id: 'inv-2',
    name: 'David Park',
    email: 'david@nexusventures.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DavidPark',
    role: 'investor',
    bio: 'Principal at Nexus Ventures. Previously founded and sold two SaaS companies. Focused on climate tech and deep tech.',
    expertise: ['Climate Tech', 'Deep Tech', 'SaaS', 'Go-to-Market'],
    location: 'San Francisco, CA',
    joinedAt: '2022-03-01',
    followersCount: 890,
  },
];

// ─── Companies ────────────────────────────────────────────────────────────────

export const mockCompanies: Company[] = [
  {
    id: 'co-1',
    name: 'SynthFlow',
    logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=SynthFlow&backgroundColor=6366f1',
    website: 'https://synthflow.io',
    description:
      'SynthFlow is an AI-native workflow automation platform that helps enterprise teams eliminate repetitive processes. Our no-code AI agents integrate with your existing tools and automate complex multi-step workflows.',
    shortDescription: 'AI-native workflow automation for enterprise teams.',
    industry: 'AI / Enterprise SaaS',
    stage: 'seed',
    foundedYear: 2023,
    location: 'San Francisco, CA',
    founders: [mockFounder],
    publicMilestones: [],
    tags: ['AI', 'Automation', 'Enterprise', 'No-code'],
    employeeCount: 12,
  },
  {
    id: 'co-2',
    name: 'HealthBridge',
    logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=HealthBridge&backgroundColor=10b981',
    website: 'https://healthbridge.ai',
    description:
      'HealthBridge makes patient data interoperable. Our AI platform connects disparate EHR systems, enabling healthcare providers to access complete patient histories instantly.',
    shortDescription: 'AI-powered patient data interoperability.',
    industry: 'HealthTech',
    stage: 'series-a',
    foundedYear: 2022,
    location: 'Boston, MA',
    founders: [mockUsers[1]],
    publicMilestones: [],
    tags: ['HealthTech', 'AI', 'Interoperability', 'EHR'],
    employeeCount: 34,
  },
  {
    id: 'co-3',
    name: 'CarbonLedger',
    logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=CarbonLedger&backgroundColor=22c55e',
    website: 'https://carbonledger.io',
    description:
      'CarbonLedger provides enterprise carbon accounting infrastructure. Real-time emissions tracking, automated reporting, and verified carbon offset procurement in a single platform.',
    shortDescription: 'Enterprise carbon accounting infrastructure.',
    industry: 'Climate Tech',
    stage: 'seed',
    foundedYear: 2023,
    location: 'New York, NY',
    founders: [mockUsers[2]],
    publicMilestones: [],
    tags: ['Climate', 'ESG', 'Carbon', 'Enterprise'],
    employeeCount: 18,
  },
  {
    id: 'co-4',
    name: 'StackMind',
    logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=StackMind&backgroundColor=8b5cf6',
    website: 'https://stackmind.dev',
    description:
      'StackMind is the AI copilot for engineering teams. Code review, architecture guidance, technical documentation, and incident analysis — all powered by LLMs that understand your codebase.',
    shortDescription: 'AI copilot for software engineering teams.',
    industry: 'Developer Tools',
    stage: 'seed',
    foundedYear: 2023,
    location: 'San Francisco, CA',
    founders: [mockUsers[3]],
    publicMilestones: [],
    tags: ['Developer Tools', 'AI', 'DevEx', 'Code Review'],
    employeeCount: 8,
  },
  {
    id: 'co-5',
    name: 'SupplyVault',
    logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=SupplyVault&backgroundColor=f59e0b',
    website: 'https://supplyvault.com',
    description:
      'SupplyVault gives mid-market manufacturers real-time supply chain visibility. IoT sensors, predictive analytics, and supplier risk monitoring in one platform.',
    shortDescription: 'Supply chain visibility for mid-market manufacturers.',
    industry: 'Supply Chain / Manufacturing',
    stage: 'pre-seed',
    foundedYear: 2023,
    location: 'Chicago, IL',
    founders: [mockUsers[4]],
    publicMilestones: [],
    tags: ['Supply Chain', 'Manufacturing', 'IoT', 'Analytics'],
    employeeCount: 6,
  },
  {
    id: 'co-6',
    name: 'LegalFlow AI',
    logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=LegalFlowAI&backgroundColor=0ea5e9',
    website: 'https://legalflow.ai',
    description:
      'LegalFlow AI is contract intelligence for in-house legal teams. Automate contract review, track obligations, and get AI-powered risk analysis — reducing legal cycle times by 70%.',
    shortDescription: 'Contract intelligence for in-house legal teams.',
    industry: 'LegalTech',
    stage: 'seed',
    foundedYear: 2023,
    location: 'New York, NY',
    founders: [mockUsers[5]],
    publicMilestones: [],
    tags: ['LegalTech', 'AI', 'Contracts', 'Compliance'],
    employeeCount: 10,
  },
];

// Assign companies to founders
mockUsers[0].company = mockCompanies[0];
mockUsers[1].company = mockCompanies[1];
mockUsers[2].company = mockCompanies[2];
mockUsers[3].company = mockCompanies[3];
mockUsers[4].company = mockCompanies[4];
mockUsers[5].company = mockCompanies[5];
mockFounder.company = mockCompanies[0];

// ─── Milestones ───────────────────────────────────────────────────────────────

export const mockMilestones: Milestone[] = [
  {
    id: 'm-1',
    companyId: 'co-1',
    title: 'Reached $100K ARR',
    description: 'Hit our first $100K ARR milestone with 15 enterprise customers.',
    date: '2024-02-15',
    type: 'revenue',
    isPublic: true,
    metrics: [{ label: 'ARR', value: '$100K' }, { label: 'Customers', value: '15' }],
  },
  {
    id: 'm-2',
    companyId: 'co-2',
    title: 'Closed Series A — $12M',
    description: 'Raised $12M Series A led by Andreessen Horowitz with Nexus Ventures participating.',
    date: '2024-01-08',
    type: 'funding',
    isPublic: true,
    metrics: [{ label: 'Round Size', value: '$12M' }, { label: 'Lead Investor', value: 'a16z' }],
  },
  {
    id: 'm-3',
    companyId: 'co-3',
    title: 'Fortune 500 customer signed',
    description: '3M signed as our first Fortune 500 customer for enterprise carbon accounting.',
    date: '2024-03-01',
    type: 'partnership',
    isPublic: true,
  },
  {
    id: 'm-4',
    companyId: 'co-4',
    title: 'YC W23 Demo Day — #2 ranked',
    description: 'Ranked #2 at YC W23 Demo Day, raising $2.5M at $15M valuation.',
    date: '2023-09-12',
    type: 'award',
    isPublic: true,
    metrics: [{ label: 'Raise', value: '$2.5M' }, { label: 'Valuation', value: '$15M' }],
  },
  {
    id: 'm-5',
    companyId: 'co-1',
    title: 'Product Launch — Enterprise Edition',
    description: 'Launched Enterprise Edition with SSO, audit logs, and custom AI model support.',
    date: '2024-03-20',
    type: 'product',
    isPublic: true,
  },
];

mockCompanies[0].publicMilestones = [mockMilestones[0], mockMilestones[4]];
mockCompanies[1].publicMilestones = [mockMilestones[1]];
mockCompanies[2].publicMilestones = [mockMilestones[2]];
mockCompanies[3].publicMilestones = [mockMilestones[3]];

// ─── Feed Posts ───────────────────────────────────────────────────────────────

export const mockPosts: Post[] = [
  {
    id: 'p-1',
    type: 'win',
    author: mockFounder,
    company: mockCompanies[0],
    title: 'We hit $100K ARR! 🚀',
    content:
      "After 8 months of building, we just crossed $100K ARR with 15 enterprise customers. When we started SynthFlow, we were told AI workflow automation was \"too early\" for enterprise. Turns out, timing was everything — enterprises are desperate to automate right now.\n\nKey lessons: (1) Start with one painful workflow, not a platform. (2) Enterprise customers will pay for reliability, not just features. (3) Annual contracts from day one changed our cash flow completely.\n\nThank you to everyone in this community who gave advice, made introductions, and shared their lessons. We're just getting started.",
    visibility: 'portfolio',
    createdAt: '2024-03-15T14:30:00Z',
    tags: ['milestone', 'revenue', 'enterprise'],
    reactions: [
      { emoji: '🚀', count: 24, userReacted: false },
      { emoji: '🎉', count: 18, userReacted: true },
      { emoji: '💪', count: 12, userReacted: false },
    ],
    comments: [
      {
        id: 'c-1',
        author: mockUsers[1],
        content: 'Massive congrats, Alex! The annual contract insight is gold. How long did it take to convince your first customer to go annual?',
        createdAt: '2024-03-15T15:00:00Z',
        reactions: [{ emoji: '👍', count: 5, userReacted: false }],
      },
      {
        id: 'c-2',
        author: mockInvestor,
        content: "This is the kind of milestone that matters. 15 customers paying for enterprise automation — that's real signal. Proud to support you.",
        createdAt: '2024-03-15T15:45:00Z',
        reactions: [{ emoji: '🙌', count: 8, userReacted: false }],
      },
    ],
    metrics: [{ label: 'ARR', value: '$100K' }, { label: 'Customers', value: '15' }],
  },
  {
    id: 'p-2',
    type: 'advice',
    author: mockUsers[2],
    company: mockCompanies[2],
    title: 'How do you structure enterprise pricing for ESG software?',
    content:
      "We're trying to figure out pricing for CarbonLedger's enterprise tier. We have 3 Fortune 500s interested but every pricing conversation is different.\n\nOptions we're considering:\n• Per-employee (simple, scales with size)\n• Per-ton of CO2 tracked (aligned with value but hard to estimate)\n• Platform fee + modules (complex but flexible)\n• Flat annual license by revenue band\n\nAnyone sold ESG/compliance software to large enterprises? What models have worked? What blew up in your face?",
    visibility: 'portfolio',
    createdAt: '2024-03-14T10:00:00Z',
    tags: ['pricing', 'enterprise', 'ESG'],
    reactions: [
      { emoji: '💡', count: 15, userReacted: false },
      { emoji: '👀', count: 22, userReacted: true },
    ],
    comments: [
      {
        id: 'c-3',
        author: mockUsers[5],
        content:
          "Platform fee + modules is what I'd recommend. We tried per-user at LegalFlow and it created friction when customers wanted to expand usage. A base platform fee with add-on modules lets you grow ACV over time without renegotiating.",
        createdAt: '2024-03-14T11:30:00Z',
        reactions: [{ emoji: '🙏', count: 7, userReacted: false }],
      },
      {
        id: 'c-4',
        author: mockInvestor,
        content:
          "Revenue bands work really well for compliance software — enterprises prefer predictability. $50K-$100K-$200K tiers based on revenue is clean and easy to defend in budget conversations.",
        createdAt: '2024-03-14T12:00:00Z',
        reactions: [{ emoji: '👍', count: 11, userReacted: false }],
      },
    ],
  },
  {
    id: 'p-3',
    type: 'introduction',
    author: mockUsers[3],
    company: mockCompanies[3],
    title: 'Looking for introductions to CTOs at mid-size tech companies',
    content:
      "StackMind is hitting a wall on enterprise distribution. Our product sells itself once engineers see it, but we're struggling to get in front of the right CTOs and VP Engs at 200-2000 person tech companies.\n\nIdeally looking for warm intros to engineering leaders at companies like:\n• Series B/C SaaS companies scaling engineering teams\n• Mid-size fintechs (100-500 engineers)\n• E-commerce companies building in-house platforms\n\nWe have strong case studies from early customers. Just need the door open. Anyone have connections they'd be willing to make?",
    visibility: 'portfolio',
    createdAt: '2024-03-13T09:00:00Z',
    tags: ['introduction', 'enterprise', 'developer-tools'],
    reactions: [
      { emoji: '🤝', count: 8, userReacted: false },
      { emoji: '💪', count: 5, userReacted: false },
    ],
    comments: [
      {
        id: 'c-5',
        author: mockInvestor,
        content:
          "Priya — I know the CTO at Gusto and the VP Eng at Rippling. Let me make some intros this week. DM me your one-pager.",
        createdAt: '2024-03-13T10:00:00Z',
        reactions: [{ emoji: '🙏', count: 14, userReacted: false }],
      },
    ],
  },
  {
    id: 'p-4',
    type: 'insight',
    author: mockUsers[1],
    company: mockCompanies[1],
    title: 'What I learned closing our Series A in 90 days',
    content:
      "We just closed a $12M Series A in 90 days. Here's what actually worked (and what I'd never do again):\n\n**What worked:**\n→ Started with 40 investors, cut to 10 within 2 weeks based on fit signals\n→ Created FOMO by announcing our lead before all closes were done\n→ Used our customer NPS score (72) as the opening line of every pitch\n→ The data room was immaculate — no back-and-forth on document requests\n\n**What I'd do differently:**\n→ Don't lead with product — lead with the problem and who's suffering\n→ Partner check calls are not due diligence — have real customer references ready immediately\n→ Never wait for a term sheet to negotiate — know your terms before you get in the room\n\nThis community gave me critical feedback on my pitch 6 weeks before I started. That made all the difference.",
    visibility: 'portfolio',
    createdAt: '2024-03-12T16:00:00Z',
    tags: ['fundraising', 'series-a', 'lessons-learned'],
    reactions: [
      { emoji: '🔥', count: 42, userReacted: true },
      { emoji: '💡', count: 31, userReacted: false },
      { emoji: '🙏', count: 19, userReacted: false },
    ],
    comments: [
      {
        id: 'c-6',
        author: mockFounder,
        content: "Maya this is exactly what I needed to read right now. Saving this. The bit about partner checks vs real references is eye-opening.",
        createdAt: '2024-03-12T17:00:00Z',
        reactions: [{ emoji: '👍', count: 9, userReacted: false }],
      },
      {
        id: 'c-7',
        author: mockUsers[2],
        content: 'The FOMO tactic by announcing lead early — did that create any awkward dynamics with investors who were still in diligence?',
        createdAt: '2024-03-12T17:30:00Z',
        reactions: [],
      },
    ],
  },
  {
    id: 'p-5',
    type: 'win',
    author: mockUsers[4],
    company: mockCompanies[4],
    title: 'First paying customer — $48K ACV deal signed',
    content:
      "SupplyVault just closed our first paying customer — a $48K ACV annual contract with Acme Manufacturing (500 employees, $200M revenue). \n\nThis took 4 months of sales cycles, 3 pilots, and more than a few moments where I thought we'd lose it. But we didn't.\n\nThe insight that unlocked the deal: we stopped selling \"supply chain visibility\" and started selling \"30 fewer hours per week in supplier email chaos for your procurement team.\" Operations ROI over platform pitch.\n\nTo every founder here still grinding for that first real contract — it happens. Keep going.",
    visibility: 'portfolio',
    createdAt: '2024-03-11T11:00:00Z',
    tags: ['milestone', 'first-customer', 'enterprise-sales'],
    reactions: [
      { emoji: '🎉', count: 29, userReacted: true },
      { emoji: '🚀', count: 22, userReacted: false },
    ],
    comments: [],
    metrics: [{ label: 'ACV', value: '$48K' }, { label: 'Sales Cycle', value: '4 months' }],
  },
  {
    id: 'p-6',
    type: 'insight',
    author: mockUsers[5],
    company: mockCompanies[5],
    title: 'Why we switched from sales-led to product-led growth',
    content:
      "After 6 months of outbound sales at LegalFlow, I made a counterintuitive decision: kill the SDR playbook and go PLG.\n\nHere's why it worked for us:\n\n1. Our buyers (in-house lawyers) are sophisticated and hate cold outreach\n2. The product sells itself if they actually touch it\n3. Free tier → paid conversion was 34% when self-serve was possible\n4. Outbound close rate was under 8% with long 90-day cycles\n\nThe pivot wasn't painless. We had to rebuild our onboarding, create a freemium tier, and retrain our 2-person sales team to be customer success.\n\nNow: 60% of new revenue comes from self-serve. Cost of acquisition dropped 65%. Sales team now focuses on upmarket expansion.\n\nIf you're selling to individual professionals inside large companies — PLG might be right for you.",
    visibility: 'portfolio',
    createdAt: '2024-03-10T09:30:00Z',
    tags: ['growth', 'PLG', 'GTM', 'strategy'],
    reactions: [
      { emoji: '💡', count: 38, userReacted: false },
      { emoji: '🔥', count: 27, userReacted: true },
    ],
    comments: [],
  },
];

// ─── Applications ─────────────────────────────────────────────────────────────

export const mockApplications: Application[] = [
  {
    id: 'app-1',
    company: mockCompanies[0],
    founder: mockFounder,
    stage: 'investing' as never,
    fundingRequested: 2500000,
    notes: 'Strong enterprise traction. Alex has great instincts on positioning.',
    submittedAt: '2024-01-15T10:00:00Z',
    reviewedBy: mockInvestor,
    industry: 'AI / Enterprise SaaS',
    website: 'https://synthflow.io',
  },
  {
    id: 'app-2',
    company: mockCompanies[2],
    founder: mockUsers[2],
    stage: 'due-diligence',
    fundingRequested: 3000000,
    notes: 'Carbon accounting is heating up. Fortune 500 pipeline is impressive for pre-seed.',
    submittedAt: '2024-02-20T14:00:00Z',
    reviewedBy: mockInvestor,
    industry: 'Climate Tech',
    website: 'https://carbonledger.io',
  },
  {
    id: 'app-3',
    company: mockCompanies[3],
    founder: mockUsers[3],
    stage: 'meeting-scheduled',
    fundingRequested: 2000000,
    notes: 'YC pedigree and strong product. Dev tools space is competitive though.',
    submittedAt: '2024-03-01T09:00:00Z',
    industry: 'Developer Tools',
    website: 'https://stackmind.dev',
  },
  {
    id: 'app-4',
    company: mockCompanies[4],
    founder: mockUsers[4],
    stage: 'reviewing',
    fundingRequested: 1500000,
    notes: 'Interesting niche. First customer validation is promising.',
    submittedAt: '2024-03-10T11:00:00Z',
    industry: 'Supply Chain',
    website: 'https://supplyvault.com',
  },
  {
    id: 'app-5',
    company: mockCompanies[5],
    founder: mockUsers[5],
    stage: 'investment-committee',
    fundingRequested: 2500000,
    notes: "Lena's background is exceptional. PLG pivot shows maturity.",
    submittedAt: '2024-02-05T16:00:00Z',
    reviewedBy: mockInvestor,
    industry: 'LegalTech',
    website: 'https://legalflow.ai',
  },
  {
    id: 'app-6',
    company: {
      id: 'co-7',
      name: 'DataPulse',
      logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=DataPulse&backgroundColor=ef4444',
      website: 'https://datapulse.io',
      description: 'Real-time data observability for modern data stacks.',
      shortDescription: 'Data observability for modern data stacks.',
      industry: 'Data Engineering',
      stage: 'pre-seed',
      foundedYear: 2024,
      location: 'Austin, TX',
      founders: [],
      publicMilestones: [],
      tags: ['Data', 'Observability', 'Analytics'],
    },
    founder: {
      id: 'f-7',
      name: 'Ryan Foster',
      email: 'ryan@datapulse.io',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=RyanFoster',
      role: 'founder',
      bio: 'Former Databricks engineer building data observability tooling.',
      expertise: ['Data Engineering', 'Distributed Systems'],
      location: 'Austin, TX',
      joinedAt: '2024-01-01',
    },
    stage: 'new',
    fundingRequested: 1000000,
    notes: '',
    submittedAt: '2024-03-18T08:00:00Z',
    industry: 'Data Engineering',
    website: 'https://datapulse.io',
  },
];

// ─── Deals ─────────────────────────────────────────────────────────────────────

export const mockDeals: Deal[] = [
  {
    id: 'd-1',
    company: mockCompanies[0],
    founder: mockFounder,
    stage: 'invested',
    fundingRequested: 2500000,
    notes: 'Closed Seed round. $2.5M at $12M pre-money. Nexus leading with $1.5M.',
    documents: [],
    activities: [
      {
        id: 'act-1',
        type: 'stage-change',
        content: 'Deal moved to Invested. Wire sent.',
        author: mockInvestor,
        createdAt: '2024-02-01T10:00:00Z',
      },
      {
        id: 'act-2',
        type: 'note',
        content: 'IC approved with 4-0 vote. Strong conviction on enterprise AI timing.',
        author: mockInvestor,
        createdAt: '2024-01-28T15:00:00Z',
      },
    ],
    assignedTo: mockInvestor,
    createdAt: '2024-01-05T10:00:00Z',
    updatedAt: '2024-02-01T10:00:00Z',
    priority: 'high',
    industry: 'AI / Enterprise SaaS',
    website: 'https://synthflow.io',
  },
  {
    id: 'd-2',
    company: mockCompanies[4],
    founder: mockUsers[4],
    stage: 'due-diligence',
    fundingRequested: 1500000,
    notes: 'First customer validates the model. Need to understand scalability of the hardware component.',
    documents: [],
    activities: [
      {
        id: 'act-3',
        type: 'meeting',
        content: 'Partner meeting with Marcus. Very impressed by manufacturing expertise.',
        author: mockInvestor,
        createdAt: '2024-03-12T14:00:00Z',
      },
    ],
    assignedTo: mockUsers[7],
    createdAt: '2024-03-01T09:00:00Z',
    updatedAt: '2024-03-15T11:00:00Z',
    priority: 'medium',
    industry: 'Supply Chain',
    website: 'https://supplyvault.com',
  },
  {
    id: 'd-3',
    company: mockCompanies[2],
    founder: mockUsers[2],
    stage: 'investment-committee',
    fundingRequested: 3000000,
    notes: 'Fortune 500 signed. Carbon market timing is right. Team is exceptional.',
    documents: [],
    activities: [],
    assignedTo: mockUsers[7],
    createdAt: '2024-02-10T10:00:00Z',
    updatedAt: '2024-03-20T16:00:00Z',
    priority: 'high',
    industry: 'Climate Tech',
    website: 'https://carbonledger.io',
  },
];

// ─── Investments ──────────────────────────────────────────────────────────────

const nexusFund1: Fund = {
  id: 'fund-1',
  name: 'Nexus Ventures Fund I',
  totalCapital: 50000000,
  deployedCapital: 32000000,
  vintage: 2022,
  currency: 'USD',
  investments: [],
  description: 'Early-stage B2B SaaS and AI infrastructure. 18 portfolio companies.',
  targetReturn: '4x-6x net',
  focus: ['B2B SaaS', 'AI Infrastructure', 'Developer Tools', 'Climate Tech'],
};

const nexusFund2: Fund = {
  id: 'fund-2',
  name: 'Nexus Ventures Fund II',
  totalCapital: 80000000,
  deployedCapital: 8000000,
  vintage: 2024,
  currency: 'USD',
  investments: [],
  description: 'Expanding into Series A. Focus on AI-native companies and climate infrastructure.',
  targetReturn: '5x-8x net',
  focus: ['AI-Native Companies', 'Climate Tech', 'Enterprise Automation'],
};

export const mockFunds: Fund[] = [nexusFund1, nexusFund2];

export const mockInvestments: Investment[] = [
  {
    id: 'inv-1',
    company: mockCompanies[0],
    amount: 1500000,
    ownership: 12.5,
    round: 'Seed',
    valuation: 12000000,
    date: '2024-02-01',
    fund: nexusFund2,
    notes: 'Lead investor in Seed round. $2.5M total raise.',
    currentValuation: 12000000,
    moic: 1.0,
    status: 'active',
  },
  {
    id: 'inv-2',
    company: mockCompanies[1],
    amount: 3000000,
    ownership: 8.5,
    round: 'Series A',
    valuation: 35000000,
    date: '2024-01-08',
    fund: nexusFund1,
    notes: 'Follow-on from Seed. Strong NPS and ARR growth justified Series A participation.',
    currentValuation: 35000000,
    moic: 1.4,
    status: 'active',
  },
  {
    id: 'inv-3',
    company: mockCompanies[3],
    amount: 500000,
    ownership: 3.3,
    round: 'Seed',
    valuation: 15000000,
    date: '2023-09-15',
    fund: nexusFund1,
    notes: 'YC batch investment. Participating in YC SAFE.',
    currentValuation: 18000000,
    moic: 1.2,
    status: 'active',
  },
  {
    id: 'inv-4',
    company: mockCompanies[5],
    amount: 2000000,
    ownership: 15.0,
    round: 'Seed',
    valuation: 13300000,
    date: '2023-11-20',
    fund: nexusFund1,
    notes: "Co-lead with Bessemer. Lena's network in legal gives us distribution advantage.",
    currentValuation: 20000000,
    moic: 1.5,
    status: 'active',
  },
];

nexusFund1.investments = [mockInvestments[1], mockInvestments[2], mockInvestments[3]];
nexusFund2.investments = [mockInvestments[0]];

// ─── Conversations ────────────────────────────────────────────────────────────

export const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Best strategies for enterprise procurement cycles',
    description: 'How do you navigate long enterprise procurement cycles without losing momentum?',
    topic: 'Enterprise Sales',
    author: mockFounder,
    participants: [mockFounder, mockUsers[1], mockUsers[2], mockInvestor],
    messages: [
      {
        id: 'msg-1',
        author: mockFounder,
        content:
          "We're 6 weeks into a procurement cycle with a Fortune 500 and it's stalling. Legal review is taking forever. Anyone have experience keeping deals warm during long procurement cycles without being annoying?",
        createdAt: '2024-03-10T09:00:00Z',
        reactions: [{ emoji: '👀', count: 12, userReacted: false }],
      },
      {
        id: 'msg-2',
        author: mockUsers[1],
        content:
          "Find your internal champion and give them ammunition to push internally. Create a one-pager with the business case framed in terms of their KPIs — not your features. They need to sell it to their CFO.",
        createdAt: '2024-03-10T10:30:00Z',
        reactions: [{ emoji: '🙌', count: 8, userReacted: true }],
        isAnswer: true,
      },
      {
        id: 'msg-3',
        author: mockInvestor,
        content:
          "Create urgency without being desperate. A limited pilot offer or pricing that expires at end of quarter can accelerate without feeling pushy. Also — identify the 3 people who can say no and make sure none of them have objections.",
        createdAt: '2024-03-10T11:00:00Z',
        reactions: [{ emoji: '💡', count: 11, userReacted: false }],
      },
    ],
    createdAt: '2024-03-10T09:00:00Z',
    updatedAt: '2024-03-12T14:00:00Z',
    isPinned: true,
    tags: ['enterprise', 'sales', 'procurement'],
    messageCount: 12,
    isAnswered: true,
  },
  {
    id: 'conv-2',
    title: 'How are you structuring your AI pricing model?',
    description: 'Usage-based, seat-based, or hybrid? What is working and what is not?',
    topic: 'Pricing',
    author: mockUsers[3],
    participants: [mockUsers[3], mockFounder, mockUsers[5], mockInvestor],
    messages: [
      {
        id: 'msg-4',
        author: mockUsers[3],
        content:
          "With AI tools, usage-based pricing makes sense theoretically (you pay for what you use) but in practice enterprise customers hate variable bills. How are others handling this?",
        createdAt: '2024-03-08T14:00:00Z',
        reactions: [{ emoji: '🤔', count: 9, userReacted: false }],
      },
      {
        id: 'msg-5',
        author: mockFounder,
        content:
          "We went with a hybrid: flat platform fee for 1,000 AI actions/month, then overage pricing above that. Enterprise customers love predictability in their base cost, with a clear path to expansion. Overage rarely triggers in practice but it shows the value.",
        createdAt: '2024-03-08T15:30:00Z',
        reactions: [{ emoji: '💡', count: 14, userReacted: true }],
        isAnswer: true,
      },
    ],
    createdAt: '2024-03-08T14:00:00Z',
    updatedAt: '2024-03-11T10:00:00Z',
    isPinned: false,
    tags: ['pricing', 'AI', 'enterprise', 'SaaS'],
    messageCount: 8,
    isAnswered: true,
  },
  {
    id: 'conv-3',
    title: 'Navigating conflicting VC feedback after Series A pitches',
    description: 'VCs are giving us completely contradictory feedback. How do you filter signal from noise?',
    topic: 'Fundraising',
    author: mockUsers[2],
    participants: [mockUsers[2], mockUsers[1], mockFounder, mockInvestor],
    messages: [
      {
        id: 'msg-6',
        author: mockUsers[2],
        content:
          "We just finished our first 10 investor meetings. Feedback is completely contradictory:\n- 3 said our market is too small\n- 2 said our market is too crowded\n- 3 said we're too early\n- 2 said this is the perfect timing\n\nHow do I know which feedback to take seriously?",
        createdAt: '2024-03-06T11:00:00Z',
        reactions: [{ emoji: '😅', count: 7, userReacted: false }],
      },
      {
        id: 'msg-7',
        author: mockInvestor,
        content:
          "From the other side of the table: conflicting feedback often means your narrative isn't clear enough. If investors are drawing different conclusions, you're not controlling the story. The signal to look for: feedback that comes up 3+ times from investors who actually understand your space.",
        createdAt: '2024-03-06T12:30:00Z',
        reactions: [{ emoji: '🙌', count: 16, userReacted: true }],
        isAnswer: true,
      },
    ],
    createdAt: '2024-03-06T11:00:00Z',
    updatedAt: '2024-03-09T16:00:00Z',
    isPinned: false,
    tags: ['fundraising', 'VC', 'Series A', 'pitch'],
    messageCount: 9,
    isAnswered: true,
  },
  {
    id: 'conv-4',
    title: 'Building async-first culture with a remote team',
    description: 'How do you maintain alignment and move fast without constant meetings?',
    topic: 'Scaling',
    author: mockUsers[4],
    participants: [mockUsers[4], mockFounder, mockUsers[3]],
    messages: [
      {
        id: 'msg-8',
        author: mockUsers[4],
        content:
          "We grew from 2 to 8 people in 3 months (all remote). Communication is starting to break down. Meetings are multiplying. What does a healthy async-first culture actually look like when you're this small?",
        createdAt: '2024-03-04T09:00:00Z',
        reactions: [{ emoji: '👀', count: 11, userReacted: false }],
      },
    ],
    createdAt: '2024-03-04T09:00:00Z',
    updatedAt: '2024-03-07T10:00:00Z',
    isPinned: false,
    tags: ['culture', 'remote', 'team', 'operations'],
    messageCount: 5,
    isAnswered: false,
  },
];

// ─── Knowledge Articles ───────────────────────────────────────────────────────

export const mockKnowledgeArticles: KnowledgeArticle[] = [
  {
    id: 'k-1',
    title: 'How to Keep Enterprise Deals Moving During Long Procurement Cycles',
    summary: 'Practical tactics for maintaining momentum when procurement timelines stretch beyond 60 days.',
    content: `Enterprise deals often stall in procurement — legal review, security review, and budget approvals can drag for months. Here are the proven tactics that work.

**Find and empower your internal champion**
Your internal champion needs to sell the deal internally just as much as you do. Give them a business case document framed in their company's language — ROI, headcount efficiency, risk reduction. Make it easy for them to present upward.

**Identify every stakeholder who can say "no"**
Map the buying committee. Find the legal team, the CFO's office, the security team, and the IT team. Proactively address their concerns before they become blockers.

**Create legitimate urgency**
Don't invent urgency. Find real leverage: a pricing window, a fiscal year end, a quarter-end incentive, or a limited onboarding slot. Artificial urgency is transparent and damages trust.

**Maintain high-value touchpoints**
During the waiting period, don't go dark. Share relevant content: a case study from a similar company, a product update that addresses their use case, an industry report. Stay top-of-mind as a valuable partner.

**Track every decision milestone**
Know when legal review is expected to complete. Know the budget approval timeline. Know the IT security review timeline. Build a shared project plan with your champion.`,
    category: 'Enterprise Sales',
    author: mockInvestor,
    sourceConversationId: 'conv-1',
    createdAt: '2024-03-12T10:00:00Z',
    tags: ['enterprise', 'sales', 'procurement', 'deals'],
    helpful: 34,
    views: 218,
  },
  {
    id: 'k-2',
    title: 'AI SaaS Pricing Models: What Works in 2024',
    summary: 'Usage-based vs seat-based vs hybrid pricing for AI-native products — a practical guide from portfolio founders.',
    content: `AI products have created new pricing challenges. Traditional seat-based models don't capture value, but pure usage-based pricing creates budget uncertainty for enterprise buyers.

**The Hybrid Model**
The emerging best practice: a flat platform fee covering a meaningful baseline of usage, with transparent overage pricing above that threshold. This gives enterprise buyers predictability while creating a natural expansion path.

**Per-Outcome Pricing**
The most sophisticated model — you charge based on results, not inputs. If your AI saves 10 hours per week per user, you price as a fraction of that value. This requires strong ROI measurement.

**Avoid Pure Token-Based Pricing**
Charging enterprises by the token creates budget anxiety and procurement headaches. Bundle token costs into your platform fee.

**Annual Contracts Over Monthly**
Enterprise AI buyers want to plan budgets. Push for annual contracts — it improves your cash flow and reduces churn risk.`,
    category: 'Pricing',
    author: mockFounder,
    sourceConversationId: 'conv-2',
    createdAt: '2024-03-09T11:00:00Z',
    tags: ['pricing', 'AI', 'SaaS', 'enterprise'],
    helpful: 51,
    views: 347,
  },
  {
    id: 'k-3',
    title: 'Reading VC Feedback: Signal vs. Noise in Fundraising',
    summary: 'How to extract actionable signal from contradictory investor feedback during a fundraising process.',
    content: `Every founder who has fundraised has experienced contradictory VC feedback. "Your market is too small" from one firm, "your market is too crowded" from another. How do you make sense of it?

**Look for frequency, not volume**
Feedback that comes up 3+ times from different investors is signal. Feedback that appears once is noise — or that investor's specific thesis.

**Filter by investor expertise**
A generalist VC's opinion on your technical architecture is worth less than a deep tech specialist's. Weight feedback by investor domain knowledge.

**When narrative is the problem**
Contradictory feedback often indicates your pitch isn't controlling the story. If investors are drawing wildly different conclusions, your narrative is ambiguous. Tighten it.

**Use rejections as market research**
"The market is too early" three times in a row means your product might need more validation before the round. That's valuable.

**The investor who gives specific, detailed feedback**
This person is actually interested. Engaged investors share specific concerns because they're trying to get comfortable. Follow up with responses.`,
    category: 'Fundraising',
    author: mockInvestor,
    sourceConversationId: 'conv-3',
    createdAt: '2024-03-07T12:00:00Z',
    tags: ['fundraising', 'VC', 'pitch', 'series-a'],
    helpful: 67,
    views: 412,
  },
  {
    id: 'k-4',
    title: 'Product-Led Growth for B2B: When PLG Works and When It Fails',
    summary: 'The conditions under which PLG outperforms sales-led growth — and the common pitfalls to avoid.',
    content: `Product-led growth is not a silver bullet. It works under specific conditions and fails under others.

**When PLG Works**
- Individual users have buying authority or strong influence
- Time-to-value is short (under 10 minutes to first "aha" moment)
- Product naturally spreads within an organization
- Marginal cost to add users is near zero
- Your buyers are technically sophisticated

**When PLG Fails**
- Enterprise procurement requires executive sign-off
- Setup requires significant configuration or integration
- The product is a platform that needs consultative implementation
- Your buyers are non-technical decision-makers

**The Hybrid Model**
Most successful B2B companies use PLG for top-of-funnel (individual users discover and love the product) with a sales team that expands accounts upmarket (converting individual users into enterprise contracts).

**Freemium Design Principles**
Your free tier should demonstrate value without delivering it. The premium features should be the ones that enterprise teams specifically need: SSO, audit logs, admin controls, integrations, advanced analytics.`,
    category: 'Marketing',
    author: mockUsers[5],
    createdAt: '2024-03-05T14:00:00Z',
    tags: ['PLG', 'growth', 'SaaS', 'GTM'],
    helpful: 44,
    views: 289,
  },
];

// ─── Introductions ────────────────────────────────────────────────────────────

export const mockIntroductions: Introduction[] = [
  {
    id: 'intro-1',
    requestedBy: mockUsers[3],
    targetName: 'Li Wei',
    targetCompany: 'Gusto',
    targetRole: 'CTO',
    purpose: 'Looking to get feedback on StackMind from engineering leaders at growing tech companies.',
    purposeType: 'customer',
    status: 'facilitated',
    facilitatedBy: mockInvestor,
    createdAt: '2024-03-13T10:00:00Z',
    notes: 'Sarah connected via LinkedIn intro. Call scheduled for March 22.',
    connectedAt: '2024-03-14T09:00:00Z',
  },
  {
    id: 'intro-2',
    requestedBy: mockFounder,
    targetName: 'James Martinez',
    targetCompany: 'Stripe',
    targetRole: 'Head of Partnerships',
    purpose: 'SynthFlow automates reconciliation workflows — exploring partnership with Stripe for joint GTM.',
    purposeType: 'partner',
    status: 'pending',
    createdAt: '2024-03-15T11:00:00Z',
    notes: '',
  },
  {
    id: 'intro-3',
    requestedBy: mockUsers[2],
    targetName: 'Dr. Aisha Nkosi',
    targetCompany: 'MIT Climate Policy Lab',
    targetRole: 'Research Director',
    purpose: 'CarbonLedger looking for academic validation and potential research partnership on carbon accounting methodology.',
    purposeType: 'expert',
    status: 'connected',
    facilitatedBy: mockUsers[7],
    createdAt: '2024-02-28T09:00:00Z',
    notes: 'Research collaboration in progress. Dr. Nkosi advising on carbon methodology.',
    connectedAt: '2024-03-05T10:00:00Z',
  },
  {
    id: 'intro-4',
    requestedBy: mockUsers[4],
    targetName: 'Chen Wei',
    targetCompany: 'Foxconn Technology Group',
    targetRole: 'VP of Supply Chain Innovation',
    purpose: 'Looking for manufacturing enterprise design partner for SupplyVault.',
    purposeType: 'customer',
    status: 'pending',
    createdAt: '2024-03-16T14:00:00Z',
    notes: '',
  },
];

// ─── Circles ──────────────────────────────────────────────────────────────────

export const mockCircles: Circle[] = [
  {
    id: 'circle-1',
    name: 'AI Founders',
    description: 'Founders building AI-native products',
    members: [mockFounder, mockUsers[3], mockUsers[5]],
    createdBy: mockInvestor,
    createdAt: '2023-06-01',
    tags: ['AI', 'LLM', 'ML'],
  },
  {
    id: 'circle-2',
    name: 'Climate Tech',
    description: 'Founders working on climate and sustainability',
    members: [mockUsers[2]],
    createdBy: mockUsers[7],
    createdAt: '2023-08-15',
    tags: ['Climate', 'ESG', 'Sustainability'],
  },
  {
    id: 'circle-3',
    name: 'Enterprise SaaS',
    description: 'B2B SaaS founders navigating enterprise go-to-market',
    members: [mockFounder, mockUsers[1], mockUsers[4], mockUsers[5]],
    createdBy: mockInvestor,
    createdAt: '2023-04-20',
    tags: ['Enterprise', 'B2B', 'SaaS'],
  },
];
