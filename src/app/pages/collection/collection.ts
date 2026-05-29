import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokemonCard } from '../../shared/components/pokemon-card/pokemon-card';
import { CardCatalogService } from '../../core/services/card-catalog.service';
import { PokemonCard as CardModel } from '../../core/models/pokemon-card.model';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [CommonModule, FormsModule, PokemonCard],
  templateUrl: './collection.html',
  styleUrl: './collection.css'
})
export class Collection implements OnInit {
  allCards: CardModel[] = [];
  filteredCards: CardModel[] = [];
  
  loading: boolean = false;
  loadingMore: boolean = false;
  errorMessage: string = '';
  
  searchTerm: string = '';
  selectedType: string = 'Todos';
  selectedRarity: string = 'Todas';
  
  totalCount: number = 0;
  hasMoreCards: boolean = true;
  
  readonly availableTypes: string[] = [
    'Todos', 'normal', 'fire', 'water', 'electric', 'grass', 'ice', 
    'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 
    'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
  ];
  readonly availableRarities: string[] = ['Todas', 'Común', 'Rara', 'Épica', 'Legendaria'];

  constructor(private cardCatalog: CardCatalogService) {}

  async ngOnInit(): Promise<void> {
    await this.loadInitialCards();
  }

  async loadInitialCards(): Promise<void> {
    this.loading = true;
    this.loadingMore = false;
    this.errorMessage = '';

    try {
      this.allCards = await this.cardCatalog.loadInitialCards();
      this.totalCount = this.cardCatalog.totalCount;
      this.hasMoreCards = this.cardCatalog.hasMoreCards;
      this.applyFilters();
    } catch (error) {
      console.error('Error cargando colección:', error);
      this.errorMessage = 'No se pudieron cargar las cartas.';
    } finally {
      this.loading = false;
      this.loadingMore = false;
    }
  }

  async loadMoreCards(): Promise<void> {
    if (this.loading || this.loadingMore || !this.hasMoreCards) return;

    this.loadingMore = true;
    this.errorMessage = '';

    try {
      this.allCards = await this.cardCatalog.loadMoreCards();
      this.totalCount = this.cardCatalog.totalCount;
      this.hasMoreCards = this.cardCatalog.hasMoreCards;
      this.applyFilters();
    } catch (error) {
      console.error('Error cargando más cartas:', error);
      this.errorMessage = 'No se pudieron cargar más cartas.';
    } finally {
      this.loadingMore = false;
    }
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedType = 'Todos';
    this.selectedRarity = 'Todas';
    this.applyFilters();
  }

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();

    this.filteredCards = this.allCards.filter(card => {
      const matchesSearch = !term || card.name.toLowerCase().includes(term);

      const matchesType =
        this.selectedType === 'Todos' ||
        card.types.some(type => type.toLowerCase() === this.selectedType.toLowerCase());

      const matchesRarity =
        this.selectedRarity === 'Todas' ||
        card.rarity === this.selectedRarity;

      return matchesSearch && matchesType && matchesRarity;
    });
  }
}
