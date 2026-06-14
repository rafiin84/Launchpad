// Service layer — abstracts Zoho CRM API calls via Zoho MCP
// In production, each method maps to a Zoho CRM module operation

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export { delay };
export * from './postsService';
export * from './companiesService';
export * from './dealsService';
export * from './conversationsService';
export * from './knowledgeService';
export * from './introductionsService';
export * from './investmentsService';
