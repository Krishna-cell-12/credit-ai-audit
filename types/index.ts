export type PrimaryUseCase = "coding" | "writing" | "data" | "research" | "mixed";

export interface ToolSpend {
  id: string;
  toolName: string;
  planName: string;
  monthlySpend: number;
  seats: number;
}

export interface AuditState {
  teamSize: number;
  primaryUseCase: PrimaryUseCase;
  tools: ToolSpend[];
}
