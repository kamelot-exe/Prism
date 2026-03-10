import type { TaskPriority } from '../api';

export type CommandType = 'task' | 'event';

export interface ParsedCommand {
  type: CommandType;
  title: string;
  date?: Date;
  startTime?: Date;
  endTime?: Date;
  durationMinutes?: number;
  priority?: TaskPriority;
  isFocus?: boolean;
  confidence: number; // 0..1
}

