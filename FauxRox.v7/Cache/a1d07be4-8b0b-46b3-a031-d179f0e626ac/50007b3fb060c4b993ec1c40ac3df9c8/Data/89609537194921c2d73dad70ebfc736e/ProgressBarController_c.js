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
// @input SceneObject pointer
// @input Component.Text percentText
// @input Asset.Material barMaterial
// @input SceneObject startMarker
// @input SceneObject endMarker
// @input float initialProgress
// @input bool smoothTransition = true
// @input float smoothSpeed = 8
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
    checkUndefined("pointer", []);
    checkUndefined("startMarker", []);
    checkUndefined("endMarker", []);
    checkUndefined("initialProgress", []);
    checkUndefined("smoothTransition", []);
    checkUndefined("smoothSpeed", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
