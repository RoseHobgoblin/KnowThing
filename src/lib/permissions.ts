export type AppPermissions = {
	isAuthenticated: boolean
	canEditContent: boolean
	canCreatePages: boolean
	canManageWordbook: boolean
	canManageMedia: boolean
	canConfigureCalendar: boolean
	canConfigureRodder: boolean
	canManageSettings: boolean
	canManageUsers: boolean
	canManageLanguages: boolean
	canGenerateInviteCodes: boolean
}

export const DEFAULT_PERMISSIONS: AppPermissions = {
	isAuthenticated: false,
	canEditContent: false,
	canCreatePages: false,
	canManageWordbook: false,
	canManageMedia: false,
	canConfigureCalendar: false,
	canConfigureRodder: false,
	canManageSettings: false,
	canManageUsers: false,
	canManageLanguages: false,
	canGenerateInviteCodes: false,
}

export function normalizePermissions(permissions?: Partial<AppPermissions> | null): AppPermissions {
	return { ...DEFAULT_PERMISSIONS, ...permissions }
}
