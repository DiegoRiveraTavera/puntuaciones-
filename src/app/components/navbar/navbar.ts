import { Component, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchService, SearchResult } from '../../services/search/search';

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
  ];

  activeTab = 'Inicio';
  searchOpen = false;
  searchQuery = '';
  results: SearchResult[] = [];

  constructor(private router: Router, private searchService: SearchService) {}

  setActive(tab: { label: string; route: string }) {
    this.activeTab = tab.label;
    this.router.navigate([tab.route]);
  }

  toggleSearch() {
    this.searchOpen = !this.searchOpen;
    if (!this.searchOpen) {
      this.searchQuery = '';
      this.results = [];
    } else {
      // foco automático al abrir
      setTimeout(() => this.searchInput?.nativeElement.focus(), 50);
    }
  }

  closeSearch() {
    this.searchOpen = false;
    this.searchQuery = '';
    this.results = [];
  }

  onSearch() {
    this.results = this.searchService.search(this.searchQuery);
  }

  goTo(result: SearchResult) {
    this.router.navigate([result.route]);
    this.closeSearch();
  }
}