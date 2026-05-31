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
// @input AssignableType locationTracker
// @input AssignableType_1 handZoneDetector
// @input SceneObject camera
// @input Component.Text statusText
// @input Component.Text timerText
// @input SceneObject timerBG
// @input Component.Text stationInfoText
// @input Component.Text countdownText
// @input Component.Text instructionText
// @input SceneObject finishTunnelVfx
// @input Component.Image titleImage
// @input SceneObject startButtonObject
// @input Component.Text gpsStatusText
// @input Component.ScriptComponent progressBar
// @input float countdownSeconds = 3
// @input bool useGPSTracking = true
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
    checkUndefined("locationTracker", []);
    checkUndefined("handZoneDetector", []);
    checkUndefined("camera", []);
    checkUndefined("statusText", []);
    checkUndefined("timerText", []);
    checkUndefined("stationInfoText", []);
    checkUndefined("countdownSeconds", []);
    checkUndefined("useGPSTracking", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
