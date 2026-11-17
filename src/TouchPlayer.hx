import flash.Lib;
import flash.events.Event;
import flash.external.ExternalInterface;
import flash.system.ApplicationDomain;

class TouchPlayer {
    static final held = new Map<String, Int>();
    static final pressedFrame = new Map<String, Int>();
    static final pendingRelease = new Map<String, Bool>();
    static var inputs:Dynamic;
    static var screens:Dynamic;
    static var gui:Dynamic;
    static var raceClass:Dynamic;
    static var active = false;
    static var frame = 0;

    static function main() {
        Lib.current.stage.addEventListener(Event.ENTER_FRAME, attach);
    }

    static function attach(_:Event) {
        var domain = ApplicationDomain.currentDomain;
        if (!domain.hasDefinition("managers.KeyboardManager")) return;
        Lib.current.stage.removeEventListener(Event.ENTER_FRAME, attach);
        inputs = domain.getDefinition("managers.KeyboardManager");
        screens = domain.getDefinition("managers.ScreenManager");
        gui = domain.getDefinition("components.SpriteGUI");
        raceClass = domain.getDefinition("screens.race.Race");
        ExternalInterface.addCallback("touchControl", control);
        ExternalInterface.addCallback("releaseControls", releaseAll);
        Lib.current.stage.addEventListener(Event.ENTER_FRAME, tick);
        ExternalInterface.call("gameLoaded");
    }

    static function tick(_:Event) {
        frame++;
        for (action in [for (key in pendingRelease.keys()) key]) {
            if (frame - pressedFrame.get(action) >= 2) release(action);
        }
        // Avoid constructing the game's Race singleton before its own startup.
        var screen:Dynamic = screens.currentScreen;
        var racing = screen != null && Std.isOfType(screen, raceClass)
            && gui.isActive == screen && screen.raceStart;
        if (racing != active) {
            active = racing;
            if (!active) releaseAll();
            ExternalInterface.call("raceControlsVisible", active);
        }
    }

    static function control(action:String, down:Bool) {
        if (!down) {
            if (held.exists(action)) {
                if (frame - pressedFrame.get(action) < 2) pendingRelease.set(action, true);
                else release(action);
            }
            return;
        }
        if (!active) return;
        pendingRelease.remove(action);
        if (held.exists(action)) return;
        var key = switch (action) {
            case "forward": 38;
            case "back": 40;
            case "noseUp": 37;
            case "noseDown": 39;
            case "fire": 32;
            case "boost": 16;
            case "jump": screens.currentScreen.mode == 2 ? 67 : 88;
            default: return;
        }
        held.set(action, key);
        pressedFrame.set(action, frame);
        inputs.keyDown(key);
    }

    static function release(action:String) {
        inputs.keyUp(held.get(action));
        held.remove(action);
        pressedFrame.remove(action);
        pendingRelease.remove(action);
    }

    static function releaseAll() {
        for (action in [for (key in held.keys()) key]) release(action);
    }
}
