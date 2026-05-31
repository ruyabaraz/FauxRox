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
// @input Asset.ObjectPrefab finishPrefab
// @input Asset.ObjectPrefab airSkiergPrefab
// @input Asset.ObjectPrefab powerLanePrefab
// @input Asset.ObjectPrefab crabWalkPrefab
// @input Asset.ObjectPrefab burpeeBroadJumpPrefab
// @input Asset.ObjectPrefab powerRowPrefab
// @input Asset.ObjectPrefab heavyCarryPrefab
// @input Asset.ObjectPrefab walkingLungesPrefab
// @input Asset.ObjectPrefab targetPressPrefab
// @input Asset.ObjectPrefab defaultWorkoutPrefab
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Run Settings"}
// @input float runDistance = 100
// @input float spawnDistanceAhead = 150
// @input float fadeDuration = 0.5
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Zone Hit Stations (reps)"}
// @input float airSkiergReps = 50
// @input float powerRowReps = 50
// @input float targetPressReps = 75
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Distance Stations (meters)"}
// @input float powerLaneDistance = 50
// @input float crabWalkDistance = 50
// @input float burpeeReps = 25
// @input float heavyCarryDistance = 200
// @input float lungesDistance = 100
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
    checkUndefined("finishPrefab", []);
    checkUndefined("runDistance", []);
    checkUndefined("spawnDistanceAhead", []);
    checkUndefined("fadeDuration", []);
    checkUndefined("airSkiergReps", []);
    checkUndefined("powerRowReps", []);
    checkUndefined("targetPressReps", []);
    checkUndefined("powerLaneDistance", []);
    checkUndefined("crabWalkDistance", []);
    checkUndefined("burpeeReps", []);
    checkUndefined("heavyCarryDistance", []);
    checkUndefined("lungesDistance", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
