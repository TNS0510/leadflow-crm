import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface UserProfile {
  id: string
  email: string
  role: 'sales_rep' | 'team_lead'
  created_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const requestIdRef = useRef(0)

  useEffect(() => {
    let active = true

    async function fetchProfile(userId: string, requestId: number) {
      console.log('fetchProfile: Starting query for userId:', userId)

      // Create a timeout promise to prevent hanging indefinitely if network stalls
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Profile fetch timed out after 5 seconds.' } }), 5000)
      )

      try {
        const queryPromise = supabase
          .from('users')
          .select('id, email, role, created_at')
          .eq('id', userId)
          .maybeSingle()

        const result = await Promise.race([queryPromise, timeoutPromise])
        const { data, error } = result

        if (!active || requestId !== requestIdRef.current) {
          return
        }

        if (error) {
          console.error('Error fetching user profile:', error)
          setProfile(null)
          return
        }

        if (!data) {
          console.error('No profile record was found in public.users for user:', userId)
          setProfile(null)
          return
        }

        console.log('fetchProfile: Successfully loaded profile:', data)
        setProfile(data as UserProfile)
      } catch (err) {
        if (!active || requestId !== requestIdRef.current) {
          return
        }
        console.error('Unexpected profile loading error:', err)
        setProfile(null)
      } finally {
        if (active && requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    }

    async function initializeAuth() {
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (!active) return

        if (sessionError) {
          console.error('Error getting initial session:', sessionError.message)
        }

        const initialUser = initialSession?.user ?? null
        setSession(initialSession)
        setUser(initialUser)

        if (!initialUser) {
          setProfile(null)
          setLoading(false)
          return
        }

        const requestId = ++requestIdRef.current
        await fetchProfile(initialUser.id, requestId)
      } catch (err) {
        console.error('Unexpected error during auth initialization:', err)
        if (active) {
          setLoading(false)
        }
      }
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return

      console.log('AuthContext: onAuthStateChange fired with event:', _event)

      setSession(nextSession)
      const nextUser = nextSession?.user ?? null
      setUser(nextUser)

      const requestId = ++requestIdRef.current

      if (!nextUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setProfile(null)
      void fetchProfile(nextUser.id, requestId)
    })

    return () => {
      active = false
      requestIdRef.current++
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign-out failed:', error.message)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}