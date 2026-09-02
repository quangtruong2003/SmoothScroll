// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  deleteProfile: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: (selector: (store: unknown) => unknown) =>
    selector({
      settings: {
        profiles: [{ id: "profile-1", name: "Test profile" }],
        app_profiles: {},
      },
      createProfile: vi.fn(),
      deleteProfile: mocks.deleteProfile,
    }),
}));

vi.mock("@/components/ui/toast", () => ({
  toast: {
    success: vi.fn(),
    error: mocks.errorToast,
  },
}));

vi.mock("./ProfileEditor", () => ({ ProfileEditor: () => null }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ProfilesSection } from "./ProfilesSection";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() { return undefined; }
    unobserve() { return undefined; }
    disconnect() { return undefined; }
  } as typeof ResizeObserver;
});

beforeEach(() => {
  mocks.deleteProfile.mockReset();
  mocks.deleteProfile.mockRejectedValue(new Error("delete failed"));
  mocks.errorToast.mockReset();
});

describe("ProfilesSection delete errors", () => {
  it("logs a failed profile deletion once and shows a localized error", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ProfilesSection />);

    await user.click(screen.getByRole("button", { name: "profiles.delete_aria" }));
    await user.click(screen.getByRole("button", { name: "profiles.delete" }));

    await waitFor(() => expect(mocks.deleteProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.errorToast).toHaveBeenCalledWith("errors.profile_delete_failed"));
    expect(consoleError).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });
});
