if (script.onAwake) {
    script.onAwake();
    return;
}
function checkUndefined(property, showIfData) {
    for (var i = 0; i < showIfData.length; i++) {
        if (showIfData[i][0] && script[showIfData[i][0]] != showIfData[i][1]) {
            return;
        }
    }
    if (script[property] == undefined) {
        throw new Error("Input " + property + " was not provided for the object " + script.getSceneObject().name);
    }
}
// @input Component.ScriptComponent courseManagerScript
// @input Component.ScriptComponent courseSetupScript
// @input AssignableType heartRateTracker
// @input AssignableType_1 bleConnectionUI
// @input SceneObject heartRateHUD
// @input AssignableType_2 handZoneDetector
// @input SceneObject camera
// @input AssignableType_3 cloudManager
// @input AssignableType_4 aiCoach
// @input AssignableType_5 profileManager
// @input AssignableType_6 onboardingUI
// @input Component.Text statusText
// @input Component.Text timerText
// @input SceneObject timerBG
// @input Component.Text stationInfoText
// @input Component.Text countdownText
// @input Component.AudioComponent countdownBeepSound
// @input Component.AudioComponent countdownGoSound
// @input Component.Text instructionText
// @input SceneObject finishTunnelVfx
// @input Component.Image titleImage
// @input Component.Text heartRateText
// @input Component.Text hrZoneText
// @input Component.Text hrStatusText
// @input Component.Text stationNameText
// @input SceneObject stationInfoBG
// @input Component.Text nextStationText
// @input Component.Text progressText
// @input Component.ScriptComponent progressBar
// @input SceneObject startButtonObject
// @input SceneObject skiergGuides
// @input Component.AudioComponent formReminderSound
// @input Component.AudioComponent goodFormSound
// @input SceneObject finishPanel
// @input Component.Text finishStatusText
// @input Component.Text finishTotalTimeText
// @input Component.Text finishAvgHRText
// @input Component.Text finishPeakHRText
// @input Component.Text finishSplitsText
// @input Component.ScriptComponent finishResetButton
// @input float countdownSeconds = 3
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../Modules/Src/Assets/Scripts/RaceStateMachine");
Object.setPrototypeOf(script, Module.RaceStateMachine.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("courseManagerScript", []);
    checkUndefined("courseSetupScript", []);
    checkUndefined("handZoneDetector", []);
    checkUndefined("camera", []);
    checkUndefined("statusText", []);
    checkUndefined("timerText", []);
    checkUndefined("stationInfoText", []);
    checkUndefined("countdownSeconds", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
