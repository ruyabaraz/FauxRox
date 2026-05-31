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
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Welcome Step"}
// @input SceneObject welcomePanel
// @input Component.Text welcomeNameText
// @input Component.ScriptComponent confirmNameButton
// @input Component.ScriptComponent guestButton
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Birth Year Step"}
// @input SceneObject birthYearPanel
// @input Component.Text birthYearText
// @input Component.ScriptComponent yearMinusButton
// @input Component.ScriptComponent yearPlusButton
// @input Component.ScriptComponent decade70sButton
// @input Component.ScriptComponent decade80sButton
// @input Component.ScriptComponent decade90sButton
// @input Component.ScriptComponent decade00sButton
// @input Component.ScriptComponent birthYearNextButton
// @input Component.ScriptComponent birthYearSkipButton
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Fitness Level Step"}
// @input SceneObject fitnessPanel
// @input Component.ScriptComponent beginnerButton
// @input Component.ScriptComponent regularButton
// @input Component.ScriptComponent athleteButton
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Goal Step"}
// @input SceneObject goalPanel
// @input Component.ScriptComponent finishStrongButton
// @input Component.ScriptComponent beatPBButton
// @input Component.ScriptComponent maxEffortButton
// @input Component.ScriptComponent pacingButton
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":"Confirm Step"}
// @input SceneObject confirmPanel
// @input Component.Text confirmSummaryText
// @input Component.ScriptComponent letsGoButton
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
