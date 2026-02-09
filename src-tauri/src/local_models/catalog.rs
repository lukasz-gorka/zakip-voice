use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum LocalModelCategory {
    SpeechToText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelCatalogEntry {
    pub id: String,
    pub name: String,
    pub category: LocalModelCategory,
    pub description: String,
    pub size_mb: u64,
    pub download_url: String,
    pub filename: String,
}

struct CatalogDef {
    id: &'static str,
    name: &'static str,
    category: LocalModelCategory,
    description: &'static str,
    size_mb: u64,
    download_url: &'static str,
    filename: &'static str,
}

const CATALOG_DEFS: &[CatalogDef] = &[
    CatalogDef {
        id: "whisper-tiny",
        name: "Whisper Tiny",
        category: LocalModelCategory::SpeechToText,
        description: "Fastest, lowest accuracy (~75 MB). Good for quick tests.",
        size_mb: 75,
        download_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        filename: "ggml-tiny.bin",
    },
    CatalogDef {
        id: "whisper-base",
        name: "Whisper Base",
        category: LocalModelCategory::SpeechToText,
        description: "Fast with decent accuracy (~142 MB).",
        size_mb: 142,
        download_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        filename: "ggml-base.bin",
    },
    CatalogDef {
        id: "whisper-small",
        name: "Whisper Small",
        category: LocalModelCategory::SpeechToText,
        description: "Good balance of speed and accuracy (~466 MB).",
        size_mb: 466,
        download_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        filename: "ggml-small.bin",
    },
    CatalogDef {
        id: "whisper-medium",
        name: "Whisper Medium",
        category: LocalModelCategory::SpeechToText,
        description: "High accuracy, slower (~1.5 GB). Recommended for most users.",
        size_mb: 1500,
        download_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        filename: "ggml-medium.bin",
    },
    CatalogDef {
        id: "whisper-large-v3-turbo",
        name: "Whisper Large V3 Turbo",
        category: LocalModelCategory::SpeechToText,
        description: "Best accuracy with Turbo speed (~1.6 GB). Best quality option.",
        size_mb: 1600,
        download_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
        filename: "ggml-large-v3-turbo.bin",
    },
];

pub fn get_model_catalog() -> Vec<LocalModelCatalogEntry> {
    CATALOG_DEFS
        .iter()
        .map(|def| LocalModelCatalogEntry {
            id: def.id.to_string(),
            name: def.name.to_string(),
            category: def.category.clone(),
            description: def.description.to_string(),
            size_mb: def.size_mb,
            download_url: def.download_url.to_string(),
            filename: def.filename.to_string(),
        })
        .collect()
}

pub fn find_catalog_entry(model_id: &str) -> Option<LocalModelCatalogEntry> {
    get_model_catalog().into_iter().find(|e| e.id == model_id)
}
