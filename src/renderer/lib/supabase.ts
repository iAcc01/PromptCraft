import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wjuhtrfhsebnodrmoclw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdWh0cmZoc2Vibm9kcm1vY2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTkwNTUsImV4cCI6MjA4ODU5NTA1NX0.az5_DDp0PJYdEkaw4WZQFl-buhIdB1Ix83Evuids_io'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})
