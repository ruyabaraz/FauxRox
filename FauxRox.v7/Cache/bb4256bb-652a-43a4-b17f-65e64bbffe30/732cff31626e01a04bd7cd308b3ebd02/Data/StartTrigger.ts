typescript
import { RaceStateMachine } from './RaceStateMachine';
import { CourseManager } from './CourseManager';

@component
export class StartTrigger extends BaseScriptComponent {
  @input raceStateMachine: RaceStateMachine;
  @input courseManager: CourseManager;

  onAwake() {
    // İlk pinch → course yerleştir
    // İkinci pinch → race başlat
    // Bunu SIK PinchButton'ın onButtonPinched event'ine bağla
    this.createEvent('OnStartEvent').bind(() => {
      print('[StartTrigger] Ready — pinch to place, pinch again to race');
    });
  }

  // PinchButton'dan çağrılacak
  onPinch(): void {
    if (!this.courseManager.isCoursePlaced) {
      this.courseManager.placeCourse();
    } else {
      this.raceStateMachine.startRace();
    }
  }
}
