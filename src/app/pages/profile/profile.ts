import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { UserProfile } from '../../core/models/user-profile.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {
  user: UserProfile | null = null;
  userStats: any = { wins: 0, losses: 0, total_matches: 0 };

  constructor(private auth: AuthService, private router: Router, private supabase: SupabaseService) {}

  async ngOnInit() {
    this.user = await this.auth.getProfile();
    if (!this.user) {
      this.router.navigate(['/login']);
      return;
    }

    // Fetch stats
    const { data } = await this.supabase.client
      .from('user_stats')
      .select('*')
      .eq('user_id', this.user.id)
      .single();
      
    if (data) {
      this.userStats = data;
    }
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/home']);
  }
}
