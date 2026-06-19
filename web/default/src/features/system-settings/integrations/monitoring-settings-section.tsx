/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMemo, useRef } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { parseHttpStatusCodeRules } from "@/lib/http-status-code-rules";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from "../components/settings-form-layout";
import { SettingsPageFormActions } from "../components/settings-page-context";
import { SettingsSection } from "../components/settings-section";
import { useResetForm } from "../hooks/use-reset-form";
import { useUpdateOption } from "../hooks/use-update-option";
import { safeNumberFieldProps } from "../utils/numeric-field";

const numericString = z.string().refine((value) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return !Number.isNaN(Number(trimmed)) && Number(trimmed) >= 0;
}, "Enter a non-negative number or leave empty");

const positiveInteger = z.coerce
  .number()
  .int()
  .min(1, "Value must be at least 1");

function parseStatusCodeList(value: string): {
  ok: boolean;
  codes: number[];
  normalized: string;
  invalidTokens: string[];
} {
  const raw = value.trim();
  if (!raw) {
    return { ok: true, codes: [], normalized: "", invalidTokens: [] };
  }

  const segments = raw
    .replace(/[，]/g, ",")
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const invalidTokens: string[] = [];
  const seen = new Set<number>();
  const codes: number[] = [];

  for (const segment of segments) {
    if (!/^\d+$/.test(segment)) {
      invalidTokens.push(segment);
      continue;
    }

    const code = Number.parseInt(segment, 10);
    if (code < 100 || code > 599) {
      invalidTokens.push(segment);
      continue;
    }

    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }

  return {
    ok: invalidTokens.length === 0,
    codes,
    normalized: codes.join(","),
    invalidTokens,
  };
}

const statusCodeListString = z.string().refine((value) => {
  const parsed = parseStatusCodeList(value);
  return parsed.ok;
}, "Enter comma-separated HTTP status codes between 100 and 599");

const monitoringSchema = z
  .object({
    ChannelDisableThreshold: numericString,
    QuotaRemindThreshold: numericString,
    AutomaticDisableChannelEnabled: z.boolean(),
    AutomaticEnableChannelEnabled: z.boolean(),
    AutomaticDisableKeywords: z.string(),
    AutomaticDisableStatusCodes: z.string(),
    AutomaticRetryStatusCodes: z.string(),
    channel_circuit_breaker: z.object({
      enabled: z.boolean(),
      failure_threshold: positiveInteger,
      success_threshold: positiveInteger,
      cooldown_seconds: positiveInteger,
      max_cooldown_seconds: positiveInteger,
      failure_window_seconds: positiveInteger,
      probe_interval_seconds: positiveInteger,
      probe_timeout_seconds: positiveInteger,
      trip_on_channel_error: z.boolean(),
      trip_on_network_error: z.boolean(),
      trip_status_codes: statusCodeListString,
    }),
    monitor_setting: z.object({
      auto_test_channel_enabled: z.boolean(),
      auto_test_channel_minutes: z.coerce
        .number()
        .int()
        .min(1, "Interval must be at least 1 minute"),
    }),
  })
  .superRefine((values, ctx) => {
    const disableParsed = parseHttpStatusCodeRules(
      values.AutomaticDisableStatusCodes,
    );
    if (!disableParsed.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["AutomaticDisableStatusCodes"],
        message: `Invalid status code rules: ${disableParsed.invalidTokens.join(
          ", ",
        )}`,
      });
    }

    const retryParsed = parseHttpStatusCodeRules(
      values.AutomaticRetryStatusCodes,
    );
    if (!retryParsed.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["AutomaticRetryStatusCodes"],
        message: `Invalid status code rules: ${retryParsed.invalidTokens.join(
          ", ",
        )}`,
      });
    }

    const tripStatusParsed = parseStatusCodeList(
      values.channel_circuit_breaker.trip_status_codes,
    );
    if (!tripStatusParsed.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["channel_circuit_breaker", "trip_status_codes"],
        message: `Invalid status codes: ${tripStatusParsed.invalidTokens.join(
          ", ",
        )}`,
      });
    }
  });

type MonitoringFormValues = z.output<typeof monitoringSchema>;
type MonitoringFormInput = z.input<typeof monitoringSchema>;

type MonitoringSettingsSectionProps = {
  defaultValues: {
    ChannelDisableThreshold: string;
    QuotaRemindThreshold: string;
    AutomaticDisableChannelEnabled: boolean;
    AutomaticEnableChannelEnabled: boolean;
    AutomaticDisableKeywords: string;
    AutomaticDisableStatusCodes: string;
    AutomaticRetryStatusCodes: string;
    "channel_circuit_breaker.enabled": boolean;
    "channel_circuit_breaker.failure_threshold": number;
    "channel_circuit_breaker.success_threshold": number;
    "channel_circuit_breaker.cooldown_seconds": number;
    "channel_circuit_breaker.max_cooldown_seconds": number;
    "channel_circuit_breaker.failure_window_seconds": number;
    "channel_circuit_breaker.probe_interval_seconds": number;
    "channel_circuit_breaker.probe_timeout_seconds": number;
    "channel_circuit_breaker.trip_on_channel_error": boolean;
    "channel_circuit_breaker.trip_on_network_error": boolean;
    "channel_circuit_breaker.trip_status_codes": number[];
    "monitor_setting.auto_test_channel_enabled": boolean;
    "monitor_setting.auto_test_channel_minutes": number;
  };
};

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, "\n");
}

type NormalizedMonitoringValues = {
  ChannelDisableThreshold: string;
  QuotaRemindThreshold: string;
  AutomaticDisableChannelEnabled: boolean;
  AutomaticEnableChannelEnabled: boolean;
  AutomaticDisableKeywords: string;
  AutomaticDisableStatusCodes: string;
  AutomaticRetryStatusCodes: string;
  "channel_circuit_breaker.enabled": boolean;
  "channel_circuit_breaker.failure_threshold": number;
  "channel_circuit_breaker.success_threshold": number;
  "channel_circuit_breaker.cooldown_seconds": number;
  "channel_circuit_breaker.max_cooldown_seconds": number;
  "channel_circuit_breaker.failure_window_seconds": number;
  "channel_circuit_breaker.probe_interval_seconds": number;
  "channel_circuit_breaker.probe_timeout_seconds": number;
  "channel_circuit_breaker.trip_on_channel_error": boolean;
  "channel_circuit_breaker.trip_on_network_error": boolean;
  "channel_circuit_breaker.trip_status_codes": string;
  "monitor_setting.auto_test_channel_enabled": boolean;
  "monitor_setting.auto_test_channel_minutes": number;
};

const buildFormDefaults = (
  defaults: MonitoringSettingsSectionProps["defaultValues"],
): MonitoringFormInput => ({
  ChannelDisableThreshold: defaults.ChannelDisableThreshold ?? "",
  QuotaRemindThreshold: defaults.QuotaRemindThreshold ?? "",
  AutomaticDisableChannelEnabled: defaults.AutomaticDisableChannelEnabled,
  AutomaticEnableChannelEnabled: defaults.AutomaticEnableChannelEnabled,
  AutomaticDisableKeywords: normalizeLineEndings(
    defaults.AutomaticDisableKeywords ?? "",
  ),
  AutomaticDisableStatusCodes: defaults.AutomaticDisableStatusCodes ?? "",
  AutomaticRetryStatusCodes: defaults.AutomaticRetryStatusCodes ?? "",
  channel_circuit_breaker: {
    enabled: defaults["channel_circuit_breaker.enabled"],
    failure_threshold: defaults["channel_circuit_breaker.failure_threshold"],
    success_threshold: defaults["channel_circuit_breaker.success_threshold"],
    cooldown_seconds: defaults["channel_circuit_breaker.cooldown_seconds"],
    max_cooldown_seconds:
      defaults["channel_circuit_breaker.max_cooldown_seconds"],
    failure_window_seconds:
      defaults["channel_circuit_breaker.failure_window_seconds"],
    probe_interval_seconds:
      defaults["channel_circuit_breaker.probe_interval_seconds"],
    probe_timeout_seconds:
      defaults["channel_circuit_breaker.probe_timeout_seconds"],
    trip_on_channel_error:
      defaults["channel_circuit_breaker.trip_on_channel_error"],
    trip_on_network_error:
      defaults["channel_circuit_breaker.trip_on_network_error"],
    trip_status_codes:
      defaults["channel_circuit_breaker.trip_status_codes"].join(","),
  },
  monitor_setting: {
    auto_test_channel_enabled:
      defaults["monitor_setting.auto_test_channel_enabled"],
    auto_test_channel_minutes:
      defaults["monitor_setting.auto_test_channel_minutes"],
  },
});

const normalizeDefaults = (
  defaults: MonitoringSettingsSectionProps["defaultValues"],
): NormalizedMonitoringValues => ({
  ChannelDisableThreshold: (defaults.ChannelDisableThreshold ?? "").trim(),
  QuotaRemindThreshold: (defaults.QuotaRemindThreshold ?? "").trim(),
  AutomaticDisableChannelEnabled: defaults.AutomaticDisableChannelEnabled,
  AutomaticEnableChannelEnabled: defaults.AutomaticEnableChannelEnabled,
  AutomaticDisableKeywords: normalizeLineEndings(
    defaults.AutomaticDisableKeywords ?? "",
  ),
  AutomaticDisableStatusCodes: parseHttpStatusCodeRules(
    defaults.AutomaticDisableStatusCodes ?? "",
  ).normalized,
  AutomaticRetryStatusCodes: parseHttpStatusCodeRules(
    defaults.AutomaticRetryStatusCodes ?? "",
  ).normalized,
  "channel_circuit_breaker.enabled":
    defaults["channel_circuit_breaker.enabled"],
  "channel_circuit_breaker.failure_threshold":
    defaults["channel_circuit_breaker.failure_threshold"],
  "channel_circuit_breaker.success_threshold":
    defaults["channel_circuit_breaker.success_threshold"],
  "channel_circuit_breaker.cooldown_seconds":
    defaults["channel_circuit_breaker.cooldown_seconds"],
  "channel_circuit_breaker.max_cooldown_seconds":
    defaults["channel_circuit_breaker.max_cooldown_seconds"],
  "channel_circuit_breaker.failure_window_seconds":
    defaults["channel_circuit_breaker.failure_window_seconds"],
  "channel_circuit_breaker.probe_interval_seconds":
    defaults["channel_circuit_breaker.probe_interval_seconds"],
  "channel_circuit_breaker.probe_timeout_seconds":
    defaults["channel_circuit_breaker.probe_timeout_seconds"],
  "channel_circuit_breaker.trip_on_channel_error":
    defaults["channel_circuit_breaker.trip_on_channel_error"],
  "channel_circuit_breaker.trip_on_network_error":
    defaults["channel_circuit_breaker.trip_on_network_error"],
  "channel_circuit_breaker.trip_status_codes": JSON.stringify(
    defaults["channel_circuit_breaker.trip_status_codes"],
  ),
  "monitor_setting.auto_test_channel_enabled":
    defaults["monitor_setting.auto_test_channel_enabled"],
  "monitor_setting.auto_test_channel_minutes":
    defaults["monitor_setting.auto_test_channel_minutes"],
});

const normalizeFormValues = (
  values: MonitoringFormValues,
): NormalizedMonitoringValues => ({
  ChannelDisableThreshold: values.ChannelDisableThreshold.trim(),
  QuotaRemindThreshold: values.QuotaRemindThreshold.trim(),
  AutomaticDisableChannelEnabled: values.AutomaticDisableChannelEnabled,
  AutomaticEnableChannelEnabled: values.AutomaticEnableChannelEnabled,
  AutomaticDisableKeywords: normalizeLineEndings(
    values.AutomaticDisableKeywords,
  ),
  AutomaticDisableStatusCodes: parseHttpStatusCodeRules(
    values.AutomaticDisableStatusCodes,
  ).normalized,
  AutomaticRetryStatusCodes: parseHttpStatusCodeRules(
    values.AutomaticRetryStatusCodes,
  ).normalized,
  "channel_circuit_breaker.enabled": values.channel_circuit_breaker.enabled,
  "channel_circuit_breaker.failure_threshold":
    values.channel_circuit_breaker.failure_threshold,
  "channel_circuit_breaker.success_threshold":
    values.channel_circuit_breaker.success_threshold,
  "channel_circuit_breaker.cooldown_seconds":
    values.channel_circuit_breaker.cooldown_seconds,
  "channel_circuit_breaker.max_cooldown_seconds":
    values.channel_circuit_breaker.max_cooldown_seconds,
  "channel_circuit_breaker.failure_window_seconds":
    values.channel_circuit_breaker.failure_window_seconds,
  "channel_circuit_breaker.probe_interval_seconds":
    values.channel_circuit_breaker.probe_interval_seconds,
  "channel_circuit_breaker.probe_timeout_seconds":
    values.channel_circuit_breaker.probe_timeout_seconds,
  "channel_circuit_breaker.trip_on_channel_error":
    values.channel_circuit_breaker.trip_on_channel_error,
  "channel_circuit_breaker.trip_on_network_error":
    values.channel_circuit_breaker.trip_on_network_error,
  "channel_circuit_breaker.trip_status_codes": JSON.stringify(
    parseStatusCodeList(values.channel_circuit_breaker.trip_status_codes).codes,
  ),
  "monitor_setting.auto_test_channel_enabled":
    values.monitor_setting.auto_test_channel_enabled,
  "monitor_setting.auto_test_channel_minutes":
    values.monitor_setting.auto_test_channel_minutes,
});

export function MonitoringSettingsSection({
  defaultValues,
}: MonitoringSettingsSectionProps) {
  const { t } = useTranslation();
  const updateOption = useUpdateOption();
  const baselineRef = useRef<NormalizedMonitoringValues>(
    normalizeDefaults(defaultValues),
  );

  const formDefaults = useMemo(
    () => buildFormDefaults(defaultValues),
    [defaultValues],
  );

  const form = useForm<MonitoringFormInput, unknown, MonitoringFormValues>({
    resolver: zodResolver(monitoringSchema),
    defaultValues: formDefaults,
  });

  useResetForm(form, formDefaults);

  const autoDisableStatusCodes = form.watch("AutomaticDisableStatusCodes");
  const autoRetryStatusCodes = form.watch("AutomaticRetryStatusCodes");
  const circuitBreakerStatusCodes = form.watch(
    "channel_circuit_breaker.trip_status_codes",
  );
  const autoDisableParsed = useMemo(
    () => parseHttpStatusCodeRules(autoDisableStatusCodes),
    [autoDisableStatusCodes],
  );
  const autoRetryParsed = useMemo(
    () => parseHttpStatusCodeRules(autoRetryStatusCodes),
    [autoRetryStatusCodes],
  );
  const circuitBreakerStatusParsed = useMemo(
    () => parseStatusCodeList(circuitBreakerStatusCodes),
    [circuitBreakerStatusCodes],
  );

  const onSubmit = async (values: MonitoringFormValues) => {
    const normalized = normalizeFormValues(values);
    const updates = (
      Object.keys(normalized) as Array<keyof NormalizedMonitoringValues>
    ).filter((key) => normalized[key] !== baselineRef.current[key]);

    if (updates.length === 0) {
      toast.info(t("No changes to save"));
      return;
    }

    for (const key of updates) {
      const value = normalized[key];
      await updateOption.mutateAsync({
        key,
        value,
      });
    }

    baselineRef.current = normalized;
  };

  return (
    <SettingsSection title={t("Monitoring & Alerts")}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel="Save monitoring rules"
          />
          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="monitor_setting.auto_test_channel_enabled"
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t("Scheduled channel tests")}</FormLabel>
                    <FormDescription>
                      {t("Automatically probe all channels in the background")}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name="monitor_setting.auto_test_channel_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Test interval (minutes)")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("How frequently the system tests all channels")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="ChannelDisableThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Disable threshold (seconds)")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      "Automatically disable channels exceeding this response time",
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="QuotaRemindThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Quota reminder (tokens)")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("Send email alerts when a user falls below this quota")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="AutomaticDisableChannelEnabled"
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t("Disable on failure")}</FormLabel>
                    <FormDescription>
                      {t("Automatically disable channels when tests fail")}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name="AutomaticEnableChannelEnabled"
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t("Re-enable on success")}</FormLabel>
                    <FormDescription>
                      {t("Bring channels back online after successful checks")}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="AutomaticDisableKeywords"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("Failure keywords")}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    placeholder={t("one keyword per line")}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    "If an upstream error contains any of these keywords (case insensitive), the channel will be disabled automatically.",
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="AutomaticDisableStatusCodes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Auto-disable status codes")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("e.g. 401, 403, 429, 500-599")}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      "Accepts comma-separated status codes and inclusive ranges.",
                    )}{" "}
                    {autoDisableParsed.ok &&
                      autoDisableParsed.normalized &&
                      autoDisableParsed.normalized !== field.value.trim() && (
                        <span className="text-muted-foreground">
                          {t("Normalized:")} {autoDisableParsed.normalized}
                        </span>
                      )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="AutomaticRetryStatusCodes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Auto-retry status codes")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("e.g. 401, 403, 429, 500-599")}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      "Accepts comma-separated status codes and inclusive ranges.",
                    )}{" "}
                    {autoRetryParsed.ok &&
                      autoRetryParsed.normalized &&
                      autoRetryParsed.normalized !== field.value.trim() && (
                        <span className="text-muted-foreground">
                          {t("Normalized:")} {autoRetryParsed.normalized}
                        </span>
                      )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="channel_circuit_breaker.enabled"
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t("Dynamic circuit breaker")}</FormLabel>
                    <FormDescription>
                      {t(
                        "Temporarily skip unstable channels and probe them before returning them to scheduling.",
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name="channel_circuit_breaker.failure_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Circuit failure threshold")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("Failures within the window required to open a circuit")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="channel_circuit_breaker.success_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Circuit recovery threshold")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("Successful probes required before closing a circuit")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="channel_circuit_breaker.failure_window_seconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Failure window (seconds)")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("Only failures inside this window are counted")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="channel_circuit_breaker.cooldown_seconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Initial cooldown (seconds)")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("How long an opened circuit stays out of scheduling")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="channel_circuit_breaker.max_cooldown_seconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Maximum cooldown (seconds)")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("Upper limit for repeated circuit cooldowns")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="channel_circuit_breaker.probe_interval_seconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Probe interval (seconds)")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("How often open circuits are checked for recovery")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="channel_circuit_breaker.probe_timeout_seconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Probe timeout (seconds)")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("Maximum duration for a recovery probe")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="channel_circuit_breaker.trip_on_channel_error"
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t("Trip on channel errors")}</FormLabel>
                    <FormDescription>
                      {t(
                        "Open the circuit for errors classified as channel faults",
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name="channel_circuit_breaker.trip_on_network_error"
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t("Trip on network errors")}</FormLabel>
                    <FormDescription>
                      {t(
                        "Open the circuit for upstream timeout or connection errors",
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="channel_circuit_breaker.trip_status_codes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("Circuit breaker status codes")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("e.g. 408, 429, 500, 502, 503, 504")}
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t("Accepts comma-separated HTTP status codes.")}{" "}
                  {circuitBreakerStatusParsed.ok &&
                    circuitBreakerStatusParsed.normalized &&
                    circuitBreakerStatusParsed.normalized !==
                      field.value.trim() && (
                      <span className="text-muted-foreground">
                        {t("Normalized:")}{" "}
                        {circuitBreakerStatusParsed.normalized}
                      </span>
                    )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  );
}
