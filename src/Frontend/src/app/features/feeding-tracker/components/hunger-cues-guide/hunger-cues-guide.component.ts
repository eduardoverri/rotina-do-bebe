import { Component } from '@angular/core';

@Component({
  selector: 'app-hunger-cues-guide',
  standalone: true,
  template: `
    <div class="card">
      <h3 class="section-title">
        <span aria-hidden="true">📖</span>
        <span>Guia Clínico de Sinais Biológicos de Fome, Saciedade e Divisão de Responsabilidades (Seção 2)</span>
      </h3>

      <div class="grid-3">
        <div class="card-elevated" style="border-left: 4px solid var(--cat-diaper);">
          <div style="font-weight: 800; color: var(--cat-diaper);">🟢 1. Sinais Precoces (Momento Ideal)</div>
          <ul style="padding-left: 1.15rem; font-size: 0.85rem; margin-top: 0.4rem; color: var(--text-secondary);">
            <li>Movimentação corporal sutil</li>
            <li>Abertura espontânea da boca</li>
            <li>Reflexo de busca (virar o rosto)</li>
            <li>Levar as mãos ou dedos à boca</li>
          </ul>
        </div>

        <div class="card-elevated" style="border-left: 4px solid var(--cat-milestone);">
          <div style="font-weight: 800; color: var(--cat-milestone);">🟡 2. Sinais Intermediários</div>
          <ul style="padding-left: 1.15rem; font-size: 0.85rem; margin-top: 0.4rem; color: var(--text-secondary);">
            <li>Espreguiçar acentuado</li>
            <li>Movimentos ativos de sucção de lábios/língua</li>
            <li>Pequenos sons e resmungos de desconforto</li>
          </ul>
        </div>

        <div class="card-elevated" style="border-left: 4px solid var(--cat-health);">
          <div style="font-weight: 800; color: var(--cat-health);">🔴 3. Sinais Tardios (Acolher Primeiro)</div>
          <ul style="padding-left: 1.15rem; font-size: 0.85rem; margin-top: 0.4rem; color: var(--text-secondary);">
            <li>Choro forte e inconsolável</li>
            <li>Agitação motora intensa e rubor facial</li>
            <li><strong>Conduta:</strong> Acalmar no colo antes de acoplar ao seio.</li>
          </ul>
        </div>
      </div>

      <div class="card-elevated" style="margin-top: 0.85rem; font-size: 0.86rem;">
        <strong>⚖️ Divisão de Responsabilidades (Satter / Guia Seção 2.2):</strong>
        O cuidador decide <strong>o que</strong>, <strong>quando</strong> e <strong>onde</strong> oferecer; o bebê decide <strong>se</strong> e <strong>quanto</strong> comer, respeitando sua autorregulação fisiológica sem coerção.
      </div>
    </div>
  `
})
export class HungerCuesGuideComponent {}
