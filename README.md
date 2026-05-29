# PokeDuel Arena

PokeDuel Arena es un videojuego web de cartas por turnos inspirado en el universo de Pokémon, desarrollado como un proyecto final con una arquitectura profesional y escalable.

## 🚀 Tecnologías

*   **Frontend:** Angular 21 (Standalone Components)
*   **Base de Datos Local:** SQLite (vía `sql.js` y abstraction `IndexedDB` para persistencia nativa en navegador).
*   **Base de Datos Online / Auth:** Supabase (PostgreSQL).
*   **API Externa:** PokéAPI v2.
*   **Estilos:** CSS3 nativo con Variables de Tema (Dark Theme/Arena Theme).

## 🌟 Características Principales

1.  **Consumo de PokéAPI y Transformación de Cartas:**
    *   Los datos raw de Pokémon se transforman dinámicamente en Cartas Jugables.
    *   Cálculo automático de HP, Ataque, Defensa, Costo de Energía y Rareza basado en las *Base Stats*.

2.  **Modo Offline y Caché Local (PWA-Ready):**
    *   Explorador de Cartas: Navega y filtra cartas. Las cartas descubiertas se guardan en caché local.
    *   Constructor de Mazos: Crea mazos de al menos 20 cartas. El mazo activo se guarda localmente en IndexedDB.
    *   Modo Solo: Juega contra una Inteligencia Artificial básica en un motor de reglas completo (Fase de Robo, Principal, Batalla, Fin) sin necesidad de internet (siempre y cuando las cartas estén en caché).
    *   Historial Local: Guarda el registro de tus partidas offline.

3.  **Modo Online y Autenticación (Supabase):**
    *   Registro y Login de usuarios usando Supabase Auth.
    *   Lobby Multijugador: Crea salas y comparte códigos para jugar contra amigos.
    *   Sincronización en tiempo real vía Supabase Realtime Channels.
    *   Guardado de resultados en la nube y actualización de perfiles.

## 📁 Estructura del Proyecto

*   `src/app/core/`: Modelos, servicios singleton (GameEngine, Auth, Supabase, Pokeapi, Sqlite).
*   `src/app/shared/`: Componentes reutilizables de UI (PokemonCard, Battlefield, Hand, etc.).
*   `src/app/pages/`: Componentes enrutados (`/home`, `/login`, `/deck-builder`, `/solo-game`, etc.).
*   `supabase/`: Esquema SQL de la base de datos de producción (`schema.sql`).

## 🛠️ Instalación Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar Entorno:
   Actualiza `src/environments/environment.ts` con tus credenciales de Supabase.

3. Correr Servidor:
   ```bash
   ng serve
   ```
   Abre `http://localhost:4200` en tu navegador.

## 🌐 Despliegue en Vercel

PokeDuel Arena está diseñado como una SPA (Single Page Application) estática, lista para ser desplegada en Vercel sin dependencias de un servidor backend local. Sigue estos pasos exactos:

1. **Subir a GitHub:** 
   Sube todo el código de este proyecto a un repositorio en tu cuenta de GitHub.
   
2. **Importar repositorio en Vercel:**
   Ve a Vercel, haz clic en "Add New..." -> "Project" y selecciona tu repositorio.

3. **Configuración de Vercel:**
   - **Framework Preset:** Selecciona `Angular`.
   - **Build Command:** Deja el predeterminado o escribe `npm run build`.
   - **Output Directory:** Vercel lo detectará, pero la ruta de salida real según el `angular.json` es `dist/pokeduel-arena/browser`.
   - **Environment Variables:** Añade tus variables de Supabase si decides usar `environment.prod.ts` o sustituir variables durante el build. En nuestro caso, como es una SPA, las variables ya pueden estar expuestas en tu `environment.ts` (ya que Supabase maneja la seguridad mediante RLS).

4. **Configuración del Router (vercel.json):**
   El proyecto ya incluye un archivo `vercel.json` en la raíz con el bloque `rewrites`. Esto asegura que al recargar páginas o acceder directamente a rutas como `/login` o `/solo-game`, Vercel redirija la petición al `index.html` para que el Angular Router se encargue sin dar un error 404.

5. **Configuración de Supabase:**
   Asegúrate de haber ejecutado el script `supabase/schema.sql` en tu proyecto de Supabase para que todas las tablas, relaciones y políticas RLS estén activas.

## 🎓 Cómo demostrar el proyecto al profesor

Para defender este proyecto y mostrar que se cumple el 100% de la rúbrica, sigue estos pasos secuenciales durante tu presentación oral:

1. **Abrir Home:** Muestra la portada principal estilo videojuego para comprobar el *Diseño visual y UI responsiva* (Punto 1).
2. **Mostrar Colección consumiendo PokeAPI:** Navega a la colección. Explica cómo Angular hace `HTTP GET` a PokeAPI, transforma la "Base Stat" en parámetros del TCG (Ataque, Defensa, Costo) y almacena las cartas localmente (Punto 2).
3. **Crear Mazo:** Ve al Constructor de Mazos. Demuestra que se limita a un mínimo de 20 cartas y que se usa *SQLite/IndexedDB Local* para guardar el mazo temporal (Punto 3 y 8).
4. **Jugar contra Computadora:** Entra a "Jugar Solo". Explica el *Motor de Reglas* (4000 LP, fases, límite de 5 cartas). Demuestra la invocación, el uso de habilidades (botón 💥) y el ataque. Muestra cómo la IA responde invocando y atacando (Punto 4 y 5).
5. **Mostrar Historial local:** Ve a Historial. Enseña que la victoria/derrota recién jugada se ha guardado localmente (Punto 8).
6. **Iniciar Sesión:** Cierra sesión si la tienes abierta y crea un usuario nuevo en `/register`, luego loguéate. Esto demuestra *Supabase Auth*.
7. **Mostrar Supabase:** Abre tu panel de Supabase y enséñale al profesor las tablas creadas por el `schema.sql`, destacando el RLS (Punto 7).
8. **Crear Sala Online:** Ve a "Multijugador". Crea una sala, copia el código (un amigo o tú en modo incógnito puede unirse). Muestra cómo los turnos se bloquean y el estado se sincroniza en *Realtime* (Punto 6).
9. **Mostrar Documentación y Schema SQL:** Enséñale la pestaña de "Reglas" para la documentación funcional, y el código de tu `supabase/schema.sql`.
10. **Explicar despliegue en Vercel:** Finalmente, explica que la app no requiere backend propio por ser estática (SPA) y muestra cómo fue configurado `vercel.json` para desplegar fácilmente.

Una vez desplegado, ¡tu juego estará online globalmente!
