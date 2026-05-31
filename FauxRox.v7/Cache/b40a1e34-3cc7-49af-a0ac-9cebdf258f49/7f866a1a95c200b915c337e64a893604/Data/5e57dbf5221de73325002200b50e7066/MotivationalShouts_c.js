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
// @input AssignableType_1 heartRateTracker
// @input AssignableType_2 cloudManager
// @ui {"widget":"separator"}
// @ui {"widget":"group_start", "label":"Display"}
// @input Component.Text shoutText
// @input float shoutDuration = 2.5
// @ui {"widget":"group_end"}
// @ui {"widget":"separator"}
// @ui {"widget":"group_start", "label":"Settings"}
// @input bool enabled = true
// @input float minShoutInterval = 8
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
    checkUndefined("shoutText", []);
    checkUndefined("shoutDuration", []);
    checkUndefined("enabled", []);
    checkUndefined("minShoutInterval", []);
    checkUndefined("debugPrint", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
