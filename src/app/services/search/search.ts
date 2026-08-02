import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export interface SearchResult {
  title: string;
  description: string;
  route: string;
  type: string;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private http: HttpClient) {}

  search(query: string): Observable<SearchResult[]> {
    if (!query || query.trim().length < 2) return of([]);
    return this.http.get<SearchResult[]>(`/api/buscar?q=${encodeURIComponent(query)}`);
  }
}