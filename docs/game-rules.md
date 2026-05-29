# Reglas de PokeDuel Arena

El juego se basa en un combate por turnos estratégico. Cada jugador utiliza un mazo de cartas de Pokémon para reducir los Puntos de Vida (HP) de su oponente a 0.

## 1. El Mazo
- **Tamaño:** Mínimo 20 cartas, recomendado 40 cartas.
- **Creación:** Los jugadores construyen su mazo seleccionando cartas de su colección local.

## 2. Preparación
- Al inicio de la partida, ambos jugadores roban **5 cartas** de su mazo.
- Se determina aleatoriamente quién empieza (en el modo Solo, el jugador empieza).
- Cada jugador inicia con **4000 LP** (Life Points o Puntos de Vida).

## 3. Fases del Turno
El juego está estructurado en 4 fases secuenciales por turno:

### a) Fase de Robo (DRAW PHASE)
- El jugador activo roba 1 carta de su mazo.
- Si un jugador no puede robar (su mazo se queda sin cartas), **pierde la partida**.

### b) Fase Principal (MAIN PHASE)
- El jugador puede invocar **1 carta** de su mano al campo.
- El campo tiene un límite máximo de **5 cartas** simultáneas por jugador.
- Las cartas invocadas entran en modo de "Ataque" por defecto.
- El jugador puede cambiar la posición de las cartas de su campo a modo "Defensa" en esta fase. Las cartas en modo defensa reciben daño reducido o nulo si su defensa supera el ataque enemigo.

### c) Fase de Batalla (BATTLE PHASE)
- El jugador puede atacar con las cartas en su campo que **no hayan atacado** en este turno.
- **Ataque a carta enemiga:** El jugador selecciona una de sus cartas y una del rival. El daño es igual al valor de "Attack" del atacante. Si el defensor está en modo defensa, el daño se calcula como `Attack - Defense` (mínimo 0). Si los HP del defensor llegan a 0, la carta es destruida y va al Descarte.
- **Ataque Directo:** Si el rival **no tiene cartas en el campo**, el jugador puede atacar directamente a los Life Points (LP) del rival.

### d) Fase Final (END PHASE)
- El jugador termina su turno.
- Se limpian estados temporales (las cartas que atacaron vuelven a estar disponibles para el siguiente turno).
- El turno pasa al oponente.

## 4. Estadísticas de Cartas
- **Ataque (ATK):** El daño que inflige.
- **Defensa (DEF):** El daño que bloquea cuando está en posición de defensa.
- **HP:** Cuánto daño puede resistir antes de ser destruida.
- **Coste de Energía (★):** Valor cosmético para representar la rareza o nivel de poder, aunque en versiones futuras limitará las invocaciones.
- **Tipo y Rareza:** Generados en base a los stats base (BST) obtenidos de la PokéAPI.

## 5. Fin de la Partida
La partida termina inmediatamente cuando ocurre una de dos condiciones:
1. Los Puntos de Vida (LP) de un jugador llegan a 0 (pierde el juego).
2. Un jugador debe robar una carta al inicio de su turno y no tiene cartas en su mazo (deck-out).
