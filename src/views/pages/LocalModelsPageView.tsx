import {HardDrive} from "lucide-react";
import {LocalModelsView} from "../settings/LocalModelsView.tsx";
import {ContentPageLayout} from "../templates/ContentPageLayout.tsx";

export function LocalModelsPageView() {
    return (
        <ContentPageLayout title="Local Models" icon={HardDrive} description="Free offline speech-to-text models">
            <LocalModelsView />
        </ContentPageLayout>
    );
}
