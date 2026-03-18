import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  employeeNumber: z.string().min(4, 'Employee number required'),
  seat: z.enum(['CA', 'FO']),
  base: z.string().length(3, 'Base must be 3-letter ICAO').optional(),
  inviteToken: z.string().optional(),
})

export const flightSchema = z.object({
  flightNumber: z.string().min(3, 'Flight number required'),
  originIcao: z.string().length(3).or(z.string().length(4)),
  destinationIcao: z.string().length(3).or(z.string().length(4)),
  scheduledOutUtc: z.string(),
  scheduledInUtc: z.string(),
  actualOutUtc: z.string().optional(),
  actualOffUtc: z.string().optional(),
  actualOnUtc: z.string().optional(),
  actualInUtc: z.string().optional(),
  aircraftType: z.enum(['E170', 'E175']).optional(),
  tailNumber: z.string().optional(),
  pilotFlying: z.enum(['CA', 'FO', 'unknown']).optional(),
  landingPilot: z.enum(['CA', 'FO']).optional(),
  approachType: z.enum(['visual', 'ILS', 'RNAV', 'RNP', 'VOR', 'NDB', 'LOC', 'other']).optional(),
  approachRunway: z.string().optional(),
  copilotEmployeeNumber: z.string().optional(),
  isDeadhead: z.boolean().default(false),
  isCancelled: z.boolean().default(false),
  hadDiversion: z.boolean().default(false),
  hadGoAround: z.boolean().default(false),
  hadReturnToGate: z.boolean().default(false),
  rtgReason: z.string().optional(),
  notes: z.string().optional(),
  sequenceId: z.string().uuid().optional(),
  dutyPeriodId: z.string().uuid().optional(),
})

export const inviteSchema = z.object({
  email: z.string().email(),
  employeeNumber: z.string().min(4),
  role: z.enum(['pilot', 'admin']).default('pilot'),
})

export type LoginForm = z.infer<typeof loginSchema>
export type RegisterForm = z.infer<typeof registerSchema>
export type FlightForm = z.infer<typeof flightSchema>
export type InviteForm = z.infer<typeof inviteSchema>
