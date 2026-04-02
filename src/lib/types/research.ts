export interface RiskBrief {
  protocolName: string;
  tvl: number;
  tvlTrend: 'rising' | 'falling' | 'stable';
  riskScore: number; 
  riskFactors: string[];
  oneLine: string;
  opportunities: string[];
  generatedAt: number;
}

export interface ResearchQuery {
  query: string;
  protocols?: string[];
}

export interface ResearchResponse {
  answer: string;
  briefs: RiskBrief[];
  toolCallsUsed: string[];
}