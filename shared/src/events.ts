// The single event stream that drives every visual in the web app.
// The server emits these; the UI is just a projection of them.

/** One slice of an agent's context window, as the model sees it. */
export type Block = {
  kind: 'system' | 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'skill_stub' | 'skill_full';
  label: string;
  /** Approximate token count (chars / 4). Shown in the UI with "≈". */
  tokens: number;
  content: string;
};

export type ItineraryDay = {
  day: number;
  date: string;
  weather: { summary: string; tempMinC: number; tempMaxC: number; rainy: boolean };
  activities: { time: string; name: string; indoor: boolean; costEur: number }[];
};

/** The final structured output produced via submit_itinerary. */
export type Itinerary = {
  id: string;
  destination: string;
  origin: string;
  startDate: string;
  endDate: string;
  transport: {
    outbound: { carrier: string; depart: string; arrive: string; priceEur: number };
    inbound: { carrier: string; depart: string; arrive: string; priceEur: number };
  };
  hotel: { name: string; nights: number; pricePerNightEur: number; totalEur: number };
  days: ItineraryDay[];
  budget: { limitEur: number; transportEur: number; stayEur: number; activitiesEur: number; foodEur: number; totalEur: number };
  notes: string[];
};

export type ToolDefinition = { name: string; description: string; input_schema: unknown; source: 'local' | 'mcp' };

export type StopReason = 'tool_use' | 'end_turn' | 'max_tokens' | 'refusal' | 'other';

export type AgentEvent =
  | { type: 'run_started'; act: number; prompt: string; flags: Record<string, boolean> }
  | { type: 'mcp_handshake'; server: string; tools: { name: string; description: string }[] }
  | {
      type: 'agent_started';
      agentId: string;
      parentId?: string;
      role: string;
      model: string;
      task?: string;
      waitsOn?: string;
      /** The delegate_task call that created this subagent. */
      parentToolUseId?: string;
      /** What the model is told about each tool (shown in the Inspector). */
      tools?: ToolDefinition[];
    }
  | { type: 'model_call'; agentId: string; turn: number; inputTokens: number }
  | {
      type: 'model_response';
      agentId: string;
      turn: number;
      stopReason: StopReason;
      text?: string;
      /** A readable summary of the model's reasoning before it decided (may be empty). */
      thinking?: string;
      outputTokens: number;
    }
  | { type: 'tool_use'; agentId: string; toolUseId: string; tool: string; source: 'local' | 'mcp'; input: unknown }
  | { type: 'hook_decision'; agentId: string; toolUseId: string; tool: string; decision: 'allow' | 'block' | 'ask'; reason: string }
  | { type: 'approval_resolved'; toolUseId: string; approved: boolean }
  | { type: 'tool_result'; agentId: string; toolUseId: string; tool: string; output: unknown; isError: boolean; ms: number }
  | { type: 'skill_loaded'; agentId: string; skill: string; tokens: number }
  | { type: 'context_snapshot'; agentId: string; blocks: Block[]; totalTokens: number; limit: number }
  | { type: 'agent_finished'; agentId: string; summary: string; totalTokens: number }
  | { type: 'itinerary'; data: Itinerary }
  | { type: 'run_finished'; totalTokens: number; durationMs: number }
  /** Step mode: the run is paused before a model call, waiting for the presenter. */
  | { type: 'step_waiting' }
  | { type: 'step_released' }
  /** The presenter pressed Stop: no new turns start, and the request in flight is cancelled. */
  | { type: 'run_stopped' }
  | { type: 'error'; message: string };

/** Every event on the wire also carries these. */
export type EventEnvelope = { runId: string; seq: number; ts: number };
export type StreamedEvent = AgentEvent & EventEnvelope;

/** Body of POST /runs */
export type StartRunRequest = {
  prompt: string;
  act: number;
  breakIt?: boolean;
  stepMode?: boolean;
  promptOnlyBudget?: boolean;
};

export const DEMO_PROMPT = 'Plan me 4 days in Paris from Skopje in early December, budget €700.';
