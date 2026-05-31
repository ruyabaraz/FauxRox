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
// @input Component.Text textComponent
// @input Asset.Material[] Mats
// @input Asset.Material BarMat
// @input Component.Image barImage
// @input float initialProgress
// @input float globalOpacity = 1
// @input Component.ScreenTransform startPosScreenTransform
// @input Component.ScreenTransform endPosScreenTransform
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../../Modules/Src/Assets/Orthographic Camera.lspkg/Scripts/ProgressBarController");
Object.setPrototypeOf(script, Module.ProgressBarController.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("pointer", []);
    checkUndefined("textComponent", []);
    checkUndefined("Mats", []);
    checkUndefined("BarMat", []);
    checkUndefined("barImage", []);
    checkUndefined("initialProgress", []);
    checkUndefined("globalOpacity", []);
    checkUndefined("startPosScreenTransform", []);
    checkUndefined("endPosScreenTransform", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
