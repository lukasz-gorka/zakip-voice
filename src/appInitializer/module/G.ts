import {AutoUpdateModule} from "../../autoUpdate/AutoUpdateModule.ts";
import {AutoUpdateStoreManager} from "../../autoUpdate/store/AutoUpdateStoreManager.ts";
import {GlobalShortcuts} from "../../globalShortcuts/GlobalShortcuts.ts";
import {AIService} from "../../integrations/ai/AIService.ts";
import {AIServiceBackend} from "../../integrations/ai/AIServiceBackend.ts";
import {RustProxyModule} from "../../rustProxy/RustProxyModule.ts";
import {VoiceStoreManager} from "../../voice/store/VoiceStoreManager.ts";
import {VoiceModule} from "../../voice/VoiceModule.ts";

export class G {
    public static globalShortcuts: GlobalShortcuts;
    public static rustProxy: RustProxyModule;
    public static ai: AIService;
    public static voice: VoiceModule;
    public static autoUpdate: AutoUpdateModule;
    public static dev: unknown;

    public static async init() {
        this.ai = new AIService(new AIServiceBackend());
        this.rustProxy = new RustProxyModule();
        this.globalShortcuts = new GlobalShortcuts();

        this.voice = new VoiceModule({
            storeManager: new VoiceStoreManager(),
            ai: this.ai,
        });

        this.autoUpdate = new AutoUpdateModule(new AutoUpdateStoreManager());
    }
}
