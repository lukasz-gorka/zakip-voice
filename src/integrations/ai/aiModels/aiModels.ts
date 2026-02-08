import {store} from "../../../appInitializer/store";
import {createCompositeModelId, parseModelId} from "../interface/AIModel.ts";
import {AIModelTag} from "../interface/AIModelConfig.ts";
import {AIModelForUI, AIProviderConfig, AIProviderModelInfo} from "../interface/AIProviderConfig.ts";

const getProviders = () => store.getState().provider.collection;

export const getAIModels = (): AIProviderModelInfo[] => {
    const providers = getProviders();

    return providers.flatMap((provider) => provider.models).filter((model) => model.enabled);
};

export const getAIModelById = (id: string) => {
    const models = getAIModels();

    return models.find((model) => model.id === id);
};

export function getModelsWithTags(tags: AIModelTag[]): AIProviderModelInfo[] {
    const models = getAIModels();

    return models.filter((model) => model.tags?.some((tag) => tags.includes(tag)));
}

export function getProvidersWithTag(tag: AIModelTag): AIProviderConfig[] {
    const providers = getProviders();
    console.log(providers);

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

export const getAIModelByCompositeId = (compositeOrSimpleId: string): AIModelForUI | undefined => {
    const models = getAIModelsWithProvider();

    const exactMatch = models.find((m) => m.compositeId === compositeOrSimpleId);
    if (exactMatch) return exactMatch;

    const parsed = parseModelId(compositeOrSimpleId);
    if (parsed) {
        return models.find((m) => m.id === parsed.modelId && m.providerId === parsed.providerId);
    }

    return models.find((m) => m.id === compositeOrSimpleId);
};

export function getModelsWithTagsGrouped(tags: AIModelTag[]): Map<string, AIModelForUI[]> {
    const grouped = getAIModelsGroupedByProvider();
    const filtered = new Map<string, AIModelForUI[]>();

    for (const [providerName, models] of grouped) {
        const filteredModels = models.filter((model) => model.tags?.some((tag) => tags.includes(tag)));
        if (filteredModels.length > 0) {
            filtered.set(providerName, filteredModels);
        }
    }

    return filtered;
}
