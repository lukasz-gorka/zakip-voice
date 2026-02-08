import {Volume2} from "lucide-react";
import {Button} from "../../views/ui/button.tsx";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from "../../views/ui/select.tsx";
import {NotificationSoundName} from "../const/NotificationSoundName.ts";
import {playNotificationSound} from "../sounds.ts";

interface ISoundSelectionDropdown {
    value: NotificationSoundName;
    onValueChange: (value: NotificationSoundName) => void;
    className?: string;
}

const SOUND_OPTIONS: Array<{id: NotificationSoundName; name: string; description: string}> = [
    {id: NotificationSoundName.NONE, name: "None", description: "No sound"},
    {id: NotificationSoundName.COMPLETE, name: "Complete", description: "Single beep (default)"},
    {id: NotificationSoundName.SUCCESS, name: "Success", description: "Positive chord"},
    {id: NotificationSoundName.ATTENTION, name: "Attention", description: "Two quick beeps"},
    {id: NotificationSoundName.BELL, name: "Bell", description: "Descending bell tone"},
    {id: NotificationSoundName.CHIME, name: "Chime", description: "Three ascending notes"},
    {id: NotificationSoundName.GENTLE, name: "Gentle", description: "Soft low tone"},
    {id: NotificationSoundName.ALERT, name: "Alert", description: "Alert-like beeps"},
];

export function SoundSelectionDropdown(props: Readonly<ISoundSelectionDropdown>) {
    const {value, onValueChange, className} = props;

    const handlePreviewSound = (soundType: NotificationSoundName) => {
        playNotificationSound(soundType);
    };

    const currentSound = SOUND_OPTIONS.find((s) => s.id === value) || SOUND_OPTIONS[1];

    return (
        <div className="flex items-center gap-2">
            <Select onValueChange={(value) => onValueChange(value as NotificationSoundName)} value={value}>
                <SelectTrigger className={className || "w-[250px]"}>
                    <SelectValue placeholder="Select a sound" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {SOUND_OPTIONS.map((sound) => (
                            <SelectItem key={sound.id} value={sound.id}>
                                <div className="flex flex-col">
                                    <span className="font-medium">{sound.name}</span>
                                    <span className="text-xs text-muted-foreground">{sound.description}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
            {value !== NotificationSoundName.NONE && (
                <Button variant="outline" size="icon" onClick={() => handlePreviewSound(currentSound.id)} title={`Preview ${currentSound.name} sound`} type="button">
                    <Volume2 className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
