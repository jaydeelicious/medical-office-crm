export interface RuntimeConfig {
    authority: string;
}

declare global {
    interface Window {
        __medicalOfficeConfig?: RuntimeConfig;
    }
}

export function getRuntimeConfig(): RuntimeConfig {
    const config = window.__medicalOfficeConfig;

    if (!config?.authority) {
        throw new Error(
            'Missing OIDC authority in runtime configuration.',
        );
    }

    return config;
}