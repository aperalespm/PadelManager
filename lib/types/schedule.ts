export type ScheduleMatch = {
  id: string
  courtNumber: number
  courtName: string
  startTime: string
  endTime: string
  categoryId: string
  categoryName: string
  groupId: string | null
  phase: string
  pair1: string
  pair2: string
  matchLabel: string
  status: 'scheduled' | 'in_progress' | 'finished'
}

export type ScheduleSummary = {
  totalMatches: number
  estimatedEndTime: string
  courtsUsed: number
  matchesPerCategory: Record<string, number>
  finalTimes: Record<string, string>
  warnings: string[]
}

export type TournamentSchedule = {
  matches: ScheduleMatch[]
  summary: ScheduleSummary
  rawExplanation: string
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  schedule?: TournamentSchedule
  timestamp: string
}

export type DistributionBin = {
  id: string
  categoryIds: string[]
}

export type ScheduleDistribution = {
  bins: DistributionBin[]
  mode: 'complete' | 'by_phase'
}
