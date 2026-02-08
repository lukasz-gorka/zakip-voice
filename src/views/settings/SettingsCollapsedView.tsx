import {ChevronDown} from "lucide-react";
import {ReactNode, useState} from "react";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "../ui/collapsible.tsx";

interface ISettingsCollapsedView {
    children: ReactNode;
    label?: string;
    defaultOpen?: boolean;
}

export function SettingsCollapsedView(props: ISettingsCollapsedView) {
    const {children, label, defaultOpen = false} = props;
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-background/20 p-2 rounded-md border border-muted border-input">
            <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-2 h-auto focus-visible:ring-2 focus-visible:ring-accent">
                    <span className="text-sm font-medium">{label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4">{children}</CollapsibleContent>
        </Collapsible>
    );
}
