import { Pipe, PipeTransform } from '@angular/core';
import { BabyModel } from '../../core/state/baby.store';

@Pipe({
  name: 'babyAge',
  standalone: true
})
export class BabyAgePipe implements PipeTransform {
  transform(baby: BabyModel | null | undefined): string {
    if (!baby) return '';
    const chronoDays = Math.max(0, Math.floor((Date.now() - new Date(baby.birthDate).getTime()) / 86400000));
    const months = Math.floor(chronoDays / 30);
    const days = chronoDays % 30;
    const baseText = `${months}m ${days}d`;

    if (baby.gestationalWeeks < 37) {
      const prematureDays = (40 * 7) - (baby.gestationalWeeks * 7 + baby.gestationalDays);
      const corrDays = Math.max(0, chronoDays - prematureDays);
      const corrMonths = Math.floor(corrDays / 30);
      const corrRemDays = corrDays % 30;
      return `${baseText} (Corrigida: ${corrMonths}m ${corrRemDays}d)`;
    }

    return baseText;
  }
}
