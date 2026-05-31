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
// @input Asset.ObjectPrefab arrowPrefab
// @input float arrowSpacing = 250
// @input float spawnAheadDistance = 1000
// @input float maxArrows = 5
// @input float arrowHeight = 50
// @input float floorY
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
var Module = require("../../../../Modules/Src/Assets/Scripts/RunArrowGuide");
Object.setPrototypeOf(script, Module.RunArrowGuide.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("camera", []);
    checkUndefined("arrowPrefab", []);
    checkUndefined("arrowSpacing", []);
    checkUndefined("spawnAheadDistance", []);
    checkUndefined("maxArrows", []);
    checkUndefined("arrowHeight", []);
    checkUndefined("floorY", []);
    checkUndefined("debugPrint", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
