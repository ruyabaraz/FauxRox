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
// @ui {"widget":"label", "label":"Fill Mode (choose one)"}
// @input SceneObject fillBar
// @input Asset.Material barMaterial
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Optional Elements"}
// @input SceneObject pointer
// @input Component.Text percentText
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Pointer Bounds (if using pointer)"}
// @input SceneObject startMarker
// @input SceneObject endMarker
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Settings"}
// @input float initialProgress
// @input bool smoothTransition = true
// @input float smoothSpeed = 8
// @input float minFillScale = 0.01
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../Modules/Src/Assets/Scripts/ProgressBarController");
Object.setPrototypeOf(script, Module.ProgressBarController.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("initialProgress", []);
    checkUndefined("smoothTransition", []);
    checkUndefined("smoothSpeed", []);
    checkUndefined("minFillScale", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
