import { legalArchetypes } from '../Assets/Scripts/RunningArchetype';
import { workingBudgetSeconds } from '../Assets/Scripts/AdaptiveSessionGenerator';
import { scheduleRunning } from '../Assets/Scripts/RunningSchedule';

for (const tier of ['SHORT', 'MEDIUM', 'FULL'] as any[]) {
  const budget = workingBudgetSeconds(tier);
  const legal = legalArchetypes(tier, budget);
  console.log(tier.padEnd(7) + ' budget ' + Math.round(budget/60) + ' min  legal: ' + legal.join(', '));
  console.log('        after scheduling, no history: ' + scheduleRunning(legal).join(', '));
  console.log('        after a VO2 12h ago:          ' + scheduleRunning(legal, { recent: ['VO2'], hoursSinceLast: 12 }).join(', '));
}
