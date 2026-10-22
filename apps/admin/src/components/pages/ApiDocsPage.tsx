import { useState, useMemo } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  Layers,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import type { ApiKey, License } from "../../types";

type Language = "curl" | "typescript" | "python" | "csharp" | "php" | "go";

interface ApiDocsPageProps {
  onBack: () => void;
  apiKeys?: ApiKey[];
  licenses?: License[];
}

export function ApiDocsPage({ onBack, apiKeys = [], licenses = [] }: ApiDocsPageProps) {
  // Global selected language
  const [selectedLang, setSelectedLang] = useState<Language>("curl");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Active API Key default or placeholder
  const activeKeys = useMemo(() => apiKeys.filter((k) => k.isActive), [apiKeys]);
  const defaultKey = activeKeys.length > 0 ? activeKeys[0].key : "KTX_YOUR_API_KEY_HERE";
  const defaultDomain = activeKeys.length > 0 && activeKeys[0].allowedDomains !== "*"
    ? activeKeys[0].allowedDomains.split(",")[0].trim()
    : "https://your-authorized-domain.com";
  const defaultSerial = licenses.length > 0 ? licenses[0].serial : "LIC-KTX88392-4B1C";

  // Interactive Sandbox State
  const [sandboxEndpoint, setSandboxEndpoint] = useState<"status" | "licenses" | "single" | "extend">("licenses");
  const [sandboxApiKey, setSandboxApiKey] = useState(defaultKey);
  const [sandboxDomain, setSandboxDomain] = useState(defaultDomain);
  const [sandboxSerial, setSandboxSerial] = useState(defaultSerial);
  const [sandboxFilterStatus, setSandboxFilterStatus] = useState("ALL");
  const [sandboxFilterQuery, setSandboxFilterQuery] = useState("");
  const [sandboxExtendDays, setSandboxExtendDays] = useState(90);
  const [sandboxExtendReason, setSandboxExtendReason] = useState("Contract renewal via client portal");
  const [sandboxExecuting, setSandboxExecuting] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState<{
    status: number;
    statusText: string;
    data: any;
    durationMs: number;
  } | null>(null);

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const languages: { id: Language; label: string }[] = [
    { id: "curl", label: "cURL" },
    { id: "typescript", label: "TypeScript / JS" },
    { id: "python", label: "Python" },
    { id: "csharp", label: "C# / .NET" },
    { id: "php", label: "PHP" },
    { id: "go", label: "Go" },
  ];

  // Code generator helper for any endpoint
  function generateSnippet(
    lang: Language,
    endpoint: "status" | "licenses" | "single" | "extend",
    customKey?: string,
    customDomain?: string,
    customSerial?: string,
    customDays?: number,
    customReason?: string,
    customQuery?: string,
    customStatus?: string,
  ): string {
    const key = customKey || "KTX_YOUR_API_KEY_HERE";
    const domain = customDomain || "https://your-authorized-domain.com";
    const serial = customSerial || "LIC-KTX88392-4B1C";
    const days = customDays || 90;
    const reason = customReason || "Subscription extension";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:8081";

    let path = "/api/v1/status";
    let method = "GET";
    let bodyObj: any = null;

    if (endpoint === "status") {
      path = "/api/v1/status";
      method = "GET";
    } else if (endpoint === "licenses") {
      const qParams = new URLSearchParams();
      if (customQuery) qParams.set("q", customQuery);
      if (customStatus && customStatus !== "ALL") qParams.set("status", customStatus);
      const qs = qParams.toString();
      path = `/api/v1/licenses${qs ? `?${qs}` : ""}`;
      method = "GET";
    } else if (endpoint === "single") {
      path = `/api/v1/licenses/${serial}`;
      method = "GET";
    } else if (endpoint === "extend") {
      path = `/api/v1/licenses/${serial}/extend`;
      method = "POST";
      bodyObj = {
        days,
        reason,
      };
    }

    if (lang === "curl") {
      if (method === "GET") {
        return `curl -X GET "${baseUrl}${path}" \\
  -H "X-API-Key: ${key}" \\
  -H "Origin: ${domain}"`;
      } else {
        return `curl -X POST "${baseUrl}${path}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${key}" \\
  -H "Origin: ${domain}" \\
  -d '${JSON.stringify(bodyObj, null, 2)}'`;
      }
    }

    if (lang === "typescript") {
      if (method === "GET") {
        return `// Using standard native Fetch API
async function fetchLicenseData() {
  const response = await fetch("${baseUrl}${path}", {
    method: "GET",
    headers: {
      "X-API-Key": "${key}",
      "Origin": "${domain}"
    }
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(\`API error \${response.status}: \${errorBody.error || response.statusText}\`);
  }

  const data = await response.json();
  console.log("Success:", data);
  return data;
}

fetchLicenseData().catch(console.error);`;
      } else {
        return `// POST Request with typed JSON payload
async function extendLicense() {
  const payload = ${JSON.stringify(bodyObj, null, 2)};

  const response = await fetch("${baseUrl}${path}", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "${key}",
      "Origin": "${domain}"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(\`Failed to extend: \${errorBody.error}\`);
  }

  const result = await response.json();
  console.log("License extended successfully:", result.serial, "New expiry:", result.expiresAt);
  return result;
}

extendLicense().catch(console.error);`;
      }
    }

    if (lang === "python") {
      if (method === "GET") {
        return `import requests

url = "${baseUrl}${path}"
headers = {
    "X-API-Key": "${key}",
    "Origin": "${domain}"
}

try:
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    data = response.json()
    print("Response status:", response.status_code)
    print("Received payload:", data)
except requests.exceptions.HTTPError as err:
    print(f"HTTP Error {response.status_code}: {response.text}")
except requests.exceptions.RequestException as err:
    print(f"Network error: {err}")`;
      } else {
        return `import requests

url = "${baseUrl}${path}"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "${key}",
    "Origin": "${domain}"
}

payload = ${JSON.stringify(bodyObj, null, 4)}

try:
    response = requests.post(url, json=payload, headers=headers, timeout=10)
    response.raise_for_status()
    result = response.json()
    print("License extended:", result["serial"])
    print("New expiry date:", result["expiresAt"])
except requests.exceptions.HTTPError as err:
    print(f"API Error {response.status_code}: {response.text}")`;
      }
    }

    if (lang === "csharp") {
      if (method === "GET") {
        return `using System;
using System.Net.Http;
using System.Threading.Tasks;

class Program
{
    private static readonly HttpClient client = new HttpClient();

    static async Task Main()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "${baseUrl}${path}");
        request.Headers.Add("X-API-Key", "${key}");
        request.Headers.Add("Origin", "${domain}");

        try
        {
            var response = await client.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                Console.WriteLine($"Status: {response.StatusCode}");
                Console.WriteLine(content);
            }
            else
            {
                Console.WriteLine($"Error {response.StatusCode}: {content}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Request failed: {ex.Message}");
        }
    }
}`;
      } else {
        return `using System;
using System.Text;
using System.Net.Http;
using System.Threading.Tasks;

class Program
{
    private static readonly HttpClient client = new HttpClient();

    static async Task Main()
    {
        var jsonBody = @"${JSON.stringify(bodyObj)}";
        var request = new HttpRequestMessage(HttpMethod.Post, "${baseUrl}${path}")
        {
            Content = new StringContent(jsonBody, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-API-Key", "${key}");
        request.Headers.Add("Origin", "${domain}");

        var response = await client.SendAsync(request);
        var resultJson = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"Result ({response.StatusCode}): {resultJson}");
    }
}`;
      }
    }

    if (lang === "php") {
      if (method === "GET") {
        return `<?php
$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => "${baseUrl}${path}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "X-API-Key: ${key}",
        "Origin: ${domain}"
    ],
]);

$response = curl_exec($curl);
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($httpCode === 200) {
    $data = json_decode($response, true);
    print_r($data);
} else {
    echo "API Request failed with HTTP $httpCode: $response";
}`;
      } else {
        return `<?php
$curl = curl_init();
$payload = json_encode([
    "days" => ${days},
    "reason" => "${reason}"
]);

curl_setopt_array($curl, [
    CURLOPT_URL => "${baseUrl}${path}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "X-API-Key: ${key}",
        "Origin: ${domain}"
    ],
]);

$response = curl_exec($curl);
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

echo "HTTP Code: $httpCode\\n";
echo "Response: $response\\n";`;
      }
    }

    if (lang === "go") {
      if (method === "GET") {
        return `package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	req, err := http.NewRequest("GET", "${baseUrl}${path}", nil)
	if err != nil {
		panic(err)
	}

	req.Header.Set("X-API-Key", "${key}")
	req.Header.Set("Origin", "${domain}")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("Status: %d\\nResponse: %s\\n", resp.StatusCode, string(body))
}`;
      } else {
        return `package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

func main() {
	payload := []byte(\`${JSON.stringify(bodyObj)}\`)

	req, err := http.NewRequest("POST", "${baseUrl}${path}", bytes.NewBuffer(payload))
	if err != nil {
		panic(err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "${key}")
	req.Header.Set("Origin", "${domain}")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("Status: %d\\nResponse: %s\\n", resp.StatusCode, string(body))
}`;
      }
    }

    return "";
  }

  // Interactive Live Request Runner
  async function executeSandboxRequest() {
    setSandboxExecuting(true);
    setSandboxResponse(null);
    const start = performance.now();

    try {
      let path = "/api/v1/status";
      let method = "GET";
      let body: any = null;

      if (sandboxEndpoint === "status") {
        path = "/api/v1/status";
      } else if (sandboxEndpoint === "licenses") {
        const qParams = new URLSearchParams();
        if (sandboxFilterQuery.trim()) qParams.set("q", sandboxFilterQuery.trim());
        if (sandboxFilterStatus !== "ALL") qParams.set("status", sandboxFilterStatus);
        const qs = qParams.toString();
        path = `/api/v1/licenses${qs ? `?${qs}` : ""}`;
      } else if (sandboxEndpoint === "single") {
        path = `/api/v1/licenses/${encodeURIComponent(sandboxSerial.trim())}`;
      } else if (sandboxEndpoint === "extend") {
        path = `/api/v1/licenses/${encodeURIComponent(sandboxSerial.trim())}/extend`;
        method = "POST";
        body = JSON.stringify({
          days: Number(sandboxExtendDays),
          reason: sandboxExtendReason.trim(),
        });
      }

      const headers: Record<string, string> = {
        "X-API-Key": sandboxApiKey.trim(),
      };
      if (method === "POST") {
        headers["Content-Type"] = "application/json";
      }
      if (sandboxDomain.trim()) {
        headers["Origin"] = sandboxDomain.trim();
      }

      const res = await fetch(path, {
        method,
        headers,
        body,
      });

      const durationMs = Math.round(performance.now() - start);
      let data: any;
      try {
        data = await res.json();
      } catch {
        data = { error: "Failed to parse JSON response" };
      }

      setSandboxResponse({
        status: res.status,
        statusText: res.statusText,
        data,
        durationMs,
      });
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      setSandboxResponse({
        status: 0,
        statusText: "Network/CORS Error",
        data: { error: err instanceof Error ? err.message : "Failed to execute request" },
        durationMs,
      });
    } finally {
      setSandboxExecuting(false);
    }
  }

  // Realistic Sample Responses
  const sampleStatus200 = {
    ok: true,
    keyName: "Enterprise Billing Portal Key",
    role: "READ_EXTEND",
    allowedDomains: "portal.partnercorp.com,*.partnercorp.com",
    expiresAt: "2027-10-22T00:00:00.000Z",
    remainingDays: 365,
  };

  const sampleLicenses200 = {
    total: 2,
    licenses: [
      {
        serial: "LIC-KTX94812-7F3A",
        status: "ACTIVE",
        customerOrganization: "Acme Industrial Technologies",
        customerContact: {
          name: "Sarah Jenkins",
          email: "sarah.jenkins@acmeindustrial.com",
        },
        vendor: {
          id: "cm12v...48a",
          name: "Kashtrix Deep Enclave",
          code: "KTX_CORE",
          publicId: "4a29a08e-8cf4-4b92-802c-7b4bf4349cb6",
          status: "ACTIVE",
        },
        application: {
          id: "cm12w...99z",
          name: "StreamOps Gateway Engine",
          code: "STREAMOPS_V2",
          publicId: "b810d7a4-8461-469b-980b-d5a2d67d1d29",
        },
        dealer: {
          id: "dl_9921",
          username: "premier_distributor",
          name: "Premier Cloud Solutions",
          phone: "+1-555-0199",
          email: "partners@premiercloud.com",
        },
        seats: {
          maxActivations: 5,
          activeActivations: 2,
        },
        dates: {
          validFrom: "2026-01-01T00:00:00.000Z",
          expiresAt: "2027-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T08:30:00.000Z",
          updatedAt: "2026-06-15T14:22:00.000Z",
          lastValidatedAt: "2026-10-22T05:30:00.000Z",
        },
        modules: [
          { code: "CORE", name: "Core Engine", description: "Base licensing and secure storage" },
          { code: "ADVANCED_ANALYTICS", name: "Telemetry Engine", description: "Real-time pipeline analytics" },
        ],
        entitlements: {
          maxThroughputGbps: 100,
          allowClustering: true,
        },
        activations: [
          {
            id: "act_101",
            clientId: "c-node-prod-01",
            state: "ACTIVE",
            platform: "linux",
            appVersion: "2.4.0",
            lastIp: "192.168.1.50",
            lastHeartbeatAt: "2026-10-22T05:44:10.000Z",
            isSocketOnline: true,
          },
        ],
      },
    ],
  };

  const sampleSingle200 = {
    serial: "LIC-KTX94812-7F3A",
    status: "ACTIVE",
    customerOrganization: "Acme Industrial Technologies",
    customerContact: {
      name: "Sarah Jenkins",
      email: "sarah.jenkins@acmeindustrial.com",
    },
    vendor: {
      name: "Kashtrix Deep Enclave",
      code: "KTX_CORE",
      publicId: "4a29a08e-8cf4-4b92-802c-7b4bf4349cb6",
    },
    application: {
      name: "StreamOps Gateway Engine",
      code: "STREAMOPS_V2",
      publicId: "b810d7a4-8461-469b-980b-d5a2d67d1d29",
    },
    dealer: {
      name: "Premier Cloud Solutions",
      username: "premier_distributor",
      phone: "+1-555-0199",
      email: "partners@premiercloud.com",
    },
    seats: {
      maxActivations: 5,
      activeActivations: 1,
    },
    dates: {
      validFrom: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T08:30:00.000Z",
      lastExtendedAt: "2026-06-15T14:22:00.000Z",
    },
    modules: [
      { code: "CORE", name: "Core Engine" },
      { code: "ADVANCED_ANALYTICS", name: "Telemetry Engine" },
    ],
    entitlements: {
      maxThroughputGbps: 100,
      allowClustering: true,
    },
    activations: [
      {
        clientId: "c-node-prod-01",
        state: "ACTIVE",
        platform: "linux",
        appVersion: "2.4.0",
        socketOnline: true,
        lastHeartbeatAt: "2026-10-22T05:44:10.000Z",
      },
    ],
  };

  const sampleExtend200 = {
    ok: true,
    serial: "LIC-KTX94812-7F3A",
    status: "ACTIVE",
    expiresAt: "2027-04-01T00:00:00.000Z",
    previousExpiresAt: "2027-01-01T00:00:00.000Z",
    entitlementVersion: 4,
    jwtKey: "eyJhbGciOiJFZERTQTEyOCIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJMSUMtS1RYOTQ4MTItN0YzQSIsImV4cCI6MTgwOTIwNjQwMCwiaXNzIjoia2FzaHRyaXgtZW5jbGF2ZSIsIm1vZHVsZXMiOlsiQ09SRSIsIkFEVkFOQ0VEX0FOQUxZVElDUyJdfQ.sig_ed25519_reissued_cryptographic_token...",
    message: "License successfully extended until 2027-04-01T00:00:00.000Z",
  };

  const sampleError401 = {
    error: "API key expired on 2026-10-01T00:00:00.000Z. Please request or generate a new API key.",
  };

  const sampleError403 = {
    error: "Domain not authorized. Incoming 'unknown-domain.org' is not allowed for this key. Authorized: [portal.partnercorp.com,*.partnercorp.com]",
  };

  const sampleError404 = {
    error: "License not found or access denied",
  };

  return (
    <div className="page-view-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-back">
          <button className="btn icon-btn back-btn" onClick={onBack} title="Back to API Keys Enclave">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="page-breadcrumbs">
              <span>API Key Enclave</span>
              <span className="sep">/</span>
              <span className="current">Integration Documentation</span>
            </div>
            <h2>External Licensing API (v1) Reference & Usage Enclave</h2>
          </div>
        </div>
      </div>

      {/* Hero Strip with Global Language Selector & Section Navigation */}
      <div className="api-docs-hero">
        <div className="api-docs-hero-top">
          <div className="api-docs-hero-title">
            <div className="brand-logo-sq">
              <Code2 size={24} />
            </div>
            <div>
              <h2>Complete Integration Suite & Code Samples</h2>
              <p className="helper-text">
                Authoritative REST API specifications, ready-to-run client snippets in 6 programming languages, and real-time interactive testing console.
              </p>
            </div>
          </div>

          {/* Preferred Language Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--muted)" }}>Code Format:</span>
            <div className="lang-selector-tabs">
              {languages.map((l) => (
                <button
                  key={l.id}
                  className={`lang-tab-pill ${selectedLang === l.id ? "active" : ""}`}
                  onClick={() => setSelectedLang(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Jump Anchors */}
        <div className="api-quick-nav">
          <a href="#overview" className="api-nav-pill">
            <BookOpen size={13} />
            <span>Overview & Auth</span>
          </a>
          <a href="#sandbox" className="api-nav-pill active">
            <Play size={13} />
            <span>Interactive Sandbox</span>
          </a>
          <a href="#status-endpoint" className="api-nav-pill">
            <span className="http-method-badge get" style={{ padding: "1px 5px", fontSize: "10px" }}>GET</span>
            <span>/api/v1/status</span>
          </a>
          <a href="#licenses-endpoint" className="api-nav-pill">
            <span className="http-method-badge get" style={{ padding: "1px 5px", fontSize: "10px" }}>GET</span>
            <span>/api/v1/licenses</span>
          </a>
          <a href="#single-endpoint" className="api-nav-pill">
            <span className="http-method-badge get" style={{ padding: "1px 5px", fontSize: "10px" }}>GET</span>
            <span>/api/v1/licenses/:serial</span>
          </a>
          <a href="#extend-endpoint" className="api-nav-pill">
            <span className="http-method-badge post" style={{ padding: "1px 5px", fontSize: "10px" }}>POST</span>
            <span>/api/v1/licenses/:serial/extend</span>
          </a>
          <a href="#sdk-section" className="api-nav-pill">
            <Layers size={13} />
            <span>Full Client SDKs</span>
          </a>
          <a href="#errors-section" className="api-nav-pill">
            <ShieldAlert size={13} />
            <span>Status & Error Codes</span>
          </a>
        </div>
      </div>

      {/* SECTION 1: Overview & Authentication Enclave */}
      <div id="overview" className="page-content-card">
        <div className="card-section-head">
          <ShieldCheck size={20} className="pink-icon" />
          <h3>Authentication, Headers & Zero-Trust Domain Whitelisting</h3>
        </div>

        <p className="endpoint-desc">
          Every external request to <code>/api/v1/*</code> is verified against a valid cryptographic API key.
          Keys are issued with time-based duration, granular permission scopes (<code>READ_ONLY</code> vs <code>READ_EXTEND</code> vs <code>FULL</code>),
          and strict domain whitelist constraints to protect license endpoints from unauthorized origin access.
        </p>

        <div className="api-callout-box">
          <KeyRound size={22} className="pink-icon" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Standardized Key Prefix:</strong> All authorized keys begin with the <code>KTX_</code> namespace prefix.
            Pass the key in the HTTP header <code>X-API-Key: KTX_...</code> or standard bearer format <code>Authorization: Bearer KTX_...</code>.
          </div>
        </div>

        <h4 style={{ fontSize: "13.5px", fontWeight: "700", marginTop: "12px", marginBottom: "6px" }}>
          Security Verification Architecture
        </h4>
        <table className="api-spec-table">
          <thead>
            <tr>
              <th>Security Mechanism</th>
              <th>Header / Protocol Checked</th>
              <th>Enforcement Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="param-name">API Token Check</span></td>
              <td><code>X-API-Key</code> or <code>Authorization</code></td>
              <td>Validated against database. Must be active and current timestamp &lt; <code>expiresAt</code>.</td>
            </tr>
            <tr>
              <td><span className="param-name">Domain Whitelisting</span></td>
              <td><code>Origin</code> or <code>Referer</code></td>
              <td>
                Host is matched against comma-separated domain list (e.g. <code>api.example.com, *.client.com</code>).
                If key has specific domains, requests without matching Origin/Referer return <code>403 Forbidden</code>.
              </td>
            </tr>
            <tr>
              <td><span className="param-name">Dealer Scoping</span></td>
              <td>API Key <code>dealerId</code></td>
              <td>
                If an API key is bound to a specific dealer or franchise partner, license queries and extensions are strictly restricted
                to licenses assigned to that dealer. Unauthorized serials return <code>404 Not Found</code>.
              </td>
            </tr>
            <tr>
              <td><span className="param-name">Permission RBAC</span></td>
              <td>API Key <code>role</code></td>
              <td>
                <code>READ_ONLY</code> allows querying status and licenses.
                <code>READ_EXTEND</code> or <code>FULL</code> is required to extend validity or trigger re-issuance.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SECTION 2: Interactive Sandbox & Live Code Generator */}
      <div id="sandbox" className="page-content-card">
        <div className="card-section-head">
          <Zap size={20} className="pink-icon" />
          <div style={{ flex: 1 }}>
            <h3>Interactive Request Builder & Live API Sandbox</h3>
            <p className="helper-text">
              Customize parameters to generate copy-pasteable snippets in any language, or execute live requests directly against your server.
            </p>
          </div>
        </div>

        <div className="sandbox-grid-inputs">
          <div className="sandbox-field">
            <label>Target Endpoint</label>
            <select
              value={sandboxEndpoint}
              onChange={(e) => setSandboxEndpoint(e.target.value as any)}
            >
              <option value="status">GET /api/v1/status (API Key Health & Validity)</option>
              <option value="licenses">GET /api/v1/licenses (Review / Query All Licenses)</option>
              <option value="single">GET /api/v1/licenses/:serial (Inspect Specific Serial)</option>
              <option value="extend">POST /api/v1/licenses/:serial/extend (Extend Expiration)</option>
            </select>
          </div>

          <div className="sandbox-field">
            <label>API Key (KTX_ Standard)</label>
            {activeKeys.length > 0 ? (
              <select
                value={sandboxApiKey}
                onChange={(e) => setSandboxApiKey(e.target.value)}
              >
                {activeKeys.map((k) => (
                  <option key={k.id} value={k.key}>
                    {k.name} ({k.role}) — {k.key.slice(0, 14)}…
                  </option>
                ))}
                <option value="KTX_CUSTOM_TEST_KEY">Custom test key…</option>
              </select>
            ) : (
              <input
                value={sandboxApiKey}
                onChange={(e) => setSandboxApiKey(e.target.value)}
                placeholder="KTX_..."
                className="mono"
              />
            )}
          </div>

          <div className="sandbox-field">
            <label>Origin / Authorized Domain</label>
            <input
              value={sandboxDomain}
              onChange={(e) => setSandboxDomain(e.target.value)}
              placeholder="https://your-app.com"
              className="mono"
            />
          </div>

          {(sandboxEndpoint === "single" || sandboxEndpoint === "extend") && (
            <div className="sandbox-field">
              <label>Target License Serial</label>
              {licenses.length > 0 ? (
                <select
                  value={sandboxSerial}
                  onChange={(e) => setSandboxSerial(e.target.value)}
                >
                  {licenses.map((l) => (
                    <option key={l.id} value={l.serial}>
                      {l.serial} ({l.customerRef || l.customerTenant || "General"})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={sandboxSerial}
                  onChange={(e) => setSandboxSerial(e.target.value)}
                  placeholder="LIC-..."
                  className="mono"
                />
              )}
            </div>
          )}

          {sandboxEndpoint === "licenses" && (
            <>
              <div className="sandbox-field">
                <label>Filter by Status</label>
                <select
                  value={sandboxFilterStatus}
                  onChange={(e) => setSandboxFilterStatus(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE only</option>
                  <option value="EXPIRED">EXPIRED only</option>
                  <option value="SUSPENDED">SUSPENDED only</option>
                  <option value="REVOKED">REVOKED only</option>
                </select>
              </div>
              <div className="sandbox-field">
                <label>Search Query (q)</label>
                <input
                  value={sandboxFilterQuery}
                  onChange={(e) => setSandboxFilterQuery(e.target.value)}
                  placeholder="Search serial, customer, or app name…"
                />
              </div>
            </>
          )}

          {sandboxEndpoint === "extend" && (
            <>
              <div className="sandbox-field">
                <label>Days to Add</label>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={sandboxExtendDays}
                  onChange={(e) => setSandboxExtendDays(Number(e.target.value))}
                />
              </div>
              <div className="sandbox-field">
                <label>Audit Reason</label>
                <input
                  value={sandboxExtendReason}
                  onChange={(e) => setSandboxExtendReason(e.target.value)}
                  placeholder="Reason for extension..."
                />
              </div>
            </>
          )}
        </div>

        {/* Generated Snippet for Current Configuration */}
        <div className="code-block-wrap" style={{ marginTop: "16px" }}>
          <div className="code-head">
            <div className="code-head-left">
              <span style={{ fontWeight: "700" }}>Live Generated Snippet ({languages.find(l => l.id === selectedLang)?.label})</span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className={`copy-code-btn ${copiedSnippet === "sandbox" ? "copied" : ""}`}
                onClick={() =>
                  copyCode(
                    generateSnippet(
                      selectedLang,
                      sandboxEndpoint,
                      sandboxApiKey,
                      sandboxDomain,
                      sandboxSerial,
                      sandboxExtendDays,
                      sandboxExtendReason,
                      sandboxFilterQuery,
                      sandboxFilterStatus
                    ),
                    "sandbox"
                  )
                }
              >
                {copiedSnippet === "sandbox" ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedSnippet === "sandbox" ? "Copied" : "Copy Code"}</span>
              </button>
            </div>
          </div>
          <pre className="code-pre-box">
            {generateSnippet(
              selectedLang,
              sandboxEndpoint,
              sandboxApiKey,
              sandboxDomain,
              sandboxSerial,
              sandboxExtendDays,
              sandboxExtendReason,
              sandboxFilterQuery,
              sandboxFilterStatus
            )}
          </pre>
        </div>

        {/* Sandbox Action Row */}
        <div className="sandbox-action-row">
          <button
            className="btn primary glow-btn"
            onClick={executeSandboxRequest}
            disabled={sandboxExecuting}
          >
            {sandboxExecuting ? (
              <RefreshCw size={15} className="spin" />
            ) : (
              <Play size={15} />
            )}
            <span>{sandboxExecuting ? "Dispatching API Request…" : "Send Test Request Now"}</span>
          </button>
          <span className="helper-text">
            Executes against your active server environment using your configured key and parameters.
          </span>
        </div>

        {/* Live Output Box */}
        {sandboxResponse && (
          <div className="sandbox-output-wrap">
            <div className="sandbox-output-head">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  className={`response-status-badge ${
                    sandboxResponse.status >= 200 && sandboxResponse.status < 300
                      ? "status-200"
                      : sandboxResponse.status === 401 || sandboxResponse.status === 403
                      ? "status-401"
                      : "status-404"
                  }`}
                >
                  HTTP {sandboxResponse.status} {sandboxResponse.statusText}
                </span>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Latency: {sandboxResponse.durationMs}ms
                </span>
              </div>
              <button
                className="copy-code-btn"
                onClick={() =>
                  copyCode(JSON.stringify(sandboxResponse.data, null, 2), "sandbox-res")
                }
              >
                {copiedSnippet === "sandbox-res" ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedSnippet === "sandbox-res" ? "Copied" : "Copy Response"}</span>
              </button>
            </div>
            <pre className="sandbox-output-pre">
              {JSON.stringify(sandboxResponse.data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* SECTION 3: Endpoint 1 - GET /api/v1/status */}
      <div id="status-endpoint" className="page-content-card">
        <div className="endpoint-header-strip">
          <span className="http-method-badge get">GET</span>
          <span className="mono endpoint-path">/api/v1/status</span>
          <span className="endpoint-summary">Check API Key health, permissions, allowed domains, and expiration</span>
        </div>

        <p className="endpoint-desc">
          Validates that your API key is authentic, active, and not expired. Returns the friendly name, RBAC role,
          authorized domain whitelist, and count of remaining validity days. Useful as a health probe or setup verification in client applications.
        </p>

        <h4 style={{ fontSize: "13px", fontWeight: "700", marginTop: "8px" }}>Required Headers</h4>
        <table className="api-spec-table">
          <thead>
            <tr>
              <th>Header</th>
              <th>Type</th>
              <th>Requirement</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="param-name">X-API-Key</span></td>
              <td><span className="param-type-badge">string</span></td>
              <td><span className="param-req-badge required">Required</span></td>
              <td>Your active cryptographic token starting with <code>KTX_</code>.</td>
            </tr>
            <tr>
              <td><span className="param-name">Origin</span></td>
              <td><span className="param-type-badge">string</span></td>
              <td><span className="param-req-badge optional">Optional</span></td>
              <td>Required if the API key restricts domains. Must match your whitelisted domain pattern.</td>
            </tr>
          </tbody>
        </table>

        {/* Code Snippet in Selected Language */}
        <div className="code-block-wrap" style={{ marginTop: "14px" }}>
          <div className="code-head">
            <div className="code-head-left">
              <span>Code Example ({languages.find(l => l.id === selectedLang)?.label})</span>
            </div>
            <button
              className={`copy-code-btn ${copiedSnippet === "ep-status" ? "copied" : ""}`}
              onClick={() => copyCode(generateSnippet(selectedLang, "status"), "ep-status")}
            >
              {copiedSnippet === "ep-status" ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedSnippet === "ep-status" ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="code-pre-box">{generateSnippet(selectedLang, "status")}</pre>
        </div>

        {/* Response Example */}
        <div className="response-card-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="response-status-badge status-200">200 OK</span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Successful verification response</span>
          </div>
          <div className="code-block-wrap">
            <pre className="code-pre-box">{JSON.stringify(sampleStatus200, null, 2)}</pre>
          </div>
        </div>
      </div>

      {/* SECTION 4: Endpoint 2 - GET /api/v1/licenses */}
      <div id="licenses-endpoint" className="page-content-card">
        <div className="endpoint-header-strip">
          <span className="http-method-badge get">GET</span>
          <span className="mono endpoint-path">/api/v1/licenses</span>
          <span className="endpoint-summary">Review all license details, seat telemetry & customer data</span>
        </div>

        <p className="endpoint-desc">
          Returns a comprehensive list of customer licenses matching your query criteria.
          Includes vendor specifications, application codes, dealer assignments, certified modules,
          seat allocations (max activations vs currently active), dates, entitlements, and live client connection status.
        </p>

        <h4 style={{ fontSize: "13px", fontWeight: "700", marginTop: "8px" }}>Query Parameters</h4>
        <table className="api-spec-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Type</th>
              <th>Requirement</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="param-name">q</span></td>
              <td><span className="param-type-badge">string</span></td>
              <td><span className="param-req-badge optional">Optional</span></td>
              <td>Full-text filter searching license serial, customer reference, vendor name, or product name.</td>
            </tr>
            <tr>
              <td><span className="param-name">status</span></td>
              <td><span className="param-type-badge">enum</span></td>
              <td><span className="param-req-badge optional">Optional</span></td>
              <td>Filter by status: <code>ACTIVE</code>, <code>SUSPENDED</code>, <code>REVOKED</code>, or <code>EXPIRED</code>.</td>
            </tr>
            <tr>
              <td><span className="param-name">application</span></td>
              <td><span className="param-type-badge">string</span></td>
              <td><span className="param-req-badge optional">Optional</span></td>
              <td>Filter by product code (e.g. <code>STREAMOPS_V2</code>), application public UUID, or product name.</td>
            </tr>
          </tbody>
        </table>

        {/* Code Snippet in Selected Language */}
        <div className="code-block-wrap" style={{ marginTop: "14px" }}>
          <div className="code-head">
            <div className="code-head-left">
              <span>Code Example ({languages.find(l => l.id === selectedLang)?.label})</span>
            </div>
            <button
              className={`copy-code-btn ${copiedSnippet === "ep-licenses" ? "copied" : ""}`}
              onClick={() => copyCode(generateSnippet(selectedLang, "licenses", undefined, undefined, undefined, undefined, undefined, "Acme", "ACTIVE"), "ep-licenses")}
            >
              {copiedSnippet === "ep-licenses" ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedSnippet === "ep-licenses" ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="code-pre-box">
            {generateSnippet(selectedLang, "licenses", undefined, undefined, undefined, undefined, undefined, "Acme", "ACTIVE")}
          </pre>
        </div>

        {/* Response Example */}
        <div className="response-card-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="response-status-badge status-200">200 OK</span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Complete list response with seat and activation telemetry</span>
          </div>
          <div className="code-block-wrap">
            <pre className="code-pre-box">{JSON.stringify(sampleLicenses200, null, 2)}</pre>
          </div>
        </div>
      </div>

      {/* SECTION 5: Endpoint 3 - GET /api/v1/licenses/:serial */}
      <div id="single-endpoint" className="page-content-card">
        <div className="endpoint-header-strip">
          <span className="http-method-badge get">GET</span>
          <span className="mono endpoint-path">/api/v1/licenses/:serial</span>
          <span className="endpoint-summary">Inspect specific license specification and hardware activations</span>
        </div>

        <p className="endpoint-desc">
          Returns granular details for a single target license, including certified module entitlements,
          application details, verified hardware ID activations, and whether the client is currently connected over mTLS sockets.
        </p>

        <h4 style={{ fontSize: "13px", fontWeight: "700", marginTop: "8px" }}>Path Parameters</h4>
        <table className="api-spec-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Type</th>
              <th>Requirement</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="param-name">:serial</span></td>
              <td><span className="param-type-badge">string</span></td>
              <td><span className="param-req-badge required">Required</span></td>
              <td>Unique license serial identifier (e.g. <code>LIC-KTX94812-7F3A</code>).</td>
            </tr>
          </tbody>
        </table>

        {/* Code Snippet in Selected Language */}
        <div className="code-block-wrap" style={{ marginTop: "14px" }}>
          <div className="code-head">
            <div className="code-head-left">
              <span>Code Example ({languages.find(l => l.id === selectedLang)?.label})</span>
            </div>
            <button
              className={`copy-code-btn ${copiedSnippet === "ep-single" ? "copied" : ""}`}
              onClick={() => copyCode(generateSnippet(selectedLang, "single"), "ep-single")}
            >
              {copiedSnippet === "ep-single" ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedSnippet === "ep-single" ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="code-pre-box">{generateSnippet(selectedLang, "single")}</pre>
        </div>

        {/* Response Example */}
        <div className="response-card-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="response-status-badge status-200">200 OK</span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Detailed specification payload</span>
          </div>
          <div className="code-block-wrap">
            <pre className="code-pre-box">{JSON.stringify(sampleSingle200, null, 2)}</pre>
          </div>
        </div>
      </div>

      {/* SECTION 6: Endpoint 4 - POST /api/v1/licenses/:serial/extend */}
      <div id="extend-endpoint" className="page-content-card">
        <div className="endpoint-header-strip">
          <span className="http-method-badge post">POST</span>
          <span className="mono endpoint-path">/api/v1/licenses/:serial/extend</span>
          <span className="endpoint-summary">Programmatically extend license duration and deliver re-signed token</span>
        </div>

        <p className="endpoint-desc">
          Extends the expiration date of an active or expired license. Keeps all hardware activations and module entitlements intact.
          The engine automatically signs a brand-new cryptographic Ed25519 token, increments <code>entitlementVersion</code>,
          records the audit trail entry, and pushes <code>LICENSE_KEY_REISSUED</code> directly across active mTLS connections to live client software.
        </p>

        <div className="api-callout-box">
          <Zap size={22} className="pink-icon" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Zero Downtime Live Push:</strong> Connected client software does not need to be restarted.
            The socket daemon intercepts the extension and hot-swaps the runtime license token in memory instantly!
          </div>
        </div>

        <h4 style={{ fontSize: "13px", fontWeight: "700", marginTop: "12px" }}>Request Body Fields (JSON)</h4>
        <table className="api-spec-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Requirement</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="param-name">days</span></td>
              <td><span className="param-type-badge">integer</span></td>
              <td><span className="param-req-badge optional">Conditional</span></td>
              <td>
                Number of days (1 to 3650) to add. If the license is still active in the future, days are appended to current expiry.
                If already expired, days are added from today. Either <code>days</code> or <code>expiresAt</code> is required.
              </td>
            </tr>
            <tr>
              <td><span className="param-name">expiresAt</span></td>
              <td><span className="param-type-badge">string (ISO 8601)</span></td>
              <td><span className="param-req-badge optional">Conditional</span></td>
              <td>Explicit future timestamp (e.g. <code>2027-12-31T23:59:59.000Z</code>).</td>
            </tr>
            <tr>
              <td><span className="param-name">reason</span></td>
              <td><span className="param-type-badge">string</span></td>
              <td><span className="param-req-badge optional">Optional</span></td>
              <td>Audit remark explaining why the license was extended (recorded permanently in the immutable audit trail).</td>
            </tr>
            <tr>
              <td><span className="param-name">customerRef</span></td>
              <td><span className="param-type-badge">string</span></td>
              <td><span className="param-req-badge optional">Optional</span></td>
              <td>Optional update to the client organization or contract reference number.</td>
            </tr>
          </tbody>
        </table>

        {/* Code Snippet in Selected Language */}
        <div className="code-block-wrap" style={{ marginTop: "14px" }}>
          <div className="code-head">
            <div className="code-head-left">
              <span>Code Example ({languages.find(l => l.id === selectedLang)?.label})</span>
            </div>
            <button
              className={`copy-code-btn ${copiedSnippet === "ep-extend" ? "copied" : ""}`}
              onClick={() => copyCode(generateSnippet(selectedLang, "extend"), "ep-extend")}
            >
              {copiedSnippet === "ep-extend" ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedSnippet === "ep-extend" ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="code-pre-box">{generateSnippet(selectedLang, "extend")}</pre>
        </div>

        {/* Response Example */}
        <div className="response-card-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="response-status-badge status-200">200 OK</span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Successful extension payload with re-signed JWT token</span>
          </div>
          <div className="code-block-wrap">
            <pre className="code-pre-box">{JSON.stringify(sampleExtend200, null, 2)}</pre>
          </div>
        </div>
      </div>

      {/* SECTION 7: Client SDK & Real-World Implementation Guides */}
      <div id="sdk-section" className="page-content-card">
        <div className="card-section-head">
          <Layers size={20} className="pink-icon" />
          <h3>Complete Client SDK & Architecture Integration Guides</h3>
        </div>

        <p className="endpoint-desc">
          Below are complete, production-ready integration examples showing how to embed license verification into desktop applications,
          cloud services, and automated e-commerce or billing checkout flows.
        </p>

        {/* SDK Tab 1: Node.js / Electron */}
        <div style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span className="http-method-badge get" style={{ background: "rgba(107, 33, 168, 0.2)", color: "#a855f7" }}>
              Node.js & Electron
            </span>
            <strong style={{ fontSize: "14px" }}>Full Socket mTLS & Hot-Reload Client (`@license/node-sdk`)</strong>
          </div>
          <div className="code-block-wrap">
            <div className="code-head">
              <span>node-client.ts</span>
              <button
                className={`copy-code-btn ${copiedSnippet === "sdk-node" ? "copied" : ""}`}
                onClick={() =>
                  copyCode(
                    `import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { LicenseSystem, loadOrCreateScopedClientId } from '@license/node-sdk';

const TENANT_ID = process.env.LICENSE_TENANT_ID!;
const APPLICATION_ID = process.env.LICENSE_APPLICATION_ID!;
const storageDir = join(homedir(), '.my-app-storage');
const clientId = await loadOrCreateScopedClientId(storageDir, TENANT_ID, APPLICATION_ID);

const license = new LicenseSystem({
  host: process.env.LICENSE_HOST ?? 'license.mycompany.com',
  port: Number(process.env.LICENSE_PORT ?? 7443),
  tenantId: TENANT_ID,
  applicationId: APPLICATION_ID,
  clientId,
  licenseKey: process.env.LICENSE_KEY!,
  caPath: './certs/ca-cert.pem',
  certPath: './certs/client-cert.pem',
  keyPath: './certs/client-key.pem',
  publicLicenseKeyPath: './certs/license-ed25519-public.pem',
  appVersion: '2.4.0',
  platform: platform(),

  // Hot updates when extended or module toggled
  onEntitlementsChanged(snapshot) {
    console.log('Modules entitled in real-time:', snapshot.modules);
  },
  onStateChange(event, reason) {
    console.log('License state event:', event, reason ?? '');
  },
  onConnectionLost(error) {
    console.error('Online validation lost, running in grace period:', error.message);
  }
});

// Perform mTLS connection and initial validation
const entitlement = await license.connect();
console.log('Validated for application:', entitlement.applicationId);

// Guard feature execution by module code
if (license.hasModule('ADVANCED_ANALYTICS')) {
  initAnalyticsEngine();
}
license.requireModule('CORE'); // Throws exception if CORE is missing`,
                    "sdk-node"
                  )
                }
              >
                {copiedSnippet === "sdk-node" ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedSnippet === "sdk-node" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <pre className="code-pre-box">
{`import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { LicenseSystem, loadOrCreateScopedClientId } from '@license/node-sdk';

const TENANT_ID = process.env.LICENSE_TENANT_ID!;
const APPLICATION_ID = process.env.LICENSE_APPLICATION_ID!;
const storageDir = join(homedir(), '.my-app-storage');
const clientId = await loadOrCreateScopedClientId(storageDir, TENANT_ID, APPLICATION_ID);

const license = new LicenseSystem({
  host: process.env.LICENSE_HOST ?? 'license.mycompany.com',
  port: Number(process.env.LICENSE_PORT ?? 7443),
  tenantId: TENANT_ID,
  applicationId: APPLICATION_ID,
  clientId,
  licenseKey: process.env.LICENSE_KEY!,
  caPath: './certs/ca-cert.pem',
  certPath: './certs/client-cert.pem',
  keyPath: './certs/client-key.pem',
  publicLicenseKeyPath: './certs/license-ed25519-public.pem',
  appVersion: '2.4.0',
  platform: platform(),

  // Hot updates when extended or module toggled
  onEntitlementsChanged(snapshot) {
    console.log('Modules entitled in real-time:', snapshot.modules);
  },
  onStateChange(event, reason) {
    console.log('License state event:', event, reason ?? '');
  },
  onConnectionLost(error) {
    console.error('Online validation lost, running in grace period:', error.message);
  }
});

// Perform mTLS connection and initial validation
const entitlement = await license.connect();
console.log('Validated for application:', entitlement.applicationId);

// Guard feature execution by module code
if (license.hasModule('ADVANCED_ANALYTICS')) {
  initAnalyticsEngine();
}
license.requireModule('CORE'); // Throws exception if CORE is missing`}
            </pre>
          </div>
        </div>

        {/* SDK Tab 2: Python Client */}
        <div style={{ marginTop: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span className="http-method-badge get" style={{ background: "rgba(14, 165, 233, 0.2)", color: "#0284c7" }}>
              Python 3.8+
            </span>
            <strong style={{ fontSize: "14px" }}>Automated License Verification & Renewal Helper</strong>
          </div>
          <div className="code-block-wrap">
            <div className="code-head">
              <span>license_client.py</span>
              <button
                className={`copy-code-btn ${copiedSnippet === "sdk-py" ? "copied" : ""}`}
                onClick={() =>
                  copyCode(
                    `import os
import requests
from datetime import datetime

class LicenseManagerClient:
    def __init__(self, api_base="http://localhost:8081", api_key=None, origin="https://my-domain.com"):
        self.api_base = api_base
        self.api_key = api_key or os.environ.get("KTX_API_KEY")
        self.origin = origin
        self.headers = {
            "X-API-Key": self.api_key,
            "Origin": self.origin
        }

    def verify_status(self):
        resp = requests.get(f"{self.api_base}/api/v1/status", headers=self.headers, timeout=5)
        resp.raise_for_status()
        return resp.json()

    def get_license(self, serial: str):
        resp = requests.get(f"{self.api_base}/api/v1/licenses/{serial}", headers=self.headers, timeout=5)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    def extend_license(self, serial: str, days: int, reason: str = "Automated subscription renewal"):
        payload = {"days": days, "reason": reason}
        resp = requests.post(f"{self.api_base}/api/v1/licenses/{serial}/extend", json=payload, headers=self.headers, timeout=8)
        resp.raise_for_status()
        return resp.json()

# Usage Example:
if __name__ == "__main__":
    client = LicenseManagerClient(api_key="KTX_PROD_SECRET_KEY")
    lic = client.get_license("LIC-KTX94812-7F3A")
    if lic:
        print(f"Customer: {lic['customerOrganization']}, Status: {lic['status']}")
        if lic['status'] == 'EXPIRED':
            print("Extending license for 30 days...")
            extended = client.extend_license("LIC-KTX94812-7F3A", days=30)
            print("New expiry:", extended["expiresAt"])`,
                    "sdk-py"
                  )
                }
              >
                {copiedSnippet === "sdk-py" ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedSnippet === "sdk-py" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <pre className="code-pre-box">
{`import os
import requests
from datetime import datetime

class LicenseManagerClient:
    def __init__(self, api_base="http://localhost:8081", api_key=None, origin="https://my-domain.com"):
        self.api_base = api_base
        self.api_key = api_key or os.environ.get("KTX_API_KEY")
        self.origin = origin
        self.headers = {
            "X-API-Key": self.api_key,
            "Origin": self.origin
        }

    def verify_status(self):
        resp = requests.get(f"{self.api_base}/api/v1/status", headers=self.headers, timeout=5)
        resp.raise_for_status()
        return resp.json()

    def get_license(self, serial: str):
        resp = requests.get(f"{self.api_base}/api/v1/licenses/{serial}", headers=self.headers, timeout=5)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    def extend_license(self, serial: str, days: int, reason: str = "Automated subscription renewal"):
        payload = {"days": days, "reason": reason}
        resp = requests.post(f"{self.api_base}/api/v1/licenses/{serial}/extend", json=payload, headers=self.headers, timeout=8)
        resp.raise_for_status()
        return resp.json()

# Usage Example:
if __name__ == "__main__":
    client = LicenseManagerClient(api_key="KTX_PROD_SECRET_KEY")
    lic = client.get_license("LIC-KTX94812-7F3A")
    if lic:
        print(f"Customer: {lic['customerOrganization']}, Status: {lic['status']}")
        if lic['status'] == 'EXPIRED':
            print("Extending license for 30 days...")
            extended = client.extend_license("LIC-KTX94812-7F3A", days=30)
            print("New expiry:", extended["expiresAt"])`}
            </pre>
          </div>
        </div>
      </div>

      {/* SECTION 8: HTTP Status & Error Codes Matrix */}
      <div id="errors-section" className="page-content-card">
        <div className="card-section-head">
          <ShieldAlert size={20} className="pink-icon" />
          <h3>HTTP Status Codes, Error Schemas & Troubleshooting</h3>
        </div>

        <p className="endpoint-desc">
          The API returns standard RFC 7807 HTTP error response payloads with descriptive messages explaining the exact reason for any failure.
        </p>

        <table className="api-spec-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Reason</th>
              <th>Sample Error JSON</th>
              <th>Recommended Remediation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="response-status-badge status-200">200 OK</span></td>
              <td>Success</td>
              <td><code>{`{"ok": true, ...}`}</code></td>
              <td>Request processed and completed successfully.</td>
            </tr>
            <tr>
              <td><span className="response-status-badge status-401">400 Bad Request</span></td>
              <td>Validation Failure</td>
              <td><code>{`{"error": "Invalid extension parameters", "details": ...}`}</code></td>
              <td>Verify required parameters (e.g. <code>days</code> or <code>expiresAt</code>) and ensure date is in the future.</td>
            </tr>
            <tr>
              <td><span className="response-status-badge status-401">401 Unauthorized</span></td>
              <td>Missing or Expired API Key</td>
              <td><code>{JSON.stringify(sampleError401)}</code></td>
              <td>Check header spelling (<code>X-API-Key</code>). If expired, generate a new duration-based key in the console.</td>
            </tr>
            <tr>
              <td><span className="response-status-badge status-403">403 Forbidden</span></td>
              <td>Domain Mismatch or Insufficient Role</td>
              <td><code>{JSON.stringify(sampleError403)}</code></td>
              <td>
                Verify that your request Origin matches the key's allowed domains. If calling <code>/extend</code>,
                ensure key has <code>READ_EXTEND</code> or <code>FULL</code> role.
              </td>
            </tr>
            <tr>
              <td><span className="response-status-badge status-404">404 Not Found</span></td>
              <td>Serial Not Found or Scope Restricted</td>
              <td><code>{JSON.stringify(sampleError404)}</code></td>
              <td>Verify the license serial number. If using a dealer API key, confirm the license is assigned to that dealer.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
