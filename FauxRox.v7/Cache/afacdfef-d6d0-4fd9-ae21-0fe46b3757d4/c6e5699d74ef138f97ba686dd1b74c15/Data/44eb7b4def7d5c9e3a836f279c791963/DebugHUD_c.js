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
// @input Component.Text debugText
// @input AssignableType raceStateMachine
// @input AssignableType_1 handZoneDetector
// @input AssignableType_2 courseManager
// @input AssignableType_3 locationTracker
// @input bool enabled = true
// @input float updateInterval = 0.1
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../Modules/Src/Assets/Scripts/DebugHUD");
Object.setPrototypeOf(script, Module.DebugHUD.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("debugText", []);
    checkUndefined("raceStateMachine", []);
    checkUndefined("handZoneDetector", []);
    checkUndefined("courseManager", []);
    checkUndefined("enabled", []);
    checkUndefined("updateInterval", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
