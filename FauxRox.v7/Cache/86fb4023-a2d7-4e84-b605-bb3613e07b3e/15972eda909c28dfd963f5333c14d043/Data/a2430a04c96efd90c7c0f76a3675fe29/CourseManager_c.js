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
// @input SceneObject cameraObject
// @input Asset.ObjectPrefab startLinePrefab
// @input Asset.ObjectPrefab gatePrefab
// @input Asset.ObjectPrefab burpeePrefab
// @input Asset.ObjectPrefab lungePrefab
// @input Asset.ObjectPrefab wallBallPrefab
// @input Asset.ObjectPrefab finishPrefab
// @input Asset.Material highlightMaterial
// @input Asset.Material completedMaterial
// @input bool useWorldQueryFilter = true
// @input float courseScale = 1
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
    checkUndefined("cameraObject", []);
    checkUndefined("startLinePrefab", []);
    checkUndefined("gatePrefab", []);
    checkUndefined("burpeePrefab", []);
    checkUndefined("lungePrefab", []);
    checkUndefined("wallBallPrefab", []);
    checkUndefined("finishPrefab", []);
    checkUndefined("useWorldQueryFilter", []);
    checkUndefined("courseScale", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
