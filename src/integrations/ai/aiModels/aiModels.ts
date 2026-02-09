import {store} from "../../../appInitializer/store";
import {createCompositeModelId} from "../interface/AIModel.ts";
import {AIModelTag} from "../interface/AIModelConfig.ts";
import {AIModelForUI, AIProviderConfig, AIProviderModelInfo} from "../interface/AIProviderConfig.ts";

const getProviders = () => store.getState().provider.collection;

export const getAIModels = (): AIProviderModelInfo[] => {
    const providers = getProviders();

    return providers.flatMap((provider) => provider.models).filter((model) => model.enabled);
};

export function getProvidersWithTag(tag: AIModelTag): AIProviderConfig[] {
    const providers = getProviders();
    return providers.filter((provider) => provider.models.some((model) => model.enabled && model.tags?.includes(tag)));
}

export const getAIModelsWithProvider = (): AIModelForUI[] => {
    const providers = getProviders();
    const models: AIModelForUI[] = [];

    for (const provider of providers) {
        for (const model of provider.models) {
            if (model.enabled) {
                models.push({
                    ...model,
                    compositeId: createCompositeModelId(provider.id, model.id),
                    providerId: provider.id,
                    providerName: provider.name,
                    providerUuid: provider.uuid,
                });
            }
        }
    }

    return models;
};

export const getAIModelsGroupedByProvider = (): Map<string, AIModelForUI[]> => {
    const providers = getProviders();
    const grouped = new Map<string, AIModelForUI[]>();

    for (const provider of providers) {
        const providerModels: AIModelForUI[] = provider.models
            .filter((model) => model.enabled)
            .map((model) => ({
                ...model,
                compositeId: createCompositeModelId(provider.id, model.id),
                providerId: provider.id,
                providerName: provider.name,
                providerUuid: provider.uuid,
            }));

        if (providerModels.length > 0) {
            grouped.set(provider.name, providerModels);
        }
    }

    return grouped;
};
