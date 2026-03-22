// Placeholder types until you run: supabase gen types typescript --project-id YOUR_ID > lib/supabase/types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          employee_number: string
          first_name: string
          last_name: string
          email: string
          role: 'pilot' | 'admin'
          base: string | null
          seat: 'CA' | 'FO' | null
          hire_date: string | null
          is_active: boolean
          operating_carrier: string | null  // e.g. "YV_AA" (Mesa for American)
          flight_prefix: string | null      // e.g. "AA" — prepended to bare flight numbers
          date_of_birth: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          employee_number: string
          first_name: string
          last_name: string
          email: string
          role?: 'pilot' | 'admin'
          base?: string | null
          seat?: 'CA' | 'FO' | null
          hire_date?: string | null
          is_active?: boolean
          operating_carrier?: string | null
          flight_prefix?: string | null
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
      aircraft: {
        Row: {
          id: string
          tail_number: string
          aircraft_type: 'E170' | 'E175'
          airline_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          tail_number: string
          aircraft_type: 'E170' | 'E175'
          airline_code?: string | null
        }
        Update: Partial<Database['public']['Tables']['aircraft']['Insert']>
        Relationships: []
      }
      sequences: {
        Row: {
          id: string
          pilot_id: string
          sequence_number: string
          raw_text: string
          report_date: string
          release_date: string
          domicile: string
          status: 'active' | 'dropped' | 'traded' | 'reassigned'
          created_at: string
          updated_at: string
        }
        Insert: {
          pilot_id: string
          sequence_number: string
          raw_text: string
          report_date: string
          release_date: string
          domicile: string
          status?: 'active' | 'dropped' | 'traded' | 'reassigned'
        }
        Update: Partial<Database['public']['Tables']['sequences']['Insert']>
        Relationships: []
      }
      duty_periods: {
        Row: {
          id: string
          sequence_id: string
          pilot_id: string
          duty_start_utc: string
          duty_end_utc: string | null
          rest_before_hrs: number | null
          max_flight_time_hrs: number | null
          is_augmented: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          sequence_id: string
          pilot_id: string
          duty_start_utc: string
          duty_end_utc?: string | null
          rest_before_hrs?: number | null
          max_flight_time_hrs?: number | null
          is_augmented?: boolean
        }
        Update: Partial<Database['public']['Tables']['duty_periods']['Insert']>
        Relationships: []
      }
      flights: {
        Row: {
          id: string
          sequence_id: string | null
          duty_period_id: string | null
          pilot_id: string
          copilot_id: string | null
          aircraft_id: string | null
          flight_number: string
          origin_icao: string
          destination_icao: string
          diverted_to_icao: string | null
          scheduled_out_utc: string
          scheduled_in_utc: string
          actual_out_utc: string | null
          actual_off_utc: string | null
          actual_on_utc: string | null
          actual_in_utc: string | null
          block_scheduled_hrs: number | null
          block_actual_hrs: number | null
          flight_time_hrs: number | null
          night_time_hrs: number | null
          cross_country: boolean
          pilot_flying: 'CA' | 'FO' | 'unknown' | null
          pilot_monitoring: 'CA' | 'FO' | 'unknown' | null
          aircraft_type: 'E170' | 'E175' | null
          tail_number: string | null
          approach_type: 'visual' | 'ILS' | 'RNAV' | 'RNP' | 'VOR' | 'NDB' | 'LOC' | 'other' | null
          approach_runway: string | null
          landing_pilot: 'CA' | 'FO' | null
          metar_raw: string | null
          ceiling_ft: number | null
          visibility_sm: number | null
          weather_conditions: Json | null
          is_deadhead: boolean
          is_positioning: boolean
          is_cancelled: boolean
          cancellation_code: string | null
          had_diversion: boolean
          had_go_around: boolean
          had_return_to_gate: boolean
          rtg_reason: string | null
          notes: string | null
          created_at: string
          updated_at: string
          fa_flight_id: string | null
          fa_track: Json | null
          fa_fetched_at: string | null
          departure_gate: string | null
          arrival_gate: string | null
          departure_runway: string | null
          cruise_gspeed_kts: number | null
          cruise_alt_ft: number | null
          descent_start_utc: string | null
          origin_timezone: string | null
          dest_timezone: string | null
          route: string | null
          route_distance_nm: number | null
          filed_airspeed_kts: number | null
          filed_altitude_ft: number | null
          terminal_origin: string | null
          terminal_destination: string | null
          baggage_claim: string | null
          google_event_id: string | null
        }
        Insert: {
          pilot_id: string
          flight_number: string
          origin_icao: string
          destination_icao: string
          scheduled_out_utc: string
          scheduled_in_utc: string
          sequence_id?: string | null
          duty_period_id?: string | null
          copilot_id?: string | null
          aircraft_id?: string | null
          diverted_to_icao?: string | null
          actual_out_utc?: string | null
          actual_off_utc?: string | null
          actual_on_utc?: string | null
          actual_in_utc?: string | null
          block_scheduled_hrs?: number | null
          block_actual_hrs?: number | null
          flight_time_hrs?: number | null
          night_time_hrs?: number | null
          cross_country?: boolean
          pilot_flying?: 'CA' | 'FO' | 'unknown' | null
          pilot_monitoring?: 'CA' | 'FO' | 'unknown' | null
          aircraft_type?: 'E170' | 'E175' | null
          tail_number?: string | null
          approach_type?: 'visual' | 'ILS' | 'RNAV' | 'RNP' | 'VOR' | 'NDB' | 'LOC' | 'other' | null
          approach_runway?: string | null
          landing_pilot?: 'CA' | 'FO' | null
          metar_raw?: string | null
          ceiling_ft?: number | null
          visibility_sm?: number | null
          weather_conditions?: Json | null
          is_deadhead?: boolean
          is_positioning?: boolean
          is_cancelled?: boolean
          cancellation_code?: string | null
          had_diversion?: boolean
          had_go_around?: boolean
          had_return_to_gate?: boolean
          rtg_reason?: string | null
          notes?: string | null
          fa_flight_id?: string | null
          fa_track?: Json | null
          fa_fetched_at?: string | null
          departure_gate?: string | null
          arrival_gate?: string | null
          departure_runway?: string | null
          cruise_gspeed_kts?: number | null
          cruise_alt_ft?: number | null
          descent_start_utc?: string | null
          origin_timezone?: string | null
          dest_timezone?: string | null
          route?: string | null
          route_distance_nm?: number | null
          filed_airspeed_kts?: number | null
          filed_altitude_ft?: number | null
          terminal_origin?: string | null
          terminal_destination?: string | null
          baggage_claim?: string | null
          google_event_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['flights']['Insert']>
        Relationships: []
      }
      pay_records: {
        Row: {
          id: string
          pilot_id: string
          sequence_id: string | null
          flight_id: string | null
          pay_period_start: string
          pay_period_end: string
          scheduled_block_hrs: number
          actual_block_hrs: number
          credit_hrs: number
          guarantee_hrs: number
          misconnect_hrs: number
          overtime_hrs: number
          pay_type: 'block' | 'guarantee' | 'misconnect' | 'deadhead' | 'training' | 'other'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          pilot_id: string
          pay_period_start: string
          pay_period_end: string
          pay_type: 'block' | 'guarantee' | 'misconnect' | 'deadhead' | 'training' | 'other'
          sequence_id?: string | null
          flight_id?: string | null
          scheduled_block_hrs?: number
          actual_block_hrs?: number
          credit_hrs?: number
          guarantee_hrs?: number
          misconnect_hrs?: number
          overtime_hrs?: number
          notes?: string | null
        }
        Update: Partial<Database['public']['Tables']['pay_records']['Insert']>
        Relationships: []
      }
      far117_records: {
        Row: {
          id: string
          pilot_id: string
          duty_period_id: string | null
          record_date: string
          flight_time_28d_hrs: number | null
          flight_time_365d_hrs: number | null
          flight_time_cal_yr_hrs: number | null
          duty_time_7d_hrs: number | null
          rest_waiver_used: boolean
          split_duty_used: boolean
          acclimation_status: 'unknown' | 'acclimated' | 'not_acclimated' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          pilot_id: string
          record_date: string
          duty_period_id?: string | null
          flight_time_28d_hrs?: number | null
          flight_time_365d_hrs?: number | null
          flight_time_cal_yr_hrs?: number | null
          duty_time_7d_hrs?: number | null
          rest_waiver_used?: boolean
          split_duty_used?: boolean
          acclimation_status?: 'unknown' | 'acclimated' | 'not_acclimated' | null
        }
        Update: Partial<Database['public']['Tables']['far117_records']['Insert']>
        Relationships: []
      }
      sequence_events: {
        Row: {
          id: string
          sequence_id: string
          flight_id: string | null
          event_type: 'reassignment' | 'change' | 'cancellation' | 'diversion' | 'return_to_gate' | 'delay' | 'deadhead_add'
          occurred_at: string | null
          description: string | null
          original_data: Json | null
          created_at: string
        }
        Insert: {
          sequence_id: string
          event_type: 'reassignment' | 'change' | 'cancellation' | 'diversion' | 'return_to_gate' | 'delay' | 'deadhead_add'
          flight_id?: string | null
          occurred_at?: string | null
          description?: string | null
          original_data?: Json | null
        }
        Update: Partial<Database['public']['Tables']['sequence_events']['Insert']>
        Relationships: []
      }
      acars_cache: {
        Row: {
          id: string
          flight_number: string
          flight_date: string
          origin_icao: string
          fetched_at: string
          out_utc: string | null
          off_utc: string | null
          on_utc: string | null
          in_utc: string | null
          raw_response: Json | null
        }
        Insert: {
          flight_number: string
          flight_date: string
          origin_icao: string
          out_utc?: string | null
          off_utc?: string | null
          on_utc?: string | null
          in_utc?: string | null
          raw_response?: Json | null
        }
        Update: Partial<Database['public']['Tables']['acars_cache']['Insert']>
        Relationships: []
      }
      metar_cache: {
        Row: {
          id: string
          station_icao: string
          observation_utc: string
          raw_metar: string
          parsed: Json | null
          fetched_at: string
        }
        Insert: {
          station_icao: string
          observation_utc: string
          raw_metar: string
          parsed?: Json | null
        }
        Update: Partial<Database['public']['Tables']['metar_cache']['Insert']>
        Relationships: []
      }
      invitations: {
        Row: {
          id: string
          invited_by: string | null
          email: string
          employee_number: string | null
          role: string
          token: string
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          email: string
          invited_by?: string | null
          employee_number?: string | null
          role?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>
        Relationships: []
      }
      certificates: {
        Row: {
          id: string
          pilot_id: string
          cert_type: 'medical_1st' | 'medical_2nd' | 'medical_3rd' | 'type_rating' | 'bfr' | 'other'
          cert_name: string
          issued_date: string | null
          expires_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          pilot_id: string
          cert_type: 'medical_1st' | 'medical_2nd' | 'medical_3rd' | 'type_rating' | 'bfr' | 'other'
          cert_name: string
          issued_date?: string | null
          expires_date?: string | null
          notes?: string | null
        }
        Update: Partial<Database['public']['Tables']['certificates']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      compute_far117: {
        Args: { p_pilot_id: string; p_as_of?: string }
        Returns: Array<{
          flight_time_28d_hrs: number
          flight_time_365d_hrs: number
          duty_time_7d_hrs: number
        }>
      }
      compute_pay_period: {
        Args: { p_pilot_id: string; p_start_date: string; p_end_date: string }
        Returns: Array<{
          total_scheduled_hrs: number
          total_actual_hrs: number
          total_credit_hrs: number
          deadhead_hrs: number
          flight_count: number
        }>
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Flight = Database['public']['Tables']['flights']['Row']
export type Sequence = Database['public']['Tables']['sequences']['Row']
export type DutyPeriod = Database['public']['Tables']['duty_periods']['Row']
export type PayRecord = Database['public']['Tables']['pay_records']['Row']
export type Invitation = Database['public']['Tables']['invitations']['Row']
