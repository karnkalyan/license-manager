import { ArrowLeft, BookOpen, Code, Copy, KeyRound, Terminal } from "lucide-react";
import { useState } from "react";

export function ApiDocsPage({ onBack }: { onBack: () => void }) {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const reviewSnippet = `curl -X GET "http://localhost:8081/api/v1/licenses" \\
  -H "X-API-Key: KTX_YOUR_KEY_HERE" \\
  -H "Origin: https://your-authorized-domain.com"`;

  const singleSnippet = `curl -X GET "http://localhost:8081/api/v1/licenses/LIC-ABC12345-DEF" \\
  -H "X-API-Key: KTX_YOUR_KEY_HERE" \\
  -H "Origin: https://your-authorized-domain.com"`;

  const extendSnippet = `curl -X POST "http://localhost:8081/api/v1/licenses/LIC-ABC12345-DEF/extend" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: KTX_YOUR_KEY_HERE" \\
  -H "Origin: https://your-authorized-domain.com" \\
  -d '{
    "days": 90,
    "reason": "Quarterly subscription renewal"
  }'`;

  return (
    <div className="page-view-container">
      <div className="page-header">
        <div className="page-header-back">
          <button className="btn icon-btn back-btn" onClick={onBack} title="Back to API Keys">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="page-breadcrumbs">
              <span>API Key Enclave</span>
              <span className="sep">/</span>
              <span className="current">Integration Documentation</span>
            </div>
            <h2>External Licensing API (v1) Reference</h2>
          </div>
        </div>
      </div>

      <div className="page-content-card">
        <div className="card-section-head">
          <BookOpen size={18} className="pink-icon" />
          <h3>Authentication & Domain Security</h3>
        </div>
        <p>
          All requests to <code>/api/v1/*</code> require a valid, non-expired API Key starting with the standard{" "}
          <code>KTX_</code> prefix. Supply it in the <code>X-API-Key</code> header or as a Bearer token in the{" "}
          <code>Authorization</code> header.
        </p>
        <p>
          <strong>Domain Authorization:</strong> If the key was created with domain restrictions, requests must
          originate from the specified domain(s). The system validates the request <code>Origin</code> or{" "}
          <code>Referer</code> against your authorized domain whitelist.
        </p>
      </div>

      {/* Endpoint 1: Review all licenses */}
      <div className="page-content-card">
        <div className="endpoint-header-strip">
          <span className="http-method-badge get">GET</span>
          <span className="mono endpoint-path">/api/v1/licenses</span>
          <span className="endpoint-summary">Review all license details & customer information</span>
        </div>
        <p className="endpoint-desc">
          Returns a comprehensive list of licenses including complete vendor, application, customer, dealer/franchise,
          expiration date, and seat telemetry.
        </p>
        <div className="code-block-wrap">
          <div className="code-head">
            <span>cURL Example</span>
            <button className="copy-code-btn" onClick={() => copyCode(reviewSnippet, "ep1")}>
              <Copy size={13} />
              <span>{copiedSnippet === "ep1" ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="mono">{reviewSnippet}</pre>
        </div>
      </div>

      {/* Endpoint 2: Inspect specific license */}
      <div className="page-content-card">
        <div className="endpoint-header-strip">
          <span className="http-method-badge get">GET</span>
          <span className="mono endpoint-path">/api/v1/licenses/:serial</span>
          <span className="endpoint-summary">Inspect specific license specification</span>
        </div>
        <p className="endpoint-desc">
          Returns full details of the target license including verified hardware ID activations and certified module
          entitlements.
        </p>
        <div className="code-block-wrap">
          <div className="code-head">
            <span>cURL Example</span>
            <button className="copy-code-btn" onClick={() => copyCode(singleSnippet, "ep2")}>
              <Copy size={13} />
              <span>{copiedSnippet === "ep2" ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="mono">{singleSnippet}</pre>
        </div>
      </div>

      {/* Endpoint 3: Extend License Expiration */}
      <div className="page-content-card">
        <div className="endpoint-header-strip">
          <span className="http-method-badge post">POST</span>
          <span className="mono endpoint-path">/api/v1/licenses/:serial/extend</span>
          <span className="endpoint-summary">Extend license expiration date</span>
        </div>
        <p className="endpoint-desc">
          Extends the expiration date of an active or expired license. Keeps all modules, entitlements, serial, and
          hardware bindings intact, and pushes the newly re-signed token over active mTLS connections automatically.
        </p>
        <div className="code-block-wrap">
          <div className="code-head">
            <span>cURL Example</span>
            <button className="copy-code-btn" onClick={() => copyCode(extendSnippet, "ep3")}>
              <Copy size={13} />
              <span>{copiedSnippet === "ep3" ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="mono">{extendSnippet}</pre>
        </div>
      </div>
    </div>
  );
}
