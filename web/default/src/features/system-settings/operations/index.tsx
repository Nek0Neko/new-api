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
import { useStatus } from "@/hooks/use-status";
import { SettingsPage } from "../components/settings-page";
import type { OperationsSettings } from "../types";
import {
  OPERATIONS_DEFAULT_SECTION,
  getOperationsSectionContent,
  getOperationsSectionMeta,
} from "./section-registry.tsx";

const defaultOperationsSettings: OperationsSettings = {
  RetryTimes: 0,
  DefaultCollapseSidebar: false,
  DemoSiteEnabled: false,
  SelfUseModeEnabled: false,
  ChannelDisableThreshold: "",
  QuotaRemindThreshold: "",
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  AutomaticDisableKeywords: "",
  AutomaticDisableStatusCodes: "401",
  AutomaticRetryStatusCodes:
    "100-199,300-399,401-407,409-499,500-503,505-523,525-599",
  "channel_circuit_breaker.enabled": true,
  "channel_circuit_breaker.failure_threshold": 3,
  "channel_circuit_breaker.success_threshold": 1,
  "channel_circuit_breaker.cooldown_seconds": 60,
  "channel_circuit_breaker.max_cooldown_seconds": 600,
  "channel_circuit_breaker.failure_window_seconds": 300,
  "channel_circuit_breaker.probe_interval_seconds": 10,
  "channel_circuit_breaker.probe_timeout_seconds": 30,
  "channel_circuit_breaker.trip_on_channel_error": true,
  "channel_circuit_breaker.trip_on_network_error": true,
  "channel_circuit_breaker.trip_status_codes": [408, 429, 500, 502, 503, 504],
  "monitor_setting.auto_test_channel_enabled": false,
  "monitor_setting.auto_test_channel_minutes": 10,
  SMTPServer: "",
  SMTPPort: "",
  SMTPAccount: "",
  SMTPFrom: "",
  SMTPToken: "",
  SMTPSSLEnabled: false,
  SMTPForceAuthLogin: false,
  "tencent_cos.enabled": false,
  "tencent_cos.secret_id": "",
  "tencent_cos.secret_key": "",
  "tencent_cos.region": "",
  "tencent_cos.bucket": "",
  "tencent_cos.custom_domain": "",
  "tencent_cos.path_prefix": "images",
  "tencent_cos.accelerate": false,
  WorkerUrl: "",
  WorkerValidKey: "",
  WorkerAllowHttpImageRequestEnabled: false,
  LogConsumeEnabled: false,
  "performance_setting.disk_cache_enabled": false,
  "performance_setting.disk_cache_threshold_mb": 10,
  "performance_setting.disk_cache_max_size_mb": 1024,
  "performance_setting.disk_cache_path": "",
  "performance_setting.monitor_enabled": false,
  "performance_setting.monitor_cpu_threshold": 90,
  "performance_setting.monitor_memory_threshold": 90,
  "performance_setting.monitor_disk_threshold": 95,
  "perf_metrics_setting.enabled": true,
  "perf_metrics_setting.flush_interval": 5,
  "perf_metrics_setting.bucket_time": "hour",
  "perf_metrics_setting.retention_days": 0,
};

export function OperationsSettings() {
  const { status } = useStatus();

  return (
    <SettingsPage
      routePath="/_authenticated/system-settings/operations/$section"
      defaultSettings={defaultOperationsSettings}
      defaultSection={OPERATIONS_DEFAULT_SECTION}
      getSectionContent={getOperationsSectionContent}
      getSectionMeta={getOperationsSectionMeta}
      extraArgs={[
        status?.version as string | undefined,
        status?.start_time as number | null | undefined,
      ]}
      loadingMessage="Loading maintenance settings..."
    />
  );
}
