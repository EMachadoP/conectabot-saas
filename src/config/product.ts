export type FeatureFlags = {
    enableProtocols: boolean
    enableCalendar: boolean
    enableReminders: boolean
    enableWhatsApp: boolean
    enableAsana: boolean
    enableGoogleCalendar: boolean
}

export const PRODUCT = {
    name: "Conectabot SaaS (NOVO)",
    defaultTimezone: "America/Recife",
    whatsappProvider: "mock" as "mock" | "evolution",
    flags: {
        enableProtocols: true,
        enableCalendar: true,
        enableReminders: true,
        enableWhatsApp: true,
        enableAsana: false,
        enableGoogleCalendar: false,
    } satisfies FeatureFlags,
}
