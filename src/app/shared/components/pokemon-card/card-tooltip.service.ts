import { Injectable, InjectionToken, Injector, ElementRef } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { PokemonCard } from '../../../core/models/pokemon-card.model';
import { CardTooltipOverlayComponent } from './card-tooltip-overlay.component';

export const TOOLTIP_DATA = new InjectionToken<PokemonCard>('TOOLTIP_DATA');

@Injectable({
  providedIn: 'root'
})
export class CardTooltipService {
  private overlayRef: OverlayRef | null = null;
  private currentElement: ElementRef | null = null;

  constructor(private overlay: Overlay, private injector: Injector) {}

  show(card: PokemonCard, elementRef: ElementRef) {
    // Si ya estamos mostrando el tooltip para este elemento, no hacemos nada
    if (this.overlayRef && this.currentElement === elementRef) {
      return;
    }

    this.hide(); // Cierra cualquier tooltip anterior

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(elementRef)
      .withPositions([
        // Preferir mostrar a la derecha
        {
          originX: 'end',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'top',
          offsetX: 10,
        },
        // Si no hay espacio a la derecha, mostrar a la izquierda
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'end',
          overlayY: 'top',
          offsetX: -10,
        },
        // Si no, arriba
        {
          originX: 'center',
          originY: 'top',
          overlayX: 'center',
          overlayY: 'bottom',
          offsetY: -10,
        },
        // Si no, abajo
        {
          originX: 'center',
          originY: 'bottom',
          overlayX: 'center',
          overlayY: 'top',
          offsetY: 10,
        }
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: false,
    });

    const injector = Injector.create({
      providers: [
        { provide: TOOLTIP_DATA, useValue: card }
      ],
      parent: this.injector
    });

    const portal = new ComponentPortal(CardTooltipOverlayComponent, null, injector);
    this.overlayRef.attach(portal);
    this.currentElement = elementRef;
  }

  hide() {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
      this.currentElement = null;
    }
  }
}
