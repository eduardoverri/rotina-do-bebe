import { Component, Input } from '@angular/core';

/** Link oficial da documentação de referência (Caderneta da Criança, 5ª edição — Ministério da Saúde, 2022). */
export const OFFICIAL_REFERENCE_URL =
  'https://www.gov.br/ans/pt-br/assuntos/operadoras/compromissos-e-interacoes-com-a-ans-1/programas-ans-1/caderneta_crianca_menino_5.ed.pdf';

@Component({
  selector: 'app-official-reference',
  standalone: true,
  template: `
    <p class="official-reference">
      <span aria-hidden="true">📚</span>
      <span>
        Referência:
        <a [href]="url" target="_blank" rel="noopener noreferrer">{{ url }}</a>
        @if (page) {
          <span> ({{ page }})</span>
        }
      </span>
    </p>
  `,
  styles: [`
    .official-reference {
      display: flex;
      align-items: flex-start;
      gap: 0.4rem;
      margin-top: 0.75rem;
      font-size: 0.74rem;
      color: var(--text-muted);
      overflow-wrap: anywhere;
    }

    .official-reference a {
      color: var(--cat-sleep);
      font-weight: 600;
    }
  `]
})
export class OfficialReferenceComponent {
  readonly url = OFFICIAL_REFERENCE_URL;

  /** Páginas/seções da Caderneta que fundamentam o texto (ex.: "Caderneta da Criança, p. 24"). */
  @Input() page = '';
}
