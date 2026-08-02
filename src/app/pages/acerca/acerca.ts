import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FutterComponent } from '../../components/futter/futter';

@Component({
  selector: 'app-acerca',
  standalone: true,
  imports: [CommonModule, NavbarComponent, FutterComponent],
  templateUrl: './acerca.html',
  styleUrl: './acerca.css'
})
export class Acerca {}