import {Bot} from "lucide-react";
import {AISettingsView} from "../settings/AISettingsView.tsx";
import {ContentPageLayout} from "../templates/ContentPageLayout.tsx";

export function ModelsPageView() {
    return (
        <ContentPageLayout title="AI Models" icon={Bot}>
            <AISettingsView />
        </ContentPageLayout>
    );
}
