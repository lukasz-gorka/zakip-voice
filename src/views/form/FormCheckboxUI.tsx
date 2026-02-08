import {Checkbox} from "../ui/checkbox.tsx";

interface FormCheckboxUIs {
    value: boolean;
    label: string;
    description?: string;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
}

export function FormCheckboxUI(props: FormCheckboxUIs) {
    const {value, label, onValueChange, description, disabled = false} = props;

    return (
        <div className="space-y-1 flex gap-4 w-full flex-row items-start justify-between">
            <Checkbox checked={value} onCheckedChange={(checked) => onValueChange(!!checked)} disabled={disabled} className="mt-1§" />
            <div className="flex flex-col gap-1">
                <p>{label}</p>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
        </div>
    );
}
