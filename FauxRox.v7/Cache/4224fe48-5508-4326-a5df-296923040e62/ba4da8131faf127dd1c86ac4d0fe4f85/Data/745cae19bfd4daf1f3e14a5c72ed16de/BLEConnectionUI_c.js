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
// @input SceneObject promptPanel
// @input Component.ScriptComponent yesButton
// @input Component.ScriptComponent noButton
// @input SceneObject scanningPanel
// @input Component.Text scanningText
// @input SceneObject deviceListPanel
// @input SceneObject deviceButtonsContainer
// @input Asset.ObjectPrefab deviceButtonPrefab
// @input Component.ScriptComponent rescanButton
// @input AssignableType heartRateTracker
// @input SceneObject heartRateHUD
// @input Component.ScriptComponent skipButton
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
var Module = require("../../../../Modules/Src/Assets/Scripts/BLEConnectionUI");
Object.setPrototypeOf(script, Module.BLEConnectionUI.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("promptPanel", []);
    checkUndefined("yesButton", []);
    checkUndefined("noButton", []);
    checkUndefined("scanningPanel", []);
    checkUndefined("scanningText", []);
    checkUndefined("deviceListPanel", []);
    checkUndefined("deviceButtonsContainer", []);
    checkUndefined("heartRateTracker", []);
    checkUndefined("heartRateHUD", []);
    checkUndefined("debugPrint", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
