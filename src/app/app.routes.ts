import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Formacion } from './pages/formacion/formacion';
import { Juegos} from './pages/juegos/juegos';
import { Tecnica } from './pages/tecnica/tecnica';
import { Lugares } from './pages/lugares/lugares';
import { Acerca } from './pages/acerca/acerca';
import { Estadisticas } from './pages/estadisticas/estadisticas';

export const routes: Routes = [
  { path: '',          redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'inicio',    component: Home },
  { path: 'formacion', component: Formacion },
  { path: 'juegos',    component: Juegos },
  { path: 'tecnica',   component: Tecnica },
  { path: 'lugares',   component: Lugares },
  { path: 'acerca',    component: Acerca },
  { path: 'estadisticas', component: Estadisticas },
  { path: '**',        redirectTo: 'inicio' },
];