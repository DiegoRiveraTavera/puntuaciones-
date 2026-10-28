import { Routes } from '@angular/router';

import { Home } from './pages/home/home';
import { Formacion } from './pages/formacion/formacion';
import { Juegos} from './pages/juegos/juegos';
import { Tecnica } from './pages/tecnica/tecnica';
import { Lugares } from './pages/lugares/lugares';
import { Acerca } from './pages/acerca/acerca';
import { Estadisticas } from './pages/estadisticas/estadisticas';

import { Camara } from './pages/camara/camara';
import { Sesion } from './pages/sesion/sesion';

import { Login } from './pages/login/login';
import { sesionGuard } from './services/sesion/sesion';


export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'sesion/:codigo', component: Sesion },

  // Pantallas internas: solo con sesión iniciada (REQ-14)
  { path: 'inicio',       component: Home,         canActivate: [sesionGuard] },
  { path: 'formacion',    component: Formacion,    canActivate: [sesionGuard] },
  { path: 'juegos',       component: Juegos,       canActivate: [sesionGuard] },
  { path: 'tecnica',      component: Tecnica,      canActivate: [sesionGuard] },
  { path: 'lugares',      component: Lugares,      canActivate: [sesionGuard] },
  { path: 'acerca',       component: Acerca,       canActivate: [sesionGuard] },
  { path: 'estadisticas', component: Estadisticas, canActivate: [sesionGuard] },
  { path: 'camara',       component: Camara,       canActivate: [sesionGuard] },

  // Ruta anterior de "Acerca de" que usaba el buscador (REQ-15)
  { path: 'acerca-de', redirectTo: 'acerca' },

  { path: '**', redirectTo: 'inicio' },
];
