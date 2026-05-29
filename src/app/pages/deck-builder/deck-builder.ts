import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokemonCard as CardComponent } from '../../shared/components/pokemon-card/pokemon-card';
import { PokemonCard as CardModel } from '../../core/models/pokemon-card.model';
import { Deck } from '../../core/models/deck.model';
import { DeckService } from '../../core/services/deck.service';
import { CardCatalogService } from '../../core/services/card-catalog.service';

@Component({
  selector: 'app-deck-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './deck-builder.html',
  styleUrl: './deck-builder.css'
})
export class DeckBuilder implements OnInit {
  availableCards: CardModel[] = [];
  filteredCards: CardModel[] = [];
  
  currentDeck: Deck = {
    id: crypto.randomUUID(),
    name: 'Mi Nuevo Mazo',
    cards: [],
    isActive: true,
    createdAt: new Date().toISOString()
  };

  savedDecks: Deck[] = [];

  // Filters
  searchTerm: string = '';
  selectedType: string = 'Todos';
  selectedRarity: string = 'Todas';
  
  readonly availableTypes: string[] = [
    'Todos', 'normal', 'fire', 'water', 'electric', 'grass', 'ice', 
    'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 
    'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
  ];
  readonly availableRarities: string[] = ['Todas', 'Común', 'Rara', 'Épica', 'Legendaria'];

  errorMessage: string | null = null;
  successMessage: string | null = null;
  isLoading: boolean = false;
  searching: boolean = false;
  generatingDeck: boolean = false;

  constructor(
    private deckService: DeckService,
    private cardCatalog: CardCatalogService
  ) {}

  async ngOnInit() {
    this.searchTerm = '';
    this.selectedType = 'Todos';
    this.selectedRarity = 'Todas';
    
    await this.loadSavedDecks();
    await this.loadAvailableCards();
  }

  async loadSavedDecks() {
    try {
      this.savedDecks = await this.deckService.getAllAvailableDecks();
      const active = this.savedDecks.find(d => d.isActive);
      if (active) {
        this.currentDeck = JSON.parse(JSON.stringify(active));
      } else if (this.savedDecks.length > 0) {
        this.currentDeck = JSON.parse(JSON.stringify(this.savedDecks[0]));
      }
    } catch(e) {
      console.error(e);
    }
  }

  async loadAvailableCards() {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      this.availableCards = await this.cardCatalog.ensureMinimumCards(60);
      
      if (!this.availableCards || this.availableCards.length === 0) {
        this.availableCards = this.deckService.getDemoCards();
      }

      this.applyFilters();
    } catch (e) {
      console.error('Error loading available cards', e);
      this.availableCards = this.deckService.getDemoCards();
      this.applyFilters();
      this.errorMessage = 'Se usaron cartas demo porque hubo un error al cargar la PokeAPI.';
      setTimeout(() => this.errorMessage = null, 4000);
    } finally {
      this.isLoading = false;
    }
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedType = 'Todos';
    this.selectedRarity = 'Todas';
    this.applyFilters();
  }

  onFilterChange() {
    this.applyFilters();
  }

  applyFilters() {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredCards = this.availableCards.filter(c => {
      const matchName = !term || c.name.toLowerCase().includes(term);
      const matchType = this.selectedType === 'Todos' || c.types.some(t => t.toLowerCase() === this.selectedType.toLowerCase());
      const matchRarity = this.selectedRarity === 'Todas' || c.rarity === this.selectedRarity;
      return matchName && matchType && matchRarity;
    });
  }
  
  private isProbablyExactPokemonName(term: string): boolean {
    const value = term.trim().toLowerCase();
    if (value.length < 3) return false;
    if (!/^[a-z0-9-]+$/.test(value)) return false;
    return true;
  }

  async searchPokemonIfNeeded() {
    const term = this.searchTerm.trim().toLowerCase();
    
    this.applyFilters();

    if (!term) return;
    if (this.filteredCards.length > 0) return;

    if (!this.isProbablyExactPokemonName(term)) {
      this.errorMessage = 'Escribe un nombre más completo, por ejemplo: charizard.';
      return;
    }

    this.searching = true;
    this.errorMessage = null;

    try {
      const found = await this.cardCatalog.findPokemonByExactName(term);
      
      if (!found) {
        this.errorMessage = `No se encontró el Pokémon "${term}".`;
        return;
      }

      this.availableCards = await this.cardCatalog.getCards();
      this.applyFilters();

      if (!this.filteredCards.length) {
        this.filteredCards = [found];
      }
    } catch (error) {
      console.error('Error buscando Pokémon:', error);
      this.errorMessage = 'No se pudo buscar el Pokémon.';
    } finally {
      this.searching = false;
    }
  }

  addCardToDeck(card: CardModel) {
    if (this.currentDeck.cards.length >= 40) {
      this.errorMessage = "El mazo no puede tener más de 40 cartas.";
      setTimeout(() => this.errorMessage = null, 3000);
      return;
    }
    // We clone the card to give it a unique instanceId in the deck
    this.currentDeck.cards.push(this.deckService.createCardInstance(card));
  }

  removeCardFromDeck(index: number) {
    this.currentDeck.cards.splice(index, 1);
  }

  async saveDeck() {
    if (this.currentDeck.cards.length < 20) {
      this.errorMessage = "El mazo debe tener al menos 20 cartas.";
      setTimeout(() => this.errorMessage = null, 3000);
      return;
    }
    
    try {
      this.currentDeck.updatedAt = new Date().toISOString();
      const result: any = await this.deckService.saveDeck(this.currentDeck);
      
      if (result && result.localOnly) {
         this.errorMessage = "El mazo se guardó localmente. Inicia sesión para sincronizarlo.";
         setTimeout(() => this.errorMessage = null, 4000);
      } else {
         this.successMessage = "Mazo guardado correctamente.";
         setTimeout(() => this.successMessage = null, 3000);
      }
      await this.loadSavedDecks(); // reload to ensure sync
    } catch(e) {
      this.errorMessage = "Error al guardar el mazo.";
      setTimeout(() => this.errorMessage = null, 3000);
    }
  }

  createNewDeck() {
    this.currentDeck = {
      id: crypto.randomUUID(),
      name: 'Mi Nuevo Mazo',
      cards: [],
      isActive: false,
      createdAt: new Date().toISOString()
    };
  }

  loadDeck(deck: Deck) {
    this.currentDeck = JSON.parse(JSON.stringify(deck));
  }

  async generateQuickDeck() {
    if (this.generatingDeck) return;

    this.generatingDeck = true;
    this.errorMessage = null;

    try {
      let sourceCards = this.availableCards;

      if (!sourceCards || sourceCards.length < 20) {
        sourceCards = await this.cardCatalog.ensureMinimumCards(40);
        this.availableCards = sourceCards;
        this.applyFilters();
      }

      if (!sourceCards || sourceCards.length < 20) {
        sourceCards = this.deckService.getDemoCards();
        this.availableCards = sourceCards;
        this.applyFilters();
      }

      if (!sourceCards || sourceCards.length < 20) {
        throw new Error('No hay suficientes cartas para generar un mazo.');
      }

      const deck = this.deckService.createQuickDeck(sourceCards, 20);
      this.currentDeck.cards = deck.cards;
      this.currentDeck.name = deck.name;
      this.successMessage = 'Mazo rápido generado correctamente.';
      setTimeout(() => this.successMessage = null, 3000);
    } catch (error: any) {
      console.error('Error generando mazo rápido:', error);
      this.errorMessage = error.message || 'No se pudo generar el mazo rápido.';
      setTimeout(() => this.errorMessage = null, 3000);
    } finally {
      this.generatingDeck = false;
    }
  }
}
