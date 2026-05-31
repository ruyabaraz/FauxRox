"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Conversions = void 0;
var Conversions;
(function (Conversions) {
    function cmToFeet(cm) {
        return cm / 30.48;
    }
    Conversions.cmToFeet = cmToFeet;
    function feetToMile(ft) {
        return ft / 5280;
    }
    Conversions.feetToMile = feetToMile;
    function pointsToDist(points) {
        let dist = 0;
        for (let i = 0; i < points.length - 1; i++) {
            dist += points[i].sub(points[i + 1]).length;
        }
        return dist;
    }
    Conversions.pointsToDist = pointsToDist;
    function secToMin(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return { min, sec };
    }
    Conversions.secToMin = secToMin;
    function secToHr(sec) {
        return sec / 3600;
    }
    Conversions.secToHr = secToHr;
    function ftPerSecToMPH(paceFtPerSec) {
        return (paceFtPerSec * 3600) / 5280;
    }
    Conversions.ftPerSecToMPH = ftPerSecToMPH;
    function cmPerSecToMPH(paceCmPerSec) {
        return (paceCmPerSec * 3600) / (30.48 * 5280);
    }
    Conversions.cmPerSecToMPH = cmPerSecToMPH;
})(Conversions || (exports.Conversions = Conversions = {}));
//# sourceMappingURL=Conversions.js.map