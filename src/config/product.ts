export type FeatureFlags = {
    enableProtocols: boolean
    enableCalendar: boolean
    enableReminders: boolean
    enableWhatsApp: boolean
    enableAsana: boolean
    enableGoogleCalendar: boolean
}

export const PRODUCT = {
    name: "G7 Client Connector",
    defaultTimezone: "America/Recife",
    whatsappProvider: "zapi" as "mock" | "evolution" | "zapi",
    flags: {
        enableProtocols: true,
        enableCalendar: true,
        enableReminders: true,
        enableWhatsApp: true,
        enableAsana: false,
        enableGoogleCalendar: false,
    } satisfies FeatureFlags,
}
