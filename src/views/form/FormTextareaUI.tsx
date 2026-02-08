import {useEffect, useRef} from "react";
import {Textarea} from "../ui/textarea.tsx";
import {FormLabelUI} from "./FormLabelUI.tsx";

interface IFormTextareaUi {
    value: string;
    onValueChange: (value: string) => void;
    label: string;
}

export function FormTextareaUI(props: IFormTextareaUi) {
    const {value, onValueChange, label} = props;
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!textareaRef.current) return;

        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }, [value]);

    return (
        <div className="space-y-1">
            <FormLabelUI>{label}</FormLabelUI>
            <Textarea
                value={value}
                className="w-full min-h-[170px] overflow-hidden p-6 rounded-md resize-none leading-6 bg-card"
                ref={textareaRef}
                onChange={(event) => onValueChange(event.target.value)}
            />
        </div>
    );
}
