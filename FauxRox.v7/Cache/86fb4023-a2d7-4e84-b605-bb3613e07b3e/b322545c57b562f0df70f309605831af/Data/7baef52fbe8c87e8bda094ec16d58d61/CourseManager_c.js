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
// @input Asset.ObjectPrefab startLinePrefab
// @input Asset.ObjectPrefab workoutPrefab
// @input Asset.ObjectPrefab finishPrefab
// @input Asset.Material highlightMaterial
// @input Asset.Material completedMaterial
// @input Asset.Material activeMaterial
// @input float runDistanceScale = 0.1
// @input float workoutScale = 1
// @input float stationSpacing = 500
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../Modules/Src/Assets/Scripts/CourseManager");
Object.setPrototypeOf(script, Module.CourseManager.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("startLinePrefab", []);
    checkUndefined("workoutPrefab", []);
    checkUndefined("finishPrefab", []);
    checkUndefined("runDistanceScale", []);
    checkUndefined("workoutScale", []);
    checkUndefined("stationSpacing", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
