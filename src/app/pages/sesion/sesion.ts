import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

const CLAVE = 'enlacesUsados';

@Component({
  selector: 'app-sesion',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './sesion.html',
  styleUrl: './sesion.css'
})
export class Sesion {
  codigo = '';
  valido = false;
  fecha = '';

  constructor(ruta: ActivatedRoute) {
    this.codigo = ruta.snapshot.paramMap.get('codigo') ?? '';
    const usados = this.leerUsados();

    if (this.codigo && !usados.includes(this.codigo)) {
      // Primer uso: la sesión inicia y el enlace queda gastado
      this.valido = true;
      this.fecha = new Date().toLocaleString('es-MX');
      this.guardarUsados([...usados, this.codigo]);
    }
  }

  private leerUsados(): string[] {
    try {
      return JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    } catch {
      return [];
    }
  }

  private guardarUsados(lista: string[]): void {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch {}
  }
}