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
// @ui {"widget":"label", "label":"AI Coach - Toggle Mode + Push-to-Talk"}
// @ui {"widget":"separator"}
// @ui {"widget":"group_start", "label":"Setup"}
// @input SceneObject websocketRequirementsObj
// @input AssignableType dynamicAudioOutput
// @input Component.Text textDisplay
// @ui {"widget":"group_end"}
// @ui {"widget":"separator"}
// @ui {"widget":"group_start", "label":"Game References"}
// @input AssignableType_1 raceStateMachine
// @input AssignableType_2 heartRateTracker
// @input AssignableType_3 cloudManager
// @ui {"widget":"group_end"}
// @ui {"widget":"separator"}
// @ui {"widget":"group_start", "label":"AI Settings"}
// @input string instructions {"widget":"text_area"}
// @input string voice = "Kore" {"widget":"combobox", "values":[{"label":"Kore", "value":"Kore"}, {"label":"Puck", "value":"Puck"}, {"label":"Charon", "value":"Charon"}, {"label":"Aoede", "value":"Aoede"}, {"label":"Fenrir", "value":"Fenrir"}, {"label":"Leda", "value":"Leda"}, {"label":"Orus", "value":"Orus"}, {"label":"Zephyr", "value":"Zephyr"}]}
// @ui {"widget":"group_end"}
// @ui {"widget":"separator"}
// @ui {"widget":"group_start", "label":"UI"}
// @input SceneObject recordingIndicator
// @input SceneObject listeningWaveAnimation
// @input SceneObject micImage
// @input SceneObject toggleButton
// @input float pulseSpeed = 4
// @input float pulseScale = 0.15
// @input bool debugPrint = true
// @ui {"widget":"group_end"}
if (!global.BaseScriptComponent) {
    function BaseScriptComponent() {}
    global.BaseScriptComponent = BaseScriptComponent;
    global.BaseScriptComponent.prototype = Object.getPrototypeOf(script);
    global.BaseScriptComponent.prototype.__initialize = function () {};
    global.BaseScriptComponent.getTypeName = function () {
        throw new Error("Cannot get type name from the class, not decorated with @component");
    };
}
var Module = require("../../../../Modules/Src/Assets/Scripts/AICoach");
Object.setPrototypeOf(script, Module.AICoach.prototype);
script.__initialize();
let awakeEvent = script.createEvent("OnAwakeEvent");
awakeEvent.bind(() => {
    checkUndefined("websocketRequirementsObj", []);
    checkUndefined("dynamicAudioOutput", []);
    checkUndefined("instructions", []);
    checkUndefined("voice", []);
    checkUndefined("pulseSpeed", []);
    checkUndefined("pulseScale", []);
    checkUndefined("debugPrint", []);
    if (script.onAwake) {
       script.onAwake();
    }
});
