import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { UserProfile } from '../models/user-profile.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser: any = null;
  currentSession: any = null;
  currentProfile: UserProfile | null = null;
  authInitialized = false;

  constructor(private supabase: SupabaseService) {}

  get isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  async initializeAuth(): Promise<void> {
    const { data, error } = await this.supabase.client.auth.getSession();

    if (error) {
      console.error('Error obteniendo sesión:', error);
    }

    this.currentSession = data.session ?? null;
    this.currentUser = data.session?.user ?? null;

    if (this.currentUser) {
      await this.loadProfileSafely();
    }

    this.supabase.client.auth.onAuthStateChange(async (event, session) => {
      this.currentSession = session;
      this.currentUser = session?.user ?? null;

      if (this.currentUser) {
        await this.loadProfileSafely();
      } else {
        this.currentProfile = null;
      }
    });

    this.authInitialized = true;
  }

  async loadProfileSafely(): Promise<void> {
    if (!this.currentUser) {
      this.currentProfile = null;
      return;
    }

    try {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error cargando profile:', error);
        this.currentProfile = null;
        return;
      }

      if (data) {
        this.currentProfile = {
          id: data.id,
          username: data.username,
          email: data.email,
          avatarUrl: data.avatar_url,
          createdAt: data.created_at
        };
      } else {
        this.currentProfile = null;
      }
    } catch (error) {
      console.error('Error inesperado cargando profile:', error);
      this.currentProfile = null;
    }
  }

  async register(username: string, email: string, password: string) {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        }
      }
    });

    if (error) {
      console.error('Supabase register error:', error);
      throw error;
    }

    return data;
  }

  async login(email: string, password: string) {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase login error:', error);
      throw error;
    }

    this.currentSession = data.session;
    this.currentUser = data.user;

    if (this.currentUser) {
      await this.loadProfileSafely();
    }

    return data;
  }

  async logout(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();

    if (error) {
      console.error('Error cerrando sesión:', error);
      throw error;
    }

    this.currentUser = null;
    this.currentSession = null;
    this.currentProfile = null;
  }

  async getCurrentUser() {
    return this.currentUser;
  }

  getCurrentSession() {
    return this.currentSession;
  }

  async getProfile(): Promise<UserProfile | null> {
    return this.currentProfile;
  }
}
