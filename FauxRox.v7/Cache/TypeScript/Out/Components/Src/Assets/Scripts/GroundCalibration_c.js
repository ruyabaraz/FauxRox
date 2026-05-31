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
// @input SceneObject camera
// @input SceneObject visualIndicator
// @input Component.Text progressText
// @input float maxHitDistance = 500
// @input float minHitDistance = 30
// @input float calibrationFrames = 30
// @input float moveThreshold = 8
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../Modules/Src/Assets/Scripts/GroundCalibration");
Object.setPrototypeOf(script, Module.GroundCalibration.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("camera", []);
    checkUndefined("maxHitDistance", []);
    checkUndefined("minHitDistance", []);
    checkUndefined("calibrationFrames", []);
    checkUndefined("moveThreshold", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
