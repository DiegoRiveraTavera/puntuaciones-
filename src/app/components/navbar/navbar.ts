import { Component, ViewChild, ElementRef, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SearchService, SearchResult } from '../../services/search/search';

type EstadoBusqueda = 'inactivo' | 'buscando' | 'listo' | 'error';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: '../navbar/navbar.html',
  styleUrl: '../navbar/navbar.css'
})
export class NavbarComponent {
  @ViewChild('searchInput') searchInput!: ElementRef;

  tabs = [
    { label: 'Inicio',    route: '/inicio' },
    { label: 'Formación', route: '/formacion' },
    { label: 'Juegos',    route: '/juegos' },
    { label: 'Técnica',   route: '/tecnica' },
    { label: 'Lugares',   route: '/lugares' },
    { label: 'Acerca',    route: '/acerca' },
    { label: 'Estadísticas', route: '/estadisticas' },
    { label: 'Sesion',    route: '/camara' },
  ];

  activeTab = 'Inicio';
  searchOpen = false;
  searchQuery = '';

  // REQ-15: la app es zoneless, así que los resultados van en signals para que la
  // pantalla se actualice en cuanto llega la respuesta (antes se veían "un paso atrasados").
  results = signal<SearchResult[]>([]);
  // REQ-17: estado explícito para distinguir "sin resultados" de "el servidor falló".
  estado = signal<EstadoBusqueda>('inactivo');

  private consultas = new Subject<string>();

  constructor(private router: Router, private searchService: SearchService) {
    this.consultas.pipe(
      debounceTime(250),
      // switchMap descarta respuestas viejas si el usuario sigue escribiendo
      switchMap(q => {
        if (q.trim().length < 2) return of({ ok: true, datos: [] as SearchResult[], vacia: true });
        this.estado.set('buscando');
        return this.searchService.search(q).pipe(
          map(datos => ({ ok: true, datos, vacia: false })),
          catchError(() => of({ ok: false, datos: [] as SearchResult[], vacia: false })),
        );
      }),
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(r => {
      this.results.set(r.datos);
      this.estado.set(r.vacia ? 'inactivo' : r.ok ? 'listo' : 'error');
    });
  }

  setActive(tab: { label: string; route: string }) {
    this.activeTab = tab.label;
    this.router.navigate([tab.route]);
  }

  toggleSearch() {
    this.searchOpen = !this.searchOpen;
    if (!this.searchOpen) {
      this.limpiar();
    } else {
      // foco automático al abrir
      setTimeout(() => this.searchInput?.nativeElement.focus(), 50);
    }
  }

  closeSearch() {
    this.searchOpen = false;
    this.limpiar();
  }

  onSearch() {
    this.consultas.next(this.searchQuery);
  }

  goTo(result: SearchResult) {
    this.router.navigate([result.route]);
    this.closeSearch();
  }

  private limpiar() {
    this.searchQuery = '';
    this.results.set([]);
    this.estado.set('inactivo');
    this.consultas.next('');
  }
}
