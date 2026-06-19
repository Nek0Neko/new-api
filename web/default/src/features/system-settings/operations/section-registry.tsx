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
import { SystemBehaviorSection } from "../general/system-behavior-section";
import { EmailSettingsSection } from "../integrations/email-settings-section";
import { MonitoringSettingsSection } from "../integrations/monitoring-settings-section";
import { TencentCosSection } from "../integrations/tencent-cos-section";
import { WorkerSettingsSection } from "../integrations/worker-settings-section";
import { LogSettingsSection } from "../maintenance/log-settings-section";
import { PerformanceSection } from "../maintenance/performance-section";
import { UpdateCheckerSection } from "../maintenance/update-checker-section";
import type { OperationsSettings } from "../types";
import { createSectionRegistry } from "../utils/section-registry";

const OPERATIONS_SECTIONS = [
  {
    id: "behavior",
    titleKey: "System Behavior",
    build: (settings: OperationsSettings) => (
      <SystemBehaviorSection
        defaultValues={{
          RetryTimes: settings.RetryTimes,
          DefaultCollapseSidebar: settings.DefaultCollapseSidebar,
          DemoSiteEnabled: settings.DemoSiteEnabled,
          SelfUseModeEnabled: settings.SelfUseModeEnabled,
        }}
      />
    ),
  },
  {
    id: "monitoring",
    titleKey: "Monitoring & Alerts",
    build: (settings: OperationsSettings) => (
      <MonitoringSettingsSection
        defaultValues={{
          ChannelDisableThreshold: settings.ChannelDisableThreshold,
          QuotaRemindThreshold: settings.QuotaRemindThreshold,
          AutomaticDisableChannelEnabled:
            settings.AutomaticDisableChannelEnabled,
          AutomaticEnableChannelEnabled: settings.AutomaticEnableChannelEnabled,
          AutomaticDisableKeywords: settings.AutomaticDisableKeywords,
          AutomaticDisableStatusCodes: settings.AutomaticDisableStatusCodes,
          AutomaticRetryStatusCodes: settings.AutomaticRetryStatusCodes,
          "channel_circuit_breaker.enabled":
            settings["channel_circuit_breaker.enabled"],
          "channel_circuit_breaker.failure_threshold":
            settings["channel_circuit_breaker.failure_threshold"],
          "channel_circuit_breaker.success_threshold":
            settings["channel_circuit_breaker.success_threshold"],
          "channel_circuit_breaker.cooldown_seconds":
            settings["channel_circuit_breaker.cooldown_seconds"],
          "channel_circuit_breaker.max_cooldown_seconds":
            settings["channel_circuit_breaker.max_cooldown_seconds"],
          "channel_circuit_breaker.failure_window_seconds":
            settings["channel_circuit_breaker.failure_window_seconds"],
          "channel_circuit_breaker.probe_interval_seconds":
            settings["channel_circuit_breaker.probe_interval_seconds"],
          "channel_circuit_breaker.probe_timeout_seconds":
            settings["channel_circuit_breaker.probe_timeout_seconds"],
          "channel_circuit_breaker.trip_on_channel_error":
            settings["channel_circuit_breaker.trip_on_channel_error"],
          "channel_circuit_breaker.trip_on_network_error":
            settings["channel_circuit_breaker.trip_on_network_error"],
          "channel_circuit_breaker.trip_status_codes":
            settings["channel_circuit_breaker.trip_status_codes"],
          "monitor_setting.auto_test_channel_enabled":
            settings["monitor_setting.auto_test_channel_enabled"],
          "monitor_setting.auto_test_channel_minutes":
            settings["monitor_setting.auto_test_channel_minutes"],
        }}
      />
    ),
  },
  {
    id: "email",
    titleKey: "SMTP Email",
    build: (settings: OperationsSettings) => (
      <EmailSettingsSection
        defaultValues={{
          SMTPServer: settings.SMTPServer,
          SMTPPort: settings.SMTPPort,
          SMTPAccount: settings.SMTPAccount,
          SMTPFrom: settings.SMTPFrom,
          SMTPToken: settings.SMTPToken,
          SMTPSSLEnabled: settings.SMTPSSLEnabled,
          SMTPForceAuthLogin: settings.SMTPForceAuthLogin,
        }}
      />
    ),
  },
  {
    id: "tencent-cos",
    titleKey: "Tencent COS Storage",
    build: (settings: OperationsSettings) => (
      <TencentCosSection
        defaultValues={{
          "tencent_cos.enabled": settings["tencent_cos.enabled"],
          "tencent_cos.secret_id": settings["tencent_cos.secret_id"],
          "tencent_cos.secret_key": settings["tencent_cos.secret_key"],
          "tencent_cos.region": settings["tencent_cos.region"],
          "tencent_cos.bucket": settings["tencent_cos.bucket"],
          "tencent_cos.custom_domain": settings["tencent_cos.custom_domain"],
          "tencent_cos.path_prefix": settings["tencent_cos.path_prefix"],
          "tencent_cos.accelerate": settings["tencent_cos.accelerate"],
        }}
      />
    ),
  },
  {
    id: "worker",
    titleKey: "Worker Proxy",
    build: (settings: OperationsSettings) => (
      <WorkerSettingsSection
        defaultValues={{
          WorkerUrl: settings.WorkerUrl,
          WorkerValidKey: settings.WorkerValidKey,
          WorkerAllowHttpImageRequestEnabled:
            settings.WorkerAllowHttpImageRequestEnabled,
        }}
      />
    ),
  },
  {
    id: "logs",
    titleKey: "Log Maintenance",
    build: (settings: OperationsSettings) => (
      <LogSettingsSection
        defaultEnabled={Boolean(settings.LogConsumeEnabled)}
      />
    ),
  },
  {
    id: "performance",
    titleKey: "Performance",
    build: (settings: OperationsSettings) => (
      <PerformanceSection
        defaultValues={{
          "performance_setting.disk_cache_enabled":
            settings["performance_setting.disk_cache_enabled"] ?? false,
          "performance_setting.disk_cache_threshold_mb":
            settings["performance_setting.disk_cache_threshold_mb"] ?? 10,
          "performance_setting.disk_cache_max_size_mb":
            settings["performance_setting.disk_cache_max_size_mb"] ?? 1024,
          "performance_setting.disk_cache_path":
            settings["performance_setting.disk_cache_path"] ?? "",
          "performance_setting.monitor_enabled":
            settings["performance_setting.monitor_enabled"] ?? false,
          "performance_setting.monitor_cpu_threshold":
            settings["performance_setting.monitor_cpu_threshold"] ?? 90,
          "performance_setting.monitor_memory_threshold":
            settings["performance_setting.monitor_memory_threshold"] ?? 90,
          "performance_setting.monitor_disk_threshold":
            settings["performance_setting.monitor_disk_threshold"] ?? 95,
          "perf_metrics_setting.enabled":
            settings["perf_metrics_setting.enabled"] ?? true,
          "perf_metrics_setting.flush_interval":
            settings["perf_metrics_setting.flush_interval"] ?? 5,
          "perf_metrics_setting.bucket_time":
            settings["perf_metrics_setting.bucket_time"] ?? "hour",
          "perf_metrics_setting.retention_days":
            settings["perf_metrics_setting.retention_days"] ?? 0,
        }}
      />
    ),
  },
  {
    id: "update-checker",
    titleKey: "System maintenance",
    build: (
      _settings: OperationsSettings,
      currentVersion?: string | null,
      startTime?: number | null,
    ) => (
      <UpdateCheckerSection
        currentVersion={currentVersion}
        startTime={startTime}
      />
    ),
  },
] as const;

export type OperationsSectionId = (typeof OPERATIONS_SECTIONS)[number]["id"];

const operationsRegistry = createSectionRegistry<
  OperationsSectionId,
  OperationsSettings,
  [string | null | undefined, number | null | undefined]
>({
  sections: OPERATIONS_SECTIONS,
  defaultSection: "behavior",
  basePath: "/system-settings/operations",
  urlStyle: "path",
});

export const OPERATIONS_SECTION_IDS = operationsRegistry.sectionIds;
export const OPERATIONS_DEFAULT_SECTION = operationsRegistry.defaultSection;
export const getOperationsSectionNavItems =
  operationsRegistry.getSectionNavItems;
export const getOperationsSectionContent = operationsRegistry.getSectionContent;
export const getOperationsSectionMeta = operationsRegistry.getSectionMeta;
