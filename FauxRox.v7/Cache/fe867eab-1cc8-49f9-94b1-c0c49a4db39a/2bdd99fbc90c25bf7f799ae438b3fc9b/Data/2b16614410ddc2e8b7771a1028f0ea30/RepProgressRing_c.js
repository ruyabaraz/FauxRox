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
// @input Component.Image ringImage
// @input Component.Text currentText
// @input Component.Text totalText
// @input vec4 ringColor = {0.8,1,0.8,1}
// @input vec4 bgColor = {0.3,0.3,0.3,0.5}
// @input float ringWidth = 0.08
// @input bool animateProgress = true
// @input float animationDuration = 0.15
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../Modules/Src/Assets/Scripts/RepProgressRing");
Object.setPrototypeOf(script, Module.RepProgressRing.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("ringImage", []);
    checkUndefined("currentText", []);
    checkUndefined("totalText", []);
    checkUndefined("ringColor", []);
    checkUndefined("bgColor", []);
    checkUndefined("ringWidth", []);
    checkUndefined("animateProgress", []);
    checkUndefined("animationDuration", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
