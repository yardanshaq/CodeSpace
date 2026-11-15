export type RealtimeEventType =
  | "snippet.created"
  | "snippet.updated"
  | "snippet.deleted"
  | "like"
  | "comment.created"
  | "comment.deleted";

export interface RealtimeEvent {
  id: number;
  type: RealtimeEventType;
  ts: number;
  snippetId?: string;
  [key: string]: unknown;
}
