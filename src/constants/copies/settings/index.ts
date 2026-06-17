export const SETTINGS = {
  TITLE:         "Settings",
  PAGE_SUBTITLE: "Manage your profile, preferences and account",

  PREFERENCES: {
    TITLE:            "Preferences",
    DISPLAY_NAME:     "Display name",
    DISPLAY_NAME_HINT: "Shown in the sidebar instead of your email.",
    DISPLAY_NAME_PLACEHOLDER: "e.g. Sergio",
    TIMEZONE:         "Timezone",
    TIMEZONE_HINT:    "Used across the app to group and display your trades by local day, hour and session.",
    CURRENCY:         "Default currency",
    SAVE:             "Save changes",
    SAVED:            "Preferences saved.",
  },

  SECURITY: {
    TITLE:            "Account",
    EMAIL:            "Email",
    EMAIL_HINT:       "Changing your email sends a confirmation link to the new address.",
    EMAIL_SAVE:       "Update email",
    EMAIL_SENT:       "Confirmation sent. Check your new inbox to finish the change.",
    PASSWORD:         "New password",
    PASSWORD_CONFIRM: "Confirm password",
    PASSWORD_PLACEHOLDER: "At least 8 characters",
    PASSWORD_SAVE:    "Update password",
    PASSWORD_SAVED:   "Password updated.",
    PASSWORD_MISMATCH: "Passwords do not match.",
  },

  DANGER: {
    TITLE:        "Danger zone",
    DESCRIPTION:  "Permanently delete your account and all your data — accounts, trades, journal, playbooks, goals and insights. This cannot be undone.",
    DELETE_CTA:   "Delete account",
    ARM_CTA:      "I understand, continue",
    MODAL_TITLE:  "Delete account",
    MODAL_BODY:   "Type your email to confirm permanent deletion.",
    CONFIRM_LABEL: "Your email",
    CONFIRM_CTA:  "Delete forever",
    CANCEL:       "Cancel",
    MISMATCH:     "The email does not match.",
  },

  ERRORS: {
    DEFAULT: "Something went wrong. Try again.",
  },
} as const
