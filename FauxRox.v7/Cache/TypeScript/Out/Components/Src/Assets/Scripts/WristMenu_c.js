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
// @input Component.ScriptComponent raceStateMachineScript
// @input AssignableType aiCoach
// @input AssignableType_1 pauseButton
// @input SceneObject pauseButtonObject
// @input AssignableType_2 resumeButton
// @input SceneObject resumeButtonObject
// @input AssignableType_3 stopButton
// @input SceneObject stopButtonObject
// @input AssignableType_4 askCoachButton
// @input SceneObject askCoachButtonObject
// @input SceneObject menuContainer
// @input bool debugPrint = true
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../Modules/Src/Assets/Scripts/WristMenu");
Object.setPrototypeOf(script, Module.WristMenu.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("raceStateMachineScript", []);
    checkUndefined("debugPrint", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
