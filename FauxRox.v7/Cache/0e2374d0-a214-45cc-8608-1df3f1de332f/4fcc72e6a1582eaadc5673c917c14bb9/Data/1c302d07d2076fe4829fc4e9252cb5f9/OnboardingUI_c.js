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
// @input AssignableType profileManager
// @input SceneObject frame
// @input SceneObject mainPanel
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Welcome"}
// @input Component.Text welcomeText
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Name Input"}
// @input Component.Text nameText
// @input Component.ScriptComponent nameEditButton
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Birth Year"}
// @input Component.Text birthYearText
// @input Component.ScriptComponent yearMinusButton
// @input Component.ScriptComponent yearPlusButton
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Fitness Level"}
// @input Component.ScriptComponent beginnerButton
// @input Component.ScriptComponent intermediateButton
// @input Component.ScriptComponent advancedButton
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Goal"}
// @input Component.ScriptComponent finishStrongButton
// @input Component.ScriptComponent beatPBButton
// @input Component.ScriptComponent maxEffortButton
// @input Component.ScriptComponent pacingButton
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Actions"}
// @input Component.ScriptComponent confirmButton
// @input Component.ScriptComponent guestButton
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Settings"}
// @input bool debugPrint = true
// @input float defaultBirthYear = 1990
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../Modules/Src/Assets/Scripts/OnboardingUI");
Object.setPrototypeOf(script, Module.OnboardingUI.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("profileManager", []);
    checkUndefined("debugPrint", []);
    checkUndefined("defaultBirthYear", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
