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
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Motivational Shouts System"}
// @ui {"widget":"separator"}
// @input AssignableType raceStateMachine
// @input AssignableType_1 aiCoach
// @input AssignableType_2 heartRateTracker
// @input AssignableType_3 cloudManager
// @ui {"widget":"separator"}
// @ui {"widget":"group_start", "label":"Settings"}
// @input bool enabled = true
// @input float minShoutInterval = 15
// @input bool debugPrint = true
// @ui {"widget":"group_end"}
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../Modules/Src/Assets/Scripts/MotivationalShouts");
Object.setPrototypeOf(script, Module.MotivationalShouts.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("raceStateMachine", []);
    checkUndefined("aiCoach", []);
    checkUndefined("enabled", []);
    checkUndefined("minShoutInterval", []);
    checkUndefined("debugPrint", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
