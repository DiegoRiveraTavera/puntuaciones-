import { Injectable } from '@angular/core';

export interface SearchResult {
  title: string;
  description: string;
  route: string;
  type: 'página' | 'contenido';
}

@Injectable({ providedIn: 'root' })
export class SearchService {

  // Páginas/secciones del sitio
  private pages: SearchResult[] = [
    { title: 'Inicio',     description: 'Puntuaciones y escuadras', route: '/inicio',    type: 'página' },
    { title: 'Formación',  description: 'Información de formación',  route: '/formacion', type: 'página' },
    { title: 'Juegos',     description: 'Lista de juegos',           route: '/juegos',    type: 'página' },
    { title: 'Técnica',    description: 'Técnicas registradas',      route: '/tecnica',   type: 'página' },
    { title: 'Lugares',    description: 'Lugares disponibles',       route: '/lugares',   type: 'página' },
  ];

  search(query: string): SearchResult[] {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return this.pages.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }
}