/**
 * Portfolio Management — one record per portfolio company, in a single CRM
 * module (`Portfolio_Management`). Everything about a company lives on its
 * record: the table fields, and its timeline of events as JSON in the
 * `Timeline_Events` large-text field (see lib/portfolioTimeline.ts). Health
 * rules are a config file (config/portfolioHealthRules.ts), not a module.
 *
 * Investor-side only: Administrator / Standard / Investor profiles, read with
 * the investor's own token, so Zoho's record and field permissions are what
 * govern access (and therefore exports — see the export in the page).
 *
 * `Company` is a lookup to the Companies module (API name `Portfolios`). That
 * lookup is the only join; sector/geography/stage are snapshots kept here so the
 * allocation views can group on them without fetching every company.
 */
import { zohoList, zohoCreate, zohoUpdate, zohoGetById, type ZohoRecord } from './zohoApi';
import { parseHealthStatus, type HealthStatus } from '../lib/portfolioHealth';
import { appendEvent, parseTimeline, type NewEventInput, type TimelineEvent } from '../lib/portfolioTimeline';

export const PM_MODULE = 'Portfolio_Management';

export const STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth'] as const;
export const STATUSES = ['Active', 'On Hold', 'Exited', 'Written Off'] as const;
export const MEMBERSHIP_BASES = ['Confirmed Investment', 'Authorized Relationship'] as const;

export interface PortfolioEntry {
  id: string;
  name: string;
  /** Record id of the company in the Companies module, or ''. */
  companyId: string;
  companyName: string;
  membershipBasis: string;
  confirmedOn: string;
  initialInvestmentDate: string;
  totalInvested: number | null;
  latestValuation: number | null;
  valuationAsOf: string;
  ownershipPct: number | null;
  status: string;
  exitDate: string;
  sector: string;
  geography: string;
  currentStage: string;
  investmentYear: number | null;
  /** Health as recorded by hand in CRM — only used when no rule can be evaluated. */
  recordedHealth: HealthStatus;
  recordedHealthReason: string;
  healthAsOf: string;
  reportingPeriod: string;
  metricsAsOf: string;
  latestRevenue: number | null;
  revenueGrowthPct: number | null;
  monthlyBurn: number | null;
  runwayMonths: number | null;
  headcount: number | null;
  openRoles: number | null;
  lastCompanyUpdate: string;
  notes: string;
  /** Events recorded on this company, newest first. */
  timeline: TimelineEvent[];
  /** The raw stored JSON — kept so an append never rewrites what it didn't parse. */
  timelineJson: string;
  modifiedTime: string;
}

const PM_FIELDS = [
  'Name', 'Company', 'Membership_Basis', 'Confirmed_On', 'Initial_Investment_Date', 'Total_Invested',
  'Latest_Valuation', 'Valuation_As_Of', 'Ownership_Percentage', 'Investment_Status', 'Exit_Date',
  'Sector', 'Geography', 'Current_Stage', 'Investment_Year', 'Health_Status', 'Health_Reason',
  'Health_As_Of', 'Reporting_Period', 'Metrics_As_Of', 'Latest_Revenue', 'Revenue_Growth_Percentage',
  'Monthly_Burn_Rate', 'Runway_Months', 'Headcount', 'Open_Roles', 'Last_Company_Update',
  'Investment_Notes', 'Timeline_Events', 'Modified_Time',
].join(',');

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const lookupId = (v: unknown): string =>
  v && typeof v === 'object' ? str((v as Record<string, unknown>).id) : '';
const lookupName = (v: unknown): string =>
  v && typeof v === 'object' ? str((v as Record<string, unknown>).name) : '';

function fromRecord(r: ZohoRecord): PortfolioEntry {
  const company = r['Company'];
  return {
    id: r.id,
    name: str(r['Name']),
    companyId: lookupId(company),
    companyName: lookupName(company) || str(r['Name']),
    membershipBasis: str(r['Membership_Basis']),
    confirmedOn: str(r['Confirmed_On']),
    initialInvestmentDate: str(r['Initial_Investment_Date']),
    totalInvested: num(r['Total_Invested']),
    latestValuation: num(r['Latest_Valuation']),
    valuationAsOf: str(r['Valuation_As_Of']),
    ownershipPct: num(r['Ownership_Percentage']),
    status: str(r['Investment_Status']),
    exitDate: str(r['Exit_Date']),
    sector: str(r['Sector']),
    geography: str(r['Geography']),
    currentStage: str(r['Current_Stage']),
    investmentYear: num(r['Investment_Year']),
    recordedHealth: parseHealthStatus(str(r['Health_Status'])),
    recordedHealthReason: str(r['Health_Reason']),
    healthAsOf: str(r['Health_As_Of']),
    reportingPeriod: str(r['Reporting_Period']),
    metricsAsOf: str(r['Metrics_As_Of']),
    latestRevenue: num(r['Latest_Revenue']),
    revenueGrowthPct: num(r['Revenue_Growth_Percentage']),
    monthlyBurn: num(r['Monthly_Burn_Rate']),
    runwayMonths: num(r['Runway_Months']),
    headcount: num(r['Headcount']),
    openRoles: num(r['Open_Roles']),
    lastCompanyUpdate: str(r['Last_Company_Update']),
    notes: str(r['Investment_Notes']),
    timeline: parseTimeline(str(r['Timeline_Events'])),
    timelineJson: str(r['Timeline_Events']),
    modifiedTime: str(r['Modified_Time']),
  };
}

export async function fetchPortfolioEntries(): Promise<PortfolioEntry[]> {
  const records = await zohoList(PM_MODULE, {
    per_page: '200', sort_by: 'Modified_Time', sort_order: 'desc', fields: PM_FIELDS,
  });
  return records.map(fromRecord);
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** The fields an investor edits. Blank strings / null mean "leave unset". */
export interface PortfolioEntryInput {
  companyId: string;
  companyName: string;
  membershipBasis: string;
  confirmedOn: string;
  initialInvestmentDate: string;
  totalInvested: string;
  latestValuation: string;
  valuationAsOf: string;
  ownershipPct: string;
  status: string;
  exitDate: string;
  sector: string;
  geography: string;
  currentStage: string;
  recordedHealth: string;
  recordedHealthReason: string;
  reportingPeriod: string;
  metricsAsOf: string;
  latestRevenue: string;
  revenueGrowthPct: string;
  monthlyBurn: string;
  runwayMonths: string;
  headcount: string;
  openRoles: string;
  lastCompanyUpdate: string;
  notes: string;
}

export function emptyInput(): PortfolioEntryInput {
  return {
    companyId: '', companyName: '', membershipBasis: 'Confirmed Investment', confirmedOn: '',
    initialInvestmentDate: '', totalInvested: '', latestValuation: '', valuationAsOf: '',
    ownershipPct: '', status: 'Active', exitDate: '', sector: '', geography: '', currentStage: '',
    recordedHealth: '', recordedHealthReason: '', reportingPeriod: '', metricsAsOf: '',
    latestRevenue: '', revenueGrowthPct: '', monthlyBurn: '', runwayMonths: '', headcount: '',
    openRoles: '', lastCompanyUpdate: '', notes: '',
  };
}

export function inputFromEntry(e: PortfolioEntry): PortfolioEntryInput {
  const s = (n: number | null) => (n === null ? '' : String(n));
  const health = e.recordedHealth === 'on_track' ? 'On Track'
    : e.recordedHealth === 'needs_attention' ? 'Needs Attention'
    : e.recordedHealth === 'at_risk' ? 'At Risk' : '';
  return {
    companyId: e.companyId, companyName: e.companyName, membershipBasis: e.membershipBasis,
    confirmedOn: e.confirmedOn, initialInvestmentDate: e.initialInvestmentDate,
    totalInvested: s(e.totalInvested), latestValuation: s(e.latestValuation),
    valuationAsOf: e.valuationAsOf, ownershipPct: s(e.ownershipPct), status: e.status,
    exitDate: e.exitDate, sector: e.sector, geography: e.geography, currentStage: e.currentStage,
    recordedHealth: health, recordedHealthReason: e.recordedHealthReason,
    reportingPeriod: e.reportingPeriod, metricsAsOf: e.metricsAsOf,
    latestRevenue: s(e.latestRevenue), revenueGrowthPct: s(e.revenueGrowthPct),
    monthlyBurn: s(e.monthlyBurn), runwayMonths: s(e.runwayMonths), headcount: s(e.headcount),
    openRoles: s(e.openRoles), lastCompanyUpdate: e.lastCompanyUpdate, notes: e.notes,
  };
}

function toPayload(input: PortfolioEntryInput): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  const text = (key: string, v: string) => { if (v.trim() !== '') p[key] = v.trim(); };
  const number = (key: string, v: string) => {
    if (v.trim() === '') return;
    const n = Number(v);
    if (Number.isFinite(n)) p[key] = n;
  };

  p['Name'] = input.companyName.trim();
  if (input.companyId) p['Company'] = { id: input.companyId };
  text('Membership_Basis', input.membershipBasis);
  text('Confirmed_On', input.confirmedOn);
  text('Initial_Investment_Date', input.initialInvestmentDate);
  number('Total_Invested', input.totalInvested);
  number('Latest_Valuation', input.latestValuation);
  text('Valuation_As_Of', input.valuationAsOf);
  number('Ownership_Percentage', input.ownershipPct);
  text('Investment_Status', input.status);
  text('Exit_Date', input.exitDate);
  text('Sector', input.sector);
  text('Geography', input.geography);
  text('Current_Stage', input.currentStage);
  text('Health_Status', input.recordedHealth);
  text('Health_Reason', input.recordedHealthReason);
  text('Reporting_Period', input.reportingPeriod);
  text('Metrics_As_Of', input.metricsAsOf);
  number('Latest_Revenue', input.latestRevenue);
  number('Revenue_Growth_Percentage', input.revenueGrowthPct);
  number('Monthly_Burn_Rate', input.monthlyBurn);
  number('Runway_Months', input.runwayMonths);
  number('Headcount', input.headcount);
  number('Open_Roles', input.openRoles);
  text('Last_Company_Update', input.lastCompanyUpdate);
  text('Investment_Notes', input.notes);

  // Investment Year is a plain number in CRM (Zoho rejected a formula), so keep it
  // in step with the initial investment date here, on every save.
  const year = Number(input.initialInvestmentDate.slice(0, 4));
  if (Number.isInteger(year) && year > 1900) p['Investment_Year'] = year;
  return p;
}

/**
 * Create the record. When `firstEvent` is given it is written into the same
 * create call, so a new company starts with its "Initial Investment" on the
 * timeline without a second request that could fail on its own.
 */
export function createPortfolioEntry(input: PortfolioEntryInput, firstEvent?: NewEventInput): Promise<string> {
  const payload = toPayload(input);
  if (firstEvent) payload['Timeline_Events'] = appendEvent('', firstEvent);
  return zohoCreate(PM_MODULE, payload);
}

export async function updatePortfolioEntry(id: string, input: PortfolioEntryInput): Promise<void> {
  // A blank field on edit means "clear it" — build the payload, then null out
  // anything the form left empty that CRM may already hold.
  const payload = toPayload(input);
  const clearable = [
    'Confirmed_On', 'Initial_Investment_Date', 'Total_Invested', 'Latest_Valuation', 'Valuation_As_Of',
    'Ownership_Percentage', 'Exit_Date', 'Sector', 'Geography', 'Current_Stage', 'Health_Status',
    'Health_Reason', 'Reporting_Period', 'Metrics_As_Of', 'Latest_Revenue', 'Revenue_Growth_Percentage',
    'Monthly_Burn_Rate', 'Runway_Months', 'Headcount', 'Open_Roles', 'Last_Company_Update',
    'Investment_Notes', 'Investment_Year',
  ];
  for (const key of clearable) if (!(key in payload)) payload[key] = null;
  await zohoUpdate(PM_MODULE, id, payload);
}

/**
 * Add an event to a company's timeline. A read-modify-write on the record's
 * `Timeline_Events` field, since Zoho replaces a field's whole value on write:
 * re-read the stored JSON first so two events recorded in a row (or from two
 * tabs) don't overwrite each other. A genuinely simultaneous save can still lose
 * one — same trade-off the app accepts for Requested_Documents.
 *
 * Returns the updated events. Throws TimelineFullError if the field is full.
 */
export async function addTimelineEvent(entryId: string, input: NewEventInput): Promise<TimelineEvent[]> {
  const record = await zohoGetById(PM_MODULE, entryId);
  const next = appendEvent(str(record?.['Timeline_Events']), input);
  await zohoUpdate(PM_MODULE, entryId, { Timeline_Events: next });
  return parseTimeline(next);
}
