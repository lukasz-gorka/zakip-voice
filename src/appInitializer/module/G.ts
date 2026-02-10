import {AutoUpdateModule} from "../../autoUpdate/AutoUpdateModule.ts";
import {AutoUpdateStoreManager} from "../../autoUpdate/store/AutoUpdateStoreManager.ts";
import {GlobalShortcuts} from "../../globalShortcuts/GlobalShortcuts.ts";
import {AIService} from "../../integrations/ai/AIService.ts";
import {AIServiceBackend} from "../../integrations/ai/AIServiceBackend.ts";
import {RustProxy} from "../../rustProxy/RustProxy.ts";
import {VoiceStoreManager} from "../../voice/store/VoiceStoreManager.ts";
import {VoiceModule} from "../../voice/VoiceModule.ts";

export class G {
    public static rustProxy: RustProxy;
    public static globalShortcuts: GlobalShortcuts;
    public static autoUpdate: AutoUpdateModule;
    public static voice: VoiceModule;

    public static async init() {
        this.rustProxy = new RustProxy();
        this.globalShortcuts = new GlobalShortcuts();
        this.autoUpdate = new AutoUpdateModule(new AutoUpdateStoreManager());

        this.voice = new VoiceModule({
            storeManager: new VoiceStoreManager(),
            ai: new AIService(new AIServiceBackend()),
        });
    }
}
