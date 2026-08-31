import { generateSession, describeBlocks, GeneratorInput } from '../Assets/Scripts/AdaptiveSessionGenerator';
import { StationConfig, StationMode, MotionType , distanceRun, runMetresOf, hasRun, timedRun} from '../Assets/Scripts/SessionTypes';

const T: StationConfig[] = [
  { name: 'AIR SKIERG', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'x', prefabType: 'AIR_SKIERG', run: distanceRun(100), motionType: MotionType.AIR_SKIERG },
  { name: 'DUMBBELL BEAR CRAWL', mode: StationMode.DISTANCE, requirement: 50, instruction: 'x', prefabType: 'POWER_LANE', run: distanceRun(100) },
  { name: 'GOBLET REVERSE WALK', mode: StationMode.DISTANCE, requirement: 50, instruction: 'x', prefabType: 'CRAB_WALK', run: distanceRun(100) },
  { name: 'BURPEE BROAD JUMP', mode: StationMode.REPS, requirement: 25, instruction: 'x', prefabType: 'BURPEE_BROAD_JUMP', run: distanceRun(100) },
  { name: 'STANDING ROW', mode: StationMode.ZONE_HIT, requirement: 50, instruction: 'x', prefabType: 'POWER_ROW', run: distanceRun(100), motionType: MotionType.BACKWARD_PULL },
  { name: 'HEAVY CARRY', mode: StationMode.DISTANCE, requirement: 200, instruction: 'x', prefabType: 'HEAVY_CARRY', run: distanceRun(100) },
  { name: 'DB WALKING LUNGES', mode: StationMode.DISTANCE, requirement: 100, instruction: 'x', prefabType: 'WALKING_LUNGES', run: distanceRun(100) },
  { name: 'SQUAT TARGET REACH', mode: StationMode.ZONE_HIT, requirement: 75, instruction: 'x', prefabType: 'TARGET_PRESS', run: distanceRun(100), motionType: MotionType.OVERHEAD_REACH },
];

const IN: GeneratorInput = { templates: T, baseRunMetres: 400 };

function show(label: string, req: any, input = IN) {
  const p = generateSession(input, req)!;
  console.log('\n' + label);
  console.log('  ' + p.rationale);
  for (const line of describeBlocks(p)) console.log('    ' + line);
}

show('NORMAL / FULL / RUNNING / REGULAR    seed 7', { space: 'NORMAL', duration: 'FULL', focus: 'RUNNING', level: 'REGULAR', seed: 7 });
show('NORMAL / MEDIUM / RUNNING / BEGINNER seed 2', { space: 'NORMAL', duration: 'MEDIUM', focus: 'RUNNING', level: 'BEGINNER', seed: 2 });
show('NORMAL / FULL / STRENGTH / REGULAR   seed 7', { space: 'NORMAL', duration: 'FULL', focus: 'STRENGTH', level: 'REGULAR', seed: 7 });
show('NORMAL / FULL / STRENGTH / REGULAR   seed 3', { space: 'NORMAL', duration: 'FULL', focus: 'STRENGTH', level: 'REGULAR', seed: 3 });
show('NORMAL / MEDIUM / ENGINE / REGULAR   seed 1', { space: 'NORMAL', duration: 'MEDIUM', focus: 'ENGINE', level: 'REGULAR', seed: 1 });
show('SMALL / SHORT / MIXED / BEGINNER     seed 5', { space: 'SMALL', duration: 'SHORT', focus: 'MIXED', level: 'BEGINNER', seed: 5 });
