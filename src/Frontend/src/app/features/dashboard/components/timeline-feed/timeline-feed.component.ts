import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RoutineEventModel, RoutineStore } from '../../../../core/state/routine.store';

@Component({
  selector: 'app-timeline-feed',
  standalone: true,
  imports: [DatePipe],
  template: `
    <section class="card" style="margin-top: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
        <div>
          <h3 class="section-title" style="margin-bottom: 0.15rem;">
            <span aria-hidden="true">📋</span>
            <span>Ficha Diária de Registro Sintético (Linha do Tempo Cronológica)</span>
          </h3>
          <p style="font-size: 0.84rem; color: var(--text-secondary);">
            Modelo estruturado da Seção 7 do Guia Completo com alertas clínicos e rastreabilidade por cuidador.
          </p>
        </div>
        <span class="badge">
          <span aria-hidden="true">🕒</span>
          <span>{{ store.events().length }} eventos registrados</span>
        </span>
      </div>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-strong); text-align: left;">
              <th style="padding: 0.65rem 0.5rem;">Horário</th>
              <th style="padding: 0.65rem 0.5rem;">Categoria</th>
              <th style="padding: 0.65rem 0.5rem;">Evento / Detalhes Clínicos</th>
              <th style="padding: 0.65rem 0.5rem;">Observações / Alertas</th>
              <th style="padding: 0.65rem 0.5rem;">Cuidador</th>
            </tr>
          </thead>
          <tbody>
            @for (ev of store.events(); track ev.id) {
              <tr style="border-bottom: 1px solid var(--border-subtle);">
                <td class="mono-timer" style="padding: 0.75rem 0.5rem; font-weight: 700; white-space: nowrap;">
                  {{ ev.timestamp | date:'HH:mm' }}
                </td>
                <td style="padding: 0.75rem 0.5rem; white-space: nowrap;">
                  <span class="badge" [class]="getCategoryBadgeClass(ev.category)">
                    <span aria-hidden="true">{{ getCategoryIcon(ev.category) }}</span>
                    <span>{{ getCategoryLabel(ev.category) }}</span>
                  </span>
                </td>
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">
                  {{ formatEventDetails(ev) }}
                </td>
                <td style="padding: 0.75rem 0.5rem;">
                  @if (ev.clinicalFlags.isRedFlagAlert) {
                    <div style="color: var(--cat-health); font-weight: 700;">
                      <span aria-hidden="true">🚨</span> {{ ev.clinicalFlags.alertMessage }}
                    </div>
                  } @else {
                    <span style="color: var(--text-secondary);">{{ ev.notes || 'Sem intercorrências' }}</span>
                  }
                </td>
                <td style="padding: 0.75rem 0.5rem; font-size: 0.82rem; color: var(--text-muted);">
                  {{ ev.recordedByName }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class TimelineFeedComponent {
  readonly store = inject(RoutineStore);

  getCategoryIcon(cat: string): string {
    switch (cat) {
      case 'Sleep': return '💤';
      case 'Feeding': return '🤱';
      case 'Diaper': return '🧷';
      case 'Medication': return '💊';
      case 'Bath': return '🛁';
      case 'WakeUp': return '☀️';
      default: return '📌';
    }
  }

  getCategoryLabel(cat: string): string {
    switch (cat) {
      case 'Sleep': return 'Sono';
      case 'Feeding': return 'Nutrição';
      case 'Diaper': return 'Higiene';
      case 'Medication': return 'Saúde/Med';
      case 'Bath': return 'Banho';
      case 'WakeUp': return 'Despertar';
      default: return cat;
    }
  }

  getCategoryBadgeClass(cat: string): string {
    switch (cat) {
      case 'Sleep':
      case 'WakeUp': return 'badge badge-sleep';
      case 'Feeding': return 'badge badge-feeding';
      case 'Diaper':
      case 'Bath': return 'badge badge-diaper';
      case 'Medication': return 'badge badge-health';
      default: return 'badge';
    }
  }

  formatEventDetails(ev: RoutineEventModel): string {
    const d = ev.details;
    if (ev.category === 'Diaper') {
      const code = `${d.state ?? 'U'}${d.volumeLevel ?? 2}`;
      const color = d.stoolColor ? ` • Cor: ${d.stoolColor}` : '';
      const cream = d.barrierCreamApplied ? ' • Pomada de barreira' : '';
      return `Fralda: ${code}${color}${cream}`;
    }
    if (ev.category === 'Sleep') {
      const type = d.sleepType === 'NightSleep' ? 'Sono Noturno' : 'Soneca';
      const dur = ev.durationMinutes ? ` (${ev.durationMinutes} min)` : '';
      const ww = d.wakeWindowPrecedingMinutes ? ` • Janela ant.: ${d.wakeWindowPrecedingMinutes} min` : '';
      return `${type}${dur} • Local: ${d.sleepLocation ?? 'Berço'}${ww}`;
    }
    if (ev.category === 'Feeding') {
      if (d.feedingType === 'Solids' && d.solidsDetails) {
        const fg = d.solidsDetails.foodGroups;
        const items = [
          ...(fg.fruitsAndVegetables ?? []),
          ...(fg.cerealsAndTubers ?? []),
          ...(fg.legumes ?? []),
          ...(fg.animalProtein ?? [])
        ].join(', ');
        return `Prato 4 Grupos (${d.solidsDetails.mealType}): ${items} • Aceitação: ${d.solidsDetails.acceptanceLevel}`;
      }
      if (d.breastfeedingDetails) {
        const bf = d.breastfeedingDetails;
        const side = bf.lastSideOffered === 'Left' ? 'Mama Esquerda' : bf.lastSideOffered === 'Right' ? 'Mama Direita' : 'Ambas as Mamas';
        return `${side} (${ev.durationMinutes ?? 15} min)`;
      }
      return `Oferta alimentar (${ev.durationMinutes ?? 15} min)`;
    }
    if (ev.category === 'Medication') {
      return `${d.medicationName ?? 'Medicação'} • Dose: ${d.dosageGiven ?? d.dosageMg + 'mg'} ${d.measuredTemperatureCelsius ? `(${d.measuredTemperatureCelsius}°C)` : ''}`;
    }
    if (ev.category === 'WakeUp') {
      return 'Despertar matinal espontâneo';
    }
    return ev.notes ?? 'Registro de rotina';
  }
}
